import calendar
from datetime import date
from typing import List, Dict, Any, Optional
from ortools.sat.python import cp_model
from .utils import build_eligibility_matrix
from ..constants import JUSTICE_PTS

# Penalty per consecutive-day pair in the objective.
# Kept well below the justice-range terms so the solver prefers spacing employees out,
# but will happily work consecutive days rather than leave a shift uncovered.
CONSEC_PENALTY = 30


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
) -> Dict[str, Any]:
    """
    Generate a monthly schedule using OR-Tools CP-SAT.

    Hard constraints
    ----------------
    C2  Every shift-day slot that has at least one eligible, unblocked employee
        must be filled by exactly one such employee (AddExactlyOne).
        Slots with zero eligible/unblocked employees are left empty and returned
        as warnings — the solver does NOT fail in that case.
    C3  Each employee works at most one shift per day.

    Soft constraints (penalised in objective)
    -----------------------------------------
    C4  Consecutive working days are discouraged (CONSEC_PENALTY per pair).
        The solver will avoid them when staffing allows, but will assign
        consecutive days rather than leave a shift empty.

    Objective (minimise weighted sum)
    ----------------------------------
    1.  Spread of cumulative justice scores (historical + this month).
        Each assignment (e, shift, day) contributes:
            JUSTICE_PTS[shift.desirability] + weekday_scores[weekday(day)]
        which exactly mirrors the /justice endpoint so the solver directly
        optimises the metric shown to users.  Historical scores from earlier
        months of the same year are included so year-to-date burden is balanced.
    2.  3 × spread of scoped-shift counts per eligible employee
        (distributes כונן / weekend / friday slots evenly).
    3.  CONSEC_PENALTY × number of consecutive working-day pairs (soft C4).

    Parameters
    ----------
    historical_justice  {emp_id: accumulated_justice_score from past months}
    weekday_scores      {str(weekday 0-6): bonus score}  (from DB config)
    """
    days_in_month = calendar.monthrange(year, month)[1]
    days = list(range(1, days_in_month + 1))

    # ── Day-category sets ────────────────────────────────────────────────────
    day_overrides: Dict[int, str] = {}
    if day_settings:
        for ds in day_settings:
            try:
                dnum = int(ds["date"].split("-")[-1])
                day_overrides[dnum] = ds["day_type_id"]
            except (ValueError, KeyError, IndexError):
                continue

    friday_days = {d for d in days if date(year, month, d).weekday() == 4}
    saturday_days = {d for d in days if date(year, month, d).weekday() == 5}
    weekend_days = friday_days | saturday_days
    weekday_days = set(days) - weekend_days

    def applicable_days(shift: dict) -> set:
        scope = shift.get("schedule_on")
        if not isinstance(scope, (list, tuple)):
            scope = (
                ["friday" if shift.get("friday_only") else "all"]
                if not scope
                else [scope]
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
            if "friday" in scope and d in friday_days:
                res.add(d)
            elif "weekend" in scope and d in weekend_days:
                res.add(d)
            elif "weekdays" in scope and d in weekday_days:
                res.add(d)
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

    eligibility = build_eligibility_matrix(active_employees, shift_types, rules)

    # ── Blocked days/shifts from constraints (הסתייגויות) ────────────────────
    # blocked_days:   emp_id -> set of day numbers where employee is fully off
    # blocked_shifts: emp_id -> day_number -> set of shift primary-names blocked
    blocked_days: Dict[str, set] = {emp["id"]: set() for emp in active_employees}
    blocked_shifts: Dict[str, Dict[int, set]] = {emp["id"]: {} for emp in active_employees}
    if constraints:
        name_to_id = {emp["name"]: emp["id"] for emp in active_employees}
        for c in constraints:
            date_str = c.get("date", "")
            if not date_str:
                continue
            try:
                cdate = date.fromisoformat(date_str)
            except ValueError:
                continue
            if cdate.year != year or cdate.month != month:
                continue
            eid = name_to_id.get(c.get("employee_name", ""))
            if not eid:
                continue
            shift_names = c.get("shifts") or []
            if not shift_names:
                # No specific shifts listed → full day off
                blocked_days[eid].add(cdate.day)
            else:
                # Specific shifts blocked
                if cdate.day not in blocked_shifts[eid]:
                    blocked_shifts[eid][cdate.day] = set()
                blocked_shifts[eid][cdate.day].update(shift_names)

    # ── Keep shift types with ≥1 eligible active employee ────────────────────
    schedulable = [
        shift
        for shift in shift_types
        if any(eligibility[e["id"]][shift["id"]] for e in active_employees)
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
    shift_ids = [s["id"] for s in shift_types]
    hist = historical_justice or {}
    wd_scores = weekday_scores or {}
    day_extra = day_extra_scores or {}

    # Per-(shift, day) justice weight — full formula matching historical_justice:
    #   base    = JUSTICE_PTS[desirability]   (from constants / DB-driven via shift_types)
    #   weekday = weekday_scores[weekday]     (ALL days including Fri/Sat — from DB config)
    #   holiday = day_extra_scores[day]       (special day-type bonus for holidays etc.)
    shift_des: Dict[str, int] = {
        s["id"]: JUSTICE_PTS.get(int(s.get("desirability", 3)), 4) for s in shift_types
    }

    def justice_weight(sid: str, day: int) -> int:
        wd = date(year, month, day).weekday()
        return shift_des[sid] + wd_scores.get(str(wd), 0) + day_extra.get(day, 0)

    # ── Build CP-SAT model ───────────────────────────────────────────────────
    model = cp_model.CpModel()

    # Decision variables: x[(emp_id, shift_id, day)] ∈ {0, 1}
    x: Dict = {}
    for emp in active_employees:
        eid = emp["id"]
        full_blocked = blocked_days.get(eid, set())
        shift_blocked = blocked_shifts.get(eid, {})
        for shift in shift_types:
            sid = shift["id"]
            shift_primary = shift["names"][0] if shift.get("names") else ""
            if not eligibility[eid][sid]:
                continue
            for day in applicable_days(shift):
                # Full-day constraint
                if day in full_blocked:
                    continue
                # Shift-specific constraint
                day_shift_blocked = shift_blocked.get(day, set())
                if day_shift_blocked and shift_primary in day_shift_blocked:
                    continue
                x[(eid, sid, day)] = model.NewBoolVar(f"x_{eid}_{sid}_{day}")

    # C2 – Hard coverage: exactly one employee per shift-day slot
    #   Exception: if no eligible unblocked employee exists for a slot, it is
    #   left empty and reported as a warning (the model stays feasible).
    warnings: List[Dict] = []
    for shift in shift_types:
        sid = shift["id"]
        name = shift["names"][0] if shift.get("names") else sid
        for day in applicable_days(shift):
            covering = [
                x[(e["id"], sid, day)]
                for e in active_employees
                if (e["id"], sid, day) in x
            ]
            if not covering:
                # Truly impossible to staff — report and move on
                warnings.append({"day": day, "shift_type_id": sid, "shift_name": name})
                continue
            model.AddExactlyOne(covering)

    # C3 – Each employee works at most one shift per day
    for emp in active_employees:
        eid = emp["id"]
        for day in days:
            day_vars = [x[(eid, sid, day)] for sid in shift_ids if (eid, sid, day) in x]
            if len(day_vars) > 1:
                model.Add(cp_model.LinearExpr.Sum(day_vars) <= 1)

    # ── Objective ────────────────────────────────────────────────────────────
    obj_terms: List[Any] = []
    obj_weights: List[int] = []

    # Term 1 – Justice table fairness (historical + this month, per /justice formula)
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
        terms_j: List[Any] = []
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
        eid = emp["id"]
        hist_score = hist.get(eid, 0)
        v = model.NewIntVar(hist_score, hist_score + max_pts_month, f"jt_{eid}")
        model.Add(v == emp_justice_month[eid] + hist_score)
        emp_justice_total[eid] = v

    if len(emp_justice_total) >= 2:
        max_jt = model.NewIntVar(0, max_justice, "max_jt")
        min_jt = model.NewIntVar(0, max_justice, "min_jt")
        range_jt = model.NewIntVar(0, max_justice, "range_jt")
        model.AddMaxEquality(max_jt, list(emp_justice_total.values()))
        model.AddMinEquality(min_jt, list(emp_justice_total.values()))
        model.Add(range_jt == max_jt - min_jt)
        obj_terms.append(range_jt)
        obj_weights.append(1)

    # Term 2 – Scoped-shift fairness (כונן / weekend / friday — weighted 3×)
    all_days_set = set(days)
    scoped_types = [s for s in shift_types if applicable_days(s) != all_days_set]
    for fs in scoped_types:
        fsid = fs["id"]
        app = applicable_days(fs)
        eligible_emp = [
            e for e in active_employees if any((e["id"], fsid, d) in x for d in app)
        ]
        if len(eligible_emp) < 2:
            continue
        max_app = len(app)
        emp_scoped: Dict[str, Any] = {}
        for emp in eligible_emp:
            eid = emp["id"]
            scoped_vars = [x[(eid, fsid, d)] for d in app if (eid, fsid, d) in x]
            v = model.NewIntVar(0, max_app, f"sc_{fsid}_{eid}")
            model.Add(v == cp_model.LinearExpr.Sum(scoped_vars))
            emp_scoped[eid] = v
        if len(emp_scoped) >= 2:
            max_s = model.NewIntVar(0, max_app, f"mxs_{fsid}")
            min_s = model.NewIntVar(0, max_app, f"mns_{fsid}")
            range_s = model.NewIntVar(0, max_app, f"rng_{fsid}")
            model.AddMaxEquality(max_s, list(emp_scoped.values()))
            model.AddMinEquality(min_s, list(emp_scoped.values()))
            model.Add(range_s == max_s - min_s)
            obj_terms.append(range_s)
            obj_weights.append(3)

    # Term 3 – Soft C4: penalise consecutive working days
    #   consec_violation[e,d] >= worked(e,d) + worked(e,d+1) - 1
    #   When both days are worked this forces the var ≥ 1 (violation).
    #   Minimising it means the solver spaces employees out when possible,
    #   but will assign consecutive days rather than leave a shift uncovered.
    consec_violation_vars: List[Any] = []
    for emp in active_employees:
        eid = emp["id"]
        for day in days[:-1]:
            today_vars = [
                x[(eid, sid, day)] for sid in shift_ids if (eid, sid, day) in x
            ]
            tomorrow_vars = [
                x[(eid, sid, day + 1)] for sid in shift_ids if (eid, sid, day + 1) in x
            ]
            if not today_vars or not tomorrow_vars:
                continue
            cv = model.NewBoolVar(f"cv_{eid}_{day}")
            # cv ≥ worked_today + worked_tomorrow - 1
            model.Add(
                cv
                >= cp_model.LinearExpr.Sum(today_vars)
                + cp_model.LinearExpr.Sum(tomorrow_vars)
                - 1
            )
            consec_violation_vars.append(cv)

    if consec_violation_vars:
        total_consec = model.NewIntVar(0, len(consec_violation_vars), "total_consec")
        model.Add(total_consec == cp_model.LinearExpr.Sum(consec_violation_vars))
        obj_terms.append(total_consec)
        obj_weights.append(CONSEC_PENALTY)

    if obj_terms:
        model.Minimize(cp_model.LinearExpr.WeightedSum(obj_terms, obj_weights))

    # ── Solve ────────────────────────────────────────────────────────────────
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 20.0
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
        sid = shift["id"]
        name = shift["names"][0] if shift.get("names") else sid
        for day in days:
            for emp in active_employees:
                eid = emp["id"]
                if (eid, sid, day) in x and solver.Value(x[(eid, sid, day)]) == 1:
                    assignments.append(
                        {
                            "day": day,
                            "shift_type_id": sid,
                            "shift_name": name,
                            "employee_id": eid,
                            "employee_name": emp["name"],
                        }
                    )

    # Sort warnings by day
    warnings.sort(key=lambda w: (w["day"], w["shift_name"]))

    # ── Per-employee summary ─────────────────────────────────────────────────
    summary = []
    for emp in employees:
        eid = emp["id"]
        shift_counts: Dict[str, int] = {}
        desired_count = 0
        for shift in shift_types:
            sid = shift["id"]
            name = shift["names"][0] if shift.get("names") else sid
            count = sum(
                1
                for day in days
                if (eid, sid, day) in x and solver.Value(x[(eid, sid, day)]) == 1
            )
            shift_counts[name] = count
            if shift.get("is_desired", False):
                desired_count += count
        summary.append(
            {
                "employee_id": eid,
                "employee_name": emp["name"],
                "shift_counts": shift_counts,
                "desired_shift_count": desired_count,
                "total_shifts": sum(shift_counts.values()),
            }
        )

    return {
        "status": "generated",
        "assignments": assignments,
        "summary": summary,
        "warnings": warnings,
    }
