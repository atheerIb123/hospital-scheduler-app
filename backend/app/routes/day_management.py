from flask import Blueprint, request, jsonify
from bson import ObjectId
from ..db import get_db
import datetime

day_mgmt_bp = Blueprint("day_management", __name__)

def _serialize(doc):
    doc["id"] = str(doc.pop("_id"))
    return doc

# --- Day Types ---

@day_mgmt_bp.route("/day-types", methods=["GET"])
def list_day_types():
    db = get_db()
    return jsonify([_serialize(d) for d in db.day_types.find().sort("name", 1)])

@day_mgmt_bp.route("/day-types", methods=["POST"])
def create_day_type():
    db = get_db()
    data = request.get_json()
    name = data.get("name", "").strip()
    if not name:
        return jsonify({"error": "name is required"}), 400
    
    doc = {
        "name": name,
        "color": data.get("color", "bg-slate-100 text-slate-600 border-slate-200"),
        "created_at": datetime.datetime.utcnow()
    }
    result = db.day_types.insert_one(doc)
    new_doc = db.day_types.find_one({"_id": result.inserted_id})
    return jsonify(_serialize(new_doc)), 201

@day_mgmt_bp.route("/day-types/<id>", methods=["PUT"])
def update_day_type(id):
    db = get_db()
    data = request.get_json()
    update = {}
    if "name" in data:
        update["name"] = data["name"].strip()
    if "color" in data:
        update["color"] = data["color"]
    
    if not update:
        return jsonify({"error": "nothing to update"}), 400
        
    db.day_types.update_one({"_id": ObjectId(id)}, {"$set": update})
    doc = db.day_types.find_one({"_id": ObjectId(id)})
    return jsonify(_serialize(doc))

@day_mgmt_bp.route("/day-types/<id>", methods=["DELETE"])
def delete_day_type(id):
    db = get_db()
    db.day_types.delete_one({"_id": ObjectId(id)})
    return jsonify({"ok": True})

# --- Day Settings ---

@day_mgmt_bp.route("/day-settings/<int:year>/<int:month>", methods=["GET"])
def get_month_settings(year, month):
    db = get_db()
    prefix = f"{year}-{month:02d}-"
    settings = list(db.day_settings.find({"date": {"$regex": f"^{prefix}"}}))
    for s in settings:
        s["id"] = str(s.pop("_id"))
    return jsonify(settings)

@day_mgmt_bp.route("/day-settings", methods=["POST"])
def set_day_setting():
    db = get_db()
    data = request.get_json()
    date_str = data.get("date")
    day_type_id = data.get("day_type_id")
    
    if not date_str:
        return jsonify({"error": "date is required"}), 400
        
    if not day_type_id:
        db.day_settings.delete_one({"date": date_str})
        return jsonify({"ok": True})
        
    db.day_settings.update_one(
        {"date": date_str},
        {"$set": {"day_type_id": day_type_id, "updated_at": datetime.datetime.utcnow()}},
        upsert=True
    )
    return jsonify({"ok": True})
