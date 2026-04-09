from datetime import date as date_type
from flask import Blueprint, request, jsonify
from ..db import get_db, get_nursing_employees_db
from ..nursing_aggregation import (
    assignment_date_in_week,
    is_nursing_request,
    latest_weekly_schedule_docs,
    nursing_department_filter_from_request,
)

stats_bp = Blueprint("stats", __name__)


@stats_bp.get("/stats")
def get_stats():
    start_str = request.args.get("start_date")
    end_str = request.args.get("end_date")
    start_date = date_type.fromisoformat(start_str) if start_str else None
    end_date = date_type.fromisoformat(end_str) if end_str else None

    assignments = []
    shift_names_set: set = set()

    if is_nursing_request():
        dept_filter = nursing_department_filter_from_request()
        for _dep, sched in latest_weekly_schedule_docs(dept_filter):
            for a in sched.get("assignments", []):
                try:
                    d = assignment_date_in_week(sched, int(a["day"]))
                except (ValueError, TypeError, KeyError):
                    continue
                if not d:
                    continue
                if start_date and d < start_date:
                    continue
                if end_date and d > end_date:
                    continue
                shift_names_set.add(a["shift_name"])
                assignments.append(
                    {
                        "employee_name": a["employee_name"],
                        "shift_name": a["shift_name"],
                        "date": d.isoformat(),
                        "day_of_week": d.isoweekday() % 7,
                    }
                )
        emp_db = get_nursing_employees_db()
        employees = [e["name"] for e in emp_db.employees.find()]
    else:
        db = get_db()
        latest_schedules: dict = {}
        for sched in db.schedules.find({"status": "generated"}, sort=[("generated_at", 1)]):
            key = (sched.get("year"), sched.get("month"))
            latest_schedules[key] = sched

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
                assignments.append(
                    {
                        "employee_name": a["employee_name"],
                        "shift_name": a["shift_name"],
                        "date": d.isoformat(),
                        "day_of_week": d.isoweekday() % 7,
                    }
                )

        employees = [e["name"] for e in db.employees.find()]

    return jsonify(
        {
            "assignments": assignments,
            "employees": employees,
            "shift_names": sorted(shift_names_set),
        }
    )
