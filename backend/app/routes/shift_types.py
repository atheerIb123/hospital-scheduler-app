import csv
import io
import os
import datetime
from flask import Blueprint, request, jsonify
from bson import ObjectId
from ..db import get_db

shift_types_bp = Blueprint("shift_types", __name__)

# Path to the bundled default shift types CSV
_DEFAULTS_CSV = os.path.join(
    os.path.dirname(__file__), "..", "..", "data", "default_shift_types.csv"
)


# Mapping from Hebrew CSV day labels → schedule_on values
_DAY_LABEL_MAP = {
    "הכל": "all",
    "all": "all",
    "": "all",
    "ימי חול": "weekdays",
    "weekdays": "weekdays",
    "שישי": "friday",
    "friday": "friday",
    "v": "friday",  # old שישי בלבד "V"
    "סוף שבוע": "weekend",
    "weekend": "weekend",
}


def _parse_schedule_on(cell: str, is_old_friday_flag: bool = False) -> str:
    """Resolve a raw CSV cell (or legacy friday_only flag) to a schedule_on string."""
    if is_old_friday_flag:
        return "friday" if cell.strip() == "V" else "all"
    return _DAY_LABEL_MAP.get(cell.strip().lower(), "all")


def _parse_shift_types_csv(
    text: str, header_to_attr: dict
) -> tuple[list[dict], list[str]]:
    """
    Parse a shift-types CSV string.
    Format:
      Row 0: שם משמרת, תכונות[, ימים]
      Rows 1+:
        col 0 = comma-separated shift name(s)
        col 1 = slash-separated attribute names
        col 2 = day scope (optional):
                  הכל / all / <empty>  → all days
                  ימי חול / weekdays   → Sunday–Thursday only
                  שישי / friday        → Fridays only
                  סוף שבוע / weekend   → Friday + Saturday
                  V                    → legacy friday-only flag

    Returns (parsed_shifts, unmatched_attr_names).
    """
    reader = csv.reader(io.StringIO(text))
    rows = [r for r in reader if any(cell.strip() for cell in r)]
    if not rows:
        return [], []

    csv_headers = [h.strip() for h in rows[0]]
    # Detect legacy "שישי בלבד" column vs new "ימים" column
    has_day_col = len(csv_headers) >= 3
    is_legacy_friday_col = has_day_col and csv_headers[2].strip() == "שישי בלבד"

    unmatched: list[str] = []
    parsed: list[dict] = []

    for row in rows[1:]:
        if not row:
            continue
        raw_name = row[0].strip()
        if not raw_name:
            continue
        names = [n.strip() for n in raw_name.split(",") if n.strip()]
        if not names:
            continue

        attr_cell = row[1].strip() if len(row) > 1 else ""
        required_attrs: list[str] = []
        if attr_cell:
            for part in attr_cell.split("/"):
                part = part.strip()
                if not part:
                    continue
                attr = header_to_attr.get(part.lower())
                if attr:
                    required_attrs.append(attr)
                elif part not in unmatched:
                    unmatched.append(part)

        day_cell = row[2].strip() if has_day_col and len(row) > 2 else ""
        schedule_on = _parse_schedule_on(day_cell, is_legacy_friday_col)

        parsed.append(
            {
                "names": names,
                "required_attributes": required_attrs,
                "schedule_on": schedule_on,
                "is_desired": False,
                "skip": False,
                "created_at": datetime.datetime.utcnow(),
            }
        )

    return parsed, unmatched


def _header_to_attr_map(db) -> dict:
    """Build {header_text_lower: col_N} from stored csv_column_headers config."""
    config = db.config.find_one({"key": "csv_column_headers"})
    stored_headers = config["headers"] if config else []
    return {h.strip().lower(): f"col_{i + 1}" for i, h in enumerate(stored_headers)}


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
    raw_names = data.get("names", [])
    if isinstance(raw_names, str):
        raw_names = [n.strip() for n in raw_names.split(",") if n.strip()]
    names = [n.strip() for n in raw_names if n.strip()]
    if not names:
        return jsonify({"error": "at least one name is required"}), 400
    required_attributes = [
        a.strip() for a in data.get("required_attributes", []) if a.strip()
    ]
    schedule_on = data.get("schedule_on", "all")
    if schedule_on not in ("all", "weekdays", "friday", "weekend"):
        schedule_on = "all"
    desirability = int(data.get("desirability", 3))
    desirability = max(1, min(5, desirability))
    doc = {
        "names": names,
        "required_attributes": required_attributes,
        "schedule_on": schedule_on,
        "desirability": desirability,
        "is_desired": desirability >= 4,
        "skip": False,
        "created_at": datetime.datetime.utcnow(),
    }
    result = db.shift_types.insert_one(doc)
    shift = db.shift_types.find_one({"_id": result.inserted_id})
    return jsonify(_serialize(shift)), 201


@shift_types_bp.route("/shift-types/load-defaults", methods=["POST"])
def load_defaults():
    """
    Load (or reset to) the bundled default shift types from backend/data/default_shift_types.csv.
    Always replaces all existing shift types.
    Returns: { imported: int, shift_types: [...], warnings: [unmatched_attr_names] }
    """
    csv_path = os.path.normpath(_DEFAULTS_CSV)
    if not os.path.exists(csv_path):
        return jsonify({"error": "default_shift_types.csv not found on server"}), 500

    db = get_db()
    with open(csv_path, encoding="utf-8-sig") as f:
        text = f.read()

    parsed_shifts, unmatched = _parse_shift_types_csv(text, _header_to_attr_map(db))

    if not parsed_shifts:
        return jsonify({"error": "Default CSV is empty or could not be parsed"}), 500

    db.shift_types.delete_many({})
    db.shift_types.insert_many(parsed_shifts)
    all_shifts = [_serialize(s) for s in db.shift_types.find()]
    return jsonify(
        {
            "imported": len(parsed_shifts),
            "shift_types": all_shifts,
            "warnings": unmatched,
        }
    ), 201


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
        update["required_attributes"] = [
            a.strip() for a in data["required_attributes"] if a.strip()
        ]
    if "desirability" in data:
        des = max(1, min(5, int(data["desirability"])))
        update["desirability"] = des
        update["is_desired"] = des >= 4
    elif "is_desired" in data:
        update["is_desired"] = bool(data["is_desired"])
    if "schedule_on" in data:
        update["schedule_on"] = data["schedule_on"]
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
    db.shift_types.update_one(
        {"_id": ObjectId(shift_id)}, {"$set": {"is_desired": is_desired}}
    )
    shift = db.shift_types.find_one({"_id": ObjectId(shift_id)})
    return jsonify(_serialize(shift))


@shift_types_bp.post("/shift-types/import")
def import_shift_types():
    """
    Accepts multipart/form-data with field name 'file'.
    Query param: ?mode=replace (default) or ?mode=append

    CSV format:
      Row 0: שם משמרת, תכונות[, שישי בלבד]
      Rows 1+:
        col 0 = shift name
        col 1 = slash-separated attribute names, e.g. "מיון 1 - צעיר/כוננות מחלקה"
        col 2 = "V" if friday-only (optional)

    Returns: { imported: int, shift_types: [...], warnings: [unmatched_attr_names] }
    """
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if not file.filename or not file.filename.endswith(".csv"):
        return jsonify({"error": "File must be a .csv"}), 400

    mode = request.args.get("mode", "replace")
    db = get_db()

    text = file.read().decode("utf-8-sig")
    parsed_shifts, unmatched = _parse_shift_types_csv(text, _header_to_attr_map(db))

    if not parsed_shifts:
        return jsonify({"error": "No valid shift rows found in CSV"}), 400

    if mode == "replace":
        db.shift_types.delete_many({})

    db.shift_types.insert_many(parsed_shifts)
    all_shifts = [_serialize(s) for s in db.shift_types.find()]
    return jsonify(
        {
            "imported": len(parsed_shifts),
            "shift_types": all_shifts,
            "warnings": unmatched,
        }
    ), 201
