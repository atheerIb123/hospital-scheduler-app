export interface Employee {
  id: string;
  name: string;
  attributes: string[]; // e.g. ["col_1", "col_3"] — which CSV columns are ticked
  max_shifts_per_week?: number; // max shifts per week, defaults to 6
  active?: boolean;          // defaults to true if absent; false = excluded from scheduling
  inactive_reason?: string;  // optional note explaining why the employee is inactive
  inactive_since?: string;   // ISO date string of when they were deactivated
  home_department?: string;  // nursing only: the department this employee belongs to
}

export type ScheduleOn = string[];

export interface ShiftType {
  id: string;
  shift_id?: number;       // only present on legacy seeded records
  names: string[];
  required_attributes: string[]; // e.g. ["col_1"]
  csv_column?: number;     // only present on legacy seeded records
  is_desired: boolean;
  desirability: number;    // 1–5: 1=very undesirable (5 justice pts), 5=very desired (1 justice pt)
  schedule_on: ScheduleOn;
  friday_only?: boolean;   // legacy — superseded by schedule_on
  skip?: boolean;
  is_special?: boolean;
}

export interface ShiftTypeImportResult {
  imported: number;
  shift_types: ShiftType[];
  warnings: string[];
}

export interface CreateShiftTypePayload {
  names: string[];
  required_attributes: string[];
  schedule_on: ScheduleOn;
  desirability: number;   // 1–5
  is_special?: boolean;
}

export interface Assignment {
  day: number;
  shift_type_id: string;
  shift_name: string;
  employee_id: string;
  employee_name: string;
}

export interface EmployeeSummary {
  employee_id: string;
  employee_name: string;
  shift_counts: Record<string, number>;
  desired_shift_count: number;
  total_shifts: number;
}

export interface ScheduleWarning {
  day: number;
  shift_type_id: string;
  shift_name: string;
}

export interface Schedule {
  id: string;
  month: number;
  year: number;
  generated_at: string;
  status: "generated" | "failed";
  assignments?: Assignment[];
  summary?: EmployeeSummary[];
  reason?: string;
  warnings?: ScheduleWarning[]; // unfilled shift-day slots the solver could not cover
}

export interface ImportResult {
  imported: number;
  employees: Employee[];
  column_headers: string[];
  invalid_departments?: string[];
}

// ---------------------------------------------------------------------------
// Constraints (הסתייגויות)
// ---------------------------------------------------------------------------

export interface Constraint {
  id: string;
  employee_name: string;
  date: string;       // ISO string: YYYY-MM-DD
  reason: string;
  created_at?: string;
}

export interface ConstraintImportResult {
  imported: number;
  skipped: number;
  errors: string[];
  constraints: Constraint[];
}

export interface CreateConstraintPayload {
  employee_name: string;
  date: string;
  reason?: string;
}

// ---------------------------------------------------------------------------
// Shift Composition (nursing)
// ---------------------------------------------------------------------------

export interface RoleSlot {
  attribute_name: string;
  count: number;
  prefer_sub_attribute?: string;
}

export interface ShiftConfig {
  shift_name: string;
  hours: string;
  total_workers: number;
  role_slots: RoleSlot[];
  min_male: number;
  min_female: number;
}

export interface ShiftCompositionData {
  shift_configs: ShiftConfig[];
}

export interface SpecialShiftMonthConfig {
  shift_name: string;
  month: number;
  year: number;
  total_count: number;
  week_distribution?: number[];
}

export interface ShiftOverride {
  date: string; // YYYY-MM-DD
  shift_name: string;
  total_workers?: number;
  role_slots?: RoleSlot[];
  min_male?: number;
  min_female?: number;
}

// ---------------------------------------------------------------------------
// Day Types & Settings
// ---------------------------------------------------------------------------

export interface DayType {
  id: string;
  name: string;
  color: string;
  score: number;
}

export interface DaySetting {
  id: string;
  date: string;
  day_type_id: string;
  score?: number;
}
