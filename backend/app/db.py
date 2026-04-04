import copy
from pymongo import MongoClient
from flask import request, current_app, has_request_context
from urllib.parse import unquote

_client = None


def init_db(app):
    global _client
    _client = MongoClient(app.config["MONGO_URI"])

def get_client():
    return _client

def get_db():
    mode = None
    if has_request_context():
        raw = request.headers.get("X-App-Mode", "").strip()
        if raw:
            mode = unquote(raw).replace(" ", "_").replace("-", "_")

    base_name = current_app.config["MONGO_DB_NAME"]
    if not mode:
        mode = "doctors"

    db_name = f"{base_name}_{mode}"
    return _client[db_name]


def get_global_db():
    """Return the shared global database (not scoped to any department/mode).
    Used for configuration that should be consistent across all views,
    such as day types, day settings, and weekday scores.
    """
    base_name = current_app.config["MONGO_DB_NAME"]
    return _client[f"{base_name}_global"]


def get_nursing_employees_db():
    """Return the shared nursing employees database.
    All nursing departments share one employees collection so that
    employees are not separated by department. The only per-employee
    distinction is the home_department field.
    Falls back to get_db() for non-nursing modes.
    """
    if has_request_context():
        raw = request.headers.get("X-App-Mode", "").strip()
        mode = unquote(raw).replace(" ", "_").replace("-", "_") if raw else ""
        if mode.startswith("nursing"):
            base_name = current_app.config["MONGO_DB_NAME"]
            return _client[f"{base_name}_nursing"]
    return get_db()


def _dept_db_name(base_name: str, department_name: str) -> str:
    """Sanitize a department name for use as a MongoDB database name segment.
    MongoDB does not allow spaces or dots in database names.
    """
    safe = department_name.replace(" ", "_").replace(".", "_")
    return f"{base_name}_nursing_{safe}"


def ensure_nursing_dept_db(department_name: str):
    """Ensure the nursing department DB has shift types and composition.

    If the department's DB is empty, copies config from the first sibling
    department that has shift types configured.  If no sibling exists,
    seeds with the built-in nursing defaults.

    Returns the pymongo Database for ``{base}_nursing_{department_name}``.
    """
    base_name = current_app.config["MONGO_DB_NAME"]
    dept_db = _client[_dept_db_name(base_name, department_name)]

    if dept_db.shift_types.count_documents({}) > 0:
        return dept_db

    # --- find a template department that already has config ---
    from .routes.departments import build_department_list

    template_db = None
    for dep in build_department_list():
        if dep == department_name:
            continue
        trial = _client[_dept_db_name(base_name, dep)]
        if trial.shift_types.count_documents({}) > 0:
            template_db = trial
            break

    if template_db is not None:
        for st in template_db.shift_types.find():
            st.pop("_id", None)
            dept_db.shift_types.insert_one(st)
        comp = template_db.shift_composition.find_one({}, {"_id": 0})
        if comp:
            dept_db.shift_composition.replace_one({}, comp, upsert=True)
        for rule in template_db.attribute_rules.find():
            rule.pop("_id", None)
            dept_db.attribute_rules.insert_one(rule)
        cfg = template_db.config.find_one({"key": "csv_column_headers"}, {"_id": 0})
        if cfg:
            dept_db.config.replace_one({"key": "csv_column_headers"}, cfg, upsert=True)
    else:
        from .routes.shift_composition import (
            _NURSING_SHIFT_TYPES,
            _NURSING_DEFAULT_COMPOSITION,
        )
        dept_db.shift_types.insert_many(
            [copy.deepcopy(st) for st in _NURSING_SHIFT_TYPES]
        )
        dept_db.shift_composition.replace_one(
            {},
            {"shift_configs": copy.deepcopy(_NURSING_DEFAULT_COMPOSITION)},
            upsert=True,
        )
        nursing_db = _client[f"{base_name}_nursing"]
        cfg = nursing_db.config.find_one({"key": "csv_column_headers"}, {"_id": 0})
        if cfg:
            dept_db.config.replace_one({"key": "csv_column_headers"}, cfg, upsert=True)

    return dept_db
