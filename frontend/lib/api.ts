import type { Employee, ShiftType, Schedule, Assignment, ImportResult, ShiftTypeImportResult, CreateShiftTypePayload, Constraint, ConstraintImportResult, CreateConstraintPayload } from "./types";

const BASE = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Employees
// ---------------------------------------------------------------------------

export const getEmployees = () => request<Employee[]>("/employees");

export const updateEmployee = (id: string, data: { name?: string; attributes?: string[] }) =>
  request<Employee>(`/employees/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

export const renameColumnHeader = (index: number, name: string) =>
  request<string[]>("/employees/column-headers", {
    method: "PATCH",
    body: JSON.stringify({ index, name }),
  });

export const addColumnHeader = (name: string) =>
  request<string[]>("/employees/column-headers", {
    method: "POST",
    body: JSON.stringify({ name }),
  });

export const deleteColumnHeader = (index: number) =>
  request<string[]>(`/employees/column-headers/${index}`, { method: "DELETE" });

export const deleteEmployee = (id: string) =>
  request<{ ok: boolean }>(`/employees/${id}`, { method: "DELETE" });

export const clearEmployees = () =>
  request<{ ok: boolean }>("/employees", { method: "DELETE" });

export const importEmployeesCsv = async (file: File): Promise<ImportResult> => {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}/employees/import`, { method: "POST", body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<ImportResult>;
};

export const getColumnHeaders = () => request<string[]>("/employees/column-headers");

// ---------------------------------------------------------------------------
// Shift Types
// ---------------------------------------------------------------------------

export const getShiftTypes = () => request<ShiftType[]>("/shift-types");

export const createShiftType = (data: CreateShiftTypePayload) =>
  request<ShiftType>("/shift-types", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updateShiftType = (
  id: string,
  data: Partial<Pick<ShiftType, "names" | "is_desired" | "schedule_on" | "required_attributes">>
) =>
  request<ShiftType>(`/shift-types/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

export const deleteShiftType = (id: string) =>
  request<{ ok: boolean }>(`/shift-types/${id}`, { method: "DELETE" });

export const toggleDesired = (id: string, is_desired: boolean) =>
  request<ShiftType>(`/shift-types/${id}/desired`, {
    method: "PATCH",
    body: JSON.stringify({ is_desired }),
  });

export const importShiftTypesCsv = async (
  file: File,
  mode: "replace" | "append" = "replace"
): Promise<ShiftTypeImportResult> => {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}/shift-types/import?mode=${mode}`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<ShiftTypeImportResult>;
};

export const loadDefaultShiftTypes = () =>
  request<ShiftTypeImportResult>("/shift-types/load-defaults", { method: "POST" });

// ---------------------------------------------------------------------------
// Schedule
// ---------------------------------------------------------------------------

export const getLatestSchedule = () => request<Schedule | null>("/schedules/latest");

export const generateSchedule = (month: number, year: number) =>
  request<Schedule>("/schedules/generate", {
    method: "POST",
    body: JSON.stringify({ month, year }),
  });

export const getScheduleByMonth = (month: number, year: number) =>
  request<Schedule | null>(`/schedules/latest?month=${month}&year=${year}`);

export const updateAssignments = (id: string, assignments: Assignment[]) =>
  request<Schedule>(`/schedules/${id}/assignments`, {
    method: "PATCH",
    body: JSON.stringify({ assignments }),
  });

// ---------------------------------------------------------------------------
// Constraints (הסתייגויות)
// ---------------------------------------------------------------------------

export const getConstraints = (params?: { month?: number; year?: number; employee?: string }) => {
  const qs = new URLSearchParams();
  if (params?.month) qs.set("month", String(params.month));
  if (params?.year) qs.set("year", String(params.year));
  if (params?.employee) qs.set("employee", params.employee);
  const query = qs.toString() ? `?${qs.toString()}` : "";
  return request<Constraint[]>(`/constraints${query}`);
};

export const createConstraint = (data: CreateConstraintPayload) =>
  request<Constraint>("/constraints", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updateConstraint = (id: string, data: Partial<CreateConstraintPayload>) =>
  request<Constraint>(`/constraints/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

export const deleteConstraint = (id: string) =>
  request<{ ok: boolean }>(`/constraints/${id}`, { method: "DELETE" });

export const clearConstraints = () =>
  request<{ ok: boolean }>("/constraints", { method: "DELETE" });

export const importConstraintsCsv = async (
  file: File,
  mode: "replace" | "append" = "replace"
): Promise<ConstraintImportResult> => {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}/constraints/import?mode=${mode}`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<ConstraintImportResult>;
};

// ---------------------------------------------------------------------------
// Advocates
// ---------------------------------------------------------------------------

export interface Advocate {
  id: string;
  employee_id: string;
  employee_name: string;
  description: string;
  points: number;
  date: string;
}

export const getAdvocates = () => request<Advocate[]>("/advocates");

export const addAdvocate = (data: Omit<Advocate, "id">) =>
  request<Advocate>("/advocates", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const removeAdvocate = (id: string) =>
  request<{ ok: boolean }>(`/advocates/${id}`, { method: "DELETE" });

// ---------------------------------------------------------------------------
// Justice / Volunteer stats
// ---------------------------------------------------------------------------

export interface JusticeEntry {
  employee_name: string;
  employee_id: string;
  justice_score: number;
  justice_shifts: number;
  volunteer_score: number;
  volunteer_count: number;
}

export const getJustice = (startDate?: string, endDate?: string) => {
  const params = new URLSearchParams();
  if (startDate) params.set("start_date", startDate);
  if (endDate) params.set("end_date", endDate);
  const qs = params.toString();
  return request<JusticeEntry[]>(`/justice${qs ? `?${qs}` : ""}`);
};

// ---------------------------------------------------------------------------
// Day Types & Settings
// ---------------------------------------------------------------------------

export const getDayTypes = () => request<DayType[]>("/day-types");

export const createDayType = (data: { name: string; color: string }) =>
  request<DayType>("/day-types", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updateDayType = (id: string, data: { name?: string; color?: string }) =>
  request<DayType>(`/day-types/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

export const deleteDayType = (id: string) =>
  request<{ ok: boolean }>(`/day-types/${id}`, { method: "DELETE" });

export const getDaySettings = (year: number, month: number) =>
  request<DaySetting[]>(`/day-settings/${year}/${month}`);

export const setDaySetting = (date: string, day_type_id: string | null) =>
  request<{ ok: boolean }>("/day-settings", {
    method: "POST",
    body: JSON.stringify({ date, day_type_id }),
  });
