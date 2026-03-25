# Hospital Shift Scheduler — מתזמן משמרות

A full-stack web application for fairly distributing hospital shifts among employees using constraint programming optimization. Built for the **Beer Sheva Mental Health Medical Center** (מרכז הרפואי לבריאות הנפש בבאר שבע). Supports multiple operational modes (doctors, nursing per-department, cleaning) with per-department data isolation.

---

## Background

The hospital previously used a proprietary "Mishmarot" software that was inflexible, could not produce cumulative annual reports, did not handle justice/fairness tracking automatically, and required manual scheduling in practice.

This system replaces it with a generic, fully automated solution driven by three data sources:
1. **Employee table** — all staff with their role attributes (~250 rows)
2. **Shift requirements table** — staffing rules per shift type (differs between doctors and nursing)
3. **Constraints table** — employee unavailability (vacations, exemptions, etc.)

The system generates monthly schedules (doctors) and weekly schedules (nursing, per department) that can be printed and posted in the ward.

---

## Features

- **Multi-Mode Support** — Separate scheduling for Doctors, Nursing (per department), and Cleaning staff
- **CSV / XLSX Import** — Load employee data and shift eligibility attributes from a spreadsheet
- **Constraint Solver** — Automatically generates monthly schedules using Google OR-Tools (CP-SAT)
- **Fairness Optimization** — Minimizes shift count gaps across employees, with weighted desirability scoring
- **Constraint Management (הסתייגויות)** — Record employee unavailability by date; respected as hard solver constraints
- **Justice & Fairness Scoring** — Per-employee fairness scores across multiple dimensions (shift desirability, day types, volunteers, shirking, manual adjustments)
- **Day Type Calendar** — Mark holidays, Shabbat, and custom day types with configurable score weights
- **Nursing Shift Composition** — Define role-slot requirements (attribute + count + gender) per shift
- **Shift Overrides** — Override shift staffing requirements for specific dates
- **Manual Editing** — Edit generated schedules directly in the browser
- **Excel Export** — Download the schedule and per-employee summary as `.xlsx`
- **Statistics** — Shift distribution analysis by employee, day, and date range
- **Hebrew UI** — Full RTL support with the Heebo font

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| Backend | Python 3, Flask 3 |
| Database | MongoDB |
| Solver | Google OR-Tools 9.9 (CP-SAT) |
| Icons | Lucide React |
| Export | XLSX / openpyxl |

---

## Project Structure

```
hospital-scheduler-app/
├── backend/
│   ├── app/
│   │   ├── __init__.py              # Flask app factory
│   │   ├── config.py                # Configuration
│   │   ├── db.py                    # MongoDB client
│   │   ├── constants.py             # Shift mapping constants
│   │   ├── seed.py                  # DB seeding (shift types, rules)
│   │   ├── routes/
│   │   │   ├── employees.py         # Employee CRUD + CSV import + export
│   │   │   ├── shift_types.py       # Shift type management
│   │   │   ├── schedule.py          # Schedule generation & retrieval
│   │   │   ├── constraints.py       # Unavailability management
│   │   │   ├── day_management.py    # Day types, day settings, weekday scores
│   │   │   ├── shift_composition.py # Nursing role-slot configs
│   │   │   ├── special_shifts.py    # Monthly special shift distribution
│   │   │   ├── shift_overrides.py   # Date-specific shift overrides
│   │   │   ├── volunteers.py        # Volunteer shift tracking
│   │   │   ├── shirking.py          # Missed shift tracking (הברזות)
│   │   │   ├── advocates.py         # Bonus points system
│   │   │   ├── manual_points.py     # Manual scoring adjustments
│   │   │   ├── stats.py             # Statistics endpoint
│   │   │   └── departments.py       # Department management (nursing)
│   │   └── scheduler/
│   │       ├── solver.py            # OR-Tools CP model
│   │       ├── solver_runner.py     # Async solver execution
│   │       └── utils.py
│   ├── requirements.txt
│   └── run.py
├── frontend/
│   ├── app/
│   │   ├── employees/page.tsx       # Employee management
│   │   ├── shift-types/page.tsx     # Shift type configuration
│   │   ├── constraints/page.tsx     # Unavailability management
│   │   ├── schedule/page.tsx        # Schedule generation & display
│   │   ├── justice/page.tsx         # Fairness scoring & analysis
│   │   └── stats/page.tsx           # Statistics & analytics
│   ├── components/
│   │   ├── ui/                      # Global reusable UI components
│   │   │   ├── Button.tsx           # Multi-variant button
│   │   │   ├── Input.tsx            # Text input with prefix
│   │   │   ├── Select.tsx           # Dropdown select
│   │   │   ├── Badge.tsx            # Attribute/filter tags
│   │   │   ├── Alert.tsx            # Success/error/warning notifications
│   │   │   ├── Toggle.tsx           # On/off toggle
│   │   │   ├── SearchInput.tsx      # Search box
│   │   │   ├── SearchDropdown.tsx   # Search with filtering dropdown
│   │   │   ├── FilterPill.tsx       # Toggle filter pills
│   │   │   ├── TabButton.tsx        # Tab navigation button
│   │   │   ├── TabsContainer.tsx    # Tab navigation wrapper
│   │   │   ├── DropdownPanel.tsx    # Floating panel/menu
│   │   │   └── DeleteIconButton.tsx # Icon-only delete action
│   │   ├── EmployeeTable.tsx        # Employee CRUD with import/export
│   │   ├── ShiftTypeTable.tsx       # Shift type management
│   │   ├── ScheduleTable.tsx        # Monthly schedule grid with inline editing
│   │   ├── SummaryTable.tsx         # Per-employee shift count summary
│   │   ├── CalendarConfigurator.tsx # Day type calendar picker
│   │   ├── DayTypeManager.tsx       # Day type CRUD
│   │   ├── WeekdayScoreManager.tsx  # Per-weekday score configuration
│   │   ├── ShiftCompositionConfig.tsx      # Nursing role-slot requirements
│   │   ├── SpecialShiftMonthlyConfig.tsx   # Monthly special shift distribution
│   │   ├── ShiftInstanceOverrides.tsx      # Date-specific shift overrides
│   │   ├── ModeProvider.tsx         # Multi-mode state (doctors/nursing/cleaning)
│   │   └── Nav.tsx                  # Sidebar navigation with mode selector
│   ├── hooks/
│   │   ├── useEmployees.ts
│   │   ├── useShiftTypes.ts
│   │   ├── useSchedule.ts
│   │   ├── useConstraints.ts
│   │   ├── useDaySettings.ts
│   │   ├── useDayTypes.ts
│   │   └── useShiftComposition.ts
│   ├── lib/
│   │   ├── api.ts                   # REST API client (all endpoints)
│   │   ├── types.ts                 # TypeScript data models
│   │   └── colors.ts                # Global color system
│   └── next.config.ts               # Proxies /api/* → Flask on :5000
└── employees_sample.csv             # Sample employee data
```

---

## Getting Started

### Prerequisites

- Node.js 20.19.4
- Python 3.10+
- Docker (used to run MongoDB)

### 1. Clone the repo

```bash
git clone https://github.com/atheerIb123/hospital-scheduler-app
cd hospital-scheduler-app
```

### 2. Start MongoDB via Docker

```bash
docker run -d -p 27017:27017 --name mongo mongo:7
```

> If the command fails, open Docker Desktop first and then retry.

### 3. Backend

```bash
# From the repo root
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r backend/requirements.txt
python backend/run.py
```

The API will be available at `http://localhost:5000`.

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
```

The app will be available at `http://localhost:3000`.

---

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and adjust as needed:

```env
MONGO_URI=mongodb://localhost:27017
MONGO_DB_NAME=hospital_scheduler
FLASK_ENV=development
FLASK_PORT=5000
```

---

## API Endpoints

### Employees
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/employees` | List all employees |
| POST | `/api/employees` | Create employee |
| PUT | `/api/employees/<id>` | Update employee |
| DELETE | `/api/employees/<id>` | Delete employee |
| DELETE | `/api/employees` | Delete all employees |
| POST | `/api/employees/import` | Import from CSV/XLSX |
| GET | `/api/employees/export` | Export to XLSX |
| GET | `/api/employees/column-headers` | Get attribute column headers |
| POST | `/api/employees/seed-defaults` | Seed default employees |

### Shift Types
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/shift-types` | List shift types |
| POST | `/api/shift-types` | Create shift type |
| PUT | `/api/shift-types/<id>` | Update shift type |
| DELETE | `/api/shift-types/<id>` | Delete shift type |
| PATCH | `/api/shift-types/<id>/desired` | Toggle desired flag |
| POST | `/api/shift-types/import` | Import shift types |
| POST | `/api/shift-types/load-defaults` | Load default shift types |

### Schedules
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/schedules/generate` | Generate monthly schedule |
| GET | `/api/schedules/latest` | Get latest schedule |
| GET | `/api/schedules/<id>` | Get specific schedule |
| PATCH | `/api/schedules/<id>/assignments` | Update assignments |

### Constraints (הסתייגויות)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/constraints` | List constraints (filterable) |
| POST | `/api/constraints` | Create constraint |
| PUT | `/api/constraints/<id>` | Update constraint |
| DELETE | `/api/constraints/<id>` | Delete constraint |
| POST | `/api/constraints/import` | Bulk import constraints |

### Day Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/day-types` | List day types |
| POST | `/api/day-types` | Create day type |
| PUT | `/api/day-types/<id>` | Update day type |
| DELETE | `/api/day-types/<id>` | Delete day type |
| GET | `/api/day-settings` | Get day settings for month |
| POST | `/api/day-settings` | Set day type for a date |
| DELETE | `/api/day-settings/<id>` | Remove day setting |
| GET/POST | `/api/config/shabbat-score` | Shabbat scoring config |
| GET/POST | `/api/config/weekday-scores` | Per-weekday score config |

### Justice & Scoring
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/justice` | Per-employee justice breakdown |
| GET | `/api/justice/day-type` | Day-type justice distribution |
| GET | `/api/volunteers` | Volunteer shift records |
| POST/DELETE | `/api/volunteers` | Add / remove volunteer record |
| GET | `/api/shirking` | Shirking records (הברזות) |
| POST/DELETE | `/api/shirking` | Add / remove shirking record |
| GET | `/api/advocates` | Advocate bonus points |
| POST/DELETE | `/api/advocates` | Add / remove advocate record |
| GET | `/api/manual-points` | Manual score adjustments |
| POST/DELETE | `/api/manual-points` | Add / remove manual point |

### Nursing-Specific
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/PUT | `/api/shift-composition` | Nursing role-slot config |
| POST | `/api/shift-composition/seed-nursing` | Seed nursing defaults |
| GET/POST/DELETE | `/api/special-shifts/monthly` | Monthly special shift config |
| GET/PUT/DELETE | `/api/shift-overrides` | Date-specific overrides |
| GET/POST/DELETE | `/api/departments` | Department management |
| POST | `/api/departments/restore-defaults` | Restore default departments |

### Statistics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stats` | Shift distribution statistics |

---

## How Scheduling Works

1. **Eligibility** — Each employee has attributes that map to shift types they can be assigned.
2. **Constraint Model** — The solver creates a binary variable `x[employee, shift, day]` for every combination.
3. **Hard Constraints:**
   - Exactly one employee per shift per day
   - At most one shift per employee per day
   - Employees can only be assigned shifts they are eligible for
   - Employee unavailability (הסתייגויות) dates are excluded
   - Inactive employees are excluded
4. **Soft Objectives** — Minimize weighted fairness gaps:
   - Total shift counts (1×)
   - Desired shifts (2×)
   - Friday-only shifts (3×)
   - Shift desirability (1–5 scale → justice points)
5. **Timeout** — Solver runs for up to 30 seconds.

---

## Multi-Mode Support

The app supports three operational modes selected from the sidebar:

| Mode | Description |
|------|-------------|
| **Doctors** | Single shared schedule for doctor staff |
| **Nursing** | Per-department schedules; each department has isolated employee/shift data |
| **Cleaning** | Single schedule for cleaning staff |

The active mode is sent as an `X-App-Mode` header with every API request, allowing the backend to isolate MongoDB data by mode/department.

---

## Justice & Fairness System

The **Justice** page provides multi-tab analysis:

| Tab | Description |
|-----|-------------|
| **Shift Justice** | Per-employee total fairness score based on shift desirability (1–5 scale) |
| **Volunteers** | Bonus points for volunteering for shifts |
| **Combined** | Aggregate fairness score across all dimensions |
| **Day-Type Justice** | Shabbat/holiday shift distribution fairness |
| **Manual Adjustments** | Directly add or subtract points for any employee |

Additional scoring mechanisms:
- **Advocates** — One-time bonus points for specific employees
- **Shirking (הברזות)** — Penalty tracking for missed shifts
- **Weekday Scoring** — Configurable point values per day of week (Sunday–Saturday)
- **Day Type Scoring** — Configurable point values for Shabbat, holidays, and custom day types

---

## Nursing Shift Composition

For nursing mode, each shift type can have detailed role-slot requirements:

- **Attribute slots** — Which employee attributes are required and how many
- **Gender requirements** — Minimum male / female count per slot
- **Total workers** — Required headcount per shift
- **Special shifts** — Monthly distribution for special shift types (e.g., holiday specials)
- **Date overrides** — Override composition requirements for specific dates

---

## CSV / XLSX Format

### Employee Import

| Column | Content |
|--------|---------|
| A | Employee name |
| B–I | Attribute flags (`V` = eligible) |

See `employees_sample.csv` for a working example.

### Constraint Import

| Column | Content |
|--------|---------|
| A | Employee name |
| B | Date (YYYY-MM-DD) |
| C | Reason (optional) |

---

## Usage Workflow

1. **Set Mode** — Select Doctors, Nursing (choose department), or Cleaning from the sidebar.
2. **Employees** → Upload CSV/XLSX to import staff; configure attributes and shift limits.
3. **Shift Types** → Review and configure shift types; set desirability (1–5); mark desired shifts.
4. **Constraints** → Add employee unavailability dates (הסתייגויות).
5. **Day Types** → Mark holidays and Shabbat on the calendar; configure point weights.
6. **Schedule** → Select month/year and click **Generate**; edit individual cells if needed; click **Save**.
7. **Justice** → Review fairness scores; adjust volunteers, shirking, or manual points as needed.
8. **Export** → Click **Download** to export the schedule as Excel.

---

## Roadmap

### Completed
- [x] Employee CRUD with CSV/XLSX import and export
- [x] Shift types management with desirability rating
- [x] Constraint (unavailability) management — file import and manual entry
- [x] Schedule generation via OR-Tools CP-SAT solver
- [x] Justice/fairness tables: shift justice, volunteers, shirking, advocates
- [x] Day type calendar (holidays, Shabbat, custom types) with scoring
- [x] Weekday scoring configuration
- [x] Multi-mode support (doctors / nursing / cleaning) with department selector
- [x] Nursing shift composition (role slots, gender requirements)
- [x] Monthly special shifts configuration
- [x] Sticky table headers and scroll fixes
- [x] Global/shared UI component library
- [x] Max shifts per week per employee
- [x] Inactive employee support
- [x] XLSX format support (in addition to CSV)
- [x] Manual justice point adjustments
- [x] Statistics page
- [x] Department management (add/remove/restore defaults)

### In Progress / Planned (Basic)
- [ ] Smart search across all screens (employee name, attribute, shift type — not just string match)
- [ ] Inactive employee option (e.g., maternity leave, reserve duty — with end date)
- [ ] Advocates table (separate screen with doctor names and advocate type)
- [ ] Admin manual override when solver cannot fill all shifts
- [ ] Constraint entry for date ranges shown as a single row (not one row per day)

### Advanced / Future
- [ ] SMS / Email notifications to employees when assigned shifts
- [ ] Login / authentication screen
- [ ] Chatbot for querying the shift database (e.g., "how many times did employee X volunteer last-minute?")
- [ ] Employee portal (self-service view)
- [ ] Multi-computer data sharing / network sync
- [ ] Usage guide / onboarding screen
- [ ] Manager approval workflow for exceeding max shifts
- [ ] Advanced solver: no consecutive-day assignments, justice-weighted distribution