from pymongo import MongoClient
from flask import request, current_app, has_request_context
from urllib.parse import unquote

_client = None


def init_db(app):
    global _client
    _client = MongoClient(app.config["MONGO_URI"])


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
