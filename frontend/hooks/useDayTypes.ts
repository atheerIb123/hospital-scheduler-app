import { useState, useEffect, useCallback } from "react";
import * as api from "@/lib/api";
import type { DayType } from "@/lib/types";

export function useDayTypes() {
  const [dayTypes, setDayTypes] = useState<DayType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDayTypes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getDayTypes();
      setDayTypes(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDayTypes();
  }, [fetchDayTypes]);

  const createDayType = async (name: string, color: string, score = 0) => {
    try {
      const newType = await api.createDayType({ name, color, score });
      setDayTypes(prev => [...prev, newType]);
      return newType;
    } catch (e) {
      throw e;
    }
  };

  const updateDayType = async (id: string, data: { name?: string; color?: string; score?: number }) => {
    try {
      const updated = await api.updateDayType(id, data);
      setDayTypes(prev => prev.map(dt => dt.id === id ? updated : dt));
      return updated;
    } catch (e) {
      throw e;
    }
  };

  const deleteDayType = async (id: string) => {
    try {
      await api.deleteDayType(id);
      setDayTypes(prev => prev.filter(dt => dt.id !== id));
    } catch (e) {
      throw e;
    }
  };

  return {
    dayTypes,
    loading,
    error,
    createDayType,
    updateDayType,
    deleteDayType,
    reload: fetchDayTypes
  };
}
