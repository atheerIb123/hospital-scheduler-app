import { useState, useEffect, useCallback } from "react";
import * as api from "@/lib/api";
import type { DaySetting } from "@/lib/types";

export function useDaySettings(year: number, month: number) {
  const [settings, setSettings] = useState<DaySetting[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    if (!year || !month) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.getDaySettings(year, month);
      setSettings(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const setOverride = async (date: string, day_type_id: string | null) => {
    try {
      await api.setDaySetting(date, day_type_id);
      // Optimistic update or refetch
      fetchSettings();
    } catch (e) {
      throw e;
    }
  };

  return {
    settings,
    loading,
    error,
    setOverride,
    reload: fetchSettings
  };
}
