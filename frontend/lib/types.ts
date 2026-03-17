export interface Employee {
  id: string;
  name: string;
  attributes: string[]; // e.g. ["col_1", "col_3"] — which CSV columns are ticked
}

export interface ShiftType {
  id: string;
  shift_id: number;       // stable numeric ID 1–14
  names: string[];
  required_attributes: string[]; // e.g. ["col_1"]
  csv_column: number;     // 1-based attribute column index (1–9)
  is_desired: boolean;
  friday_only?: boolean;
  skip?: boolean;
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
