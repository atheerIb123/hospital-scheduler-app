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
    start = request.args.get("start")
    end = request.args.get("end")
    query = {}
    if start and end:
        # Filter by logical date if available, or created_at as fallback
        query["date"] = {"$gte": start, "$lte": end}

    docs = db.manual_points.find(query).sort("created_at", -1)
    return jsonify([_serialize(d) for d in docs])

@manual_points_bp.post("/manual-points")
def add_manual_point():
    db = get_db()
    data = request.get_json()

    # Allow manual date override
    created_at = datetime.datetime.utcnow()
    date_str = datetime.datetime.now().strftime("%Y-%m-%d")
    
    if "date" in data and data["date"]:
        # Use the provided date string for the logical date, but keep created_at as 'now'
        date_str = data["date"][:10]

    doc = {
        "employee_id":   data["employee_id"],
        "employee_name": data["employee_name"],
        "points":        int(data["points"]),
        "reason":        data.get("reason", ""),
        "table":         data.get("table", "general"),
        "date":          date_str,
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
