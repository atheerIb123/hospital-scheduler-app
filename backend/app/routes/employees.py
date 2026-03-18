import csv
import io
import os
import datetime
from flask import Blueprint, request, jsonify
from bson import ObjectId
from ..db import get_db
from ..constants import col_attr

_DEFAULTS_CSV = os.path.join(os.path.dirname(__file__), "..", "..", "data", "default_shift_types.csv")

employees_bp = Blueprint("employees", __name__)


def _col_key(role: str) -> str:
    """Return the config key for this role's column headers."""
    return "csv_column_headers_nursing" if role == "nursing" else "csv_column_headers"


def _safe_role(raw) -> str:
    return raw if raw in ("doctor", "nursing") else "doctor"


def _serialize(doc):
    doc["id"] = str(doc.pop("_id"))
    return doc


def _parse_csv(file_bytes: bytes) -> tuple[list[str], list[dict]]:
    """
    Parse an employee CSV file.
    Row 0  = headers (column names).
    Rows 1+ = employees: col 0 = name, cols 1–N = attribute columns (V = ticked).
    The number of attribute columns is inferred dynamically from the header row.
    Returns (column_headers, employees_list).
    """
    text = file_bytes.decode("utf-8-sig")  # handle BOM from Excel exports
    reader = csv.reader(io.StringIO(text))
    rows = [r for r in reader if any(cell.strip() for cell in r)]

    if not rows:
        return [], []

    headers = [h.strip() for h in rows[0]]
    # Attribute columns are everything after the name column (index 0)
    num_attr_cols = len(headers) - 1

    col_headers = {
        i: headers[i] if i < len(headers) else f"עמודה {i}"
        for i in range(1, num_attr_cols + 1)
    }

    employees = []
    for row in rows[1:]:
        name = row[0].strip() if row else ""
        if not name:
            continue
        ticked_attributes = []
        for col_idx in range(1, num_attr_cols + 1):
            cell = row[col_idx].strip() if col_idx < len(row) else ""
            if cell == "V":
                ticked_attributes.append(col_attr(col_idx))
        employees.append(
            {
                "name": name,
                "attributes": ticked_attributes,
                "col_headers": col_headers,
            }
        )

    return list(col_headers.values()), employees


# ---------------------------------------------------------------------------
# Employees — list / delete
# ---------------------------------------------------------------------------

@employees_bp.get("/employees")
def list_employees():
    db = get_db()
    role = request.args.get("role")
    query = {}
    if role in ("doctor", "nursing"):
        query["role"] = role
    employees = []
    for emp in db.employees.find(query):
        emp["id"] = str(emp.pop("_id"))
        if "role" not in emp:
            emp["role"] = "doctor"  # backward compat
        employees.append(emp)
    return jsonify(employees)


@employees_bp.put("/employees/<emp_id>")
def update_employee(emp_id):
    """Update an employee's name and/or attributes."""
    db = get_db()
    data = request.get_json()
    patch = {}
    if "name" in data:
        name = data["name"].strip()
        if name:
            patch["name"] = name
    if "attributes" in data:
        patch["attributes"] = [a.strip() for a in data["attributes"] if a.strip()]
    if "role" in data and data["role"] in ("doctor", "nursing"):
        patch["role"] = data["role"]
    if not patch:
        return jsonify({"error": "nothing to update"}), 400
    db.employees.update_one({"_id": ObjectId(emp_id)}, {"$set": patch})
    emp = db.employees.find_one({"_id": ObjectId(emp_id)})
    return jsonify(_serialize(emp))


@employees_bp.delete("/employees/<emp_id>")
def delete_employee(emp_id):
    db = get_db()
    db.employees.delete_one({"_id": ObjectId(emp_id)})
    return jsonify({"ok": True})


@employees_bp.delete("/employees")
def clear_employees():
    """Delete all employees (used before re-importing)."""
    db = get_db()
    db.employees.delete_many({})
    return jsonify({"ok": True})


# ---------------------------------------------------------------------------
# CSV import
# ---------------------------------------------------------------------------

@employees_bp.post("/employees/import")
def import_employees():
    """
    Accepts a multipart/form-data upload with field name 'file'.
    Query param ?role=doctor|nursing (default: doctor).
    Replaces all existing employees of that role and stores role-specific column headers.
    """
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if not file.filename or not file.filename.endswith(".csv"):
        return jsonify({"error": "File must be a .csv"}), 400

    role = _safe_role(request.args.get("role", "doctor"))
    col_headers, parsed = _parse_csv(file.read())
    if not parsed:
        return jsonify({"error": "CSV is empty or could not be parsed"}), 400

    db = get_db()

    # Replace only employees of this role
    db.employees.delete_many({"role": role})
    # Also treat legacy employees (no role field) as doctors
    if role == "doctor":
        db.employees.delete_many({"role": {"$exists": False}})
    db.employees.insert_many(
        [{"name": e["name"], "attributes": e["attributes"], "role": role} for e in parsed]
    )

    # Store role-specific column headers
    config_key = _col_key(role)
    if col_headers:
        db.config.replace_one(
            {"key": config_key},
            {"key": config_key, "headers": col_headers},
            upsert=True,
        )

    employees = [_serialize(e) for e in db.employees.find()]

    # Auto-seed default shift types on first employee import (if collection is empty)
    auto_seeded = False
    if db.shift_types.count_documents({}) == 0:
        csv_path = os.path.normpath(_DEFAULTS_CSV)
        if os.path.exists(csv_path):
            from .shift_types import _parse_shift_types_csv, _header_to_attr_map
            with open(csv_path, encoding="utf-8-sig") as f:
                text = f.read()
            parsed_shifts, _ = _parse_shift_types_csv(text, _header_to_attr_map(db))
            if parsed_shifts:
                db.shift_types.insert_many(parsed_shifts)
                auto_seeded = True

    return jsonify({
        "imported": len(employees),
        "employees": employees,
        "column_headers": col_headers,
        "shift_types_auto_seeded": auto_seeded,
    }), 201


@employees_bp.get("/employees/column-headers")
def get_column_headers():
    db = get_db()
    role = _safe_role(request.args.get("role", "doctor"))
    config = db.config.find_one({"key": _col_key(role)})
    headers = config["headers"] if config else []
    return jsonify(headers)


@employees_bp.patch("/employees/column-headers")
def rename_column_header():
    """Rename a single column header. Body: {index: 0-based int, name: str}. Query: ?role="""
    db = get_db()
    role = _safe_role(request.args.get("role", "doctor"))
    data = request.get_json()
    idx = data.get("index")
    new_name = (data.get("name") or "").strip()
    if idx is None or not new_name:
        return jsonify({"error": "index and name are required"}), 400
    key = _col_key(role)
    config = db.config.find_one({"key": key})
    headers = list(config["headers"]) if config else []
    if idx < 0 or idx >= len(headers):
        return jsonify({"error": "column index out of range"}), 400
    headers[idx] = new_name
    db.config.update_one({"key": key}, {"$set": {"headers": headers}})
    return jsonify(headers)


@employees_bp.post("/employees/column-headers")
def add_column_header():
    """Append a new column header. Body: {name: str}. Query: ?role="""
    db = get_db()
    role = _safe_role(request.args.get("role", "doctor"))
    data = request.get_json()
    new_name = (data.get("name") or "").strip()
    if not new_name:
        return jsonify({"error": "name is required"}), 400
    key = _col_key(role)
    config = db.config.find_one({"key": key})
    headers = list(config["headers"]) if config else []
    headers.append(new_name)
    db.config.update_one({"key": key}, {"$set": {"headers": headers}}, upsert=True)
    return jsonify(headers), 201


@employees_bp.delete("/employees/column-headers/<int:col_index>")
def delete_column_header(col_index):
    """
    Delete a column header by 0-based index for a specific role (?role=).
    Cascades only to employees of that role and shift_types with matching staff_type.
    """
    db = get_db()
    role = _safe_role(request.args.get("role", "doctor"))
    key = _col_key(role)
    config = db.config.find_one({"key": key})
    headers = list(config["headers"]) if config else []
    if col_index < 0 or col_index >= len(headers):
        return jsonify({"error": "column index out of range"}), 400

    deleted_attr = col_attr(col_index + 1)

    def _shift_attrs(attrs):
        new_attrs = []
        changed = False
        for a in attrs:
            if a == deleted_attr:
                changed = True
            elif a.startswith("col_"):
                try:
                    n = int(a[4:])
                except ValueError:
                    new_attrs.append(a)
                    continue
                if n > col_index + 1:
                    new_attrs.append(col_attr(n - 1))
                    changed = True
                else:
                    new_attrs.append(a)
            else:
                new_attrs.append(a)
        return new_attrs, changed

    # Cascade only to employees of this role
    role_query = {"role": role} if role == "nursing" else {"$or": [{"role": "doctor"}, {"role": {"$exists": False}}]}
    for emp in db.employees.find(role_query):
        new_attrs, changed = _shift_attrs(emp.get("attributes", []))
        if changed:
            db.employees.update_one({"_id": emp["_id"]}, {"$set": {"attributes": new_attrs}})

    # Cascade to shift_types with matching staff_type
    st_query = {"staff_type": role} if role in ("doctor", "nursing") else {}
    for st in db.shift_types.find(st_query):
        new_req, changed = _shift_attrs(st.get("required_attributes", []))
        if changed:
            db.shift_types.update_one({"_id": st["_id"]}, {"$set": {"required_attributes": new_req}})

    headers.pop(col_index)
    db.config.update_one({"key": key}, {"$set": {"headers": headers}})
    return jsonify(headers)
