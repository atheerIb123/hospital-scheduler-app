import os
import json
from flask import Blueprint, jsonify, request

departments_bp = Blueprint("departments", __name__)

DEPARTMENTS_FILE = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "departments.json"
)


@departments_bp.get("/departments")
def get_departments():
    if not os.path.exists(DEPARTMENTS_FILE):
        return jsonify([])
    with open(DEPARTMENTS_FILE, "r", encoding="utf-8") as f:
        return jsonify(json.load(f))


@departments_bp.post("/departments")
def add_department():
    data = request.get_json()
    new_dep = data.get("name", "").strip()
    if not new_dep:
        return jsonify({"error": "Name is required"}), 400

    deps = []
    if os.path.exists(DEPARTMENTS_FILE):
        with open(DEPARTMENTS_FILE, "r", encoding="utf-8") as f:
            try:
                deps = json.load(f)
            except Exception:
                deps = []

    if new_dep not in deps:
        deps.append(new_dep)
        with open(DEPARTMENTS_FILE, "w", encoding="utf-8") as f:
            json.dump(deps, f, ensure_ascii=False, indent=2)

    return jsonify(deps)
