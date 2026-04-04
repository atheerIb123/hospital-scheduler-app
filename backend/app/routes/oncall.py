import calendar
from datetime import date as date_type, timedelta
from flask import Blueprint, request, jsonify
from ..db import get_global_db, get_db

oncall_bp = Blueprint("oncall", __name__)

SLOTS = ["ערב_1", "ערב_2", "לילה"]
SLOT_LABELS = {
    "ערב_1": "כוננות ערב I",
    "ערב_2": "כוננות ערב II",
    "לילה": "כוננות לילה",
}


@oncall_bp.get("/oncall/config")
def get_config():
    global_db = get_global_db()
    config = global_db.oncall_config.find_one({}, {"_id": 0})
    if not config:
        config = {"slots": {s: [] for s in SLOTS}, "start_date": None}
    return jsonify(config)


@oncall_bp.post("/oncall/config")
def save_config():
    global_db = get_global_db()
    data = request.get_json() or {}
    global_db.oncall_config.replace_one({}, data, upsert=True)
    return jsonify({"ok": True})


@oncall_bp.get("/oncall/monthly")
def get_monthly():
    """Return the full rotation table for a month with overrides + assignments."""
    global_db = get_global_db()
    year = int(request.args.get("year", date_type.today().year))
    month = int(request.args.get("month", date_type.today().month))

    days_in_month = calendar.monthrange(year, month)[1]
    all_dates = [date_type(year, month, d) for d in range(1, days_in_month + 1)]

    config = global_db.oncall_config.find_one({}, {"_id": 0}) or {}
    slot_departments = config.get("slots", {s: [] for s in SLOTS})
    start_date_str = config.get("start_date")

    # Parse start_date or default to first day of month
    if start_date_str:
        try:
            start_date = date_type.fromisoformat(start_date_str)
        except ValueError:
            start_date = date_type(year, month, 1)
    else:
        start_date = date_type(year, month, 1)

    # Load overrides: {(date_iso, slot): department}
    overrides: dict = {}
    for o in global_db.oncall_overrides.find({"year": year, "month": month}, {"_id": 0}):
        overrides[(o["date"], o["slot"])] = o.get("department", "")

    # Load assignments: {(date_iso, slot): {employee_id, employee_name, from_department}}
    assignments: dict = {}
    for a in global_db.oncall_assignments.find({"year": year, "month": month}, {"_id": 0}):
        assignments[(a["date"], a["slot"])] = {
            "employee_id": a.get("employee_id", ""),
            "employee_name": a.get("employee_name", ""),
            "from_department": a.get("from_department", ""),
        }

    result = []
    for d in all_dates:
        iso = d.isoformat()
        day_offset = (d - start_date).days

        day_data = {"date": iso, "slots": {}}
        for slot in SLOTS:
            depts = slot_departments.get(slot, [])
            dept = ""
            if depts:
                idx = day_offset % len(depts)
                if idx < 0:
                    idx += len(depts)
                dept = depts[idx]

            # Apply override if set
            if (iso, slot) in overrides:
                dept = overrides[(iso, slot)]

            day_data["slots"][slot] = {
                "department": dept,
                "assignment": assignments.get((iso, slot)),
                "is_override": (iso, slot) in overrides,
            }
        result.append(day_data)

    return jsonify(result)


@oncall_bp.post("/oncall/override")
def set_override():
    global_db = get_global_db()
    data = request.get_json() or {}
    date_str = data.get("date")
    slot = data.get("slot")
    department = data.get("department", "")
    if not date_str or not slot:
        return jsonify({"error": "date and slot required"}), 400
    d = date_type.fromisoformat(date_str)
    global_db.oncall_overrides.update_one(
        {"date": date_str, "slot": slot},
        {"$set": {"date": date_str, "slot": slot, "year": d.year, "month": d.month, "department": department}},
        upsert=True,
    )
    return jsonify({"ok": True})


@oncall_bp.delete("/oncall/override")
def delete_override():
    global_db = get_global_db()
    data = request.get_json() or {}
    date_str = data.get("date")
    slot = data.get("slot")
    global_db.oncall_overrides.delete_one({"date": date_str, "slot": slot})
    return jsonify({"ok": True})


@oncall_bp.post("/oncall/assignment")
def set_assignment():
    global_db = get_global_db()
    data = request.get_json() or {}
    date_str = data.get("date")
    slot = data.get("slot")
    if not date_str or not slot:
        return jsonify({"error": "date and slot required"}), 400
    d = date_type.fromisoformat(date_str)
    doc = {
        "date": date_str,
        "slot": slot,
        "year": d.year,
        "month": d.month,
        "employee_id": data.get("employee_id", ""),
        "employee_name": data.get("employee_name", ""),
        "from_department": data.get("from_department", ""),
    }
    global_db.oncall_assignments.update_one(
        {"date": date_str, "slot": slot},
        {"$set": doc},
        upsert=True,
    )
    return jsonify({"ok": True})


@oncall_bp.delete("/oncall/assignment")
def delete_assignment():
    global_db = get_global_db()
    data = request.get_json() or {}
    date_str = data.get("date")
    slot = data.get("slot")
    global_db.oncall_assignments.delete_one({"date": date_str, "slot": slot})
    return jsonify({"ok": True})


@oncall_bp.post("/oncall/import")
def import_oncall():
    """Bulk import overrides and/or assignments for a month."""
    global_db = get_global_db()
    data = request.get_json() or {}
    overrides = data.get("overrides", [])
    assignments = data.get("assignments", [])

    for o in overrides:
        date_str = o.get("date", "")
        slot = o.get("slot", "")
        dept = o.get("department", "")
        if not date_str or not slot or not dept:
            continue
        d = date_type.fromisoformat(date_str)
        global_db.oncall_overrides.update_one(
            {"date": date_str, "slot": slot},
            {"$set": {"date": date_str, "slot": slot, "year": d.year, "month": d.month, "department": dept}},
            upsert=True,
        )

    for a in assignments:
        date_str = a.get("date", "")
        slot = a.get("slot", "")
        if not date_str or not slot:
            continue
        d = date_type.fromisoformat(date_str)
        doc = {
            "date": date_str, "slot": slot,
            "year": d.year, "month": d.month,
            "employee_id": a.get("employee_id", ""),
            "employee_name": a.get("employee_name", ""),
            "from_department": a.get("from_department", ""),
        }
        global_db.oncall_assignments.update_one(
            {"date": date_str, "slot": slot},
            {"$set": doc},
            upsert=True,
        )

    return jsonify({"ok": True, "overrides": len(overrides), "assignments": len(assignments)})


@oncall_bp.get("/oncall/justice")
def get_justice():
    """Return a summary of on-call counts per employee, grouped by slot."""
    global_db = get_global_db()

    query: dict = {}
    start_date_str = request.args.get("start_date")
    end_date_str = request.args.get("end_date")
    if start_date_str or end_date_str:
        date_filter: dict = {}
        if start_date_str:
            date_filter["$gte"] = start_date_str
        if end_date_str:
            date_filter["$lte"] = end_date_str
        query["date"] = date_filter

    assignments = list(global_db.oncall_assignments.find(query, {"_id": 0}))

    # Aggregate counts per employee per slot
    # Key by employee_id if present, otherwise fall back to employee_name
    summary: dict = {}
    for a in assignments:
        eid = a.get("employee_id", "")
        ename = a.get("employee_name", "")
        key = eid if eid else f"__name__{ename}"
        if not key or key == "__name__":
            continue
        slot = a.get("slot", "")
        if key not in summary:
            summary[key] = {
                "employee_id": eid,
                "employee_name": ename,
                "from_department": a.get("from_department", ""),
                "slot_counts": {s: 0 for s in SLOTS},
            }
        if slot in SLOTS:
            summary[key]["slot_counts"][slot] += 1

    result = []
    for entry in summary.values():
        entry["total"] = sum(entry["slot_counts"].values())
        result.append(entry)

    result.sort(key=lambda x: x["total"], reverse=True)
    return jsonify(result)


@oncall_bp.post("/oncall/auto-generate")
def auto_generate():
    """Auto-assign oncall slots for a month, balancing by least oncall this year."""
    from ..db import get_nursing_employees_db
    global_db = get_global_db()
    data = request.get_json() or {}
    year = int(data.get("year", date_type.today().year))
    month = int(data.get("month", date_type.today().month))
    overwrite = bool(data.get("overwrite", False))

    # Get oncall config
    config = global_db.oncall_config.find_one({}, {"_id": 0}) or {}
    slot_departments = config.get("slots", {s: [] for s in SLOTS})
    required_attributes = config.get("required_attributes", [])
    start_date_str = config.get("start_date")
    if start_date_str:
        try:
            start_date = date_type.fromisoformat(start_date_str)
        except ValueError:
            start_date = date_type(year, month, 1)
    else:
        start_date = date_type(year, month, 1)

    # Get employees
    emp_db = get_nursing_employees_db()
    employees = []
    for e in emp_db.employees.find({}):
        e["id"] = str(e.pop("_id"))
        employees.append(e)

    # Filter eligible employees (have required attributes)
    # attributes is stored as a list of column keys e.g. ["col_1", "col_3"]
    def is_eligible(emp: dict) -> bool:
        if not required_attributes:
            return True
        attrs = emp.get("attributes", [])
        return all(a in attrs for a in required_attributes)

    eligible = [e for e in employees if is_eligible(e)]

    # Group eligible employees by department
    dept_employees: dict = {}
    for e in eligible:
        dept = e.get("home_department", "")
        dept_employees.setdefault(dept, []).append(e)

    # Get justice data for the full year to seed oncall counts
    year_start = f"{year}-01-01"
    year_end = f"{year}-12-31"
    past_assignments = list(global_db.oncall_assignments.find(
        {"date": {"$gte": year_start, "$lte": year_end}},
        {"_id": 0}
    ))

    oncall_counts: dict = {}  # employee_id -> total count
    for a in past_assignments:
        eid = a.get("employee_id", "")
        if eid:
            oncall_counts[eid] = oncall_counts.get(eid, 0) + 1

    # Load existing assignments for this month
    existing = set()
    for a in global_db.oncall_assignments.find({"year": year, "month": month}, {"_id": 0}):
        existing.add((a["date"], a["slot"]))

    days_in_month = calendar.monthrange(year, month)[1]
    all_dates = [date_type(year, month, d) for d in range(1, days_in_month + 1)]

    # Load overrides for the month
    overrides_map: dict = {}
    for o in global_db.oncall_overrides.find({"year": year, "month": month}, {"_id": 0}):
        overrides_map[(o["date"], o["slot"])] = o.get("department", "")

    generated = []

    for d in all_dates:
        iso = d.isoformat()
        day_offset = (d - start_date).days

        for slot in SLOTS:
            key = (iso, slot)
            if key in existing and not overwrite:
                continue

            depts = slot_departments.get(slot, [])
            if not depts:
                continue
            idx = day_offset % len(depts)
            if idx < 0:
                idx += len(depts)
            dept = depts[idx]
            # Apply override if present
            if key in overrides_map:
                dept = overrides_map[key]

            dept_emps = dept_employees.get(dept, [])
            if not dept_emps:
                continue

            # Sort by total oncall count ascending (least first)
            dept_emps_sorted = sorted(
                dept_emps,
                key=lambda e: oncall_counts.get(e.get("id", ""), 0)
            )
            chosen = dept_emps_sorted[0]
            eid = chosen.get("id", "")
            ename = chosen.get("name", "")
            edept = chosen.get("home_department", dept)

            doc = {
                "date": iso, "slot": slot,
                "year": d.year, "month": d.month,
                "employee_id": eid,
                "employee_name": ename,
                "from_department": edept,
            }
            global_db.oncall_assignments.update_one(
                {"date": iso, "slot": slot},
                {"$set": doc},
                upsert=True,
            )
            # Update running count so same person isn't picked again
            oncall_counts[eid] = oncall_counts.get(eid, 0) + 1
            generated.append({"date": iso, "slot": slot, "name": ename})

    return jsonify({"ok": True, "generated": len(generated)})


@oncall_bp.get("/oncall/week-blocks")
def get_week_blocks():
    """Return on-call assignments for a 7-day window (used by schedule generator to block employees)."""
    global_db = get_global_db()
    week_start_str = request.args.get("week_start")
    if not week_start_str:
        return jsonify([])
    week_start = date_type.fromisoformat(week_start_str)
    date_strings = [(week_start + timedelta(days=i)).isoformat() for i in range(7)]
    result = list(global_db.oncall_assignments.find({"date": {"$in": date_strings}}, {"_id": 0}))
    return jsonify(result)
