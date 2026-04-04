from flask import Blueprint, request, jsonify
from ..db import get_db

shift_composition_bp = Blueprint("shift_composition", __name__)

# Default nursing shift types to seed
_NURSING_SHIFT_TYPES = [
    {"names": ["משמרת בוקר",   "בוקר"],              "required_attributes": [], "schedule_on": ["all"], "desirability": 3, "is_desired": False, "is_special": False},
    {"names": ["משמרת ערב",    "ערב"],               "required_attributes": [], "schedule_on": ["all"], "desirability": 2, "is_desired": False, "is_special": False},
    {"names": ["משמרת לילה",   "לילה"],              "required_attributes": [], "schedule_on": ["all"], "desirability": 1, "is_desired": False, "is_special": False},
    {"names": ["משמרת מיוחדת", "מיוחדת"],            "required_attributes": [], "schedule_on": ["all"], "desirability": 5, "is_desired": True,  "is_special": True},
]

# Shift type names that should never appear in any nursing department
_REMOVED_SHIFT_NAMES = {"רזרבה", "כוננות", "רזרבה/כוננות"}

# Default composition config (shift_name must match a shift type name)
_NURSING_DEFAULT_COMPOSITION = [
    {
        "shift_name": "משמרת בוקר",
        "hours": "07:00-15:00",
        "total_workers": 6,
        "role_slots": [
            {"attribute_name": "אחראי משמרת", "count": 1, "prefer_sub_attribute": "על בסיסי"},
            {"attribute_name": "אח/אחות",     "count": 1},
            {"attribute_name": "כוח עזר",     "count": 1},
        ],
        "min_male": 0,
        "min_female": 0,
    },
    {
        "shift_name": "משמרת ערב",
        "hours": "15:00-23:00",
        "total_workers": 5,
        "role_slots": [
            {"attribute_name": "אחראי משמרת", "count": 1, "prefer_sub_attribute": "על בסיסי"},
            {"attribute_name": "אח/אחות",     "count": 1},
            {"attribute_name": "כוח עזר",     "count": 1},
        ],
        "min_male": 0,
        "min_female": 0,
    },
    {
        "shift_name": "משמרת לילה",
        "hours": "23:00-07:00",
        "total_workers": 3,
        "role_slots": [
            {"attribute_name": "אחראי משמרת", "count": 1, "prefer_sub_attribute": "על בסיסי"},
            {"attribute_name": "אח/אחות",     "count": 1},
        ],
        "min_male": 0,
        "min_female": 0,
    },
    {
        "shift_name": "משמרת מיוחדת",
        "is_special": True,
        "hours": "",
        "total_workers": 4,
        "role_slots": [
            {"attribute_name": "אחראי משמרת", "count": 1, "prefer_sub_attribute": "על בסיסי"},
            {"attribute_name": "אח/אחות",     "count": 1},
            {"attribute_name": "כוח עזר",     "count": 1},
        ],
        "min_male": 0,
        "min_female": 0,
    },
]


@shift_composition_bp.get("/shift-composition")
def get_shift_composition():
    db = get_db()
    config = db.shift_composition.find_one({}, {"_id": 0})
    if not config:
        return jsonify({"shift_configs": []})
    return jsonify(config)


@shift_composition_bp.put("/shift-composition")
def save_shift_composition():
    db = get_db()
    data = request.get_json()
    shift_configs = data.get("shift_configs", [])
    db.shift_composition.replace_one({}, {"shift_configs": shift_configs}, upsert=True)
    return jsonify({"ok": True, "shift_configs": shift_configs})


@shift_composition_bp.post("/shift-composition/seed-nursing")
def seed_nursing_composition():
    """Seed default nursing shift types AND composition config (additive)."""
    db = get_db()

    # Always reset shift types to defaults
    db.shift_types.delete_many({})
    db.shift_types.insert_many(_NURSING_SHIFT_TYPES)

    # Always reset composition to defaults
    db.shift_composition.replace_one({}, {"shift_configs": _NURSING_DEFAULT_COMPOSITION}, upsert=True)

    return jsonify({"ok": True, "shift_configs": _NURSING_DEFAULT_COMPOSITION}), 201
