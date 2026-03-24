from flask import Blueprint, request, jsonify
from bson import ObjectId
from ..db import get_db, get_global_db
import datetime

day_mgmt_bp = Blueprint("day_management", __name__)


def _serialize(doc):
    doc["id"] = str(doc.pop("_id"))
    return doc


# --- Day Types ---


@day_mgmt_bp.route("/day-types", methods=["GET"])
def list_day_types():
    db = get_global_db()
    return jsonify([_serialize(d) for d in db.day_types.find().sort("name", 1)])


@day_mgmt_bp.route("/day-types", methods=["POST"])
def create_day_type():
    db = get_global_db()
    data = request.get_json()
    name = data.get("name", "").strip()
    if not name:
        return jsonify({"error": "name is required"}), 400

    score = max(0, int(data.get("score", 0)))
    doc = {
        "name": name,
        "color": data.get("color", "bg-slate-100 text-slate-600 border-slate-200"),
        "score": score,
        "created_at": datetime.datetime.utcnow(),
    }
    result = db.day_types.insert_one(doc)
    new_doc = db.day_types.find_one({"_id": result.inserted_id})
    return jsonify(_serialize(new_doc)), 201


@day_mgmt_bp.route("/day-types/<id>", methods=["PUT"])
def update_day_type(id):
    db = get_global_db()
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
    db = get_global_db()
    db.day_types.delete_one({"_id": ObjectId(id)})
    return jsonify({"ok": True})


# --- Day Settings ---


@day_mgmt_bp.route("/day-settings/<int:year>/<int:month>", methods=["GET"])
def get_month_settings(year, month):
    db = get_global_db()
    prefix = f"{year}-{month:02d}-"
    settings = list(db.day_settings.find({"date": {"$regex": f"^{prefix}"}}))
    for s in settings:
        s["id"] = str(s.pop("_id"))
    return jsonify(settings)


@day_mgmt_bp.route("/day-settings", methods=["POST"])
def set_day_setting():
    db = get_global_db()
    data = request.get_json()
    date_str = data.get("date")
    day_type_id = data.get("day_type_id")

    if not date_str:
        return jsonify({"error": "date is required"}), 400

    score = data.get("score")

    if not day_type_id:
        db.day_settings.delete_one({"date": date_str})
        return jsonify({"ok": True})

    db.day_settings.update_one(
        {"date": date_str},
        {
            "$set": {
                "day_type_id": day_type_id,
                "score": score,
                "updated_at": datetime.datetime.utcnow(),
            }
        },
        upsert=True,
    )
    return jsonify({"ok": True})


@day_mgmt_bp.route("/config/shabbat-score", methods=["GET"])
def get_shabbat_score():
    db = get_global_db()
    cfg = db.config.find_one({"key": "shabbat_score"})
    return jsonify({"score": cfg["value"] if cfg else 2})


@day_mgmt_bp.route("/config/shabbat-score", methods=["PUT"])
def set_shabbat_score():
    db = get_global_db()
    data = request.get_json()
    score = max(0, int(data.get("score", 2)))
    db.config.update_one(
        {"key": "shabbat_score"}, {"$set": {"value": score}}, upsert=True
    )
    return jsonify({"score": score})


def _get_weekday_scores(db):
    """Return weekday scores dict {str(0..6): score}. 0=Mon,4=Fri,5=Sat,6=Sun."""
    defaults = {str(i): 0 for i in range(7)}
    defaults["4"] = 2
    defaults["5"] = 2
    cfg = db.config.find_one({"key": "weekday_scores"})
    if cfg and isinstance(cfg.get("value"), dict):
        for i in range(7):
            k = str(i)
            if k in cfg["value"]:
                defaults[k] = cfg["value"][k]
    return defaults


@day_mgmt_bp.route("/config/weekday-scores", methods=["GET"])
def get_weekday_scores():
    db = get_global_db()
    return jsonify(_get_weekday_scores(db))


@day_mgmt_bp.route("/config/weekday-scores", methods=["PUT"])
def set_weekday_scores():
    db = get_global_db()
    data = request.get_json()
    scores = {str(i): max(0, int(data.get(str(i), 0))) for i in range(7)}
    db.config.update_one(
        {"key": "weekday_scores"}, {"$set": {"value": scores}}, upsert=True
    )
    return jsonify(scores)


@day_mgmt_bp.route("/day-type-justice", methods=["GET"])
def day_type_justice():
    import datetime as dt_mod

    start_str = request.args.get("start_date")
    end_str = request.args.get("end_date")
    db = get_global_db()
    sched_db = get_db()

    weekday_scores = _get_weekday_scores(db)

    day_types_list = list(db.day_types.find())
    day_types_map = {
        str(d["_id"]): {
            "id": str(d["_id"]),
            "name": d["name"],
            "color": d.get("color", ""),
            "score": d.get("score", 0),
        }
        for d in day_types_list
    }

    # Build day_settings map {date_str: day_type_id} and per-date score overrides
    day_settings = {}
    date_score_map: dict = {}
    if start_str and end_str:
        settings = list(
            db.day_settings.find({"date": {"$gte": start_str, "$lte": end_str}})
        )
        for s in settings:
            day_settings[s["date"]] = s["day_type_id"]
            if s.get("score") is not None:
                date_score_map[s["date"]] = s["score"]

    # Keep only the latest generated schedule per (year, month) — same as /justice
    latest_map = {}
    for s in sched_db.schedules.find({"status": "generated"}, sort=[("generated_at", 1)]):
        latest_map[(s.get("year"), s.get("month"))] = s
    schedules = list(latest_map.values())
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
                emp_data[emp_name] = {
                    "shabbat_count": 0,
                    "shabbat_dates": {},
                    "by_type": {},
                    "by_type_dates": {},
                }

            # Friday=4 or Saturday=5 counts as Shabbat
            if date_obj.weekday() in (4, 5):  # Friday=4, Saturday=5 in Python
                emp_data[emp_name]["shabbat_count"] += 1
                emp_data[emp_name]["shabbat_dates"][date_str] = (
                    emp_data[emp_name]["shabbat_dates"].get(date_str, 0) + 1
                )

            dt_id = day_settings.get(date_str)
            if dt_id and dt_id in day_types_map:
                emp_data[emp_name]["by_type"][dt_id] = (
                    emp_data[emp_name]["by_type"].get(dt_id, 0) + 1
                )
                emp_data[emp_name]["by_type_dates"].setdefault(dt_id, {})[date_str] = (
                    emp_data[emp_name]["by_type_dates"].get(dt_id, {}).get(date_str, 0)
                    + 1
                )

    employees = []
    for name, d in emp_data.items():
        # Compute shabbat score — use per-date override, then weekday score
        shabbat_total = 0
        for date_str_key, count in d.get("shabbat_dates", {}).items():
            try:
                wd = str(dt_mod.date.fromisoformat(date_str_key).weekday())
            except Exception:
                wd = "5"
            default_score = weekday_scores.get(wd, 0)
            effective = date_score_map.get(date_str_key, default_score)
            shabbat_total += count * effective
        total_score = shabbat_total
        by_type_scored = {}
        for type_id, count in d["by_type"].items():
            default_score_per = day_types_map.get(type_id, {}).get("score", 0)
            # Sum per-date scores for this type, using per-date override when available
            type_score_total = 0
            for date_str_key, cnt in (
                d.get("by_type_dates", {}).get(type_id, {}).items()
            ):
                effective = date_score_map.get(date_str_key, default_score_per)
                type_score_total += cnt * effective
            by_type_scored[type_id] = {"count": count, "score": type_score_total}
            total_score += type_score_total
        employees.append(
            {
                "name": name,
                "shabbat_count": d["shabbat_count"],
                "shabbat_score": shabbat_total,
                "by_type": by_type_scored,
                "total_score": total_score,
            }
        )
    employees.sort(key=lambda e: e["total_score"], reverse=True)

    return jsonify(
        {
            "day_types": list(day_types_map.values()),
            "weekday_scores": weekday_scores,
            "employees": employees,
        }
    )


@day_mgmt_bp.route("/day-type-justice/breakdown", methods=["GET"])
def day_type_justice_breakdown():
    import datetime as dt_mod

    employee_name = request.args.get("employee", "")
    start_str = request.args.get("start_date")
    end_str = request.args.get("end_date")
    db = get_global_db()
    sched_db = get_db()

    weekday_scores = _get_weekday_scores(db)

    day_types_list = list(db.day_types.find())
    day_types_map = {
        str(d["_id"]): {
            "name": d["name"],
            "color": d.get("color", ""),
            "score": d.get("score", 0),
        }
        for d in day_types_list
    }

    day_settings = {}
    date_score_map: dict = {}
    if start_str and end_str:
        settings = list(
            db.day_settings.find({"date": {"$gte": start_str, "$lte": end_str}})
        )
        for s in settings:
            day_settings[s["date"]] = s.get("day_type_id")
            if s.get("score") is not None:
                date_score_map[s["date"]] = s["score"]

    latest_map: dict = {}
    for s in sched_db.schedules.find({"status": "generated"}, sort=[("generated_at", 1)]):
        latest_map[(s.get("year"), s.get("month"))] = s

    HE_DAYS = {
        0: "שני",
        1: "שלישי",
        2: "רביעי",
        3: "חמישי",
        4: "שישי",
        5: "שבת",
        6: "ראשון",
    }

    rows = []
    for sched in latest_map.values():
        year = sched.get("year")
        month = sched.get("month")
        for a in sched.get("assignments", []):
            if a.get("employee_name") != employee_name:
                continue
            try:
                date_obj = dt_mod.date(year, month, int(a["day"]))
                date_str = date_obj.isoformat()
            except Exception:
                continue
            if start_str and date_str < start_str:
                continue
            if end_str and date_str > end_str:
                continue

            wd = date_obj.weekday()
            is_shabbat = wd in (4, 5)
            dt_id = day_settings.get(date_str)
            dt_info = day_types_map.get(dt_id) if dt_id else None

            if not is_shabbat and not dt_id:
                continue

            shabbat_score = 0
            if is_shabbat:
                default = weekday_scores.get(str(wd), 0)
                shabbat_score = date_score_map.get(date_str, default)

            day_type_score = 0
            if dt_id and dt_info:
                default = dt_info["score"]
                day_type_score = date_score_map.get(date_str, default)

            rows.append(
                {
                    "date": date_str,
                    "day_of_week": HE_DAYS.get(wd, ""),
                    "shift_name": a.get("shift_name", ""),
                    "is_shabbat": is_shabbat,
                    "shabbat_score": shabbat_score,
                    "day_type": dt_info["name"] if dt_info else None,
                    "day_type_color": dt_info["color"] if dt_info else None,
                    "day_type_score": day_type_score,
                    "total": shabbat_score + day_type_score,
                }
            )

    rows.sort(key=lambda r: r["date"])
    return jsonify(
        {
            "employee": employee_name,
            "rows": rows,
            "total": sum(r["total"] for r in rows),
        }
    )
