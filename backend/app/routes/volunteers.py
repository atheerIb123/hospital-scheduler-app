from flask import Blueprint, request, jsonify
from bson import ObjectId
from ..db import get_db

volunteers_bp = Blueprint("volunteers", __name__)


def _serialize(doc):
    doc["id"] = str(doc.pop("_id"))
    return doc


@volunteers_bp.get("/volunteers")
def list_volunteers():
    db = get_db()
    month = request.args.get("month", type=int)
    year = request.args.get("year", type=int)
    query = {}
    if month and year:
        query["month"] = month
        query["year"] = year
    return jsonify([_serialize(v) for v in db.volunteers.find(query)])


@volunteers_bp.post("/volunteers")
def add_volunteer():
    db = get_db()
    data = request.get_json()
    existing = db.volunteers.find_one(
        {
            "employee_id": data["employee_id"],
            "shift_type_id": data.get("shift_type_id", ""),
            "day": data["day"],
            "month": data["month"],
            "year": data["year"],
        }
    )
    if existing:
        return jsonify(_serialize(existing)), 200
    doc = {
        "employee_id": data["employee_id"],
        "employee_name": data["employee_name"],
        "shift_type_id": data.get("shift_type_id", ""),
        "shift_name": data["shift_name"],
        "day": int(data["day"]),
        "month": int(data["month"]),
        "year": int(data["year"]),
    }
    result = db.volunteers.insert_one(doc)
    v = db.volunteers.find_one({"_id": result.inserted_id})
    return jsonify(_serialize(v)), 201


@volunteers_bp.delete("/volunteers/<vol_id>")
def remove_volunteer(vol_id):
    db = get_db()
    db.volunteers.delete_one({"_id": ObjectId(vol_id)})
    return jsonify({"ok": True})
