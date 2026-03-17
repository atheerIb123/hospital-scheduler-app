"use client";
import { useState, useEffect, useCallback } from "react";
import type { Employee } from "@/lib/types";
import * as api from "@/lib/api";

export function useEmployees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [columnHeaders, setColumnHeaders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const [emps, headers] = await Promise.all([
        api.getEmployees(),
        api.getColumnHeaders(),
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

  const importCsv = async (file: File) => {
    const result = await api.importEmployeesCsv(file);
    setEmployees(result.employees);
    setColumnHeaders(result.column_headers);
    return result;
  };

  const removeEmployee = async (id: string) => {
    await api.deleteEmployee(id);
    setEmployees((prev) => prev.filter((e) => e.id !== id));
  };

  return { employees, columnHeaders, loading, error, reload, importCsv, removeEmployee };
}
