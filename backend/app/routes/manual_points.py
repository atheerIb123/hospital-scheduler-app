from flask import Blueprint, request, jsonify
from bson import ObjectId
from ..db import get_db
import datetime

manual_points_bp = Blueprint("manual_points", __name__)


def _serialize(doc):
    doc["id"] = str(doc.pop("_id"))
    if "created_at" in doc and isinstance(doc["created_at"], datetime.datetime):
        doc["created_at"] = doc["created_at"].isoformat()
    return doc


@manual_points_bp.get("/manual-points")
def list_manual_points():
    db = get_db()
    return jsonify([_serialize(d) for d in db.manual_points.find(
        {}, sort=[("created_at", -1)]
    )])


@manual_points_bp.post("/manual-points")
def add_manual_point():
    db = get_db()
    data = request.get_json()

    # Allow manual date override
    created_at = datetime.datetime.utcnow()
    if "date" in data and data["date"]:
        try:
            d_str = data["date"]
            # Handle YYYY-MM-DD or full ISO
            if len(d_str) == 10:
                created_at = datetime.datetime.strptime(d_str, "%Y-%m-%d")
            else:
                created_at = datetime.datetime.fromisoformat(d_str.replace("Z", ""))
        except ValueError:
            pass

    doc = {
        "employee_id":   data["employee_id"],
        "employee_name": data["employee_name"],
        "points":        int(data["points"]),
        "reason":        data.get("reason", ""),
        "table":         data.get("table", "general"),
        "created_at":    created_at,
    }
    result = db.manual_points.insert_one(doc)
    saved = db.manual_points.find_one({"_id": result.inserted_id})
    return jsonify(_serialize(saved)), 201


@manual_points_bp.delete("/manual-points/<entry_id>")
def remove_manual_point(entry_id):
    db = get_db()
    db.manual_points.delete_one({"_id": ObjectId(entry_id)})
    return jsonify({"ok": True})
