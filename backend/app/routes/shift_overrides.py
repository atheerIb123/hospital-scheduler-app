from flask import Blueprint, request, jsonify
from ..db import get_db

shift_overrides_bp = Blueprint("shift_overrides", __name__)


@shift_overrides_bp.get("/shift-overrides")
def get_shift_overrides():
    """Return shift overrides, optionally filtered by year and/or month."""
    db = get_db()
    year = request.args.get("year", type=int)
    month = request.args.get("month", type=int)
    query = {}
    if year and month:
        from_date = f"{year:04d}-{month:02d}-01"
        next_month = month + 1 if month < 12 else 1
        next_year = year if month < 12 else year + 1
        to_date = f"{next_year:04d}-{next_month:02d}-01"
        query = {"date": {"$gte": from_date, "$lt": to_date}}
    elif year:
        query = {"date": {"$gte": f"{year:04d}-01-01", "$lt": f"{year + 1:04d}-01-01"}}

    docs = list(db.shift_overrides.find(query, {"_id": 0}))
    return jsonify(docs)


@shift_overrides_bp.put("/shift-overrides")
def save_shift_override():
    """Create or update a composition override for a specific date + shift."""
    db = get_db()
    data = request.get_json()
    try:
        date = str(data["date"])        # YYYY-MM-DD
        shift_name = str(data["shift_name"])
    except (KeyError, TypeError):
        return jsonify({"error": "date and shift_name are required"}), 400

    doc = {"date": date, "shift_name": shift_name}
    if "total_workers" in data:
        doc["total_workers"] = max(0, int(data["total_workers"]))
    if "role_slots" in data:
        doc["role_slots"] = data["role_slots"]
    if "min_male" in data:
        doc["min_male"] = max(0, int(data["min_male"]))
    if "min_female" in data:
        doc["min_female"] = max(0, int(data["min_female"]))

    db.shift_overrides.replace_one(
        {"date": date, "shift_name": shift_name},
        doc,
        upsert=True,
    )
    return jsonify({"ok": True, **doc})


@shift_overrides_bp.delete("/shift-overrides/<string:date>/<string:shift_name>")
def delete_shift_override(date, shift_name):
    db = get_db()
    db.shift_overrides.delete_one({"date": date, "shift_name": shift_name})
    return jsonify({"ok": True})
