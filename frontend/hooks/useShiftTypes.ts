"use client";
import { useState, useEffect, useCallback } from "react";
import type { ShiftType } from "@/lib/types";
import * as api from "@/lib/api";

export function useShiftTypes() {
  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const data = await api.getShiftTypes();
      setShiftTypes(data);
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
    data: Partial<Pick<ShiftType, "names" | "is_desired">>
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

  return { shiftTypes, loading, error, reload, updateShiftType, setDesired };
}
