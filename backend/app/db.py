from pymongo import MongoClient

_client = None
_db = None


def init_db(app):
    global _client, _db
    _client = MongoClient(app.config["MONGO_URI"])
    _db = _client[app.config["MONGO_DB_NAME"]]


def get_db():
    return _db
