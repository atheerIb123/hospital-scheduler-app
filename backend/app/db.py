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
            # Decode URI component and sanitize string for MongoDB
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
