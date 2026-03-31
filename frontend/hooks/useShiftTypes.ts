"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import type { ShiftType, CreateShiftTypePayload } from "@/lib/types";
import * as api from "@/lib/api";

export function useShiftTypes(modeOverride?: string) {
  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([]);
  const [columnHeaders, setColumnHeaders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const latestModeRef = useRef(modeOverride);
  latestModeRef.current = modeOverride;

  const reload = useCallback(async () => {
    const fetchMode = modeOverride;
    try {
      setLoading(true);
      const [data, headers] = await Promise.all([
        api.getShiftTypes(fetchMode),
        api.getColumnHeaders(),
      ]);
      if (latestModeRef.current !== fetchMode) return;
      setShiftTypes(data);
      setColumnHeaders(headers);
      setError(null);
    } catch (e) {
      if (latestModeRef.current !== fetchMode) return;
      setError((e as Error).message);
    } finally {
      if (latestModeRef.current === fetchMode) setLoading(false);
    }
  }, [modeOverride]);

  useEffect(() => { reload(); }, [reload]);

  const updateShiftType = async (
    id: string,
    data: Partial<Pick<ShiftType, "names" | "is_desired" | "desirability" | "schedule_on" | "required_attributes" | "is_special">>
  ) => {
    const st = await api.updateShiftType(id, data, modeOverride);
    setShiftTypes((prev) => prev.map((s) => (s.id === id ? st : s)));
    return st;
  };

  const setDesired = async (id: string, is_desired: boolean) => {
    const st = await api.toggleDesired(id, is_desired, modeOverride);
    setShiftTypes((prev) => prev.map((s) => (s.id === id ? st : s)));
    return st;
  };

  const createShiftType = async (payload: CreateShiftTypePayload) => {
    const st = await api.createShiftType(payload, modeOverride);
    setShiftTypes((prev) => [...prev, st]);
    return st;
  };

  const deleteShiftType = async (id: string) => {
    await api.deleteShiftType(id, modeOverride);
    setShiftTypes((prev) => prev.filter((s) => s.id !== id));
  };

  const deleteAllShiftTypes = async () => {
    await api.deleteAllShiftTypes(modeOverride);
    setShiftTypes([]);
  };

  const importFromCsv = async (file: File, mode: "replace" | "append" = "replace") => {
    const result = await api.importShiftTypesCsv(file, mode);
    setShiftTypes(result.shift_types);
    return result;
  };

  const loadDefaults = async () => {
    const result = await api.loadDefaultShiftTypes(modeOverride);
    setShiftTypes(result.shift_types);
    return result;
  };

  return {
    shiftTypes, columnHeaders, loading, error,
    reload, updateShiftType, setDesired,
    createShiftType, deleteShiftType, deleteAllShiftTypes, importFromCsv, loadDefaults,
  };
}
