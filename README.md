# Hospital Shift Scheduler — מתזמן משמרות

A full-stack web application for fairly distributing hospital shifts among employees using constraint programming optimization.

---

## Features

- **CSV Import** — Load employee data and shift eligibility attributes from a spreadsheet
- **Constraint Solver** — Automatically generates monthly schedules using Google OR-Tools
- **Fairness Optimization** — Minimizes shift count gaps across employees, with extra weight on Friday-only and "desired" shifts
- **Manual Editing** — Edit generated schedules directly in the browser
- **Excel Export** — Download the schedule and per-employee summary as `.xlsx`
- **Hebrew UI** — Full RTL support with the Heebo font

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS |
| Backend | Python 3, Flask |
| Database | MongoDB |
| Solver | Google OR-Tools (CP-SAT) |

---

## Project Structure

```
hospital-scheduler-app/
├── backend/
│   ├── app/
│   │   ├── __init__.py          # Flask app factory
│   │   ├── config.py            # Configuration
│   │   ├── db.py                # MongoDB client
│   │   ├── constants.py         # Shift mapping constants
│   │   ├── seed.py              # DB seeding (shift types, rules)
│   │   └── routes/
│   │       ├── employees.py     # Employee CRUD + CSV import
│   │       ├── shift_types.py   # Shift type management
│   │       └── schedule.py      # Schedule generation & retrieval
│   │   └── scheduler/
│   │       ├── solver.py        # OR-Tools CP model
│   │       ├── solver_runner.py
│   │       └── utils.py
│   ├── requirements.txt
│   └── run.py
├── frontend/
│   ├── app/
│   │   ├── employees/page.tsx   # Employee management
│   │   ├── shift-types/page.tsx # Shift type configuration
│   │   └── schedule/page.tsx    # Schedule generation & display
│   ├── components/
│   │   ├── Nav.tsx
│   │   ├── EmployeeTable.tsx
│   │   ├── ShiftTypeTable.tsx
│   │   ├── ScheduleTable.tsx
│   │   └── SummaryTable.tsx
│   ├── hooks/                   # useEmployees, useShiftTypes, useSchedule
│   ├── lib/                     # API client and TypeScript types
│   └── next.config.ts           # Proxies /api/* → Flask on :5000
└── employees_sample.csv         # Sample employee data (24 employees)
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.10+
- MongoDB running locally on port `27017`

### 1. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env       # edit if needed
python run.py
```

The API will be available at `http://localhost:5000`.

### 2. Frontend

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

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/employees` | List all employees |
| POST | `/api/employees/import` | Import employees from CSV |
| DELETE | `/api/employees` | Delete all employees |
| DELETE | `/api/employees/<id>` | Delete one employee |
| GET | `/api/shift-types` | List shift types |
| POST | `/api/shift-types` | Create shift type |
| PUT | `/api/shift-types/<id>` | Update shift type |
| DELETE | `/api/shift-types/<id>` | Delete shift type |
| PATCH | `/api/shift-types/<id>/desired` | Toggle desired flag |
| POST | `/api/schedules/generate` | Generate monthly schedule |
| GET | `/api/schedules/latest` | Get latest schedule |
| GET | `/api/schedules/<id>` | Get specific schedule |
| PATCH | `/api/schedules/<id>/assignments` | Update assignments |

---

## How Scheduling Works

1. **Eligibility** — Each employee has attributes (columns B–I in the CSV) that map to shift types they can be assigned.
2. **Constraint Model** — The solver creates a binary variable `x[employee, shift, day]` for every combination.
3. **Hard Constraints:**
   - Exactly one employee per shift per day
   - At most one shift per employee per day
   - Friday-only shifts are restricted to Fridays
   - Employees can only be assigned shifts they are eligible for
4. **Objective** — Minimize weighted fairness gaps:
   - Total shift counts (1×)
   - Desired shifts (2×)
   - Friday-only shifts (3×)
5. **Timeout** — Solver runs for up to 30 seconds.

---

## CSV Format

The employee import CSV must follow this layout:

| Column | Content |
|--------|---------|
| A | Employee name |
| B–I | Attribute flags (`V` = eligible) |

See `employees_sample.csv` for a working example with 24 employees.

---

## Usage Workflow

1. Go to **Employees** → upload the CSV to import staff.
2. Go to **Shift Types** → review and configure shift types; mark desired shifts with ★.
3. Go to **Schedule** → select month/year and click **Generate**.
4. Edit individual cells if adjustments are needed, then click **Save**.
5. Click **Download** to export the schedule as Excel.
