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
