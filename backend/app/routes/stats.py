from datetime import date as date_type
from flask import Blueprint, request, jsonify
from ..db import get_db

stats_bp = Blueprint("stats", __name__)


@stats_bp.get("/stats")
def get_stats():
    db = get_db()

    start_str = request.args.get("start_date")
    end_str = request.args.get("end_date")
    start_date = date_type.fromisoformat(start_str) if start_str else None
    end_date = date_type.fromisoformat(end_str) if end_str else None

    # Only the most recent generated schedule per (year, month)
    latest_schedules: dict = {}
    for sched in db.schedules.find({"status": "generated"}, sort=[("generated_at", 1)]):
        key = (sched.get("year"), sched.get("month"))
        latest_schedules[key] = sched

    assignments = []
    shift_names_set: set = set()

    for sched in latest_schedules.values():
        year = sched.get("year")
        month = sched.get("month")
        for a in sched.get("assignments", []):
            try:
                d = date_type(year, month, int(a["day"]))
            except (ValueError, TypeError, KeyError):
                continue
            if start_date and d < start_date:
                continue
            if end_date and d > end_date:
                continue
            shift_names_set.add(a["shift_name"])
            # isoweekday(): Mon=1 … Sun=7  →  % 7 gives Sun=0, Mon=1 … Sat=6
            assignments.append({
                "employee_name": a["employee_name"],
                "shift_name": a["shift_name"],
                "date": d.isoformat(),
                "day_of_week": d.isoweekday() % 7,
            })

    role = request.args.get("role")
    emp_query = {}
    if role in ("doctor", "nursing"):
        emp_query["role"] = role
    employees = [e["name"] for e in db.employees.find(emp_query)]

    # Filter assignments to only this role's employees
    if role in ("doctor", "nursing"):
        emp_set = set(employees)
        assignments = [a for a in assignments if a["employee_name"] in emp_set]

    return jsonify({
        "assignments": assignments,
        "employees": employees,
        "shift_names": sorted(shift_names_set),
    })
