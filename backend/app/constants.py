def col_attr(col_index: int) -> str:
    """Convert a 1-based attribute column index to the attribute string stored in DB."""
    return f"col_{col_index}"


# Justice points per desirability level — used by both the /justice endpoint
# and the solver so the two systems stay in sync.
# desirability=1 (most burdensome shift) → 10 pts accumulated
# desirability=5 (most desirable shift)  →  1 pt  accumulated
JUSTICE_PTS: dict = {1: 10, 2: 7, 3: 4, 4: 2, 5: 1}
