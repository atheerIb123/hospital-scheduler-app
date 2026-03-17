from .constants import SHIFT_TYPE_COLUMN_MAP, col_attr

SHIFT_NAMES: dict[int, list[str]] = {
    1:  ["15", "15א'", "19"],
    2:  ["16", "17", "השהייה"],
    3:  ["14", "13", "17א"],
    4:  ["בית רותם", "בית מאזן", "20", "תחלואה כפולה"],
    5:  ["כונן"],
    6:  ["מיון 14:00"],
    7:  ["מיון 1 - צעיר"],
    8:  ["מיון 2 - ותיק"],
    9:  ["תורן מחלקות"],
    10: ["תורן גריאטריה"],
    12: ["כונן נוער"],
    13: ["תורנות מיון שישי"],
}

FRIDAY_ONLY_SHIFTS = {13}


def seed_shift_types(db):
    """
    Upsert the 12 active shift types with their Hebrew names.
    Shift 13 (תורנות מיון שישי) is Friday-only.
    Shift 11 (פסיכיאטר מחוזי) is kept but marked skip=True — never scheduled.
    Old shift_id 14 is deleted (renumbered to 13).
    """
    for shift_id, col_index in SHIFT_TYPE_COLUMN_MAP.items():
        db.shift_types.update_one(
            {"shift_id": shift_id},
            {
                "$set": {
                    "names": SHIFT_NAMES[shift_id],
                    "required_attributes": [col_attr(col_index)],
                    "csv_column": col_index,
                    "friday_only": shift_id in FRIDAY_ONLY_SHIFTS,
                    "skip": False,
                },
                "$setOnInsert": {
                    "shift_id": shift_id,
                    "is_desired": False,
                },
            },
            upsert=True,
        )

    # Shift 11: keep in DB, mark skip=True, no column assignment
    db.shift_types.update_one(
        {"shift_id": 11},
        {
            "$set": {
                "names": ["פסיכיאטר מחוזי"],
                "required_attributes": [],
                "csv_column": 0,
                "friday_only": False,
                "skip": True,
            },
            "$setOnInsert": {
                "shift_id": 11,
                "is_desired": False,
            },
        },
        upsert=True,
    )

    # Remove old shift_id 14 (renumbered to 13) and old shift_id 13 (dropped)
    db.shift_types.delete_many({"shift_id": {"$in": [14]}})


def seed_attribute_rules(db):
    """
    Seed the rule: col_4 (מיון 2 - ותיק) implies col_3 (מיון 1 - צעיר).
    This makes senior ER employees eligible for both shift 7 and shift 8.
    """
    db.attribute_rules.update_one(
        {"from_attribute": "col_4"},
        {"$set": {"from_attribute": "col_4", "implies": ["col_3"]}},
        upsert=True,
    )
