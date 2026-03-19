import csv
import io
import datetime
import os
from flask import Blueprint, request, jsonify
from bson import ObjectId
from ..db import get_db

constraints_bp = Blueprint("constraints", __name__)


def _serialize(doc):
    doc["id"] = str(doc.pop("_id"))
    return doc


# ---------------------------------------------------------------------------
# Date / range parsing
# ---------------------------------------------------------------------------

def _parse_single_date(raw: str) -> datetime.date:
    raw = raw.strip()
    for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y", "%d.%m.%Y"):
        try:
            return datetime.datetime.strptime(raw, fmt).date()
        except ValueError:
            continue
    raise ValueError(f"פורמט תאריך לא מוכר: '{raw}'")


def _expand_date_expression(raw: str) -> list:
    """
    Parse a date expression that may contain:
      - Single date:   01/10/2026
      - Range:         01/10/2026 - 05/10/2026
      - Mixed commas:  01/10/2026, 03/10/2026 - 07/10/2026, 10/10/2026
    Returns a flat sorted list of unique datetime.date objects.
    """
    all_dates = set()
    segments = [s.strip() for s in raw.split(",") if s.strip()]

    for seg in segments:
        if " - " in seg:
            parts = seg.split(" - ", 1)
            if len(parts) != 2:
                raise ValueError(f"טווח תאריכים לא תקין: '{seg}'")
            start = _parse_single_date(parts[0])
            end   = _parse_single_date(parts[1])
            if end < start:
                raise ValueError(f"תאריך סיום לפני תאריך התחלה: '{seg}'")
            if (end - start).days > 365:
                raise ValueError(f"טווח תאריכים ארוך מדי (מעל שנה): '{seg}'")
            current = start
            while current <= end:
                all_dates.add(current)
                current += datetime.timedelta(days=1)
        else:
            all_dates.add(_parse_single_date(seg))

    return sorted(all_dates)


# ---------------------------------------------------------------------------
# Multi-format file parsing
# ---------------------------------------------------------------------------

ALLOWED_EXTENSIONS = {".csv", ".xlsx", ".xls", ".ods"}


def _ext(filename: str) -> str:
    return os.path.splitext(filename.lower())[1]


def _rows_from_csv(file_bytes: bytes) -> list[list[str]]:
    for encoding in ("utf-8-sig", "windows-1255", "utf-16", "iso-8859-8"):
        try:
            text = file_bytes.decode(encoding)
            break
        except (UnicodeDecodeError, LookupError):
            continue
    else:
        raise ValueError("לא ניתן לקרוא את הקובץ. יש לשמור אותו בפורמט UTF-8 או Windows-1255")
    reader = csv.reader(io.StringIO(text))
    return [r for r in reader if any(cell.strip() for cell in r)]


def _rows_from_xlsx(file_bytes: bytes) -> list[list[str]]:
    import openpyxl
    wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
    ws = wb.active
    rows = []
    for row in ws.iter_rows(values_only=True):
        cells = [str(c).strip() if c is not None else "" for c in row]
        if any(c for c in cells):
            rows.append(cells)
    return rows


def _rows_from_xls(file_bytes: bytes) -> list[list[str]]:
    import xlrd
    wb = xlrd.open_workbook(file_contents=file_bytes)
    ws = wb.sheet_by_index(0)
    rows = []
    for i in range(ws.nrows):
        cells = [str(ws.cell_value(i, j)).strip() for j in range(ws.ncols)]
        cells = [c[:-2] if c.endswith(".0") else c for c in cells]
        if any(c for c in cells):
            rows.append(cells)
    return rows


def _rows_from_ods(file_bytes: bytes) -> list[list[str]]:
    from odf.opendocument import load as ods_load
    from odf.table import Table, TableRow, TableCell
    from odf.text import P
    doc = ods_load(io.BytesIO(file_bytes))
    rows = []
    for sheet in doc.spreadsheet.getElementsByType(Table):
        for row_el in sheet.getElementsByType(TableRow):
            cells = []
            for cell in row_el.getElementsByType(TableCell):
                paragraphs = cell.getElementsByType(P)
                text = " ".join(str(p) for p in paragraphs).strip() if paragraphs else ""
                repeat = int(cell.getAttribute("numbercolumnsrepeated") or 1)
                cells.extend([text] * repeat)
            while cells and not cells[-1]:
                cells.pop()
            if any(c for c in cells):
                rows.append(cells)
        break
    return rows


def _get_rows(file_bytes: bytes, extension: str) -> list[list[str]]:
    if extension == ".xlsx":
        return _rows_from_xlsx(file_bytes)
    elif extension == ".xls":
        return _rows_from_xls(file_bytes)
    elif extension == ".ods":
        return _rows_from_ods(file_bytes)
    else:
        return _rows_from_csv(file_bytes)


def _parse_rows(rows: list[list[str]]):
    """
    Convert raw rows (first row = headers) into constraint records.
    Looks for columns containing 'שם' (name), 'תאריך' (date), 'סיבה' (reason).
    """
    if not rows:
        return [], ["הקובץ ריק או חסר שורת כותרות"]

    fieldnames = [f.strip() for f in rows[0]]
    name_col   = next((f for f in fieldnames if "שם"    in f), None)
    date_col   = next((f for f in fieldnames if "תאריך" in f), None)
    reason_col = next((f for f in fieldnames if "סיבה"  in f), None)

    if not name_col or not date_col:
        return [], [
            "הקובץ חייב לכלול עמודות 'שם עובד' ו-'תאריך'. "
            f"עמודות שנמצאו: {', '.join(fieldnames)}"
        ]

    parsed = []
    errors = []

    for i, row in enumerate(rows[1:], start=2):
        row_dict = {fieldnames[j]: row[j] if j < len(row) else "" for j in range(len(fieldnames))}
        employee_name = row_dict.get(name_col, "").strip()
        date_raw      = row_dict.get(date_col, "").strip()
        reason        = row_dict.get(reason_col, "").strip() if reason_col else ""

        if not employee_name and not date_raw:
            continue
        if not employee_name:
            errors.append(f"שורה {i}: חסר שם עובד")
            continue
        if not date_raw:
            errors.append(f"שורה {i}: חסר תאריך עבור '{employee_name}'")
            continue

        try:
            dates = _expand_date_expression(date_raw)
        except ValueError as e:
            errors.append(f"שורה {i}: {e}")
            continue

        for d in dates:
            parsed.append({
                "employee_name": employee_name,
                "date": d.isoformat(),
                "reason": reason,
            })

    return parsed, errors


# ---------------------------------------------------------------------------
# List
# ---------------------------------------------------------------------------

@constraints_bp.get("/constraints")
def list_constraints():
    db = get_db()
    month = request.args.get("month", type=int)
    year  = request.args.get("year",  type=int)
    employee_name = request.args.get("employee")

    query = {}
    if month and year:
        prefix = f"{year:04d}-{month:02d}-"
        query["date"] = {"$regex": f"^{prefix}"}
    if employee_name:
        query["employee_name"] = {"$regex": employee_name, "$options": "i"}

    docs = [_serialize(d) for d in db.constraints.find(query).sort("date", 1)]
    return jsonify(docs)


# ---------------------------------------------------------------------------
# Create — accepts single date or full date expression
# ---------------------------------------------------------------------------

@constraints_bp.post("/constraints")
def create_constraint():
    db   = get_db()
    data = request.get_json()

    employee_name = (data.get("employee_name") or "").strip()
    date_raw      = (data.get("date")          or "").strip()
    reason        = (data.get("reason")        or "").strip()

    if not employee_name:
        return jsonify({"error": "שם עובד הוא שדה חובה"}), 400
    if not date_raw:
        return jsonify({"error": "תאריך הוא שדה חובה"}), 400

    try:
        dates = _expand_date_expression(date_raw)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    created_docs = []
    skipped = 0
    for d in dates:
        iso = d.isoformat()
        if db.constraints.find_one({"employee_name": employee_name, "date": iso}):
            skipped += 1
            continue
        doc = {
            "employee_name": employee_name,
            "date": iso,
            "reason": reason,
            "created_at": datetime.datetime.utcnow(),
        }
        result = db.constraints.insert_one(doc)
        created = db.constraints.find_one({"_id": result.inserted_id})
        created_docs.append(_serialize(created))

    if not created_docs and skipped:
        return jsonify({"error": "כל התאריכים שהוזנו כבר קיימים עבור עובד זה"}), 409

    return jsonify({"created": created_docs, "skipped": skipped}), 201


# ---------------------------------------------------------------------------
# Update
# ---------------------------------------------------------------------------

@constraints_bp.put("/constraints/<constraint_id>")
def update_constraint(constraint_id):
    db   = get_db()
    data = request.get_json()
    patch = {}

    if "employee_name" in data:
        name = data["employee_name"].strip()
        if not name:
            return jsonify({"error": "שם עובד לא יכול להיות ריק"}), 400
        patch["employee_name"] = name

    if "date" in data:
        try:
            patch["date"] = _parse_single_date(data["date"]).isoformat()
        except ValueError as e:
            return jsonify({"error": str(e)}), 400

    if "reason" in data:
        patch["reason"] = (data["reason"] or "").strip()

    if not patch:
        return jsonify({"error": "אין מה לעדכן"}), 400

    db.constraints.update_one({"_id": ObjectId(constraint_id)}, {"$set": patch})
    updated = db.constraints.find_one({"_id": ObjectId(constraint_id)})
    if not updated:
        return jsonify({"error": "לא נמצא"}), 404
    return jsonify(_serialize(updated))


# ---------------------------------------------------------------------------
# Delete single / clear all
# ---------------------------------------------------------------------------

@constraints_bp.delete("/constraints/<constraint_id>")
def delete_constraint(constraint_id):
    db = get_db()
    db.constraints.delete_one({"_id": ObjectId(constraint_id)})
    return jsonify({"ok": True})


@constraints_bp.delete("/constraints")
def clear_constraints():
    db = get_db()
    db.constraints.delete_many({})
    return jsonify({"ok": True})


# ---------------------------------------------------------------------------
# CSV import
# ---------------------------------------------------------------------------

@constraints_bp.post("/constraints/import")
def import_constraints():
    if "file" not in request.files:
        return jsonify({"error": "לא סופק קובץ"}), 400

    file = request.files["file"]
    extension = _ext(file.filename or "")
    if not file.filename or extension not in ALLOWED_EXTENSIONS:
        return jsonify({
            "error": f"סוג קובץ לא נתמך '{extension}'. מותר: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        }), 400

    mode = request.args.get("mode", "replace")

    try:
        rows = _get_rows(file.read(), extension)
    except Exception as e:
        return jsonify({"error": f"לא ניתן לקרוא את הקובץ: {e}"}), 400

    parsed, errors = _parse_rows(rows)

    if not parsed and errors:
        return jsonify({"error": errors[0], "all_errors": errors}), 400

    db = get_db()
    if mode == "replace":
        db.constraints.delete_many({})

    skipped = 0
    inserted_docs = []
    for item in parsed:
        if mode == "append" and db.constraints.find_one({
            "employee_name": item["employee_name"],
            "date": item["date"],
        }):
            skipped += 1
            continue
        item["created_at"] = datetime.datetime.utcnow()
        result = db.constraints.insert_one(item)
        doc = db.constraints.find_one({"_id": result.inserted_id})
        inserted_docs.append(_serialize(doc))

    return jsonify({
        "imported": len(inserted_docs),
        "skipped":  skipped,
        "errors":   errors,
        "constraints": inserted_docs,
    }), 201
