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

    friday_days   = {d for d in days if date(year, month, d).weekday() == 4}
    saturday_days = {d for d in days if date(year, month, d).weekday() == 5}
    weekend_days  = friday_days | saturday_days
    weekday_days  = set(days) - weekend_days

    def applicable_days(shift: dict) -> set:
        """Return the set of days this shift should be scheduled on."""
        scope = shift.get("schedule_on")
        # Backwards compat: if schedule_on absent, fall back to friday_only flag
        if not scope:
            scope = "friday" if shift.get("friday_only") else "all"
        if scope == "friday":
            return friday_days
        if scope == "weekend":
            return weekend_days
        if scope == "weekdays":
            return weekday_days
        return set(days)  # "all"

    # Normalise MongoDB _id → id string
    for emp in employees:
        if "_id" in emp:
            emp["id"] = str(emp.pop("_id"))
    for shift in shift_types:
        if "_id" in shift:
            shift["id"] = str(shift.pop("_id"))

    eligibility = build_eligibility_matrix(employees, shift_types, rules)

    # Skip shift types with no eligible employees (e.g. no required_attributes configured yet)
    schedulable = [
        shift for shift in shift_types
        if any(eligibility[e["id"]][shift["id"]] for e in employees)
    ]

    if not schedulable:
        return {
            "status": "failed",
            "reason": "אין סוגי משמרות עם עובדים זכאים. בדוק שהוגדרו תכונות נדרשות לכל משמרת.",
        }

    shift_types = schedulable

    model = cp_model.CpModel()

    # Decision variables: x[(emp_id, shift_id, day)] = 1 iff that employee works that shift that day
    x: Dict = {}
    for emp in employees:
        eid = emp["id"]
        for shift in shift_types:
            sid = shift["id"]
            app_days = applicable_days(shift)
            if eligibility[eid][sid]:
                for day in days:
                    if day not in app_days:
                        continue
                    x[(eid, sid, day)] = model.NewBoolVar(f"x_{eid}_{sid}_{day}")

    # C2 – exactly one eligible employee covers each shift each applicable day
    for shift in shift_types:
        sid = shift["id"]
        for day in applicable_days(shift):
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

    # Fairness for scoped shifts (non-"all") — weighted 3× because slots are scarce
    scoped_types = [s for s in shift_types if s.get("schedule_on", "friday" if s.get("friday_only") else "all") != "all"]
    for fs in scoped_types:
        fsid = fs["id"]
        app = applicable_days(fs)
        eligible = [e for e in employees if any((e["id"], fsid, d) in x for d in app)]
        if len(eligible) < 2:
            continue
        max_app = len(app)
        emp_scoped: Dict[str, Any] = {}
        for emp in eligible:
            eid = emp["id"]
            scoped_vars = [x[(eid, fsid, d)] for d in app if (eid, fsid, d) in x]
            v = model.NewIntVar(0, max_app, f"scoped_{fsid}_{eid}")
            model.Add(v == cp_model.LinearExpr.Sum(scoped_vars))
            emp_scoped[eid] = v
        max_s = model.NewIntVar(0, max_app, f"max_s_{fsid}")
        min_s = model.NewIntVar(0, max_app, f"min_s_{fsid}")
        model.AddMaxEquality(max_s, list(emp_scoped.values()))
        model.AddMinEquality(min_s, list(emp_scoped.values()))
        range_s = model.NewIntVar(0, max_app, f"range_s_{fsid}")
        model.Add(range_s == max_s - min_s)
        objective_vars += [range_s, range_s, range_s]

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
