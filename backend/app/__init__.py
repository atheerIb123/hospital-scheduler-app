from flask import Flask
from flask_cors import CORS
from .config import Config
from .db import init_db, get_db, get_client, _dept_db_name
from .routes import register_routes
from .seed import seed_attribute_rules


def _remove_reserve_shifts_from_all_depts(app):
    """One-time migration: remove רזרבה/כוננות shift types and compositions from all dept DBs."""
    from .routes.shift_composition import _REMOVED_SHIFT_NAMES
    from .routes.departments import build_department_list

    base_name = app.config["MONGO_DB_NAME"]
    client = get_client()

    for dept in build_department_list():
        dept_db = client[_dept_db_name(base_name, dept)]
        # Remove matching shift types (any name in the names array matches)
        dept_db.shift_types.delete_many({"names": {"$elemMatch": {"$in": list(_REMOVED_SHIFT_NAMES)}}})
        # Remove matching entries from shift_composition config
        comp = dept_db.shift_composition.find_one({})
        if comp:
            configs = comp.get("shift_configs", [])
            cleaned = [c for c in configs if c.get("shift_name") not in _REMOVED_SHIFT_NAMES]
            if len(cleaned) != len(configs):
                dept_db.shift_composition.replace_one({}, {"shift_configs": cleaned})


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    CORS(app, resources={r"/api/*": {"origins": "*"}})

    init_db(app)

    with app.app_context():
        db = get_db()
        seed_attribute_rules(db)
        _remove_reserve_shifts_from_all_depts(app)

    register_routes(app)

    return app
