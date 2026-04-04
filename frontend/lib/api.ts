import type { Employee, ShiftType, Schedule, Assignment, ImportResult, ShiftTypeImportResult, CreateShiftTypePayload, Constraint, ConstraintImportResult, CreateConstraintPayload, DayType, DaySetting, ShiftCompositionData, ShiftConfig, SpecialShiftMonthConfig, ShiftOverride, WeeklySchedule, OncallConfig, OncallDay, OncallSlot } from "./types";

const BASE = "/api";

async function request<T>(path: string, options?: RequestInit, modeOverride?: string): Promise<T> {
  const mode = modeOverride ?? (typeof window !== "undefined" ? localStorage.getItem("app_mode") : "");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (mode) headers["X-App-Mode"] = encodeURIComponent(mode);

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      ...headers,
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string; reason?: string };
    throw new Error(err.reason ?? err.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Departments (Global File Config)
// ---------------------------------------------------------------------------

export const getDepartments = () => request<string[]>("/departments");
export const addDepartment = (name: string) =>
  request<string[]>("/departments", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
export const deleteDepartment = (name: string) =>
  request<string[]>(`/departments/${encodeURIComponent(name)}`, {
    method: "DELETE",
  });
export const restoreDefaultDepartments = () =>
  request<string[]>("/departments/restore-defaults", {
    method: "POST",
  });

// ---------------------------------------------------------------------------
// Employees
// ---------------------------------------------------------------------------

export const getEmployees = () => request<Employee[]>("/employees");

export const exportEmployeesXlsx = async (ids?: string[]) => {
  const mode = typeof window !== "undefined" ? localStorage.getItem("app_mode") : "";
  const headers: Record<string, string> = {};
  if (mode) headers["X-App-Mode"] = encodeURIComponent(mode);
  const url = ids?.length
    ? `${BASE}/employees/export?ids=${ids.join(",")}`
    : `${BASE}/employees/export`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = "employees.xlsx";
  a.click();
  URL.revokeObjectURL(objectUrl);
};

export const updateEmployee = (id: string, data: { name?: string; attributes?: string[]; active?: boolean; inactive_reason?: string; max_shifts_per_week?: number | null; home_department?: string | null }) =>
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

export const importEmployeesCsv = async (file: File, department?: string, replace?: boolean): Promise<ImportResult> => {
  const form = new FormData();
  form.append("file", file);
  const mode = typeof window !== "undefined" ? localStorage.getItem("app_mode") : "";
  const headers: Record<string, string> = mode ? { "X-App-Mode": encodeURIComponent(mode) } : {};
  const params = new URLSearchParams();
  if (department) params.set("department", department);
  if (replace) params.set("replace", "true");
  const query = params.toString();
  const url = `${BASE}/employees/import${query ? `?${query}` : ""}`;
  const res = await fetch(url, { method: "POST", body: form, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<ImportResult>;
};

export const getColumnHeaders = () => request<string[]>("/employees/column-headers");

export const seedDefaultEmployees = () =>
  request<{ ok: boolean; seeded: number; employees: Employee[] }>("/employees/seed-defaults", {
    method: "POST",
  });

export const seedNursingAttributes = () =>
  request<{ ok: boolean; headers: string[]; added: string[] }>("/employees/seed-nursing-attributes", {
    method: "POST",
  });

// ---------------------------------------------------------------------------
// Shift Types
// ---------------------------------------------------------------------------

export const getShiftTypes = (m?: string) => request<ShiftType[]>("/shift-types", undefined, m);

export const createShiftType = (data: CreateShiftTypePayload, m?: string) =>
  request<ShiftType>("/shift-types", { method: "POST", body: JSON.stringify(data) }, m);

export const updateShiftType = (
  id: string,
  data: Partial<Pick<ShiftType, "names" | "is_desired" | "desirability" | "schedule_on" | "required_attributes">>,
  m?: string
) =>
  request<ShiftType>(`/shift-types/${id}`, { method: "PUT", body: JSON.stringify(data) }, m);

export const deleteShiftType = (id: string, m?: string) =>
  request<{ ok: boolean }>(`/shift-types/${id}`, { method: "DELETE" }, m);

export const deleteAllShiftTypes = (m?: string) =>
  request<{ ok: boolean }>("/shift-types", { method: "DELETE" }, m);

export const toggleDesired = (id: string, is_desired: boolean, m?: string) =>
  request<ShiftType>(`/shift-types/${id}/desired`, { method: "PATCH", body: JSON.stringify({ is_desired }) }, m);

export const importShiftTypesCsv = async (
  file: File,
  mode: "replace" | "append" = "replace"
): Promise<ShiftTypeImportResult> => {
  const form = new FormData();
  form.append("file", file);
  const appMode = typeof window !== "undefined" ? localStorage.getItem("app_mode") : "";
  const headers: Record<string, string> = appMode ? { "X-App-Mode": encodeURIComponent(appMode) } : {};
  const res = await fetch(`${BASE}/shift-types/import?mode=${mode}`, {
    method: "POST",
    body: form,
    headers,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<ShiftTypeImportResult>;
};

export const loadDefaultShiftTypes = (m?: string) =>
  request<ShiftTypeImportResult>("/shift-types/load-defaults", { method: "POST" }, m);

// ---------------------------------------------------------------------------
// Schedule
// ---------------------------------------------------------------------------

export const getLatestSchedule = () => request<Schedule | null>("/schedules/latest");

export const generateSchedule = (month: number, year: number) =>
  request<Schedule>("/schedules/generate", {
    method: "POST",
    body: JSON.stringify({ month, year }),
  });

export const generateWeeklySchedule = (weekStart: string, department?: string, lockedAssignments?: Assignment[]) =>
  request<WeeklySchedule>("/schedules/generate-weekly", {
    method: "POST",
    body: JSON.stringify({
      week_start: weekStart,
      ...(department ? { department } : {}),
      ...(lockedAssignments?.length ? { locked_assignments: lockedAssignments } : {}),
    }),
  });

export const getLatestWeeklySchedule = (weekStart: string, department?: string) => {
  const params = new URLSearchParams({ week_start: weekStart });
  if (department) params.set("department", department);
  return request<WeeklySchedule | null>(`/schedules/latest-weekly?${params.toString()}`);
};

export const deleteWeeklySchedule = (weekStart: string, department?: string) => {
  const params = new URLSearchParams({ week_start: weekStart });
  if (department) params.set("department", department);
  return request<{ deleted: boolean }>(`/schedules/latest-weekly?${params.toString()}`, { method: "DELETE" });
};

export const getScheduleByMonth = (month: number, year: number) =>
  request<Schedule | null>(`/schedules/latest?month=${month}&year=${year}`);

export const deleteSchedule = (id: string, department?: string) => {
  const qs = department ? `?department=${encodeURIComponent(department)}` : "";
  return request<{ ok: boolean }>(`/schedules/${id}${qs}`, { method: "DELETE" });
};

export const updateAssignments = (id: string, assignments: Assignment[], department?: string) =>
  request<Schedule>(`/schedules/${id}/assignments`, {
    method: "PATCH",
    body: JSON.stringify({ assignments, department }),
  });

// ---------------------------------------------------------------------------
// Locked Pre-Assignments (DB-backed)
// ---------------------------------------------------------------------------

export const getLockedPreAssignments = (weekStart: string) =>
  request<Assignment[]>(`/locked-pre-assignments?week_start=${weekStart}`);

export const addLockedPreAssignment = (data: Assignment & { week_start: string }) =>
  request<{ ok: boolean }>("/locked-pre-assignments", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const removeLockedPreAssignment = (data: { week_start: string; employee_id: string; day: number; shift_name: string; department: string }) =>
  request<{ ok: boolean }>("/locked-pre-assignments", {
    method: "DELETE",
    body: JSON.stringify(data),
  });

export const clearLockedPreAssignmentsDept = (weekStart: string, department: string) =>
  request<{ ok: boolean }>("/locked-pre-assignments/dept", {
    method: "DELETE",
    body: JSON.stringify({ week_start: weekStart, department }),
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
  const appMode = typeof window !== "undefined" ? localStorage.getItem("app_mode") : "";
  const headers: Record<string, string> = appMode ? { "X-App-Mode": encodeURIComponent(appMode) } : {};
  const res = await fetch(`${BASE}/constraints/import?mode=${mode}`, {
    method: "POST",
    body: form,
    headers,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<ConstraintImportResult>;
};

// ---------------------------------------------------------------------------
// Volunteers
// ---------------------------------------------------------------------------

export interface Volunteer {
  id: string;
  employee_id: string;
  employee_name: string;
  shift_type_id: string;
  shift_name: string;
  day: number;
  month: number;
  year: number;
}

export const getVolunteers = (month?: number, year?: number) => {
  const params = new URLSearchParams();
  if (month != null) params.set("month", String(month));
  if (year  != null) params.set("year",  String(year));
  const qs = params.toString();
  return request<Volunteer[]>(`/volunteers${qs ? `?${qs}` : ""}`);
};

export const addVolunteer = (data: Omit<Volunteer, "id">) =>
  request<Volunteer>("/volunteers", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const removeVolunteer = (id: string) =>
  request<{ ok: boolean }>(`/volunteers/${id}`, { method: "DELETE" });

// ---------------------------------------------------------------------------
// Shirking (הברזות)
// ---------------------------------------------------------------------------

export interface ShirkingRecord {
  id: string;
  employee_id: string;
  employee_name: string;
  shift_name: string;
  day: number;
  month: number;
  year: number;
  replacement_name: string;
}

export const getShirking = (month?: number, year?: number) => {
  const qs = month && year ? `?month=${month}&year=${year}` : "";
  return request<ShirkingRecord[]>(`/shirking${qs}`);
};

export const addShirking = (data: Omit<ShirkingRecord, "id">) =>
  request<ShirkingRecord>("/shirking", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const removeShirking = (id: string) =>
  request<{ ok: boolean }>(`/shirking/${id}`, { method: "DELETE" });

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
// Statistics
// ---------------------------------------------------------------------------

export interface StatAssignment {
  employee_name: string;
  shift_name: string;
  date: string;
  day_of_week: number; // 0=Sunday … 6=Saturday
}

export interface StatsData {
  assignments: StatAssignment[];
  employees: string[];
  shift_names: string[];
}

export const getStats = (startDate: string, endDate: string) =>
  request<StatsData>(`/stats?start_date=${startDate}&end_date=${endDate}`);

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

export const createDayType = (data: { name: string; color: string; score?: number }) =>
  request<DayType>("/day-types", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updateDayType = (id: string, data: { name?: string; color?: string; score?: number }) =>
  request<DayType>(`/day-types/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

export const deleteDayType = (id: string) =>
  request<{ ok: boolean }>(`/day-types/${id}`, { method: "DELETE" });

export const getDaySettings = (year: number, month: number) =>
  request<DaySetting[]>(`/day-settings/${year}/${month}`);

export const setDaySetting = (date: string, day_type_id: string | null, score?: number) =>
  request<{ ok: boolean }>("/day-settings", {
    method: "POST",
    body: JSON.stringify({ date, day_type_id, score: score ?? null }),
  });

export const getShabbatScore = () =>
  request<{ score: number }>("/config/shabbat-score");

export const setShabbatScore = (score: number) =>
  request<{ score: number }>("/config/shabbat-score", {
    method: "PUT",
    body: JSON.stringify({ score }),
  });

export interface DayTypeJusticeEntry {
  name: string;
  shabbat_count: number;
  shabbat_score: number;
  by_type: Record<string, { count: number; score: number }>;
  total_score: number;
}

export interface DayTypeJusticeData {
  day_types: { id: string; name: string; color: string; score: number }[];
  weekday_scores: Record<string, number>;
  employees: DayTypeJusticeEntry[];
}

export const getDayTypeJustice = (startDate: string, endDate: string) =>
  request<DayTypeJusticeData>(`/day-type-justice?start_date=${startDate}&end_date=${endDate}`);

// ---------------------------------------------------------------------------
// Weekday Scores
// ---------------------------------------------------------------------------

export interface BreakdownRow {
  date: string;
  day_of_week: string;
  shift_name: string;
  desirability: number;
  desirability_points: number;
  weekday_score: number;
  total: number;
}

export interface JusticeBreakdown {
  employee: string;
  rows: BreakdownRow[];
  total: number;
}

export const getJusticeBreakdown = (employee: string, startDate?: string, endDate?: string) => {
  const params = new URLSearchParams({ employee });
  if (startDate) params.set("start_date", startDate);
  if (endDate) params.set("end_date", endDate);
  return request<JusticeBreakdown>(`/justice/breakdown?${params}`);
};

export interface VolunteerBreakdownRow {
  date: string;
  day_of_week: string;
  shift_name: string;
  desirability: number;
  desirability_points: number;
  total: number;
}

export interface VolunteerBreakdown {
  employee: string;
  rows: VolunteerBreakdownRow[];
  total: number;
}

export const getVolunteerBreakdown = (employee: string, startDate?: string, endDate?: string) => {
  const params = new URLSearchParams({ employee });
  if (startDate) params.set("start_date", startDate);
  if (endDate) params.set("end_date", endDate);
  return request<VolunteerBreakdown>(`/justice/volunteer-breakdown?${params}`);
};

export interface DayTypeBreakdownRow {
  date: string;
  day_of_week: string;
  shift_name: string;
  is_shabbat: boolean;
  shabbat_score: number;
  day_type: string | null;
  day_type_color: string | null;
  day_type_score: number;
  total: number;
}

export interface DayTypeBreakdown {
  employee: string;
  rows: DayTypeBreakdownRow[];
  total: number;
}

export const getDayTypeBreakdown = (employee: string, startDate?: string, endDate?: string) => {
  const params = new URLSearchParams({ employee });
  if (startDate) params.set("start_date", startDate);
  if (endDate) params.set("end_date", endDate);
  return request<DayTypeBreakdown>(`/day-type-justice/breakdown?${params}`);
};

export const getWeekdayScores = () => request<Record<string, number>>("/config/weekday-scores");

export const setWeekdayScores = (scores: Record<string, number>) =>
  request<Record<string, number>>("/config/weekday-scores", {
    method: "PUT",
    body: JSON.stringify(scores),
  });

// ---------------------------------------------------------------------------
// Manual points
// ---------------------------------------------------------------------------

export type ManualPointTable = "justice" | "volunteer" | "shirking" | "daytype" | "advocates" | "general";

export interface ManualPoint {
  id: string;
  employee_id: string;
  employee_name: string;
  points: number;
  reason: string;
  table: ManualPointTable;
  created_at: string;
}

export const getManualPoints = () => request<ManualPoint[]>("/manual-points");

export const addManualPoint = (data: Omit<ManualPoint, "id" | "created_at">) =>
  request<ManualPoint>("/manual-points", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const removeManualPoint = (id: string) =>
  request<{ ok: boolean }>(`/manual-points/${id}`, { method: "DELETE" });

// ---------------------------------------------------------------------------
// Shift Composition (nursing)
// ---------------------------------------------------------------------------

export const getShiftComposition = (m?: string) =>
  request<ShiftCompositionData>("/shift-composition", undefined, m);

export const saveShiftComposition = (data: ShiftCompositionData, m?: string) =>
  request<{ ok: boolean; shift_configs: ShiftConfig[] }>("/shift-composition", {
    method: "PUT",
    body: JSON.stringify(data),
  }, m);

export const seedNursingComposition = (m?: string) =>
  request<{ ok: boolean; shift_configs: ShiftConfig[] }>("/shift-composition/seed-nursing", {
    method: "POST",
  }, m);

// ---------------------------------------------------------------------------
// Special Shifts (monthly)
// ---------------------------------------------------------------------------

export const getMonthlySpecialShifts = (year?: number, m?: string) =>
  request<SpecialShiftMonthConfig[]>(`/special-shifts/monthly${year ? `?year=${year}` : ""}`, undefined, m);

export const setMonthlySpecialShifts = (month: number, year: number, total_count: number, week_distribution?: number[], shift_name?: string, m?: string) =>
  request<{ ok: boolean; shift_name: string; month: number; year: number; total_count: number; week_distribution?: number[] }>(
    "/special-shifts/monthly",
    { method: "POST", body: JSON.stringify({ month, year, total_count, week_distribution, shift_name }) },
    m,
  );

export const deleteMonthlySpecialShifts = (year: number, month: number, m?: string) =>
  request<{ ok: boolean }>(`/special-shifts/monthly/${year}/${month}`, { method: "DELETE" }, m);

export const getShiftOverrides = (year?: number, month?: number, m?: string) =>
  request<ShiftOverride[]>(`/shift-overrides${year ? `?year=${year}${month ? `&month=${month}` : ""}` : ""}`, undefined, m);

export const saveShiftOverride = (override: ShiftOverride, m?: string) =>
  request<{ ok: boolean } & ShiftOverride>("/shift-overrides", { method: "PUT", body: JSON.stringify(override) }, m);

export const deleteShiftOverride = (date: string, shiftName: string, m?: string) =>
  request<{ ok: boolean }>(`/shift-overrides/${date}/${encodeURIComponent(shiftName)}`, { method: "DELETE" }, m);

// ---------------------------------------------------------------------------
// On-call (כוננות סיעוד)
// ---------------------------------------------------------------------------

export const getOncallConfig = () =>
  request<OncallConfig>("/oncall/config");

export const saveOncallConfig = (config: OncallConfig) =>
  request<{ ok: boolean }>("/oncall/config", { method: "POST", body: JSON.stringify(config) });

export const getOncallMonthly = (year: number, month: number) =>
  request<OncallDay[]>(`/oncall/monthly?year=${year}&month=${month}`);

export const setOncallOverride = (date: string, slot: OncallSlot, department: string) =>
  request<{ ok: boolean }>("/oncall/override", { method: "POST", body: JSON.stringify({ date, slot, department }) });

export const deleteOncallOverride = (date: string, slot: OncallSlot) =>
  request<{ ok: boolean }>("/oncall/override", { method: "DELETE", body: JSON.stringify({ date, slot }) });

export const setOncallAssignment = (date: string, slot: OncallSlot, employee_id: string, employee_name: string, from_department: string) =>
  request<{ ok: boolean }>("/oncall/assignment", { method: "POST", body: JSON.stringify({ date, slot, employee_id, employee_name, from_department }) });

export const deleteOncallAssignment = (date: string, slot: OncallSlot) =>
  request<{ ok: boolean }>("/oncall/assignment", { method: "DELETE", body: JSON.stringify({ date, slot }) });

export const getOncallWeekBlocks = (weekStart: string) =>
  request<Array<{ date: string; slot: OncallSlot; employee_id: string; employee_name: string; from_department: string }>>(`/oncall/week-blocks?week_start=${weekStart}`);

export interface OncallJusticeEntry {
  employee_id: string;
  employee_name: string;
  from_department: string;
  slot_counts: Record<string, number>;
  total: number;
}

export const getOncallJustice = (startDate?: string, endDate?: string) => {
  const params = new URLSearchParams();
  if (startDate) params.set("start_date", startDate);
  if (endDate) params.set("end_date", endDate);
  const qs = params.toString();
  return request<OncallJusticeEntry[]>(`/oncall/justice${qs ? `?${qs}` : ""}`);
};

export const autoGenerateOncall = (year: number, month: number, overwrite = false) =>
  request<{ ok: boolean; generated: number }>("/oncall/auto-generate", {
    method: "POST",
    body: JSON.stringify({ year, month, overwrite }),
  });

export const importOncall = (data: {
  year: number; month: number;
  overrides: { date: string; slot: string; department: string }[];
  assignments: { date: string; slot: string; employee_id: string; employee_name: string; from_department: string }[];
}) => request<{ ok: boolean; overrides: number; assignments: number }>("/oncall/import", {
  method: "POST", body: JSON.stringify(data),
});
