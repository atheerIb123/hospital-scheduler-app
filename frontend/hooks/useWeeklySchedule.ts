"use client";
import { useState, useEffect, useRef } from "react";
import type { WeeklySchedule, Assignment } from "@/lib/types";
import * as api from "@/lib/api";

export function useWeeklySchedule(weekStart: string | null, department?: string) {
  const [schedule, setSchedule] = useState<WeeklySchedule | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Track the latest fetch so stale responses from earlier renders are ignored
  const fetchSeqRef = useRef(0);

  useEffect(() => {
    if (!weekStart) { setSchedule(null); return; }
    const seq = ++fetchSeqRef.current;
    setLoading(true);
    setError(null);
    api.getLatestWeeklySchedule(weekStart, department)
      .then(s => { if (fetchSeqRef.current === seq) setSchedule(s); })
      .catch(() => { if (fetchSeqRef.current === seq) setSchedule(null); })
      .finally(() => { if (fetchSeqRef.current === seq) setLoading(false); });
  }, [weekStart, department]);

  const generate = async (lockedAssignments?: Assignment[]) => {
    if (!weekStart) return null;
    setGenerating(true);
    setError(null);
    try {
      const result = await api.generateWeeklySchedule(weekStart, department, lockedAssignments);
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

  const deleteSchedule = async () => {
    if (!weekStart) return;
    setDeleting(true);
    setError(null);
    try {
      await api.deleteWeeklySchedule(weekStart, department);
      setSchedule(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  return { schedule, loading, generating, deleting, error, generate, deleteSchedule };
}
