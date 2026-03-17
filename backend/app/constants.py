# Maps each shift type ID to its CSV column index (1-based, where 1 = first attribute column after name).
# CSV column 1 = spreadsheet column B, column 2 = C, ..., column 8 = I
# Shifts 11 and 13 are removed from the system.
SHIFT_TYPE_COLUMN_MAP: dict[int, int] = {
    1: 1, 2: 1, 3: 1, 4: 1, 5: 1,   # col 1 = כוננות מחלקה
    6: 2,                              # col 2 = מיון 14:00
    7: 3,                              # col 3 = מיון 1 - צעיר
    8: 4,                              # col 4 = מיון 2 - ותיק (also covers shift 7 via rule col_4→col_3)
    9: 5,                              # col 5 = תורן מחלקות
    10: 6,                             # col 6 = תורן גריאטריה
    12: 7,                             # col 7 = כונן נוער
    13: 8,                             # col 8 = תורנות מיון שישי (Friday-only)
}


def col_attr(col_index: int) -> str:
    """Convert a 1-based attribute column index to the attribute string stored in DB."""
    return f"col_{col_index}"


NUM_SHIFT_TYPES = 12
NUM_ATTRIBUTE_COLUMNS = 8
