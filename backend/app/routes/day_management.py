from flask import Blueprint, request, jsonify
from bson import ObjectId
from ..db import get_db
import datetime

day_mgmt_bp = Blueprint("day_management", __name__)

def _serialize(doc):
    doc["id"] = str(doc.pop("_id"))
    return doc

# --- Day Types ---

@day_mgmt_bp.route("/day-types", methods=["GET"])
def list_day_types():
    db = get_db()
    return jsonify([_serialize(d) for d in db.day_types.find().sort("name", 1)])

@day_mgmt_bp.route("/day-types", methods=["POST"])
def create_day_type():
    db = get_db()
    data = request.get_json()
    name = data.get("name", "").strip()
    if not name:
        return jsonify({"error": "name is required"}), 400
    
    score = max(0, int(data.get("score", 0)))
    doc = {
        "name": name,
        "color": data.get("color", "bg-slate-100 text-slate-600 border-slate-200"),
        "score": score,
        "created_at": datetime.datetime.utcnow()
    }
    result = db.day_types.insert_one(doc)
    new_doc = db.day_types.find_one({"_id": result.inserted_id})
    return jsonify(_serialize(new_doc)), 201

@day_mgmt_bp.route("/day-types/<id>", methods=["PUT"])
def update_day_type(id):
    db = get_db()
    data = request.get_json()
    update = {}
    if "name" in data:
        update["name"] = data["name"].strip()
    if "color" in data:
        update["color"] = data["color"]
    if "score" in data:
        update["score"] = max(0, int(data["score"]))

    if not update:
        return jsonify({"error": "nothing to update"}), 400
        
    db.day_types.update_one({"_id": ObjectId(id)}, {"$set": update})
    doc = db.day_types.find_one({"_id": ObjectId(id)})
    return jsonify(_serialize(doc))

@day_mgmt_bp.route("/day-types/<id>", methods=["DELETE"])
def delete_day_type(id):
    db = get_db()
    db.day_types.delete_one({"_id": ObjectId(id)})
    return jsonify({"ok": True})

# --- Day Settings ---

@day_mgmt_bp.route("/day-settings/<int:year>/<int:month>", methods=["GET"])
def get_month_settings(year, month):
    db = get_db()
    prefix = f"{year}-{month:02d}-"
    settings = list(db.day_settings.find({"date": {"$regex": f"^{prefix}"}}))
    for s in settings:
        s["id"] = str(s.pop("_id"))
    return jsonify(settings)

@day_mgmt_bp.route("/day-settings", methods=["POST"])
def set_day_setting():
    db = get_db()
    data = request.get_json()
    date_str = data.get("date")
    day_type_id = data.get("day_type_id")
    
    if not date_str:
        return jsonify({"error": "date is required"}), 400
        
    if not day_type_id:
        db.day_settings.delete_one({"date": date_str})
        return jsonify({"ok": True})
        
    db.day_settings.update_one(
        {"date": date_str},
        {"$set": {"day_type_id": day_type_id, "updated_at": datetime.datetime.utcnow()}},
        upsert=True
    )
    return jsonify({"ok": True})

@day_mgmt_bp.route("/config/shabbat-score", methods=["GET"])
def get_shabbat_score():
    db = get_db()
    cfg = db.config.find_one({"key": "shabbat_score"})
    return jsonify({"score": cfg["value"] if cfg else 2})

@day_mgmt_bp.route("/config/shabbat-score", methods=["PUT"])
def set_shabbat_score():
    db = get_db()
    data = request.get_json()
    score = max(0, int(data.get("score", 2)))
    db.config.update_one({"key": "shabbat_score"}, {"$set": {"value": score}}, upsert=True)
    return jsonify({"score": score})

@day_mgmt_bp.route("/day-type-justice", methods=["GET"])
def day_type_justice():
    import datetime as dt_mod
    start_str = request.args.get("start_date")
    end_str = request.args.get("end_date")
    db = get_db()

    cfg = db.config.find_one({"key": "shabbat_score"})
    shabbat_score = cfg["value"] if cfg else 2

    day_types_list = list(db.day_types.find())
    day_types_map = {
        str(d["_id"]): {"id": str(d["_id"]), "name": d["name"], "color": d.get("color", ""), "score": d.get("score", 0)}
        for d in day_types_list
    }

    # Build day_settings map {date_str: day_type_id}
    day_settings = {}
    if start_str and end_str:
        settings = list(db.day_settings.find({"date": {"$gte": start_str, "$lte": end_str}}))
        for s in settings:
            day_settings[s["date"]] = s["day_type_id"]

    schedules = list(db.schedules.find({"status": "generated"}))
    emp_data = {}  # {name: {shabbat_count, by_type: {type_id: count}}}

    for sched in schedules:
        year = sched["year"]
        month = sched["month"]
        for a in sched.get("assignments", []):
            day_num = a.get("day")
            emp_name = a.get("employee_name", "")
            if not emp_name or not day_num:
                continue
            try:
                date_obj = dt_mod.date(year, month, day_num)
                date_str = date_obj.isoformat()
            except Exception:
                continue
            if start_str and date_str < start_str:
                continue
            if end_str and date_str > end_str:
                continue

            if emp_name not in emp_data:
                emp_data[emp_name] = {"shabbat_count": 0, "by_type": {}}

            # Saturday: Python weekday() == 5
            if date_obj.weekday() == 5:
                emp_data[emp_name]["shabbat_count"] += 1

            dt_id = day_settings.get(date_str)
            if dt_id and dt_id in day_types_map:
                emp_data[emp_name]["by_type"][dt_id] = emp_data[emp_name]["by_type"].get(dt_id, 0) + 1

    employees = []
    for name, d in emp_data.items():
        total_score = d["shabbat_count"] * shabbat_score
        by_type_scored = {}
        for type_id, count in d["by_type"].items():
            score_per = day_types_map.get(type_id, {}).get("score", 0)
            by_type_scored[type_id] = {"count": count, "score": count * score_per}
            total_score += count * score_per
        employees.append({
            "name": name,
            "shabbat_count": d["shabbat_count"],
            "shabbat_score": d["shabbat_count"] * shabbat_score,
            "by_type": by_type_scored,
            "total_score": total_score,
        })
    employees.sort(key=lambda e: e["total_score"], reverse=True)

    return jsonify({
        "day_types": list(day_types_map.values()),
        "shabbat_score": shabbat_score,
        "employees": employees,
    })
