import traceback
from datetime import datetime, timezone, date as date_type
from flask import Blueprint, request, jsonify
from bson import ObjectId
from ..db import get_db
from ..scheduler.solver import generate_schedule
from .day_management import _get_weekday_scores
from ..constants import JUSTICE_PTS

schedule_bp = Blueprint("schedule", __name__)


def _serialize(doc):
    doc["id"] = str(doc.pop("_id"))
    return doc


@schedule_bp.post("/schedules/generate")
def generate():
    db = get_db()
    try:
        data = request.get_json()
        month = int(data.get("month", datetime.now().month))
        year = int(data.get("year", datetime.now().year))

        employees = list(db.employees.find())
        shift_types = [s for s in db.shift_types.find() if not s.get("skip", False)]
        rules = list(db.attribute_rules.find())

        # Load constraints and day settings for the requested month/year
        month_prefix = f"{year:04d}-{month:02d}-"
        constraints = list(
            db.constraints.find({"date": {"$regex": f"^{month_prefix}"}})
        )
        day_settings = list(
            db.day_settings.find({"date": {"$regex": f"^{month_prefix}"}})
        )

        if not employees:
            return jsonify(
                {
                    "status": "failed",
                    "reason": "אין עובדים מוגדרים. ייבא קובץ CSV תחילה.",
                }
            ), 400
        if not shift_types:
            return jsonify(
                {"status": "failed", "reason": "אין סוגי משמרות מוגדרים."}
            ), 400

        # ── Weekday scores from DB (configurable via day-management UI) ──────
        weekday_scores = _get_weekday_scores(db)

        # ── Day-type extra scores (holidays, special days) ───────────────────
        # day_type_score_map: {day_type_id_str: score}
        day_type_score_map: dict = {
            str(dt["_id"]): int(dt.get("score", 0)) for dt in db.day_types.find()
        }

        # day_extra_by_date: {date_str: extra_score}
        # Built from all day_settings ever recorded — used for historical justice
        # and also filtered to the current month for the solver.
        day_extra_by_date: dict = {}
        for ds in db.day_settings.find():
            dt_id = ds.get("day_type_id", "")
            # Per-date score override takes priority over the day-type default
            extra = (
                ds["score"]
                if ds.get("score") is not None
                else day_type_score_map.get(dt_id, 0)
            )
            day_extra_by_date[ds["date"]] = extra

        # day_extra_scores for the solver: {day_num (1-31): extra_score}
        day_extra_scores: dict = {}
        for ds in day_settings:  # already filtered to current month
            dnum = int(ds["date"].split("-")[-1])
            dt_id = ds.get("day_type_id", "")
            extra = (
                ds["score"]
                if ds.get("score") is not None
                else day_type_score_map.get(dt_id, 0)
            )
            day_extra_scores[dnum] = extra

        # ── Historical justice scores (all sources) ──────────────────────────
        # Full formula per assignment:
        #   pts = JUSTICE_PTS[desirability]
        #       + weekday_scores[weekday]          (ALL days including Fri/Sat)
        #       + day_extra_by_date[date]          (holiday / special day bonus)
        des_map: dict = {}
        for st in db.shift_types.find():
            des = int(st.get("desirability", 3))
            pts = JUSTICE_PTS.get(des, 4)
            for name in st.get("names", []):
                des_map[name] = pts

        name_to_eid = {str(e["name"]): str(e["_id"]) for e in employees}

        historical_justice: dict = {}
        latest_per_month: dict = {}
        for sched in db.schedules.find(
            {"status": "generated", "year": year, "month": {"$lt": month}},
            sort=[("generated_at", 1)],
        ):
            latest_per_month[sched.get("month")] = sched

        for sched in latest_per_month.values():
            sched_year = sched.get("year")
            sched_month = sched.get("month")
            for a in sched.get("assignments", []):
                emp_name = a.get("employee_name", "")
                eid = name_to_eid.get(emp_name)
                if not eid:
                    continue
                try:
                    a_date = date_type(sched_year, sched_month, int(a["day"]))
                except (ValueError, TypeError, KeyError):
                    continue
                pts = des_map.get(a.get("shift_name", ""), 4)
                pts += weekday_scores.get(str(a_date.weekday()), 0)  # all days
                pts += day_extra_by_date.get(a_date.isoformat(), 0)  # holidays
                historical_justice[eid] = historical_justice.get(eid, 0) + pts

        result = generate_schedule(
            employees,
            shift_types,
            rules,
            month,
            year,
            constraints,
            day_settings,
            historical_justice=historical_justice,
            weekday_scores=weekday_scores,
            day_extra_scores=day_extra_scores,
        )

        doc = {
            "month": month,
            "year": year,
            "generated_at": datetime.now(timezone.utc),
            "status": result["status"],
        }
        if result["status"] == "generated":
            doc["assignments"] = result["assignments"]
            doc["summary"] = result["summary"]
        else:
            doc["reason"] = result.get("reason", "שגיאה לא ידועה")

        inserted = db.schedules.insert_one(doc)
        saved = db.schedules.find_one({"_id": inserted.inserted_id})
        saved["id"] = str(saved.pop("_id"))
        if "generated_at" in saved:
            saved["generated_at"] = saved["generated_at"].isoformat()

        status_code = 200 if result["status"] == "generated" else 422
        return jsonify(saved), status_code

    except Exception:
        traceback.print_exc()
        return jsonify(
            {"status": "failed", "reason": "שגיאת שרת פנימית. ראה לוג."}
        ), 500


@schedule_bp.get("/schedules/latest")
def get_latest():
    """
    Without params: returns the most recent generated schedule.
    With ?month=X&year=Y: returns the most recent generated schedule for that month/year.
    """
    db = get_db()
    month = request.args.get("month", type=int)
    year = request.args.get("year", type=int)
    query: dict = {"status": "generated"}
    if month and year:
        query["month"] = month
        query["year"] = year
    schedule = db.schedules.find_one(query, sort=[("generated_at", -1)])
    if not schedule:
        return jsonify(None)
    schedule["id"] = str(schedule.pop("_id"))
    if "generated_at" in schedule:
        schedule["generated_at"] = schedule["generated_at"].isoformat()
    return jsonify(schedule)


@schedule_bp.route("/schedules/<schedule_id>/assignments", methods=["PATCH"])
def update_assignments(schedule_id):
    db = get_db()
    data = request.get_json()
    assignments = data.get("assignments", [])
    db.schedules.update_one(
        {"_id": ObjectId(schedule_id)}, {"$set": {"assignments": assignments}}
    )
    schedule = db.schedules.find_one({"_id": ObjectId(schedule_id)})
    schedule["id"] = str(schedule.pop("_id"))
    if "generated_at" in schedule:
        schedule["generated_at"] = schedule["generated_at"].isoformat()
    return jsonify(schedule)


@schedule_bp.get("/justice")
def get_justice():
    db = get_db()

    # Optional date range filter
    start_date = None
    end_date = None
    start_str = request.args.get("start_date")
    end_str = request.args.get("end_date")
    if start_str:
        try:
            start_date = date_type.fromisoformat(start_str)
        except ValueError:
            pass
    if end_str:
        try:
            end_date = date_type.fromisoformat(end_str)
        except ValueError:
            pass

    # Build desirability map: shift_name → justice points
    des_map: dict = {}
    for st in db.shift_types.find():
        des = st.get("desirability", 3)
        pts = JUSTICE_PTS.get(int(des), 4)
        for name in st.get("names", []):
            des_map[name] = pts

    # For each (month, year) pair keep only the most recently generated schedule
    latest_schedules: dict = {}
    for schedule in db.schedules.find(
        {"status": "generated"}, sort=[("generated_at", 1)]
    ):
        key = (schedule.get("year"), schedule.get("month"))
        latest_schedules[key] = schedule

    # Weekday scores for non-Shabbat days → added to regular justice
    weekday_scores = _get_weekday_scores(db)

    # Aggregate justice scores from one schedule per month
    justice: dict = {}
    for schedule in latest_schedules.values():
        sched_year = schedule.get("year")
        sched_month = schedule.get("month")
        for a in schedule.get("assignments", []):
            try:
                a_date = date_type(sched_year, sched_month, int(a["day"]))
            except (ValueError, TypeError, KeyError):
                continue
            if start_date and a_date < start_date:
                continue
            if end_date and a_date > end_date:
                continue
            emp = a["employee_name"]
            pts = des_map.get(a["shift_name"], 4)
            justice.setdefault(emp, {"score": 0, "shifts": 0})
            justice[emp]["score"] += pts
            # Add weekday score for Sun–Thu (not Friday=4 or Saturday=5)
            wd = a_date.weekday()
            if wd not in (4, 5):
                justice[emp]["score"] += weekday_scores.get(str(wd), 0)
            justice[emp]["shifts"] += 1

    # Aggregate volunteer scores
    volunteer: dict = {}
    for vol in db.volunteers.find():
        if start_date or end_date:
            try:
                v_date = date_type(int(vol["year"]), int(vol["month"]), int(vol["day"]))
            except (ValueError, TypeError, KeyError):
                continue
            if start_date and v_date < start_date:
                continue
            if end_date and v_date > end_date:
                continue
        emp = vol["employee_name"]
        pts = des_map.get(vol["shift_name"], 4)
        volunteer.setdefault(emp, {"score": 0, "count": 0})
        volunteer[emp]["score"] += pts
        volunteer[emp]["count"] += 1

    employees = list(db.employees.find())
    result = []
    for emp in employees:
        name = emp["name"]
        j = justice.get(name, {"score": 0, "shifts": 0})
        v = volunteer.get(name, {"score": 0, "count": 0})
        result.append(
            {
                "employee_name": name,
                "employee_id": str(emp["_id"]),
                "justice_score": j["score"],
                "justice_shifts": j["shifts"],
                "volunteer_score": v["score"],
                "volunteer_count": v["count"],
            }
        )

    return jsonify(result)


@schedule_bp.get("/justice/breakdown")
def get_justice_breakdown():
    db = get_db()
    employee_name = request.args.get("employee", "")
    start_str = request.args.get("start_date")
    end_str = request.args.get("end_date")

    start_date = None
    end_date = None
    if start_str:
        try:
            start_date = date_type.fromisoformat(start_str)
        except ValueError:
            pass
    if end_str:
        try:
            end_date = date_type.fromisoformat(end_str)
        except ValueError:
            pass

    des_map: dict = {}
    des_level_map: dict = {}
    for st in db.shift_types.find():
        des = int(st.get("desirability", 3))
        pts = JUSTICE_PTS.get(des, 4)
        for name in st.get("names", []):
            des_map[name] = pts
            des_level_map[name] = des

    latest_schedules: dict = {}
    for s in db.schedules.find({"status": "generated"}, sort=[("generated_at", 1)]):
        latest_schedules[(s.get("year"), s.get("month"))] = s

    weekday_scores = _get_weekday_scores(db)
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
    for sched in latest_schedules.values():
        year = sched.get("year")
        month = sched.get("month")
        for a in sched.get("assignments", []):
            if a.get("employee_name") != employee_name:
                continue
            try:
                a_date = date_type(year, month, int(a["day"]))
            except Exception:
                continue
            if start_date and a_date < start_date:
                continue
            if end_date and a_date > end_date:
                continue
            shift = a.get("shift_name", "")
            des_pts = des_map.get(shift, 4)
            des_lvl = des_level_map.get(shift, 3)
            wd = a_date.weekday()
            wd_score = weekday_scores.get(str(wd), 0) if wd not in (4, 5) else 0
            rows.append(
                {
                    "date": a_date.isoformat(),
                    "day_of_week": HE_DAYS.get(wd, ""),
                    "shift_name": shift,
                    "desirability": des_lvl,
                    "desirability_points": des_pts,
                    "weekday_score": wd_score,
                    "total": des_pts + wd_score,
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


@schedule_bp.get("/justice/volunteer-breakdown")
def get_volunteer_breakdown():
    db = get_db()
    employee_name = request.args.get("employee", "")
    start_str = request.args.get("start_date")
    end_str = request.args.get("end_date")

    start_date = None
    end_date = None
    if start_str:
        try:
            start_date = date_type.fromisoformat(start_str)
        except ValueError:
            pass
    if end_str:
        try:
            end_date = date_type.fromisoformat(end_str)
        except ValueError:
            pass

    des_map: dict = {}
    des_level_map: dict = {}
    for st in db.shift_types.find():
        des = int(st.get("desirability", 3))
        pts = JUSTICE_PTS.get(des, 4)
        for name in st.get("names", []):
            des_map[name] = pts
            des_level_map[name] = des

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
    for vol in db.volunteers.find({"employee_name": employee_name}):
        try:
            v_date = date_type(int(vol["year"]), int(vol["month"]), int(vol["day"]))
        except Exception:
            continue
        if start_date and v_date < start_date:
            continue
        if end_date and v_date > end_date:
            continue
        shift = vol.get("shift_name", "")
        des_pts = des_map.get(shift, 4)
        des_lvl = des_level_map.get(shift, 3)
        wd = v_date.weekday()
        rows.append(
            {
                "date": v_date.isoformat(),
                "day_of_week": HE_DAYS.get(wd, ""),
                "shift_name": shift,
                "desirability": des_lvl,
                "desirability_points": des_pts,
                "total": des_pts,
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


@schedule_bp.get("/schedules/<schedule_id>")
def get_schedule(schedule_id):
    db = get_db()
    schedule = db.schedules.find_one({"_id": ObjectId(schedule_id)})
    if not schedule:
        return jsonify({"error": "Not found"}), 404
    schedule["id"] = str(schedule.pop("_id"))
    if "generated_at" in schedule:
        schedule["generated_at"] = schedule["generated_at"].isoformat()
    return jsonify(schedule)
