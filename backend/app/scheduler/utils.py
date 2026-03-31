from typing import List, Dict, Any, Optional


def expand_attributes(
    raw_attributes: List[str], rules: List[Dict[str, Any]]
) -> List[str]:
    """
    Given a list of raw attributes and a list of implication rules
    (each rule: {from_attribute: str, implies: [str]}),
    return the full expanded set of attributes (raw + all implied).

    Rules are applied transitively: if A → B and B → C, then A also implies C.
    """
    expanded = set(raw_attributes)
    changed = True
    while changed:
        changed = False
        for rule in rules:
            if rule["from_attribute"] in expanded:
                for implied in rule["implies"]:
                    if implied not in expanded:
                        expanded.add(implied)
                        changed = True
    return sorted(expanded)


def build_eligibility_matrix(
    employees: List[Dict[str, Any]],
    shift_types: List[Dict[str, Any]],
    rules: List[Dict[str, Any]],
    composition: Optional[Dict[str, Dict]] = None,
) -> Dict[str, Dict[str, bool]]:
    """
    Returns eligibility[emp_id][shift_id] = True/False.

    Standard mode (composition=None):
      An employee is eligible for a shift if their expanded attributes
      contain ALL of the shift type's required_attributes.
      Empty required_attributes → any employee is eligible.

    Nursing mode (composition provided):
      If the shift has role_slots configured in the composition, an employee
      is eligible if they have ANY attribute that matches ANY role_slot.
      This means only employees who can contribute to at least one role are
      assigned to the shift, while still allowing the solver to mix roles freely.
      If no role_slots are configured, every employee is eligible (fallback).
    """
    eligibility: Dict[str, Dict[str, bool]] = {}
    for emp in employees:
        emp_id = str(emp["_id"]) if "_id" in emp else emp["id"]
        expanded = set(expand_attributes(emp.get("attributes", []), rules))
        eligibility[emp_id] = {}
        for shift in shift_types:
            shift_id = str(shift["_id"]) if "_id" in shift else shift["id"]
            shift_name = shift.get("names", [None])[0]

            if composition is not None and shift_name:
                # Nursing mode: derive eligibility from role_slots
                role_slots = composition.get(shift_name, {}).get("role_slots", [])
                if role_slots:
                    # Employee eligible if they have ANY role_slot attribute
                    eligible = any(
                        slot.get("attr_col") in expanded
                        for slot in role_slots
                        if slot.get("attr_col")
                    )
                else:
                    # No role_slots configured → everyone eligible
                    eligible = True
            else:
                # Standard mode: employee must have ALL required_attributes
                required = set(shift.get("required_attributes", []))
                eligible = required.issubset(expanded)

            eligibility[emp_id][shift_id] = eligible
    return eligibility
