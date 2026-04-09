"use client";
import { useState, useEffect } from "react";
import type { Schedule } from "@/lib/types";
import * as api from "@/lib/api";

export function useSchedule(month: number, year: number) {
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .getScheduleByMonth(month, year)
      .then((s) => { setSchedule(s); })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [month, year]);

  const generate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const result = await api.generateSchedule(month, year);
      if (result.status === "failed") {
        setError(result.reason ?? "Schedule generation failed.");
      } else {
        setSchedule(result);
        setError(null);
      }
      return result;
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg);
      return null;
    } finally {
      setGenerating(false);
    }
  };

  const deleteSchedule = async () => {
    if (!schedule?.id) return;
    setDeleting(true);
    setError(null);
    try {
      await api.deleteSchedule(schedule.id);
      setSchedule(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  return { schedule, loading, generating, deleting, error, generate, deleteSchedule };
}
