import calendar
from datetime import date
from typing import List, Dict, Any
from ortools.sat.python import cp_model
from .utils import build_eligibility_matrix


def generate_schedule(
    employees: List[Dict[str, Any]],
    shift_types: List[Dict[str, Any]],
    rules: List[Dict[str, Any]],
    month: int,
    year: int,
) -> Dict[str, Any]:
    days_in_month = calendar.monthrange(year, month)[1]
    days = list(range(1, days_in_month + 1))

    # Determine which days are Fridays (weekday() == 4)
    friday_days = {d for d in days if date(year, month, d).weekday() == 4}

    # Normalise MongoDB _id → id string
    for emp in employees:
        if "_id" in emp:
            emp["id"] = str(emp.pop("_id"))
    for shift in shift_types:
        if "_id" in shift:
            shift["id"] = str(shift.pop("_id"))

    eligibility = build_eligibility_matrix(employees, shift_types, rules)

    # Pre-feasibility check: every shift type must have at least one eligible employee
    for shift in shift_types:
        sid = shift["id"]
        if not any(eligibility[e["id"]][sid] for e in employees):
            names = ", ".join(shift.get("names", [sid]))
            return {
                "status": "failed",
                "reason": f"אין עובדים זכאים למשמרת '{names}'. בדוק הרשאות עובדים.",
            }

    model = cp_model.CpModel()

    # Decision variables: x[(emp_id, shift_id, day)] = 1 iff that employee works that shift that day
    # Friday-only shifts only get variables for Friday days.
    x: Dict = {}
    for emp in employees:
        eid = emp["id"]
        for shift in shift_types:
            sid = shift["id"]
            is_friday_only = shift.get("friday_only", False)
            if eligibility[eid][sid]:
                for day in days:
                    if is_friday_only and day not in friday_days:
                        continue
                    x[(eid, sid, day)] = model.NewBoolVar(f"x_{eid}_{sid}_{day}")

    # C2 – exactly one eligible employee covers each shift each applicable day
    for shift in shift_types:
        sid = shift["id"]
        is_friday_only = shift.get("friday_only", False)
        applicable_days = friday_days if is_friday_only else days
        for day in applicable_days:
            covering = [x[(e["id"], sid, day)] for e in employees if (e["id"], sid, day) in x]
            model.AddExactlyOne(covering)

    # C3 – each employee works at most one shift per day
    for emp in employees:
        eid = emp["id"]
        for day in days:
            day_vars = [x[(eid, shift["id"], day)] for shift in shift_types if (eid, shift["id"], day) in x]
            if len(day_vars) > 1:
                model.Add(cp_model.LinearExpr.Sum(day_vars) <= 1)

    max_possible = days_in_month * len(shift_types)

    # Per-employee total shift counts
    emp_total: Dict[str, Any] = {}
    for emp in employees:
        eid = emp["id"]
        all_vars = [x[(eid, shift["id"], day)] for shift in shift_types for day in days if (eid, shift["id"], day) in x]
        v = model.NewIntVar(0, max_possible, f"total_{eid}")
        model.Add(v == cp_model.LinearExpr.Sum(all_vars))
        emp_total[eid] = v

    max_total = model.NewIntVar(0, max_possible, "max_total")
    min_total = model.NewIntVar(0, max_possible, "min_total")
    model.AddMaxEquality(max_total, list(emp_total.values()))
    model.AddMinEquality(min_total, list(emp_total.values()))
    range_total = model.NewIntVar(0, max_possible, "range_total")
    model.Add(range_total == max_total - min_total)

    objective_vars: List[Any] = [range_total]

    # Friday-only shift fairness – computed per shift, only among eligible employees (weighted 3×)
    friday_only_types = [s for s in shift_types if s.get("friday_only", False)]
    max_fridays = len(friday_days)
    for fs in friday_only_types:
        fsid = fs["id"]
        eligible = [e for e in employees if any((e["id"], fsid, d) in x for d in friday_days)]
        if len(eligible) < 2:
            continue
        emp_fri: Dict[str, Any] = {}
        for emp in eligible:
            eid = emp["id"]
            fri_vars = [x[(eid, fsid, d)] for d in friday_days if (eid, fsid, d) in x]
            v = model.NewIntVar(0, max_fridays, f"fri_{fsid}_{eid}")
            model.Add(v == cp_model.LinearExpr.Sum(fri_vars))
            emp_fri[eid] = v
        max_fri = model.NewIntVar(0, max_fridays, f"max_fri_{fsid}")
        min_fri = model.NewIntVar(0, max_fridays, f"min_fri_{fsid}")
        model.AddMaxEquality(max_fri, list(emp_fri.values()))
        model.AddMinEquality(min_fri, list(emp_fri.values()))
        range_fri = model.NewIntVar(0, max_fridays, f"range_fri_{fsid}")
        model.Add(range_fri == max_fri - min_fri)
        # Weight 3× — Friday slots are scarce so fairness here needs stronger pull
        objective_vars += [range_fri, range_fri, range_fri]

    # Desired shift fairness (weighted 2×)
    desired_types = [s for s in shift_types if s.get("is_desired", False)]
    if desired_types:
        max_des = days_in_month * len(desired_types)
        emp_desired: Dict[str, Any] = {}
        for emp in employees:
            eid = emp["id"]
            des_vars = [x[(eid, s["id"], day)] for s in desired_types for day in days if (eid, s["id"], day) in x]
            v = model.NewIntVar(0, max_des, f"desired_{eid}")
            model.Add(v == cp_model.LinearExpr.Sum(des_vars))
            emp_desired[eid] = v

        max_desired = model.NewIntVar(0, max_des, "max_desired")
        min_desired = model.NewIntVar(0, max_des, "min_desired")
        model.AddMaxEquality(max_desired, list(emp_desired.values()))
        model.AddMinEquality(min_desired, list(emp_desired.values()))
        range_desired = model.NewIntVar(0, max_des, "range_desired")
        model.Add(range_desired == max_desired - min_desired)
        objective_vars.append(range_desired)
        objective_vars.append(range_desired)  # weight 2× by adding twice

    model.Minimize(cp_model.LinearExpr.Sum(objective_vars))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 30.0
    status = solver.Solve(model)

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return {
            "status": "failed",
            "reason": "הסולבר לא מצא סידור אפשרי. ודא שיש מספיק עובדים זכאים לכל סוג משמרת.",
        }

    # Extract assignments
    assignments = []
    for shift in shift_types:
        sid = shift["id"]
        name = shift["names"][0] if shift.get("names") else sid
        for day in days:
            for emp in employees:
                eid = emp["id"]
                if (eid, sid, day) in x and solver.Value(x[(eid, sid, day)]) == 1:
                    assignments.append({
                        "day": day,
                        "shift_type_id": sid,
                        "shift_name": name,
                        "employee_id": eid,
                        "employee_name": emp["name"],
                    })

    # Build per-employee summary
    summary = []
    for emp in employees:
        eid = emp["id"]
        shift_counts: Dict[str, int] = {}
        desired_count = 0
        for shift in shift_types:
            sid = shift["id"]
            name = shift["names"][0] if shift.get("names") else sid
            count = sum(
                1 for day in days
                if (eid, sid, day) in x and solver.Value(x[(eid, sid, day)]) == 1
            )
            shift_counts[name] = count
            if shift.get("is_desired", False):
                desired_count += count
        summary.append({
            "employee_id": eid,
            "employee_name": emp["name"],
            "shift_counts": shift_counts,
            "desired_shift_count": desired_count,
            "total_shifts": sum(shift_counts.values()),
        })

    return {"status": "generated", "assignments": assignments, "summary": summary}
