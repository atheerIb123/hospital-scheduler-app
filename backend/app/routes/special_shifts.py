from flask import Blueprint, request, jsonify
from ..db import get_db

special_shifts_bp = Blueprint("special_shifts", __name__)


@special_shifts_bp.get("/special-shifts/monthly")
def get_monthly_special_shifts():
    """Return monthly special-shift configs, optionally filtered by year."""
    db = get_db()
    year = request.args.get("year", type=int)
    query = {"year": year} if year else {}
    docs = list(db.special_shifts_monthly.find(query, {"_id": 0}))
    return jsonify(docs)


@special_shifts_bp.post("/special-shifts/monthly")
def set_monthly_special_shifts():
    """Create or update the total special-shift count for a month/year/shift_name."""
    db = get_db()
    data = request.get_json()
    try:
        month      = int(data["month"])
        year       = int(data["year"])
        total      = max(0, int(data.get("total_count", 0)))
        shift_name = str(data.get("shift_name", "")).strip()
    except (KeyError, TypeError, ValueError):
        return jsonify({"error": "month, year and total_count are required"}), 400

    if not shift_name:
        return jsonify({"error": "shift_name is required"}), 400

    doc = {"shift_name": shift_name, "month": month, "year": year, "total_count": total}

    week_dist = data.get("week_distribution")
    if week_dist is not None:
        try:
            doc["week_distribution"] = [max(0, int(x)) for x in week_dist]
        except (TypeError, ValueError):
            pass

    db.special_shifts_monthly.replace_one(
        {"shift_name": shift_name, "month": month, "year": year},
        doc,
        upsert=True,
    )
    return jsonify({"ok": True, **doc})


@special_shifts_bp.delete("/special-shifts/monthly/<int:year>/<int:month>")
def delete_monthly_special_shifts(year, month):
    db = get_db()
    shift_name = request.args.get("shift_name", "").strip()
    query = {"year": year, "month": month}
    if shift_name:
        query["shift_name"] = shift_name
    db.special_shifts_monthly.delete_one(query)
    return jsonify({"ok": True})
