"use client";
import { useState, useEffect } from "react";
import type { WeeklySchedule } from "@/lib/types";
import * as api from "@/lib/api";

export function useWeeklySchedule(weekStart: string | null, department?: string) {
  const [schedule, setSchedule] = useState<WeeklySchedule | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!weekStart) { setSchedule(null); return; }
    setLoading(true);
    setError(null);
    api.getLatestWeeklySchedule(weekStart, department)
      .then(s => setSchedule(s))
      .catch(() => setSchedule(null))
      .finally(() => setLoading(false));
  }, [weekStart, department]);

  const generate = async () => {
    if (!weekStart) return null;
    setGenerating(true);
    setError(null);
    try {
      const result = await api.generateWeeklySchedule(weekStart, department);
      if (result.status === "failed") {
        setError(result.reason ?? "שגיאה ביצירת הסידור");
      } else {
        setSchedule(result);
      }
      return result;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setGenerating(false);
    }
  };

  return { schedule, loading, generating, error, generate };
}
