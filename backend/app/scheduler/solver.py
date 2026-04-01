import calendar
from datetime import date
from typing import List, Dict, Any, Optional, Tuple
from ortools.sat.python import cp_model
from .utils import build_eligibility_matrix
from ..constants import JUSTICE_PTS

# ── Penalty / bonus constants ────────────────────────────────────────────────
CONSEC_PENALTY = 30        # penalty per consecutive-day pair (different days)
DOUBLE_SHIFT_PENALTY = 80  # penalty per consecutive shift pair on the SAME day
PREFER_BONUS = 3           # objective bonus for using preferred sub-attribute
UNFILLED_PENALTY = 50000   # penalty per unfilled slot in nursing exact-staffing mode
C4_EXCEED_PENALTY = 200    # penalty per excess shift above max_shifts_per_week (nursing)


# ── Time helpers ─────────────────────────────────────────────────────────────

def _parse_minutes(t: str) -> Optional[int]:
    """'HH:MM' → minutes since midnight, or None on failure."""
    try:
        h, m = t.strip().split(":")
        return int(h) * 60 + int(m)
    except Exception:
        return None


def _shifts_are_consecutive(hours_a: str, hours_b: str) -> bool:
    """
    True if the two shifts are adjacent (end of A == start of B, or vice-versa).
    E.g. "07:00-15:00" and "15:00-23:00" are consecutive.
    """
    if not hours_a or not hours_b or "-" not in hours_a or "-" not in hours_b:
        return False
    parts_a = hours_a.split("-")
    parts_b = hours_b.split("-")
    end_a   = _parse_minutes(parts_a[-1])
    start_b = _parse_minutes(parts_b[0])
    end_b   = _parse_minutes(parts_b[-1])
    start_a = _parse_minutes(parts_a[0])
    return (end_a is not None and start_b is not None and end_a == start_b) or \
           (end_b is not None and start_a is not None and end_b == start_a)


# ── Main entry point ─────────────────────────────────────────────────────────

def generate_schedule(
    employees: List[Dict[str, Any]],
    shift_types: List[Dict[str, Any]],
    rules: List[Dict[str, Any]],
    month: int,
    year: int,
    constraints: List[Dict[str, Any]] = None,
    day_settings: List[Dict[str, Any]] = None,
    historical_justice: Optional[Dict[str, int]] = None,
    weekday_scores: Optional[Dict[str, int]] = None,
    day_extra_scores: Optional[Dict[int, int]] = None,
    # ── New nursing parameters ───────────────────────────────────────────────
    shift_composition: Optional[Dict[str, Dict]] = None,
    # {primary_shift_name → {total_workers, role_slots, min_male, min_female, hours}}
    col_header_names: Optional[List[str]] = None,
    # ordered list of column-header display names → maps to col_1, col_2, …
    special_shifts_monthly: Optional[List[Dict]] = None,
    # [{shift_name, total_count, week_distribution?: [w0,w1,w2,w3]}]
    specific_days: Optional[List[int]] = None,
    force_nursing_mode: bool = False,
    locked_assignments: Optional[List[Dict]] = None,
    extra_blocked_days: Optional[Dict[str, List[int]]] = None,
    day_to_actual_date: Optional[Dict[int, Any]] = None,
    # Maps day-number → actual date object. Required when specific_days spans month boundaries.
) -> Dict[str, Any]:
    """
    Generate a monthly schedule using OR-Tools CP-SAT.

    Hard constraints
    ----------------
    C2  Every shift-day slot must be filled by total_workers employees
        (from shift_composition; defaults to 1 if not specified).
        Nursing mode: equality via slack variable — the solver fills
        exactly total_workers; shortfalls are penalised (UNFILLED_PENALTY)
        rather than making the model infeasible.
        Doctors mode: soft upper bound (<= total_workers) with FILL_BONUS
        incentive.  Understaffed slots emit a warning.
    C3  Each employee works at most 2 shifts per day.
    C4  Max shifts per week per employee (from employee.max_shifts_per_week,
        default 6).  Nursing mode: soft constraint — exceedances are penalised
        (C4_EXCEED_PENALTY) so all slots can be filled even when employees
        must work beyond their weekly limit.
    C5  Role slot minimums: for each role slot in the composition, at least
        `count` assigned employees must hold that attribute.
    C6  Gender minimums: at least min_male / min_female per shift-day.
    C7  Special-shift weekly quotas (when week_distribution is set).

    Soft constraints (penalised in objective)
    -----------------------------------------
    S1  Consecutive working days across different days (CONSEC_PENALTY).
    S2  Consecutive shift pairs on the same day (DOUBLE_SHIFT_PENALTY).
        Morning+Night are allowed; Morning+Evening or Evening+Night are heavily
        penalised but will be used if no other solution exists.
    S3  Preferred sub-attribute for role slots (PREFER_BONUS reward).

    Objective (minimise weighted sum)
    ----------------------------------
    1.  Spread of cumulative justice scores (historical + this month).
    2.  3 × spread of scoped-shift counts per eligible employee.
    3.  CONSEC_PENALTY × consecutive working-day pairs.
    4.  DOUBLE_SHIFT_PENALTY × consecutive same-day shift pairs.
    5.  -PREFER_BONUS × preferred-sub-attribute role assignments (reward).
    """
    days_in_month = calendar.monthrange(year, month)[1]
    all_days = list(range(1, days_in_month + 1))
    days = specific_days if specific_days else all_days

    # ── Composition lookup ───────────────────────────────────────────────────
    comp: Dict[str, Dict] = shift_composition or {}

    # Map column-header display names → col_N keys
    name_to_col: Dict[str, str] = {}
    if col_header_names:
        for i, h in enumerate(col_header_names):
            name_to_col[h] = f"col_{i + 1}"

    # Gender column keys (look for exact matches "גבר" / "אישה")
    male_col   = name_to_col.get("גבר")
    female_col = name_to_col.get("אישה")

    # Pre-compute attr_col on each role_slot so eligibility matrix can use it
    for shift_name, cfg in comp.items():
        for slot in cfg.get("role_slots", []):
            slot["attr_col"] = name_to_col.get(slot.get("attribute_name", ""))

    # ── Day-category sets ────────────────────────────────────────────────────
    day_overrides: Dict[int, str] = {}
    if day_settings:
        for ds in day_settings:
            try:
                dnum = int(ds["date"].split("-")[-1])
                day_overrides[dnum] = ds["day_type_id"]
            except (ValueError, KeyError, IndexError):
                continue

    def _day_date(d):
        if day_to_actual_date and d in day_to_actual_date:
            return day_to_actual_date[d]
        return date(year, month, d)

    friday_days  = {d for d in days if _day_date(d).weekday() == 4}
    saturday_days = {d for d in days if _day_date(d).weekday() == 5}
    weekend_days  = friday_days | saturday_days
    weekday_days  = set(days) - weekend_days

    def applicable_days(shift: dict) -> set:
        scope = shift.get("schedule_on")
        if not isinstance(scope, (list, tuple)):
            scope = (
                ["friday" if shift.get("friday_only") else "all"]
                if not scope else [scope]
            )
        if "all" in scope:
            return set(days)
        res = set()
        for d in days:
            override = day_overrides.get(d)
            if override:
                if override in scope:
                    res.add(d)
                continue
            if "friday"   in scope and d in friday_days:   res.add(d)
            elif "weekend" in scope and d in weekend_days:  res.add(d)
            elif "weekdays" in scope and d in weekday_days: res.add(d)
        return res

    # ── Normalise MongoDB _id → id ───────────────────────────────────────────
    for emp in employees:
        if "_id" in emp:
            emp["id"] = str(emp.pop("_id"))
    for shift in shift_types:
        if "_id" in shift:
            shift["id"] = str(shift.pop("_id"))

    # ── Active employees only ────────────────────────────────────────────────
    active_employees = [e for e in employees if e.get("active", True)]
    if not active_employees:
        return {"status": "failed", "reason": "אין עובדים פעילים. הפעל לפחות עובד אחד."}

    # Pass composition to eligibility builder for nursing mode
    eligibility = build_eligibility_matrix(
        active_employees, shift_types, rules,
        composition=comp if comp else None,
    )

    # ── Blocked days/shifts from constraints ─────────────────────────────────
    blocked_days:   Dict[str, set]            = {e["id"]: set() for e in active_employees}
    blocked_shifts: Dict[str, Dict[int, set]] = {e["id"]: {}    for e in active_employees}
    if constraints:
        name_to_id = {e["name"]: e["id"] for e in active_employees}
        for c in constraints:
            date_str = c.get("date", "")
            if not date_str:
                continue
            try:
                cdate = date.fromisoformat(date_str)
            except ValueError:
                continue
            valid_dates = set(day_to_actual_date.values()) if day_to_actual_date else None
            if valid_dates:
                if cdate not in valid_dates:
                    continue
            elif cdate.year != year or cdate.month != month:
                continue
            eid = name_to_id.get(c.get("employee_name", ""))
            if not eid:
                continue
            shift_names = c.get("shifts") or []
            if not shift_names:
                blocked_days[eid].add(cdate.day)
            else:
                blocked_shifts[eid].setdefault(cdate.day, set()).update(shift_names)

    # ── Apply extra blocked days (e.g., from cross-dept pre-assignments) ─────
    if extra_blocked_days:
        for eid, blocked in extra_blocked_days.items():
            if eid in blocked_days:
                blocked_days[eid].update(blocked)

    # ── Schedulable shift types ──────────────────────────────────────────────
    schedulable = [
        s for s in shift_types
        if any(eligibility.get(e["id"], {}).get(s["id"], False) for e in active_employees)
    ]
    if not schedulable:
        return {
            "status": "failed",
            "reason": (
                "אין סוגי משמרות עם עובדים פעילים זכאים. "
                "בדוק שהוגדרו תכונות נדרשות לכל משמרת."
            ),
        }
    shift_types = schedulable
    shift_ids   = [s["id"] for s in shift_types]

    hist      = historical_justice or {}
    wd_scores = weekday_scores or {}
    day_extra = day_extra_scores or {}

    # ── Per-(shift, day) justice weight ─────────────────────────────────────
    shift_des: Dict[str, int] = {
        s["id"]: JUSTICE_PTS.get(int(s.get("desirability", 3)), 4)
        for s in shift_types
    }

    def justice_weight(sid: str, day: int) -> int:
        wd = _day_date(day).weekday()
        return shift_des[sid] + wd_scores.get(str(wd), 0) + day_extra.get(day, 0)

    # ── Consecutive shift pairs (same-day penalty) ───────────────────────────
    # Detect from hours stored in shift_composition; fallback to empty list.
    shift_hours: Dict[str, str] = {
        s["names"][0]: comp.get(s["names"][0], {}).get("hours", "")
        for s in shift_types if s.get("names")
    }
    consecutive_sid_pairs: List[Tuple[str, str]] = []
    sid_list = [(s["id"], s["names"][0] if s.get("names") else "") for s in shift_types]
    for i, (sid_a, name_a) in enumerate(sid_list):
        for sid_b, name_b in sid_list[i + 1:]:
            if _shifts_are_consecutive(shift_hours.get(name_a, ""), shift_hours.get(name_b, "")):
                consecutive_sid_pairs.append((sid_a, sid_b))

    # ── Build CP-SAT model ───────────────────────────────────────────────────
    model = cp_model.CpModel()

    # Decision variables: x[(emp_id, shift_id, day)] ∈ {0, 1}
    x: Dict = {}
    for emp in active_employees:
        eid = emp["id"]
        full_blocked  = blocked_days.get(eid, set())
        shift_blocked = blocked_shifts.get(eid, {})
        for shift in shift_types:
            sid = shift["id"]
            shift_primary = shift["names"][0] if shift.get("names") else ""
            if not eligibility.get(eid, {}).get(sid, False):
                continue
            for day in applicable_days(shift):
                if day in full_blocked:
                    continue
                day_blocked = shift_blocked.get(day, set())
                if day_blocked and shift_primary in day_blocked:
                    continue
                x[(eid, sid, day)] = model.NewBoolVar(f"x_{eid}_{sid}_{day}")

    # ── Locked assignments (pre-assignments from UI) ──────────────────────────
    shift_name_to_id: Dict[str, str] = {}
    for st in shift_types:
        for n in st.get("names", []):
            shift_name_to_id[n] = st["id"]

    # locked_role_slot_map: (eid, sid, day) -> role_slot_name
    # Used to (a) inject the role attribute so C5 counts the locked employee,
    # and (b) carry role_slot through to assignment output.
    locked_role_slot_map: Dict[tuple, str] = {}

    if locked_assignments:
        emp_id_set = {e["id"] for e in active_employees}
        for la in locked_assignments:
            eid = la.get("employee_id", "")
            shift_name = la.get("shift_name", "")
            day = la.get("day")
            if not eid or not shift_name or day is None:
                continue
            if eid not in emp_id_set:
                continue
            sid = shift_name_to_id.get(shift_name)
            if not sid:
                continue
            # Force-create variable if it doesn't exist (bypasses eligibility)
            if (eid, sid, day) not in x:
                x[(eid, sid, day)] = model.NewBoolVar(f"x_{eid}_{sid}_{day}")
            model.Add(x[(eid, sid, day)] == 1)

            # Track role_slot for output and attribute injection
            role_slot_name = la.get("role_slot", "")
            if role_slot_name and role_slot_name != "__free__":
                locked_role_slot_map[(eid, sid, day)] = role_slot_name
                # Inject the role attribute so this employee satisfies C5
                # for that role slot (even if they're from a different dept).
                attr_col = name_to_col.get(role_slot_name)
                if attr_col:
                    for emp in active_employees:
                        if emp["id"] == eid:
                            attrs = list(emp.get("attributes", []))
                            if attr_col not in attrs:
                                attrs.append(attr_col)
                                emp["attributes"] = attrs
                            break

    # ── C2 – Coverage: fill total_workers slots per shift-day ────────────────
    # Special shifts (is_special=True) are excluded from per-day coverage;
    # their total count is capped globally via C7 instead.
    special_shift_ids = {
        s["id"] for s in shift_types if s.get("is_special")
    }
    # Build set of special shift names that already have a C7 entry
    special_with_c7 = {
        ssm.get("shift_name") for ssm in (special_shifts_monthly or [])
        if ssm.get("shift_name")
    }

    warnings: List[Dict] = []
    nursing_mode = force_nursing_mode or bool(comp)
    nursing_slack_vars: List[Any] = []  # collected here, added to objective later
    for shift in shift_types:
        sid  = shift["id"]
        name = shift["names"][0] if shift.get("names") else sid
        shift_comp_cfg = comp.get(name, {})
        total_w = max(1, int(shift_comp_cfg.get("total_workers", 1)))

        # Special shifts: apply a total-period cap instead of per-day coverage
        if sid in special_shift_ids and name not in special_with_c7:
            all_sv = [
                x[(e["id"], sid, d)]
                for e in active_employees
                for d in applicable_days(shift)
                if (e["id"], sid, d) in x
            ]
            if all_sv:
                model.Add(cp_model.LinearExpr.Sum(all_sv) <= total_w)
            continue

        for day in applicable_days(shift):
            covering = [
                x[(e["id"], sid, day)]
                for e in active_employees
                if (e["id"], sid, day) in x
            ]
            if not covering:
                warnings.append({"day": day, "shift_type_id": sid, "shift_name": name})
                continue

            if nursing_mode:
                # Nursing: exact staffing via slack variable — the solver fills
                # all slots unless C4/eligibility makes it impossible, in which
                # case it minimises the shortfall instead of going infeasible.
                actual_target = min(total_w, len(covering))
                slack = model.NewIntVar(0, actual_target, f"slk_{sid}_{day}")
                model.Add(
                    cp_model.LinearExpr.Sum(covering) + slack == actual_target
                )
                nursing_slack_vars.append(slack)
                if len(covering) < total_w:
                    for _ in range(total_w - len(covering)):
                        warnings.append({
                            "day": day, "shift_type_id": sid, "shift_name": name,
                            "issue": "understaffed",
                        })
            else:
                # Doctors: soft upper bound with fill incentive (existing behaviour)
                model.Add(cp_model.LinearExpr.Sum(covering) <= total_w)
                if len(covering) < total_w:
                    for _ in range(total_w - len(covering)):
                        warnings.append({
                            "day": day, "shift_type_id": sid, "shift_name": name,
                            "issue": "understaffed",
                        })

    # ── C5 – Role slot minimums (skip special shifts — they use global caps) ─
    # Pre-compute total demand per attribute across all non-special shifts
    # so we can skip hard enforcement when weekly capacity is insufficient.
    attr_total_demand: Dict[str, int] = {}
    attr_qualified_capacity: Dict[str, int] = {}
    for shift in shift_types:
        if shift["id"] in special_shift_ids:
            continue
        name = shift["names"][0] if shift.get("names") else shift["id"]
        for slot in comp.get(name, {}).get("role_slots", []):
            acol = name_to_col.get(slot.get("attribute_name", ""))
            if not acol:
                continue
            n_days = len(applicable_days(shift))
            attr_total_demand[acol] = attr_total_demand.get(acol, 0) + max(1, int(slot.get("count", 1))) * n_days
            if acol not in attr_qualified_capacity:
                qualified_emps = [e for e in active_employees if acol in e.get("attributes", [])]
                cap = sum(int(e.get("max_shifts_per_week") or 6) for e in qualified_emps)
                attr_qualified_capacity[acol] = cap

    for shift in shift_types:
        sid  = shift["id"]
        if sid in special_shift_ids:
            continue
        name = shift["names"][0] if shift.get("names") else sid
        role_slots = comp.get(name, {}).get("role_slots", [])
        for slot in role_slots:
            attr_col = name_to_col.get(slot.get("attribute_name", ""))
            if not attr_col:
                continue
            req_count = max(1, int(slot.get("count", 1)))
            # Skip hard enforcement when total demand for this attribute across
            # all shifts exceeds the weekly capacity of qualified employees.
            if attr_total_demand.get(attr_col, 0) > attr_qualified_capacity.get(attr_col, 0):
                continue
            for day in applicable_days(shift):
                qualified = [
                    x[(e["id"], sid, day)]
                    for e in active_employees
                    if attr_col in e.get("attributes", []) and (e["id"], sid, day) in x
                ]
                if len(qualified) > req_count:
                    model.Add(cp_model.LinearExpr.Sum(qualified) >= req_count)

    # ── C6 – Gender minimums (skip special shifts — they use global caps) ────
    for shift in shift_types:
        sid  = shift["id"]
        if sid in special_shift_ids:
            continue
        name = shift["names"][0] if shift.get("names") else sid
        cfg      = comp.get(name, {})
        min_male   = int(cfg.get("min_male", 0))
        min_female = int(cfg.get("min_female", 0))
        if not (min_male or min_female):
            continue
        for day in applicable_days(shift):
            if min_male and male_col:
                male_vars = [
                    x[(e["id"], sid, day)] for e in active_employees
                    if male_col in e.get("attributes", []) and (e["id"], sid, day) in x
                ]
                if len(male_vars) >= min_male:
                    model.Add(cp_model.LinearExpr.Sum(male_vars) >= min_male)
            if min_female and female_col:
                female_vars = [
                    x[(e["id"], sid, day)] for e in active_employees
                    if female_col in e.get("attributes", []) and (e["id"], sid, day) in x
                ]
                if len(female_vars) >= min_female:
                    model.Add(cp_model.LinearExpr.Sum(female_vars) >= min_female)

    # ── C3 – Each employee works at most 2 shifts per day ────────────────────
    for emp in active_employees:
        eid = emp["id"]
        for day in days:
            day_vars = [x[(eid, sid, day)] for sid in shift_ids if (eid, sid, day) in x]
            if len(day_vars) > 1:
                model.Add(cp_model.LinearExpr.Sum(day_vars) <= 2)

    # ── C4 – Max shifts per week per employee ────────────────────────────────
    # Nursing mode: soft constraint — filling all slots takes priority over
    # respecting max-shifts.  Overages are penalised in the objective and
    # reported as warnings so the user can manually adjust.
    # Doctors mode: hard constraint (unchanged).
    nursing_c4_slack_vars: List[Any] = []
    emp_max_wpw: Dict[str, int] = {}
    for emp in active_employees:
        eid     = emp["id"]
        max_wpw = int(emp.get("max_shifts_per_week") or 6)
        emp_max_wpw[eid] = max_wpw
        for week_start in range(1, days_in_month + 1, 7):
            week_day_range = list(range(week_start, min(week_start + 7, days_in_month + 1)))
            week_vars = [
                x[(eid, sid, d)]
                for sid in shift_ids
                for d   in week_day_range
                if (eid, sid, d) in x
            ]
            if not week_vars:
                continue
            if nursing_mode:
                slack = model.NewIntVar(0, len(week_vars), f"c4slk_{eid}_{week_start}")
                model.Add(
                    cp_model.LinearExpr.Sum(week_vars) <= max_wpw + slack
                )
                nursing_c4_slack_vars.append(slack)
            else:
                model.Add(cp_model.LinearExpr.Sum(week_vars) <= max_wpw)

    # ── C7 – Special-shift weekly distribution ───────────────────────────────
    if special_shifts_monthly:
        for ssm in special_shifts_monthly:
            s_name      = ssm.get("shift_name", "")
            total_count = int(ssm.get("total_count", 0))
            week_dist   = ssm.get("week_distribution") or []

            ss_shift = next(
                (s for s in shift_types if s.get("names", [None])[0] == s_name), None
            )
            if not ss_shift:
                continue
            ssid = ss_shift["id"]

            if week_dist:
                for week_idx, week_max in enumerate(week_dist):
                    w_start = week_idx * 7 + 1
                    w_days  = list(range(w_start, min(w_start + 7, days_in_month + 1)))
                    wvars   = [
                        x[(e["id"], ssid, d)]
                        for e in active_employees
                        for d in w_days
                        if (e["id"], ssid, d) in x
                    ]
                    if wvars:
                        model.Add(cp_model.LinearExpr.Sum(wvars) == week_max)
            elif total_count > 0:
                all_sv = [
                    x[(e["id"], ssid, d)]
                    for e in active_employees
                    for d in days
                    if (e["id"], ssid, d) in x
                ]
                if all_sv:
                    model.Add(cp_model.LinearExpr.Sum(all_sv) == total_count)

    # ── Objective ─────────────────────────────────────────────────────────────
    obj_terms:   List[Any] = []
    obj_weights: List[int] = []

    # Nursing slack penalties (from C2): strongly penalise unfilled slots
    for sv in nursing_slack_vars:
        obj_terms.append(sv)
        obj_weights.append(UNFILLED_PENALTY)

    # Nursing C4 slack penalties: penalise exceeding max shifts per week
    for sv in nursing_c4_slack_vars:
        obj_terms.append(sv)
        obj_weights.append(C4_EXCEED_PENALTY)

    # Term 1 – Justice spread
    max_w_per_slot = (
        max(JUSTICE_PTS.values())
        + max((v for v in wd_scores.values() if v), default=0)
        + max((v for v in day_extra.values() if v), default=0)
    )
    max_pts_month = days_in_month * len(shift_types) * max_w_per_slot + 1
    max_hist_score = max(hist.values()) if hist else 0
    max_justice = max_pts_month + max_hist_score

    emp_justice_month: Dict[str, Any] = {}
    for emp in active_employees:
        eid = emp["id"]
        terms_j:   List[Any] = []
        weights_j: List[int] = []
        for shift in shift_types:
            sid = shift["id"]
            for day in days:
                if (eid, sid, day) in x:
                    terms_j.append(x[(eid, sid, day)])
                    weights_j.append(justice_weight(sid, day))
        v = model.NewIntVar(0, max_pts_month, f"jm_{eid}")
        if terms_j:
            model.Add(v == cp_model.LinearExpr.WeightedSum(terms_j, weights_j))
        else:
            model.Add(v == 0)
        emp_justice_month[eid] = v

    emp_justice_total: Dict[str, Any] = {}
    for emp in active_employees:
        eid        = emp["id"]
        hist_score = hist.get(eid, 0)
        v = model.NewIntVar(hist_score, hist_score + max_pts_month, f"jt_{eid}")
        model.Add(v == emp_justice_month[eid] + hist_score)
        emp_justice_total[eid] = v

    if len(emp_justice_total) >= 2:
        max_jt   = model.NewIntVar(0, max_justice, "max_jt")
        min_jt   = model.NewIntVar(0, max_justice, "min_jt")
        range_jt = model.NewIntVar(0, max_justice, "range_jt")
        model.AddMaxEquality(max_jt, list(emp_justice_total.values()))
        model.AddMinEquality(min_jt, list(emp_justice_total.values()))
        model.Add(range_jt == max_jt - min_jt)
        obj_terms.append(range_jt)
        obj_weights.append(1)

    # Term 2 – Per-shift-type fairness (weighted 3×)
    # Nursing mode: fair distribution across ALL non-special shifts (incl. reserve)
    # Doctors mode: only scoped (weekend/friday) shifts (existing behaviour)
    all_days_set = set(days)
    if nursing_mode:
        fairness_types = [s for s in shift_types if s["id"] not in special_shift_ids]
    else:
        fairness_types = [s for s in shift_types if applicable_days(s) != all_days_set]
    for fs in fairness_types:
        fsid = fs["id"]
        app  = applicable_days(fs)
        eligible_emp = [
            e for e in active_employees
            if any((e["id"], fsid, d) in x for d in app)
        ]
        if len(eligible_emp) < 2:
            continue
        max_app = len(app)
        emp_scoped: Dict[str, Any] = {}
        for emp in eligible_emp:
            eid        = emp["id"]
            scoped_vars = [x[(eid, fsid, d)] for d in app if (eid, fsid, d) in x]
            v = model.NewIntVar(0, max_app, f"sc_{fsid}_{eid}")
            model.Add(v == cp_model.LinearExpr.Sum(scoped_vars))
            emp_scoped[eid] = v
        if len(emp_scoped) >= 2:
            max_s   = model.NewIntVar(0, max_app, f"mxs_{fsid}")
            min_s   = model.NewIntVar(0, max_app, f"mns_{fsid}")
            range_s = model.NewIntVar(0, max_app, f"rng_{fsid}")
            model.AddMaxEquality(max_s, list(emp_scoped.values()))
            model.AddMinEquality(min_s, list(emp_scoped.values()))
            model.Add(range_s == max_s - min_s)
            obj_terms.append(range_s)
            obj_weights.append(3)

    # Term 3 – S1: Consecutive working-day penalty (across different days)
    consec_violation_vars: List[Any] = []
    for emp in active_employees:
        eid = emp["id"]
        for day in days[:-1]:
            today_vars    = [x[(eid, sid, day)]     for sid in shift_ids if (eid, sid, day)     in x]
            tomorrow_vars = [x[(eid, sid, day + 1)] for sid in shift_ids if (eid, sid, day + 1) in x]
            if not today_vars or not tomorrow_vars:
                continue
            cv = model.NewBoolVar(f"cv_{eid}_{day}")
            model.Add(
                cv >= cp_model.LinearExpr.Sum(today_vars)
                    + cp_model.LinearExpr.Sum(tomorrow_vars)
                    - 1
            )
            consec_violation_vars.append(cv)

    if consec_violation_vars:
        total_consec = model.NewIntVar(0, len(consec_violation_vars), "total_consec")
        model.Add(total_consec == cp_model.LinearExpr.Sum(consec_violation_vars))
        obj_terms.append(total_consec)
        obj_weights.append(CONSEC_PENALTY)

    # Term 4 – S2: Consecutive same-day shift penalty
    consec_same_day_vars: List[Any] = []
    for emp in active_employees:
        eid = emp["id"]
        for sid_a, sid_b in consecutive_sid_pairs:
            for day in days:
                if (eid, sid_a, day) not in x or (eid, sid_b, day) not in x:
                    continue
                csd = model.NewBoolVar(f"csd_{eid}_{sid_a}_{sid_b}_{day}")
                model.Add(csd >= x[(eid, sid_a, day)] + x[(eid, sid_b, day)] - 1)
                consec_same_day_vars.append(csd)

    if consec_same_day_vars:
        total_csd = model.NewIntVar(0, len(consec_same_day_vars), "total_csd")
        model.Add(total_csd == cp_model.LinearExpr.Sum(consec_same_day_vars))
        obj_terms.append(total_csd)
        obj_weights.append(DOUBLE_SHIFT_PENALTY)

    # Term 5 – S3: Preferred sub-attribute reward (negative weight = bonus)
    for shift in shift_types:
        sid  = shift["id"]
        name = shift["names"][0] if shift.get("names") else sid
        for slot in comp.get(name, {}).get("role_slots", []):
            prefer    = slot.get("prefer_sub_attribute")
            attr_name = slot.get("attribute_name", "")
            if not prefer or not name_to_col:
                continue
            prefer_col = name_to_col.get(prefer)
            attr_col   = name_to_col.get(attr_name)
            if not prefer_col or not attr_col:
                continue
            for day in applicable_days(shift):
                for emp in active_employees:
                    eid   = emp["id"]
                    attrs = set(emp.get("attributes", []))
                    if prefer_col in attrs and attr_col in attrs and (eid, sid, day) in x:
                        obj_terms.append(x[(eid, sid, day)])
                        obj_weights.append(-PREFER_BONUS)

    # Term 6 – Fill bonus: reward filling regular shift slots
    # (needed when C2 uses <= instead of == due to understaffing)
    FILL_BONUS = 500  # large enough to dominate fairness terms
    for shift in shift_types:
        if shift["id"] in special_shift_ids:
            continue  # special shifts are capped, not rewarded for filling
        sid  = shift["id"]
        for day in applicable_days(shift):
            for emp in active_employees:
                eid = emp["id"]
                if (eid, sid, day) in x:
                    obj_terms.append(x[(eid, sid, day)])
                    obj_weights.append(-FILL_BONUS)

    if obj_terms:
        model.Minimize(cp_model.LinearExpr.WeightedSum(obj_terms, obj_weights))

    # ── Solve ────────────────────────────────────────────────────────────────
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 30.0
    status = solver.Solve(model)

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return {
            "status": "failed",
            "reason": (
                "הסולבר לא מצא סידור אפשרי. ודא שיש מספיק עובדים זכאים לכל סוג משמרת."
            ),
        }

    # ── Extract assignments ──────────────────────────────────────────────────
    assignments = []
    for shift in shift_types:
        sid  = shift["id"]
        name = shift["names"][0] if shift.get("names") else sid
        for day in days:
            for emp in active_employees:
                eid = emp["id"]
                if (eid, sid, day) in x and solver.Value(x[(eid, sid, day)]) == 1:
                    a = {
                        "day":           day,
                        "shift_type_id": sid,
                        "shift_name":    name,
                        "employee_id":   eid,
                        "employee_name": emp["name"],
                    }
                    role_slot = locked_role_slot_map.get((eid, sid, day))
                    if role_slot:
                        a["role_slot"] = role_slot
                    assignments.append(a)

    # ── Detect consecutive same-day violations in output ────────────────────
    name_for_sid = {s["id"]: (s["names"][0] if s.get("names") else s["id"]) for s in shift_types}
    for emp in active_employees:
        eid = emp["id"]
        for sid_a, sid_b in consecutive_sid_pairs:
            for day in days:
                if (
                    (eid, sid_a, day) in x and solver.Value(x[(eid, sid_a, day)]) == 1 and
                    (eid, sid_b, day) in x and solver.Value(x[(eid, sid_b, day)]) == 1
                ):
                    warnings.append({
                        "type":          "consecutive_same_day",
                        "day":           day,
                        "shift_type_id": sid_a,
                        "shift_name":    name_for_sid[sid_a],
                        "employee_name": emp["name"],
                        "consecutive_with": name_for_sid[sid_b],
                    })

    # ── Detect max-shifts-per-week violations (nursing soft C4) ─────────────
    if nursing_mode:
        for emp in active_employees:
            eid = emp["id"]
            max_wpw = emp_max_wpw.get(eid, 6)
            total_assigned = sum(
                1 for shift in shift_types for day in days
                if (eid, shift["id"], day) in x
                and solver.Value(x[(eid, shift["id"], day)]) == 1
            )
            if total_assigned > max_wpw:
                warnings.append({
                    "type": "max_shifts_exceeded",
                    "employee_id": eid,
                    "employee_name": emp["name"],
                    "assigned": total_assigned,
                    "max": max_wpw,
                })

    warnings.sort(key=lambda w: (w.get("day", 0), w.get("shift_name", "")))

    # ── Per-employee summary ─────────────────────────────────────────────────
    summary = []
    for emp in employees:
        eid = emp["id"]
        shift_counts:  Dict[str, int] = {}
        desired_count = 0
        for shift in shift_types:
            sid  = shift["id"]
            name = shift["names"][0] if shift.get("names") else sid
            count = sum(
                1 for day in days
                if (eid, sid, day) in x and solver.Value(x[(eid, sid, day)]) == 1
            )
            shift_counts[name] = count
            if shift.get("is_desired", False):
                desired_count += count
        summary.append({
            "employee_id":         eid,
            "employee_name":       emp["name"],
            "shift_counts":        shift_counts,
            "desired_shift_count": desired_count,
            "total_shifts":        sum(shift_counts.values()),
        })

    return {
        "status":      "generated",
        "assignments": assignments,
        "summary":     summary,
        "warnings":    warnings,
    }
