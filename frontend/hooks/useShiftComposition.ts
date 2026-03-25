"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import type { ShiftCompositionData, ShiftConfig, SpecialShiftMonthConfig } from "@/lib/types";
import * as api from "@/lib/api";

export function useShiftComposition(modeOverride?: string) {
  const [data, setData] = useState<ShiftCompositionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const autoSeededRef = useRef(false);

  const reload = useCallback(async () => {
    try {
      const result = await api.getShiftComposition(modeOverride);
      setData(result);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [modeOverride]);

  useEffect(() => { reload(); }, [reload]);

  // Auto-add reserve/special if nursing base shifts exist but they're missing
  useEffect(() => {
    if (!data || autoSeededRef.current) return;
    const names = new Set(data.shift_configs.map(c => c.shift_name));
    const baseNursing = ["משמרת בוקר", "משמרת ערב", "משמרת לילה"];
    const missing = ["רזרבה", "משמרת מיוחדת"].filter(n => !names.has(n));
    if (data.shift_configs.length > 0 && baseNursing.every(n => names.has(n)) && missing.length > 0) {
      autoSeededRef.current = true;
      api.seedNursingComposition(modeOverride).then(result => {
        if (result.shift_configs) setData({ shift_configs: result.shift_configs });
      }).catch(() => {});
    }
  }, [data, modeOverride]);

  const save = async (configs: ShiftConfig[]) => {
    const result = await api.saveShiftComposition({ shift_configs: configs }, modeOverride);
    setData({ shift_configs: result.shift_configs });
  };

  const seedNursing = async () => {
    const result = await api.seedNursingComposition(modeOverride);
    if (result.shift_configs) setData({ shift_configs: result.shift_configs });
  };

  return { data, loading, error, reload, save, seedNursing };
}

export function useSpecialShifts(year: number) {
  const [configs, setConfigs] = useState<SpecialShiftMonthConfig[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const result = await api.getMonthlySpecialShifts(year);
      setConfigs(result);
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => { reload(); }, [reload]);

  const setMonth = async (month: number, total_count: number, week_distribution?: number[], shift_name?: string) => {
    const result = await api.setMonthlySpecialShifts(month, year, total_count, week_distribution, shift_name);
    setConfigs(prev => {
      const next = prev.filter(c => !(c.shift_name === result.shift_name && c.month === month && c.year === year));
      if (result.total_count > 0) next.push({
        shift_name: result.shift_name,
        month, year,
        total_count: result.total_count,
        week_distribution: result.week_distribution,
      });
      return next;
    });
  };

  const getCount = (month: number, shift_name?: string) =>
    configs.find(c => c.month === month && c.year === year && (!shift_name || c.shift_name === shift_name))?.total_count ?? 0;

  const getDistribution = (month: number, shift_name?: string) =>
    configs.find(c => c.month === month && c.year === year && (!shift_name || c.shift_name === shift_name))?.week_distribution;

  return { configs, loading, reload, setMonth, getCount, getDistribution };
}
