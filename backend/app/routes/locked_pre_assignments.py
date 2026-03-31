from flask import Blueprint, request, jsonify
from ..db import get_nursing_employees_db

locked_pre_bp = Blueprint("locked_pre_assignments", __name__)


@locked_pre_bp.get("/locked-pre-assignments")
def get_locked_pre_assignments():
    """Return all locked pre-assignments for a given week_start."""
    week_start = request.args.get("week_start")
    if not week_start:
        return jsonify({"error": "week_start נדרש"}), 400
    nursing_db = get_nursing_employees_db()
    docs = list(nursing_db.locked_pre_assignments.find({"week_start": week_start}))
    for doc in docs:
        doc["id"] = str(doc.pop("_id"))
    return jsonify(docs), 200


@locked_pre_bp.post("/locked-pre-assignments")
def add_locked_pre_assignment():
    """Upsert a locked pre-assignment by (week_start, employee_id, day, shift_name, department)."""
    data = request.get_json(force=True, silent=True) or {}
    week_start = data.get("week_start")
    employee_id = data.get("employee_id", "")
    day = data.get("day")
    shift_name = data.get("shift_name", "")
    department = data.get("department", "")

    if not week_start or not employee_id or day is None or not shift_name:
        return jsonify({"error": "חסרים שדות חובה"}), 400

    nursing_db = get_nursing_employees_db()
    filter_key = {
        "week_start": week_start,
        "employee_id": employee_id,
        "day": day,
        "shift_name": shift_name,
        "department": department,
    }
    update_doc = {
        "$set": {
            "week_start": week_start,
            "employee_id": employee_id,
            "employee_name": data.get("employee_name", ""),
            "day": day,
            "shift_name": shift_name,
            "shift_type_id": data.get("shift_type_id", ""),
            "department": department,
            "role_slot": data.get("role_slot"),
        }
    }
    nursing_db.locked_pre_assignments.update_one(filter_key, update_doc, upsert=True)
    return jsonify({"ok": True}), 200


@locked_pre_bp.delete("/locked-pre-assignments")
def remove_locked_pre_assignment():
    """Delete a specific locked pre-assignment."""
    data = request.get_json(force=True, silent=True) or {}
    week_start = data.get("week_start")
    employee_id = data.get("employee_id", "")
    day = data.get("day")
    shift_name = data.get("shift_name", "")
    department = data.get("department", "")

    if not week_start or not employee_id or day is None or not shift_name:
        return jsonify({"error": "חסרים שדות חובה"}), 400

    nursing_db = get_nursing_employees_db()
    nursing_db.locked_pre_assignments.delete_one({
        "week_start": week_start,
        "employee_id": employee_id,
        "day": day,
        "shift_name": shift_name,
        "department": department,
    })
    return jsonify({"ok": True}), 200


@locked_pre_bp.delete("/locked-pre-assignments/dept")
def clear_locked_pre_assignments_dept():
    """Delete all locked pre-assignments for a given week + department."""
    data = request.get_json(force=True, silent=True) or {}
    week_start = data.get("week_start")
    department = data.get("department", "")

    if not week_start:
        return jsonify({"error": "week_start נדרש"}), 400

    nursing_db = get_nursing_employees_db()
    nursing_db.locked_pre_assignments.delete_many({
        "week_start": week_start,
        "department": department,
    })
    return jsonify({"ok": True}), 200
