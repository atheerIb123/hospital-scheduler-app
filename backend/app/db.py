from pymongo import MongoClient
from flask import request, current_app, has_request_context

_client = None

def init_db(app):
    global _client
    _client = MongoClient(app.config["MONGO_URI"])


def get_db():
    mode = None
    if has_request_context():
        mode = request.headers.get("X-App-Mode", "").strip().lower()
    
    base_name = current_app.config["MONGO_DB_NAME"]
    if mode in ["doctors", "nursing", "cleaning"]:
        db_name = f"{base_name}_{mode}"
    else:
        db_name = base_name
        
    return _client[db_name]
