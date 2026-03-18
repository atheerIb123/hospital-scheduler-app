export interface Employee {
  id: string;
  name: string;
  attributes: string[]; // e.g. ["col_1", "col_3"] — which CSV columns are ticked
}

export type ScheduleOn = "all" | "weekdays" | "friday" | "weekend";

export interface ShiftType {
  id: string;
  shift_id?: number;       // only present on legacy seeded records
  names: string[];
  required_attributes: string[]; // e.g. ["col_1"]
  csv_column?: number;     // only present on legacy seeded records
  is_desired: boolean;
  schedule_on: ScheduleOn;
  friday_only?: boolean;   // legacy — superseded by schedule_on
  skip?: boolean;
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
  is_desired: boolean;
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

export interface Schedule {
  id: string;
  month: number;
  year: number;
  generated_at: string;
  status: "generated" | "failed";
  assignments?: Assignment[];
  summary?: EmployeeSummary[];
  reason?: string;
}

export interface ImportResult {
  imported: number;
  employees: Employee[];
  column_headers: string[];
}
