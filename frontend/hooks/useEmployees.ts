"use client";
import { useState, useEffect, useCallback } from "react";
import type { Employee } from "@/lib/types";
import * as api from "@/lib/api";

export function useEmployees(role?: string) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [columnHeaders, setColumnHeaders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // When role is "all", fetch all employees but use doctor column headers as default
  const headerRole = role === "nursing" ? "nursing" : "doctor";

  const reload = useCallback(async () => {
    try {
      const [emps, headers] = await Promise.all([
        api.getEmployees(role),
        api.getColumnHeaders(headerRole),
      ]);
      setEmployees(emps);
      setColumnHeaders(headers);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const importCsv = async (file: File, importRole?: string) => {
    const result = await api.importEmployeesCsv(file, importRole ?? role ?? "doctor");
    setEmployees(result.employees);
    setColumnHeaders(result.column_headers);
    return result;
  };

  const updateEmployee = async (id: string, data: { name?: string; attributes?: string[]; role?: string }) => {
    const emp = await api.updateEmployee(id, data);
    setEmployees((prev) => prev.map((e) => (e.id === id ? emp : e)));
    return emp;
  };

  const removeEmployee = async (id: string) => {
    await api.deleteEmployee(id);
    setEmployees((prev) => prev.filter((e) => e.id !== id));
  };

  const renameColumnHeader = async (index: number, name: string) => {
    const headers = await api.renameColumnHeader(index, name, headerRole);
    setColumnHeaders(headers);
    return headers;
  };

  const addColumnHeader = async (name: string) => {
    const headers = await api.addColumnHeader(name, headerRole);
    setColumnHeaders(headers);
    return headers;
  };

  const deleteColumnHeader = async (index: number) => {
    const headers = await api.deleteColumnHeader(index, headerRole);
    setColumnHeaders(headers);
    // Reload employees so their attributes reflect the shifted col_N values
    await reload();
    return headers;
  };

  return {
    employees, columnHeaders, loading, error, reload,
    importCsv, updateEmployee, removeEmployee,
    renameColumnHeader, addColumnHeader, deleteColumnHeader,
  };
}
