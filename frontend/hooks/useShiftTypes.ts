"use client";
import { useState, useEffect, useCallback } from "react";
import type { ShiftType, CreateShiftTypePayload } from "@/lib/types";
import * as api from "@/lib/api";

export function useShiftTypes() {
  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([]);
  const [columnHeaders, setColumnHeaders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const [data, headers] = await Promise.all([
        api.getShiftTypes(),
        api.getColumnHeaders(),
      ]);
      setShiftTypes(data);
      setColumnHeaders(headers);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const updateShiftType = async (
    id: string,
    data: Partial<Pick<ShiftType, "names" | "is_desired" | "desirability" | "schedule_on" | "required_attributes">>
  ) => {
    const st = await api.updateShiftType(id, data);
    setShiftTypes((prev) => prev.map((s) => (s.id === id ? st : s)));
    return st;
  };

  const setDesired = async (id: string, is_desired: boolean) => {
    const st = await api.toggleDesired(id, is_desired);
    setShiftTypes((prev) => prev.map((s) => (s.id === id ? st : s)));
    return st;
  };

  const createShiftType = async (payload: CreateShiftTypePayload) => {
    const st = await api.createShiftType(payload);
    setShiftTypes((prev) => [...prev, st]);
    return st;
  };

  const deleteShiftType = async (id: string) => {
    await api.deleteShiftType(id);
    setShiftTypes((prev) => prev.filter((s) => s.id !== id));
  };

  const importFromCsv = async (file: File, mode: "replace" | "append" = "replace") => {
    const result = await api.importShiftTypesCsv(file, mode);
    setShiftTypes(result.shift_types);
    return result;
  };

  const loadDefaults = async () => {
    const result = await api.loadDefaultShiftTypes();
    setShiftTypes(result.shift_types);
    return result;
  };

  return {
    shiftTypes, columnHeaders, loading, error,
    reload, updateShiftType, setDesired,
    createShiftType, deleteShiftType, importFromCsv, loadDefaults,
  };
}
