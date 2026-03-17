import csv
import io
from flask import Blueprint, request, jsonify
from bson import ObjectId
from ..db import get_db
from ..constants import col_attr, NUM_ATTRIBUTE_COLUMNS

employees_bp = Blueprint("employees", __name__)

# 1-based attribute column index → list of shift type IDs it covers
COL_TO_SHIFTS: dict[int, list[int]] = {
    1: [1, 2, 3, 4, 5],
    2: [6],
    3: [7],
    4: [8],
    5: [9],
    6: [10],
    7: [11],
    8: [12],
    9: [13, 14],
}


def _serialize(doc):
    doc["id"] = str(doc.pop("_id"))
    return doc


def _parse_csv(file_bytes: bytes) -> tuple[list[str], list[dict]]:
    """
    Parse an employee CSV file.
    Row 0  = headers (column names).
    Rows 1+ = employees: col 0 = name, cols 1–9 = attribute columns (V = ticked).
    Returns (column_headers, employees_list).
    Each employee dict: {name, attributes: [col_attr strings], col_headers: {col_index: header}}
    """
    text = file_bytes.decode("utf-8-sig")  # handle BOM from Excel exports
    reader = csv.reader(io.StringIO(text))
    rows = [r for r in reader if any(cell.strip() for cell in r)]

    if not rows:
        return [], []

    headers = [h.strip() for h in rows[0]]
    col_headers = {
        i: headers[i] if i < len(headers) else f"עמודה {i + 1}"
        for i in range(1, NUM_ATTRIBUTE_COLUMNS + 1)
    }

    employees = []
    for row in rows[1:]:
        name = row[0].strip() if row else ""
        if not name:
            continue
        ticked_attributes = []
        for col_idx in range(1, NUM_ATTRIBUTE_COLUMNS + 1):
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
    employees = []
    for emp in db.employees.find():
        emp["id"] = str(emp.pop("_id"))
        employees.append(emp)
    return jsonify(employees)


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
    Replaces all existing employees with the parsed CSV data.
    Also stores column headers in the db.config collection for display.
    """
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if not file.filename or not file.filename.endswith(".csv"):
        return jsonify({"error": "File must be a .csv"}), 400

    col_headers, parsed = _parse_csv(file.read())
    if not parsed:
        return jsonify({"error": "CSV is empty or could not be parsed"}), 400

    db = get_db()

    # Replace all employees
    db.employees.delete_many({})
    db.employees.insert_many(
        [{"name": e["name"], "attributes": e["attributes"]} for e in parsed]
    )

    # Store column headers for UI display
    if col_headers:
        db.config.replace_one(
            {"key": "csv_column_headers"},
            {"key": "csv_column_headers", "headers": col_headers},
            upsert=True,
        )

    employees = [_serialize(e) for e in db.employees.find()]
    return jsonify({"imported": len(employees), "employees": employees, "column_headers": col_headers}), 201


@employees_bp.get("/employees/column-headers")
def get_column_headers():
    db = get_db()
    config = db.config.find_one({"key": "csv_column_headers"})
    headers = config["headers"] if config else []
    return jsonify(headers)
