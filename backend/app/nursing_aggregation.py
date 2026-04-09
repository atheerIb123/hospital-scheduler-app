"""Aggregate weekly nursing schedules across department DBs for stats / justice.

Doctors mode uses monthly schedules in a single DB; nursing stores weekly
schedules per department. This module is only used when is_nursing_request().
"""
from __future__ import annotations

from datetime import date as date_type, timedelta
from typing import Any, Dict, Iterator, List, Optional, Tuple
from urllib.parse import unquote

from flask import current_app, has_request_context, request

from .db import get_client


def is_nursing_request() -> bool:
    if not has_request_context():
        return False
    raw = request.headers.get("X-App-Mode", "").strip()
    if not raw:
        return False
    mode_str = unquote(raw).replace(" ", "_").replace("-", "_")
    return mode_str.startswith("nursing")


def nursing_department_filter_from_request() -> Optional[str]:
    """None = all nursing departments; str = one department (exact name from config)."""
    if not has_request_context():
        return None
    raw = request.headers.get("X-App-Mode", "").strip()
    if not raw:
        return None
    mode_str = unquote(raw).replace(" ", "_").replace("-", "_")
    if not mode_str.startswith("nursing"):
        return None
    rest = mode_str[len("nursing") :].lstrip("_")
    return rest or None


def _sanitize_dept(name: str) -> str:
    return name.replace(" ", "_").replace(".", "_")


def iter_nursing_department_databases(
    department_filter: Optional[str] = None,
) -> Iterator[Tuple[str, Any]]:
    """Yield (department_name, pymongo.Database) for each nursing dept DB."""
    from .routes.departments import build_department_list

    base_name = current_app.config["MONGO_DB_NAME"]
    client = get_client()
    for dep in build_department_list():
        if department_filter and dep != department_filter:
            continue
        dbname = f"{base_name}_nursing_{_sanitize_dept(dep)}"
        yield dep, client[dbname]


def assignment_date_in_week(sched: dict, day_of_month: int) -> Optional[date_type]:
    """Map stored assignment day (calendar day within the week window) to a date."""
    ws_str = sched.get("week_start")
    if not ws_str:
        return None
    try:
        week_start = date_type.fromisoformat(ws_str)
    except ValueError:
        return None
    for i in range(7):
        d = week_start + timedelta(days=i)
        if d.day == int(day_of_month):
            return d
    return None


def latest_weekly_schedule_docs(
    department_filter: Optional[str] = None,
) -> List[Tuple[str, dict]]:
    """Latest generated weekly schedule per (department, week_start)."""
    latest: Dict[Tuple[str, str], dict] = {}
    for dep, ddb in iter_nursing_department_databases(department_filter):
        for sched in ddb.schedules.find(
            {"status": "generated", "schedule_type": "weekly"},
            sort=[("generated_at", 1)],
        ):
            ws = sched.get("week_start") or ""
            latest[(dep, ws)] = sched
    return [(dep, s) for (dep, ws), s in sorted(
        ((k[0], k[1]), v) for k, v in latest.items()
    )]


def build_des_maps_per_dept(
    department_filter: Optional[str] = None,
) -> Dict[str, Dict[str, int]]:
    """department -> shift_name -> justice points (from desirability)."""
    from .constants import JUSTICE_PTS

    out: Dict[str, Dict[str, int]] = {}
    for dep, ddb in iter_nursing_department_databases(department_filter):
        des_map: Dict[str, int] = {}
        for st in ddb.shift_types.find():
            des = int(st.get("desirability", 3))
            pts = JUSTICE_PTS.get(des, 4)
            for name in st.get("names", []):
                des_map[name] = pts
        out[dep] = des_map
    return out


def build_des_level_maps_per_dept(
    department_filter: Optional[str] = None,
) -> Dict[str, Dict[str, int]]:
    """department -> shift_name -> desirability level."""
    out: Dict[str, Dict[str, int]] = {}
    for dep, ddb in iter_nursing_department_databases(department_filter):
        lvl_map: Dict[str, int] = {}
        for st in ddb.shift_types.find():
            des = int(st.get("desirability", 3))
            for name in st.get("names", []):
                lvl_map[name] = des
        out[dep] = lvl_map
    return out
