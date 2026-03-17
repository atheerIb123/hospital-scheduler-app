from flask import Flask
from flask_cors import CORS
from .config import Config
from .db import init_db, get_db
from .routes import register_routes
from .seed import seed_shift_types, seed_attribute_rules


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    CORS(app, resources={r"/api/*": {"origins": "*"}})

    init_db(app)

    with app.app_context():
        db = get_db()
        seed_shift_types(db)
        seed_attribute_rules(db)

    register_routes(app)

    return app
