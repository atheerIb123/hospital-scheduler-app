from .employees import employees_bp
from .shift_types import shift_types_bp
from .schedule import schedule_bp


def register_routes(app):
    app.register_blueprint(employees_bp, url_prefix="/api")
    app.register_blueprint(shift_types_bp, url_prefix="/api")
    app.register_blueprint(schedule_bp, url_prefix="/api")
