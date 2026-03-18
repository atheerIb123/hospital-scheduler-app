import traceback
from datetime import datetime, timezone, date as date_type
from flask import Blueprint, request, jsonify
from bson import ObjectId
from ..db import get_db
from ..scheduler.solver import generate_schedule

schedule_bp = Blueprint("schedule", __name__)


def _serialize(doc):
    doc["id"] = str(doc.pop("_id"))
    return doc


@schedule_bp.post("/schedules/generate")
def generate():
    db = get_db()
    try:
        data = request.get_json()
        month = int(data.get("month", datetime.now().month))
        year = int(data.get("year", datetime.now().year))

        employees = list(db.employees.find())
        shift_types = [s for s in db.shift_types.find() if not s.get("skip", False)]
        rules = list(db.attribute_rules.find())

        # Load constraints and day settings for the requested month/year
        month_prefix = f"{year:04d}-{month:02d}-"
        constraints = list(db.constraints.find({"date": {"$regex": f"^{month_prefix}"}}))
        day_settings = list(db.day_settings.find({"date": {"$regex": f"^{month_prefix}"}}))

        if not employees:
            return jsonify({"status": "failed", "reason": "אין עובדים מוגדרים. ייבא קובץ CSV תחילה."}), 400
        if not shift_types:
            return jsonify({"status": "failed", "reason": "אין סוגי משמרות מוגדרים."}), 400

        result = generate_schedule(employees, shift_types, rules, month, year, constraints, day_settings)

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
        return jsonify({"status": "failed", "reason": "שגיאת שרת פנימית. ראה לוג."}), 500


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


@schedule_bp.route("/schedules/<schedule_id>/assignments", methods=["PATCH"])
def update_assignments(schedule_id):
    db = get_db()
    data = request.get_json()
    assignments = data.get("assignments", [])
    db.schedules.update_one(
        {"_id": ObjectId(schedule_id)},
        {"$set": {"assignments": assignments}}
    )
    schedule = db.schedules.find_one({"_id": ObjectId(schedule_id)})
    schedule["id"] = str(schedule.pop("_id"))
    if "generated_at" in schedule:
        schedule["generated_at"] = schedule["generated_at"].isoformat()
    return jsonify(schedule)


@schedule_bp.get("/justice")
def get_justice():
    db = get_db()

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

    # Build desirability map: shift_name → score (1–5)
    des_map: dict = {}
    for st in db.shift_types.find():
        des = st.get("desirability", 3)
        for name in st.get("names", []):
            des_map[name] = des

    # For each (month, year) pair keep only the most recently generated schedule
    latest_schedules: dict = {}
    for schedule in db.schedules.find({"status": "generated"}, sort=[("generated_at", 1)]):
        key = (schedule.get("year"), schedule.get("month"))
        latest_schedules[key] = schedule

    # Aggregate justice scores from one schedule per month
    justice: dict = {}
    for schedule in latest_schedules.values():
        sched_year = schedule.get("year")
        sched_month = schedule.get("month")
        for a in schedule.get("assignments", []):
            if start_date or end_date:
                try:
                    a_date = date_type(sched_year, sched_month, int(a["day"]))
                except (ValueError, TypeError, KeyError):
                    continue
                if start_date and a_date < start_date:
                    continue
                if end_date and a_date > end_date:
                    continue
            emp = a["employee_name"]
            des = des_map.get(a["shift_name"], 3)
            justice.setdefault(emp, {"score": 0, "shifts": 0})
            justice[emp]["score"] += 6 - des
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
        des = des_map.get(vol["shift_name"], 3)
        volunteer.setdefault(emp, {"score": 0, "count": 0})
        volunteer[emp]["score"] += 6 - des
        volunteer[emp]["count"] += 1

    employees = list(db.employees.find())
    result = []
    for emp in employees:
        name = emp["name"]
        j = justice.get(name, {"score": 0, "shifts": 0})
        v = volunteer.get(name, {"score": 0, "count": 0})
        result.append({
            "employee_name": name,
            "employee_id": str(emp["_id"]),
            "justice_score": j["score"],
            "justice_shifts": j["shifts"],
            "volunteer_score": v["score"],
            "volunteer_count": v["count"],
        })

    return jsonify(result)


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
