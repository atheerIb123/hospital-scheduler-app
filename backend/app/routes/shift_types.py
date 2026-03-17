from flask import Blueprint, request, jsonify
from bson import ObjectId
from ..db import get_db

shift_types_bp = Blueprint("shift_types", __name__)


def _serialize(doc):
    doc["id"] = str(doc.pop("_id"))
    return doc


@shift_types_bp.get("/shift-types")
def list_shift_types():
    db = get_db()
    return jsonify([_serialize(s) for s in db.shift_types.find()])


@shift_types_bp.post("/shift-types")
def create_shift_type():
    db = get_db()
    data = request.get_json()
    # Accept comma-separated string or array for names
    raw_names = data.get("names", [])
    if isinstance(raw_names, str):
        raw_names = [n.strip() for n in raw_names.split(",") if n.strip()]
    names = [n.strip() for n in raw_names if n.strip()]
    if not names:
        return jsonify({"error": "at least one name is required"}), 400
    required_attributes = [a.strip() for a in data.get("required_attributes", []) if a.strip()]
    doc = {
        "names": names,
        "required_attributes": required_attributes,
        "is_desired": bool(data.get("is_desired", False)),
    }
    result = db.shift_types.insert_one(doc)
    shift = db.shift_types.find_one({"_id": result.inserted_id})
    return jsonify(_serialize(shift)), 201


@shift_types_bp.put("/shift-types/<shift_id>")
def update_shift_type(shift_id):
    db = get_db()
    data = request.get_json()
    update = {}
    if "names" in data:
        raw = data["names"]
        if isinstance(raw, str):
            raw = [n.strip() for n in raw.split(",") if n.strip()]
        update["names"] = [n.strip() for n in raw if n.strip()]
    if "required_attributes" in data:
        update["required_attributes"] = [a.strip() for a in data["required_attributes"] if a.strip()]
    if "is_desired" in data:
        update["is_desired"] = bool(data["is_desired"])
    db.shift_types.update_one({"_id": ObjectId(shift_id)}, {"$set": update})
    shift = db.shift_types.find_one({"_id": ObjectId(shift_id)})
    return jsonify(_serialize(shift))


@shift_types_bp.delete("/shift-types/<shift_id>")
def delete_shift_type(shift_id):
    db = get_db()
    db.shift_types.delete_one({"_id": ObjectId(shift_id)})
    return jsonify({"ok": True})


@shift_types_bp.patch("/shift-types/<shift_id>/desired")
def toggle_desired(shift_id):
    db = get_db()
    data = request.get_json()
    is_desired = bool(data.get("is_desired", False))
    db.shift_types.update_one({"_id": ObjectId(shift_id)}, {"$set": {"is_desired": is_desired}})
    shift = db.shift_types.find_one({"_id": ObjectId(shift_id)})
    return jsonify(_serialize(shift))
