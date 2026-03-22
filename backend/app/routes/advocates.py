from flask import Blueprint, request, jsonify
from bson import ObjectId
from ..db import get_db
import datetime

advocates_bp = Blueprint("advocates", __name__)


def _serialize(doc):
    doc["id"] = str(doc.pop("_id"))
    return doc


@advocates_bp.get("/advocates")
def list_advocates():
    db = get_db()
    return jsonify([_serialize(a) for a in db.advocates.find(sort=[("date", -1)])])


@advocates_bp.post("/advocates")
def add_advocate():
    db = get_db()
    data = request.get_json()
    if not data.get("employee_id") or not data.get("description") or data.get("points") is None:
        return jsonify({"error": "employee_id, description and points are required"}), 400
    doc = {
        "employee_id": data["employee_id"],
        "employee_name": data["employee_name"],
        "description": data["description"],
        "points": int(data["points"]),
        "date": data.get("date", datetime.date.today().isoformat()),
    }
    result = db.advocates.insert_one(doc)
    saved = db.advocates.find_one({"_id": result.inserted_id})
    return jsonify(_serialize(saved)), 201


@advocates_bp.delete("/advocates/<adv_id>")
def remove_advocate(adv_id):
    db = get_db()
    db.advocates.delete_one({"_id": ObjectId(adv_id)})
    return jsonify({"ok": True})
