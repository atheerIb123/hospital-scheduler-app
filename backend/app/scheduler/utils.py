from typing import List, Dict, Any


def expand_attributes(raw_attributes: List[str], rules: List[Dict[str, Any]]) -> List[str]:
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
) -> Dict[str, Dict[str, bool]]:
    """
    Returns eligibility[emp_id][shift_id] = True/False.

    An employee is eligible for a shift type if their expanded attributes
    contain ALL of the shift type's required_attributes.
    If a shift type has no required_attributes, all employees are eligible.
    """
    eligibility: Dict[str, Dict[str, bool]] = {}
    for emp in employees:
        emp_id = str(emp["_id"]) if "_id" in emp else emp["id"]
        expanded = set(expand_attributes(emp.get("attributes", []), rules))
        eligibility[emp_id] = {}
        for shift in shift_types:
            shift_id = str(shift["_id"]) if "_id" in shift else shift["id"]
            required = set(shift.get("required_attributes", []))
            eligibility[emp_id][shift_id] = required.issubset(expanded)
    return eligibility
