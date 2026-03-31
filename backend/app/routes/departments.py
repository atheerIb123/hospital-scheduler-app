import os
import json
from flask import Blueprint, jsonify, request, current_app
from ..db import get_client

departments_bp = Blueprint("departments", __name__)

DEPARTMENTS_FILE = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "departments.json"
)

def get_config_db():
    base_name = current_app.config["MONGO_DB_NAME"]
    return get_client()[base_name]


def load_default_departments():
    if not os.path.exists(DEPARTMENTS_FILE):
        return []

    with open(DEPARTMENTS_FILE, "r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except Exception:
            return []


def build_department_list():
    defaults = load_default_departments()
    db = get_config_db()
    hidden_defaults = {
        doc["name"]
        for doc in db.hidden_departments.find({}, {"name": 1})
        if doc.get("name")
    }
    customs = [doc["name"] for doc in db.departments.find({}, {"name": 1})]

    merged = []
    for department in defaults:
        if department in hidden_defaults:
            continue
        if department not in merged:
            merged.append(department)

    for department in customs:
        if department not in merged:
            merged.append(department)

    return merged


def auto_add_department(name: str):
    """Add a department to the known list if it doesn't exist yet."""
    name = name.strip()
    if not name:
        return
    db = get_config_db()
    defaults = load_default_departments()
    if name not in defaults and not db.departments.find_one({"name": name}):
        db.departments.insert_one({"name": name})

@departments_bp.get("/departments")
def get_departments():
    return jsonify(build_department_list())

@departments_bp.post("/departments")
def add_department():
    data = request.get_json()
    new_dep = data.get("name", "").strip()
    if not new_dep:
        return jsonify({"error": "Name is required"}), 400
        
    db = get_config_db()
    db.hidden_departments.delete_many({"name": new_dep})
    existing = db.departments.find_one({"name": new_dep})
    if not existing and new_dep not in load_default_departments():
        db.departments.insert_one({"name": new_dep})
        
    # Return updated list
    return get_departments()


@departments_bp.delete("/departments/<path:department_name>")
def delete_department(department_name):
    name = department_name.strip()
    if not name:
        return jsonify({"error": "Name is required"}), 400

    db = get_config_db()
    deleted_any = False

    if name in load_default_departments():
        db.hidden_departments.update_one(
            {"name": name},
            {"$set": {"name": name}},
            upsert=True,
        )
        deleted_any = True
    else:
        result = db.departments.delete_one({"name": name})
        deleted_any = result.deleted_count > 0

    if not deleted_any:
        return jsonify({"error": "Department not found"}), 404

    return jsonify(build_department_list())


@departments_bp.post("/departments/restore-defaults")
def restore_default_departments():
    db = get_config_db()
    defaults = load_default_departments()
    if defaults:
        db.hidden_departments.delete_many({"name": {"$in": defaults}})

    return jsonify(build_department_list())
