from .employees import employees_bp
from .shift_types import shift_types_bp
from .schedule import schedule_bp
from .constraints import constraints_bp
from .day_management import day_mgmt_bp
from .volunteers import volunteers_bp
from .shirking import shirking_bp
from .advocates import advocates_bp
from .stats import stats_bp
from .departments import departments_bp
from .shift_composition import shift_composition_bp
from .special_shifts import special_shifts_bp
from .shift_overrides import shift_overrides_bp
from .locked_pre_assignments import locked_pre_bp
from .oncall import oncall_bp


def register_routes(app):
    app.register_blueprint(day_mgmt_bp, url_prefix="/api")
    app.register_blueprint(employees_bp, url_prefix="/api")
    app.register_blueprint(shift_types_bp, url_prefix="/api")
    app.register_blueprint(schedule_bp, url_prefix="/api")
    app.register_blueprint(constraints_bp, url_prefix="/api")
    app.register_blueprint(volunteers_bp, url_prefix="/api")
    app.register_blueprint(shirking_bp, url_prefix="/api")
    app.register_blueprint(advocates_bp, url_prefix="/api")
    app.register_blueprint(stats_bp, url_prefix="/api")
    app.register_blueprint(departments_bp, url_prefix="/api")
    app.register_blueprint(shift_composition_bp, url_prefix="/api")
    app.register_blueprint(special_shifts_bp, url_prefix="/api")
    app.register_blueprint(shift_overrides_bp, url_prefix="/api")
    app.register_blueprint(locked_pre_bp, url_prefix="/api")
    app.register_blueprint(oncall_bp, url_prefix="/api")
