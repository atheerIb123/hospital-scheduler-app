"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import type { ShiftCompositionData, ShiftConfig, SpecialShiftMonthConfig } from "@/lib/types";
import * as api from "@/lib/api";

export function useShiftComposition(modeOverride?: string) {
  const [data, setData] = useState<ShiftCompositionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const latestModeRef = useRef(modeOverride);
  latestModeRef.current = modeOverride;

  const reload = useCallback(async () => {
    const fetchMode = modeOverride;
    try {
      setLoading(true);
      const result = await api.getShiftComposition(fetchMode);
      if (latestModeRef.current !== fetchMode) return;
      setData(result);
      setError(null);
    } catch (e) {
      if (latestModeRef.current !== fetchMode) return;
      setError((e as Error).message);
    } finally {
      if (latestModeRef.current === fetchMode) setLoading(false);
    }
  }, [modeOverride]);

  useEffect(() => { reload(); }, [reload]);

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

export function useSpecialShifts(year: number, modeOverride?: string) {
  const [configs, setConfigs] = useState<SpecialShiftMonthConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const latestKeyRef = useRef(`${year}|${modeOverride}`);
  latestKeyRef.current = `${year}|${modeOverride}`;

  const reload = useCallback(async () => {
    const key = `${year}|${modeOverride}`;
    try {
      setLoading(true);
      const result = await api.getMonthlySpecialShifts(year, modeOverride);
      if (latestKeyRef.current !== key) return;
      setConfigs(result);
    } finally {
      if (latestKeyRef.current === key) setLoading(false);
    }
  }, [year, modeOverride]);

  useEffect(() => { reload(); }, [reload]);

  const setMonth = async (month: number, total_count: number, week_distribution?: number[], shift_name?: string) => {
    const result = await api.setMonthlySpecialShifts(month, year, total_count, week_distribution, shift_name, modeOverride);
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
