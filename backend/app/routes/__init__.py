from .employees import employees_bp
from .shift_types import shift_types_bp
from .schedule import schedule_bp
from .constraints import constraints_bp
from .volunteers import volunteers_bp
from .shirking import shirking_bp
from .advocates import advocates_bp


def register_routes(app):
    app.register_blueprint(employees_bp, url_prefix="/api")
    app.register_blueprint(shift_types_bp, url_prefix="/api")
    app.register_blueprint(schedule_bp, url_prefix="/api")
    app.register_blueprint(constraints_bp, url_prefix="/api")
    app.register_blueprint(volunteers_bp, url_prefix="/api")
    app.register_blueprint(shirking_bp, url_prefix="/api")
    app.register_blueprint(advocates_bp, url_prefix="/api")
