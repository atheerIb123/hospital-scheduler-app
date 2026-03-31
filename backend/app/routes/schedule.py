import traceback
import calendar as calendar_mod
from datetime import datetime, timezone, date as date_type, timedelta
from flask import Blueprint, request, jsonify
from bson import ObjectId
from ..db import get_db, get_global_db, get_nursing_employees_db, get_client, ensure_nursing_dept_db
from ..scheduler.solver import generate_schedule
from .day_management import _get_weekday_scores
from ..constants import JUSTICE_PTS
from urllib.parse import unquote

schedule_bp = Blueprint("schedule", __name__)


def _serialize(doc):
    doc["id"] = str(doc.pop("_id"))
    return doc


@schedule_bp.post("/schedules/generate")
def generate():
    db = get_db()
    global_db = get_global_db()
    try:
        data = request.get_json()
        month = int(data.get("month", datetime.now().month))
        year = int(data.get("year", datetime.now().year))

        employees = list(db.employees.find())
        shift_types = [s for s in db.shift_types.find() if not s.get("skip", False)]
        rules = list(db.attribute_rules.find())

        # Load constraints and day settings for the requested month/year
        month_prefix = f"{year:04d}-{month:02d}-"
        constraints = list(
            db.constraints.find({"date": {"$regex": f"^{month_prefix}"}})
        )
        day_settings = list(
            global_db.day_settings.find({"date": {"$regex": f"^{month_prefix}"}})
        )

        if not employees:
            return jsonify(
                {
                    "status": "failed",
                    "reason": "אין עובדים מוגדרים. ייבא קובץ CSV תחילה.",
                }
            ), 400
        if not shift_types:
            return jsonify(
                {"status": "failed", "reason": "אין סוגי משמרות מוגדרים."}
            ), 400

        # ── Weekday scores from DB (configurable via day-management UI) ──────
        weekday_scores = _get_weekday_scores(global_db)

        # ── Day-type extra scores (holidays, special days) ───────────────────
        # day_type_score_map: {day_type_id_str: score}
        day_type_score_map: dict = {
            str(dt["_id"]): int(dt.get("score", 0)) for dt in global_db.day_types.find()
        }

        # day_extra_by_date: {date_str: extra_score}
        # Built from all day_settings ever recorded — used for historical justice
        # and also filtered to the current month for the solver.
        day_extra_by_date: dict = {}
        for ds in global_db.day_settings.find():
            dt_id = ds.get("day_type_id", "")
            # Per-date score override takes priority over the day-type default
            extra = (
                ds["score"]
                if ds.get("score") is not None
                else day_type_score_map.get(dt_id, 0)
            )
            day_extra_by_date[ds["date"]] = extra

        # day_extra_scores for the solver: {day_num (1-31): extra_score}
        day_extra_scores: dict = {}
        for ds in day_settings:  # already filtered to current month
            dnum = int(ds["date"].split("-")[-1])
            dt_id = ds.get("day_type_id", "")
            extra = (
                ds["score"]
                if ds.get("score") is not None
                else day_type_score_map.get(dt_id, 0)
            )
            day_extra_scores[dnum] = extra

        # ── Historical justice scores (all sources) ──────────────────────────
        # Full formula per assignment:
        #   pts = JUSTICE_PTS[desirability]
        #       + weekday_scores[weekday]          (ALL days including Fri/Sat)
        #       + day_extra_by_date[date]          (holiday / special day bonus)
        des_map: dict = {}
        for st in db.shift_types.find():
            des = int(st.get("desirability", 3))
            pts = JUSTICE_PTS.get(des, 4)
            for name in st.get("names", []):
                des_map[name] = pts

        name_to_eid = {str(e["name"]): str(e["_id"]) for e in employees}

        historical_justice: dict = {}
        latest_per_month: dict = {}
        for sched in db.schedules.find(
            {"status": "generated", "year": year, "month": {"$lt": month}},
            sort=[("generated_at", 1)],
        ):
            latest_per_month[sched.get("month")] = sched

        for sched in latest_per_month.values():
            sched_year = sched.get("year")
            sched_month = sched.get("month")
            for a in sched.get("assignments", []):
                emp_name = a.get("employee_name", "")
                eid = name_to_eid.get(emp_name)
                if not eid:
                    continue
                try:
                    a_date = date_type(sched_year, sched_month, int(a["day"]))
                except (ValueError, TypeError, KeyError):
                    continue
                pts = des_map.get(a.get("shift_name", ""), 4)
                pts += weekday_scores.get(str(a_date.weekday()), 0)  # all days
                pts += day_extra_by_date.get(a_date.isoformat(), 0)  # holidays
                historical_justice[eid] = historical_justice.get(eid, 0) + pts

        # ── Nursing-only: shift composition + special shifts ─────────────────
        mode_raw = request.headers.get("X-App-Mode", "").strip()
        mode_str = unquote(mode_raw).replace(" ", "_").replace("-", "_") if mode_raw else ""
        is_nursing = mode_str.startswith("nursing")

        shift_composition_arg   = None
        col_header_names_arg    = None
        special_shifts_arg      = None

        if is_nursing:
            # Shift composition dict: {primary_name → config}
            comp_doc = db.shift_composition.find_one({}, {"_id": 0})
            if comp_doc:
                shift_composition_arg = {
                    cfg["shift_name"]: cfg
                    for cfg in comp_doc.get("shift_configs", [])
                    if cfg.get("shift_name")
                }

            # Column header names for attribute mapping
            cfg_doc = db.config.find_one({"key": "csv_column_headers"})
            if cfg_doc:
                col_header_names_arg = cfg_doc.get("headers", [])

            # Special shift monthly configs for this month
            special_shifts_arg = list(
                db.special_shifts_monthly.find(
                    {"month": month, "year": year}, {"_id": 0}
                )
            )

        result = generate_schedule(
            employees,
            shift_types,
            rules,
            month,
            year,
            constraints,
            day_settings,
            historical_justice=historical_justice,
            weekday_scores=weekday_scores,
            day_extra_scores=day_extra_scores,
            shift_composition=shift_composition_arg,
            col_header_names=col_header_names_arg,
            special_shifts_monthly=special_shifts_arg,
        )

        doc = {
            "month": month,
            "year": year,
            "generated_at": datetime.now(timezone.utc),
            "status": result["status"],
        }
        if result["status"] == "generated":
            doc["assignments"] = result["assignments"]
            doc["summary"] = result["summary"]
        else:
            doc["reason"] = result.get("reason", "שגיאה לא ידועה")

        inserted = db.schedules.insert_one(doc)
        saved = db.schedules.find_one({"_id": inserted.inserted_id})
        saved["id"] = str(saved.pop("_id"))
        if "generated_at" in saved:
            saved["generated_at"] = saved["generated_at"].isoformat()

        status_code = 200 if result["status"] == "generated" else 422
        return jsonify(saved), status_code

    except Exception:
        traceback.print_exc()
        return jsonify(
            {"status": "failed", "reason": "שגיאת שרת פנימית. ראה לוג."}
        ), 500


def _build_nursing_weekly_outputs(assignments, all_employees, shift_types, week_days, constraints, shift_composition, cross_dept_assignments=None):
    """Build weekly_grid and employee_plan from flat assignments."""
    # Map day number → ISO date string
    day_to_iso = {d.day: d.isoformat() for d in week_days}

    # ── weekly_grid ──────────────────────────────────────────────────────────
    weekly_grid = []
    for shift in shift_types:
        name = shift["names"][0] if shift.get("names") else shift.get("id", "")
        hours = shift_composition.get(name, {}).get("hours", "")
        by_day = {d.isoformat(): [] for d in week_days}
        weekly_grid.append({"shift_name": name, "hours": hours, "by_day": by_day})

    grid_by_name = {g["shift_name"]: g for g in weekly_grid}
    for a in assignments:
        iso = day_to_iso.get(a["day"])
        g = grid_by_name.get(a["shift_name"])
        if iso and g:
            entry = {"employee_id": a["employee_id"], "employee_name": a["employee_name"]}
            # Pre-assigned employees (with explicit role_slot) go first so the
            # leader badge is correctly attributed to them in the frontend.
            if a.get("role_slot"):
                g["by_day"][iso].insert(0, entry)
            else:
                g["by_day"][iso].append(entry)

    # ── employee_plan ─────────────────────────────────────────────────────────
    week_isos = {d.isoformat() for d in week_days}

    # constraint lookup: emp_name → day_iso → {full, reason, shifts}
    c_lookup: dict = {}
    for c in constraints:
        iso = c.get("date", "")
        if iso not in week_isos:
            continue
        emp = c.get("employee_name", "")
        c_lookup.setdefault(emp, {})[iso] = {
            "full": not bool(c.get("shifts")),
            "reason": c.get("reason", ""),
        }

    # assignment lookup: emp_id → day_iso → [shift_name]
    a_lookup: dict = {}
    for a in assignments:
        iso = day_to_iso.get(a["day"])
        if iso:
            a_lookup.setdefault(a["employee_id"], {}).setdefault(iso, []).append(a["shift_name"])

    # cross-dept lookup: employee_id → day_number → {shift_name, department}
    cd_lookup: dict = {}
    if cross_dept_assignments:
        for la in cross_dept_assignments:
            eid_la = la.get("employee_id", "")
            day_la = la.get("day")
            if eid_la and day_la is not None:
                cd_lookup.setdefault(eid_la, {})[day_la] = {
                    "shift_name": la.get("shift_name", ""),
                    "department": la.get("department", ""),
                }

    employee_plan = []
    for emp in all_employees:
        eid = str(emp.get("id") or emp.get("_id", ""))
        name = emp["name"]
        days_out = {}
        for d in week_days:
            iso = d.isoformat()
            assigned = a_lookup.get(eid, {}).get(iso, [])
            constraint = c_lookup.get(name, {}).get(iso)
            cross = cd_lookup.get(eid, {}).get(d.day)
            if assigned:
                days_out[iso] = [{"type": "shift", "shift_name": s} for s in assigned]
            elif cross:
                days_out[iso] = [{"type": "cross_dept", "shift_name": cross["shift_name"], "department": cross["department"]}]
            elif constraint and constraint["full"]:
                days_out[iso] = [{"type": "constraint", "reason": constraint["reason"]}]
            else:
                days_out[iso] = [{"type": "off"}]
        employee_plan.append({
            "employee_id": eid,
            "employee_name": name,
            "home_department": emp.get("home_department", ""),
            "active": emp.get("active", True),
            "max_shifts_per_week": int(emp.get("max_shifts_per_week") or 6),
            "attributes": emp.get("attributes", []),
            "days": days_out,
        })

    employee_plan.sort(key=lambda e: (not e["active"], e["employee_name"]))
    return weekly_grid, employee_plan


@schedule_bp.post("/schedules/generate-weekly")
def generate_weekly():
    """Generate a nursing weekly schedule for a specific 7-day window."""
    db = get_db()
    global_db = get_global_db()
    try:
        data = request.get_json(force=True, silent=True) or {}
        week_start_str = data.get("week_start")
        if not week_start_str:
            return jsonify({"status": "failed", "reason": "week_start נדרש (YYYY-MM-DD)"}), 400

        try:
            week_start = date_type.fromisoformat(week_start_str)
        except ValueError:
            return jsonify({"status": "failed", "reason": "פורמט week_start לא תקין. נדרש YYYY-MM-DD"}), 400

        # Full 7-day window starting from week_start (may span two months)
        week_days = [week_start + timedelta(days=i) for i in range(7)]
        month = week_start.month
        year  = week_start.year

        # Day numbers for all 7 days — unique within any 7-day window (no month overlap)
        specific_day_nums = [d.day for d in week_days]
        # Map day-of-month → actual date for cross-month correctness in the solver
        day_to_actual_date = {d.day: d for d in week_days}

        department = data.get("department")  # optional department filter
        locked_assignments = data.get("locked_assignments", [])  # pre-assigned slots

        # Employees live in the base nursing DB (shared across all departments)
        all_employees_db = list(db.employees.find())
        if department:
            all_employees = [e for e in all_employees_db if e.get("home_department") == department]
        else:
            all_employees = all_employees_db

        # ── Load all locked pre-assignments for this week from DB ─────────────
        # Must happen before cross-dept employee inclusion below.
        nursing_db = get_nursing_employees_db()
        all_week_locked = list(nursing_db.locked_pre_assignments.find(
            {"week_start": week_start_str}, {"_id": 0}
        ))

        # If not sent from frontend, load locked assignments from DB for this dept
        if not locked_assignments and department:
            locked_assignments = [la for la in all_week_locked if la.get("department") == department]

        # Add cross-department employees who appear in locked_assignments but
        # are not in this department's employee list (e.g. a הדס nurse pre-assigned
        # to an אלון shift).  They are included with max_shifts_per_week capped to
        # exactly the number of slots locked for them so the solver cannot freely
        # schedule them beyond those pre-assigned shifts.
        if department and locked_assignments:
            dept_id_set = {str(e["_id"]) for e in all_employees}
            cross_counts: dict = {}
            for la in locked_assignments:
                eid = la.get("employee_id", "")
                if eid and eid not in dept_id_set:
                    cross_counts[eid] = cross_counts.get(eid, 0) + 1
            if cross_counts:
                for emp in all_employees_db:
                    eid = str(emp["_id"])
                    if eid in cross_counts:
                        emp_copy = dict(emp)
                        emp_copy["max_shifts_per_week"] = cross_counts[eid]
                        all_employees.append(emp_copy)

        # Each department has its own fully-provisioned DB.
        # ensure_nursing_dept_db creates it (with shift types, composition,
        # rules, column headers) if it doesn't exist yet.
        if department:
            dept_db = ensure_nursing_dept_db(department)
        else:
            dept_db = db

        shift_types = [s for s in dept_db.shift_types.find() if not s.get("skip", False)]
        rules = list(dept_db.attribute_rules.find())

        # Fetch constraints and day settings from all months covered by this week
        covered_months = set((d.year, d.month) for d in week_days)
        constraints = []
        day_settings = []
        for cy, cm in covered_months:
            prefix = f"{cy:04d}-{cm:02d}-"
            constraints += list(db.constraints.find({"date": {"$regex": f"^{prefix}"}}))
            day_settings += list(global_db.day_settings.find({"date": {"$regex": f"^{prefix}"}}))

        if not all_employees:
            return jsonify({"status": "failed", "reason": "אין עובדים מוגדרים."}), 400
        if not shift_types:
            return jsonify({"status": "failed", "reason": "אין סוגי משמרות מוגדרים."}), 400

        weekday_scores = _get_weekday_scores(global_db)

        # Day-type extra scores
        day_type_score_map = {str(dt["_id"]): int(dt.get("score", 0)) for dt in global_db.day_types.find()}
        day_extra_scores: dict = {}
        for ds in day_settings:
            dnum = int(ds["date"].split("-")[-1])
            if dnum not in specific_day_nums:
                continue
            dt_id = ds.get("day_type_id", "")
            extra = ds["score"] if ds.get("score") is not None else day_type_score_map.get(dt_id, 0)
            day_extra_scores[dnum] = extra

        # Historical justice (reuse same logic as monthly)
        des_map: dict = {}
        for st in dept_db.shift_types.find():
            pts = JUSTICE_PTS.get(int(st.get("desirability", 3)), 4)
            for n in st.get("names", []):
                des_map[n] = pts

        name_to_eid = {str(e["name"]): str(e["_id"]) for e in all_employees}
        day_extra_by_date: dict = {}
        for ds in global_db.day_settings.find():
            dt_id = ds.get("day_type_id", "")
            extra = ds["score"] if ds.get("score") is not None else day_type_score_map.get(dt_id, 0)
            day_extra_by_date[ds["date"]] = extra

        historical_justice: dict = {}
        latest_per_month: dict = {}
        for sched in dept_db.schedules.find(
            {"status": "generated", "year": year, "month": {"$lte": month}},
            sort=[("generated_at", 1)],
        ):
            latest_per_month[sched.get("month")] = sched
        for sched in latest_per_month.values():
            sy, sm = sched.get("year"), sched.get("month")
            for a in sched.get("assignments", []):
                eid = name_to_eid.get(a.get("employee_name", ""))
                if not eid:
                    continue
                try:
                    a_date = date_type(sy, sm, int(a["day"]))
                except (ValueError, TypeError, KeyError):
                    continue
                pts = des_map.get(a.get("shift_name", ""), 4)
                pts += weekday_scores.get(str(a_date.weekday()), 0)
                pts += day_extra_by_date.get(a_date.isoformat(), 0)
                historical_justice[eid] = historical_justice.get(eid, 0) + pts

        # Nursing composition + special shifts
        shift_composition_arg = None
        col_header_names_arg = None
        special_shifts_arg = None

        # Each department DB is self-contained — no fallbacks
        comp_doc = dept_db.shift_composition.find_one({}, {"_id": 0})
        if comp_doc:
            shift_composition_arg = {
                cfg["shift_name"]: cfg
                for cfg in comp_doc.get("shift_configs", [])
                if cfg.get("shift_name")
            }
        cfg_doc = dept_db.config.find_one({"key": "csv_column_headers"})
        if not cfg_doc:
            cfg_doc = db.config.find_one({"key": "csv_column_headers"})
        if cfg_doc:
            col_header_names_arg = cfg_doc.get("headers", [])
        special_shifts_arg = list(
            dept_db.special_shifts_monthly.find({"month": month, "year": year}, {"_id": 0})
        )

        # ── Locked assignments fallback ───────────────────────────────────────
        # DB load already done above. Fall back to preserving manual edits from
        # an existing generated schedule if no locked assignments found.
        if not locked_assignments:
            existing_schedule = dept_db.schedules.find_one(
                {"week_start": week_start_str, "department": department, "status": "generated"},
                sort=[("generated_at", -1)]
            )
            if existing_schedule and existing_schedule.get("assignments"):
                locked_assignments = [
                    {
                        "employee_id": a["employee_id"],
                        "shift_name": a["shift_name"],
                        "day": a["day"]
                    }
                    for a in existing_schedule["assignments"]
                    if a["day"] in specific_day_nums
                ]

        # ── Compute extra_blocked_days from cross-dept locked assignments ─────
        # If a home-dept employee is locked to ANOTHER dept's shift, block them
        # from being scheduled in their home dept on those days.
        extra_blocked_days: dict = {}
        cross_dept_assignments_for_plan = []
        if department and all_week_locked:
            dept_emp_ids = {str(e["_id"]) for e in all_employees}
            for la in all_week_locked:
                if la.get("department") != department:  # assignment to a different dept
                    eid = la.get("employee_id", "")
                    day = la.get("day")
                    if eid and day is not None and eid in dept_emp_ids:
                        extra_blocked_days.setdefault(eid, []).append(day)
                        cross_dept_assignments_for_plan.append(la)

        result = generate_schedule(
            all_employees,
            shift_types,
            rules,
            month,
            year,
            constraints,
            day_settings,
            historical_justice=historical_justice,
            weekday_scores=weekday_scores,
            day_extra_scores=day_extra_scores,
            shift_composition=shift_composition_arg,
            col_header_names=col_header_names_arg,
            special_shifts_monthly=special_shifts_arg,
            specific_days=specific_day_nums,
            force_nursing_mode=True,
            locked_assignments=locked_assignments,
            extra_blocked_days=extra_blocked_days or None,
            day_to_actual_date=day_to_actual_date if len(covered_months) > 1 else None,
        )
        if result["status"] != "generated":
            return jsonify({"status": "failed", "reason": result.get("reason", "שגיאה לא ידועה")}), 422

        # Build nursing-specific outputs
        weekly_grid, employee_plan = _build_nursing_weekly_outputs(
            assignments=result["assignments"],
            all_employees=all_employees,
            shift_types=shift_types,
            week_days=week_days,
            constraints=constraints,
            shift_composition=shift_composition_arg or {},
            cross_dept_assignments=cross_dept_assignments_for_plan or None,
        )

        doc = {
            "month": month,
            "year": year,
            "week_start": week_start_str,
            "schedule_type": "weekly",
            "department": department or "",
            "generated_at": datetime.now(timezone.utc),
            "status": "generated",
            "assignments": result["assignments"],
            "summary": result["summary"],
            "weekly_grid": weekly_grid,
            "employee_plan": employee_plan,
        }

        inserted = dept_db.schedules.insert_one(doc)
        saved = dept_db.schedules.find_one({"_id": inserted.inserted_id})
        saved["id"] = str(saved.pop("_id"))
        saved["generated_at"] = saved["generated_at"].isoformat()
        saved["warnings"] = result.get("warnings", [])

        return jsonify(saved), 200

    except Exception:
        traceback.print_exc()
        return jsonify({"status": "failed", "reason": "שגיאת שרת פנימית. ראה לוג."}), 500


@schedule_bp.get("/schedules/latest-weekly")
def get_latest_weekly():
    """Get the most recently generated weekly schedule for a given week_start."""
    db = get_db()
    week_start = request.args.get("week_start")
    department = request.args.get("department")
    query: dict = {"status": "generated", "schedule_type": "weekly"}
    if week_start:
        query["week_start"] = week_start
        if department:
            query["department"] = department
            search_db = ensure_nursing_dept_db(department)
        else:
            search_db = db
    schedule = search_db.schedules.find_one(query, sort=[("generated_at", -1)])
    if not schedule:
        return jsonify(None)
    schedule["id"] = str(schedule.pop("_id"))
    if "generated_at" in schedule:
        schedule["generated_at"] = schedule["generated_at"].isoformat()
    return jsonify(schedule)


@schedule_bp.delete("/schedules/latest-weekly")
def delete_latest_weekly():
    """Delete the most recently generated weekly schedule for a given week_start and department."""
    db = get_db()
    week_start = request.args.get("week_start")
    department = request.args.get("department")
    query: dict = {"status": "generated", "schedule_type": "weekly"}
    if week_start:
        query["week_start"] = week_start
    if department:
        query["department"] = department
        search_db = ensure_nursing_dept_db(department)
    else:
        search_db = db
    result = search_db.schedules.delete_one(query)
    if result.deleted_count > 0:
        return jsonify({"deleted": True})
    return jsonify({"deleted": False, "reason": "לא נמצא לוח זמנים למחיקה"}), 404


@schedule_bp.get("/schedules/latest")
def get_latest():
    """
    Without params: returns the most recent generated schedule.
    With ?month=X&year=Y: returns the most recent generated schedule for that month/year.
    """
    db = get_db()
    month = request.args.get("month", type=int)
    year = request.args.get("year", type=int)
    query: dict = {"status": "generated"}
    if month and year:
        query["month"] = month
        query["year"] = year
    schedule = db.schedules.find_one(query, sort=[("generated_at", -1)])
    if not schedule:
        return jsonify(None)
    schedule["id"] = str(schedule.pop("_id"))
    if "generated_at" in schedule:
        schedule["generated_at"] = schedule["generated_at"].isoformat()
    return jsonify(schedule)


@schedule_bp.route("/schedules/<schedule_id>", methods=["DELETE"])
def delete_schedule(schedule_id):
    oid = ObjectId(schedule_id)
    department = request.args.get("department", "")
    if department:
        target_db = ensure_nursing_dept_db(department)
    else:
        target_db = get_db()
    result = target_db.schedules.delete_one({"_id": oid})
    if result.deleted_count == 0:
        return jsonify({"ok": False, "error": "not found"}), 404
    return jsonify({"ok": True})


@schedule_bp.route("/schedules/<schedule_id>/assignments", methods=["PATCH"])
def update_assignments(schedule_id):
    db = get_db()
    data = request.get_json() or {}
    assignments = data.get("assignments", [])
    # Optional: frontend may pass department to locate the right nursing dept DB
    dept_hint = data.get("department", "")

    update_fields: dict = {"assignments": assignments}

    try:
        oid = ObjectId(schedule_id)
    except Exception:
        return jsonify({"error": "invalid id"}), 400

    # Locate the correct DB — check base DB first, then nursing dept DB if hinted
    target_db = db
    existing = db.schedules.find_one({"_id": oid})
    if existing is None and dept_hint:
        dept_db_candidate = ensure_nursing_dept_db(dept_hint)
        existing = dept_db_candidate.schedules.find_one({"_id": oid})
        if existing is not None:
            target_db = dept_db_candidate

    if existing is None:
        return jsonify({"error": "לא נמצא"}), 404

    if existing.get("schedule_type") == "weekly":
        week_start_str = existing.get("week_start", "")
        department = existing.get("department", "") or dept_hint
        if week_start_str:
            ws = date_type.fromisoformat(week_start_str)
            week_days = [ws + timedelta(days=i) for i in range(7)]

            dept_db = ensure_nursing_dept_db(department) if department else target_db
            shift_types = [
                s for s in dept_db.shift_types.find()
                if not s.get("skip", False)
            ]
            comp_doc = dept_db.shift_composition.find_one({}, {"_id": 0})
            shift_composition = {}
            if comp_doc:
                for sc in comp_doc.get("shift_configs", []):
                    shift_composition[sc["shift_name"]] = sc

            emp_db = get_nursing_employees_db()
            emp_query: dict = {"active": {"$ne": False}}
            if department:
                emp_query["home_department"] = department
            all_employees = []
            for e in emp_db.employees.find(emp_query):
                e["id"] = str(e.pop("_id"))
                all_employees.append(e)

            covered = set((d.year, d.month) for d in week_days)
            constraints = []
            for cy, cm in covered:
                prefix = f"{cy:04d}-{cm:02d}-"
                constraints += list(db.constraints.find({"date": {"$regex": f"^{prefix}"}}))

            weekly_grid, employee_plan = _build_nursing_weekly_outputs(
                assignments=assignments,
                all_employees=all_employees,
                shift_types=shift_types,
                week_days=week_days,
                constraints=constraints,
                shift_composition=shift_composition,
            )
            update_fields["weekly_grid"] = weekly_grid
            update_fields["employee_plan"] = employee_plan

    target_db.schedules.update_one({"_id": oid}, {"$set": update_fields})
    saved = target_db.schedules.find_one({"_id": oid})
    saved["id"] = str(saved.pop("_id"))
    if "generated_at" in saved:
        saved["generated_at"] = saved["generated_at"].isoformat()
    return jsonify(saved)


@schedule_bp.get("/justice")
def get_justice():
    db = get_db()
    global_db = get_global_db()

    # Optional date range filter
    start_date = None
    end_date = None
    start_str = request.args.get("start_date")
    end_str = request.args.get("end_date")
    if start_str:
        try:
            start_date = date_type.fromisoformat(start_str)
        except ValueError:
            pass
    if end_str:
        try:
            end_date = date_type.fromisoformat(end_str)
        except ValueError:
            pass

    # Build desirability map: shift_name → justice points
    des_map: dict = {}
    for st in db.shift_types.find():
        des = st.get("desirability", 3)
        pts = JUSTICE_PTS.get(int(des), 4)
        for name in st.get("names", []):
            des_map[name] = pts

    # For each (month, year) pair keep only the most recently generated schedule
    latest_schedules: dict = {}
    for schedule in db.schedules.find(
        {"status": "generated"}, sort=[("generated_at", 1)]
    ):
        key = (schedule.get("year"), schedule.get("month"))
        latest_schedules[key] = schedule

    # Weekday scores for non-Shabbat days → added to regular justice
    weekday_scores = _get_weekday_scores(global_db)

    # Aggregate justice scores from one schedule per month
    justice: dict = {}
    for schedule in latest_schedules.values():
        sched_year = schedule.get("year")
        sched_month = schedule.get("month")
        for a in schedule.get("assignments", []):
            try:
                a_date = date_type(sched_year, sched_month, int(a["day"]))
            except (ValueError, TypeError, KeyError):
                continue
            if start_date and a_date < start_date:
                continue
            if end_date and a_date > end_date:
                continue
            emp = a["employee_name"]
            pts = des_map.get(a["shift_name"], 4)
            justice.setdefault(emp, {"score": 0, "shifts": 0})
            justice[emp]["score"] += pts
            # Add weekday score for Sun–Thu (not Friday=4 or Saturday=5)
            wd = a_date.weekday()
            if wd not in (4, 5):
                justice[emp]["score"] += weekday_scores.get(str(wd), 0)
            justice[emp]["shifts"] += 1

    # Aggregate volunteer scores
    volunteer: dict = {}
    for vol in db.volunteers.find():
        if start_date or end_date:
            try:
                v_date = date_type(int(vol["year"]), int(vol["month"]), int(vol["day"]))
            except (ValueError, TypeError, KeyError):
                continue
            if start_date and v_date < start_date:
                continue
            if end_date and v_date > end_date:
                continue
        emp = vol["employee_name"]
        pts = des_map.get(vol["shift_name"], 4)
        volunteer.setdefault(emp, {"score": 0, "count": 0})
        volunteer[emp]["score"] += pts
        volunteer[emp]["count"] += 1

    employees = list(db.employees.find())
    result = []
    for emp in employees:
        name = emp["name"]
        j = justice.get(name, {"score": 0, "shifts": 0})
        v = volunteer.get(name, {"score": 0, "count": 0})
        result.append(
            {
                "employee_name": name,
                "employee_id": str(emp["_id"]),
                "justice_score": j["score"],
                "justice_shifts": j["shifts"],
                "volunteer_score": v["score"],
                "volunteer_count": v["count"],
            }
        )

    return jsonify(result)


@schedule_bp.get("/justice/breakdown")
def get_justice_breakdown():
    db = get_db()
    global_db = get_global_db()
    employee_name = request.args.get("employee", "")
    start_str = request.args.get("start_date")
    end_str = request.args.get("end_date")

    start_date = None
    end_date = None
    if start_str:
        try:
            start_date = date_type.fromisoformat(start_str)
        except ValueError:
            pass
    if end_str:
        try:
            end_date = date_type.fromisoformat(end_str)
        except ValueError:
            pass

    des_map: dict = {}
    des_level_map: dict = {}
    for st in db.shift_types.find():
        des = int(st.get("desirability", 3))
        pts = JUSTICE_PTS.get(des, 4)
        for name in st.get("names", []):
            des_map[name] = pts
            des_level_map[name] = des

    latest_schedules: dict = {}
    for s in db.schedules.find({"status": "generated"}, sort=[("generated_at", 1)]):
        latest_schedules[(s.get("year"), s.get("month"))] = s

    weekday_scores = _get_weekday_scores(global_db)
    HE_DAYS = {
        0: "שני",
        1: "שלישי",
        2: "רביעי",
        3: "חמישי",
        4: "שישי",
        5: "שבת",
        6: "ראשון",
    }

    rows = []
    for sched in latest_schedules.values():
        year = sched.get("year")
        month = sched.get("month")
        for a in sched.get("assignments", []):
            if a.get("employee_name") != employee_name:
                continue
            try:
                a_date = date_type(year, month, int(a["day"]))
            except Exception:
                continue
            if start_date and a_date < start_date:
                continue
            if end_date and a_date > end_date:
                continue
            shift = a.get("shift_name", "")
            des_pts = des_map.get(shift, 4)
            des_lvl = des_level_map.get(shift, 3)
            wd = a_date.weekday()
            wd_score = weekday_scores.get(str(wd), 0) if wd not in (4, 5) else 0
            rows.append(
                {
                    "date": a_date.isoformat(),
                    "day_of_week": HE_DAYS.get(wd, ""),
                    "shift_name": shift,
                    "desirability": des_lvl,
                    "desirability_points": des_pts,
                    "weekday_score": wd_score,
                    "total": des_pts + wd_score,
                }
            )

    rows.sort(key=lambda r: r["date"])
    return jsonify(
        {
            "employee": employee_name,
            "rows": rows,
            "total": sum(r["total"] for r in rows),
        }
    )


@schedule_bp.get("/justice/volunteer-breakdown")
def get_volunteer_breakdown():
    db = get_db()
    employee_name = request.args.get("employee", "")
    start_str = request.args.get("start_date")
    end_str = request.args.get("end_date")

    start_date = None
    end_date = None
    if start_str:
        try:
            start_date = date_type.fromisoformat(start_str)
        except ValueError:
            pass
    if end_str:
        try:
            end_date = date_type.fromisoformat(end_str)
        except ValueError:
            pass

    des_map: dict = {}
    des_level_map: dict = {}
    for st in db.shift_types.find():
        des = int(st.get("desirability", 3))
        pts = JUSTICE_PTS.get(des, 4)
        for name in st.get("names", []):
            des_map[name] = pts
            des_level_map[name] = des

    HE_DAYS = {
        0: "שני",
        1: "שלישי",
        2: "רביעי",
        3: "חמישי",
        4: "שישי",
        5: "שבת",
        6: "ראשון",
    }

    rows = []
    for vol in db.volunteers.find({"employee_name": employee_name}):
        try:
            v_date = date_type(int(vol["year"]), int(vol["month"]), int(vol["day"]))
        except Exception:
            continue
        if start_date and v_date < start_date:
            continue
        if end_date and v_date > end_date:
            continue
        shift = vol.get("shift_name", "")
        des_pts = des_map.get(shift, 4)
        des_lvl = des_level_map.get(shift, 3)
        wd = v_date.weekday()
        rows.append(
            {
                "date": v_date.isoformat(),
                "day_of_week": HE_DAYS.get(wd, ""),
                "shift_name": shift,
                "desirability": des_lvl,
                "desirability_points": des_pts,
                "total": des_pts,
            }
        )

    rows.sort(key=lambda r: r["date"])
    return jsonify(
        {
            "employee": employee_name,
            "rows": rows,
            "total": sum(r["total"] for r in rows),
        }
    )


@schedule_bp.get("/schedules/<schedule_id>")
def get_schedule(schedule_id):
    db = get_db()
    schedule = db.schedules.find_one({"_id": ObjectId(schedule_id)})
    if not schedule:
        return jsonify({"error": "Not found"}), 404
    schedule["id"] = str(schedule.pop("_id"))
    if "generated_at" in schedule:
        schedule["generated_at"] = schedule["generated_at"].isoformat()
    return jsonify(schedule)
