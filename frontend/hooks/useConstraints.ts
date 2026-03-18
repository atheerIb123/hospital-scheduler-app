"use client";
import { useState, useEffect, useCallback } from "react";
import type { Constraint, CreateConstraintPayload } from "@/lib/types";
import {
  getConstraints,
  createConstraint,
  updateConstraint,
  deleteConstraint,
  clearConstraints,
  importConstraintsCsv,
} from "@/lib/api";

export function useConstraints(filterMonth?: number, filterYear?: number) {
  const [constraints, setConstraints] = useState<Constraint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getConstraints(
        filterMonth && filterYear
          ? { month: filterMonth, year: filterYear }
          : undefined
      );
      setConstraints(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [filterMonth, filterYear]);

  useEffect(() => { load(); }, [load]);

  const add = async (payload: CreateConstraintPayload) => {
    // API now returns { created: Constraint[], skipped: number }
    const result = await createConstraint(payload) as unknown as { created: Constraint[]; skipped: number };
    const newDocs = result.created ?? [];
    setConstraints((prev) => [...prev, ...newDocs].sort((a, b) => a.date.localeCompare(b.date)));
    return result;
  };

  const update = async (id: string, payload: Partial<CreateConstraintPayload>) => {
    const updated = await updateConstraint(id, payload);
    setConstraints((prev) =>
      prev.map((c) => (c.id === id ? updated : c)).sort((a, b) => a.date.localeCompare(b.date))
    );
    return updated;
  };

  const remove = async (id: string) => {
    await deleteConstraint(id);
    setConstraints((prev) => prev.filter((c) => c.id !== id));
  };

  const clear = async () => {
    await clearConstraints();
    setConstraints([]);
  };

  const importCsv = async (file: File, mode: "replace" | "append" = "replace") => {
    const result = await importConstraintsCsv(file, mode);
    await load(); // full reload to reflect server state
    return result;
  };

  return { constraints, loading, error, reload: load, add, update, remove, clear, importCsv };
}
