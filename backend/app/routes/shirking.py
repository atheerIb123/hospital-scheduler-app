from flask import Blueprint, request, jsonify
from bson import ObjectId
from ..db import get_db
import datetime

shirking_bp = Blueprint("shirking", __name__)


def _serialize(doc):
    doc["id"] = str(doc.pop("_id"))
    return doc


@shirking_bp.get("/shirking")
def list_shirking():
    import datetime as dt_mod
    db = get_db()
    month = request.args.get("month", type=int)
    year = request.args.get("year", type=int)
    start_str = request.args.get("start_date")
    end_str = request.args.get("end_date")
    query = {}
    if start_str and end_str:
        try:
            start = dt_mod.date.fromisoformat(start_str)
            end = dt_mod.date.fromisoformat(end_str)
            # Build list of (year, month, day) ranges covered
            # Use a simple date-comparison approach: filter in Python
            docs = list(db.shirking.find({}, sort=[("year", -1), ("month", -1), ("day", 1)]))
            result = []
            for s in docs:
                try:
                    d = dt_mod.date(s["year"], s["month"], s["day"])
                    if start <= d <= end:
                        result.append(_serialize(s))
                except Exception:
                    pass
            return jsonify(result)
        except Exception:
            pass
    if month and year:
        query["month"] = month
        query["year"] = year
    return jsonify(
        [
            _serialize(s)
            for s in db.shirking.find(
                query, sort=[("year", -1), ("month", -1), ("day", 1)]
            )
        ]
    )


@shirking_bp.post("/shirking")
def add_shirking():
    db = get_db()
    data = request.get_json()
    # Prevent duplicates for the same employee+shift+day
    existing = db.shirking.find_one(
        {
            "employee_id": data["employee_id"],
            "shift_name": data["shift_name"],
            "day": int(data["day"]),
            "month": int(data["month"]),
            "year": int(data["year"]),
        }
    )
    if existing:
        return jsonify(_serialize(existing)), 200
    doc = {
        "employee_id": data["employee_id"],
        "employee_name": data["employee_name"],
        "shift_name": data["shift_name"],
        "day": int(data["day"]),
        "month": int(data["month"]),
        "year": int(data["year"]),
        "replacement_name": data.get("replacement_name", ""),
        "created_at": datetime.datetime.utcnow(),
    }
    result = db.shirking.insert_one(doc)
    saved = db.shirking.find_one({"_id": result.inserted_id})
    return jsonify(_serialize(saved)), 201


@shirking_bp.delete("/shirking/<shk_id>")
def remove_shirking(shk_id):
    db = get_db()
    db.shirking.delete_one({"_id": ObjectId(shk_id)})
    return jsonify({"ok": True})
