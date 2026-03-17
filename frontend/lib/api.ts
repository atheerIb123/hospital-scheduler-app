import type { Employee, ShiftType, Schedule, Assignment, ImportResult } from "./types";

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

export const updateShiftType = (
  id: string,
  data: Partial<Pick<ShiftType, "names" | "is_desired">>
) =>
  request<ShiftType>(`/shift-types/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

export const toggleDesired = (id: string, is_desired: boolean) =>
  request<ShiftType>(`/shift-types/${id}/desired`, {
    method: "PATCH",
    body: JSON.stringify({ is_desired }),
  });

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
