"use client";
import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export type Role = "all" | "doctor" | "nursing";

interface RoleContextValue {
  role: Role;
  setRole: (r: Role) => void;
}

const RoleContext = createContext<RoleContextValue>({ role: "all", setRole: () => {} });

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role>("all");

  useEffect(() => {
    const stored = localStorage.getItem("role_filter") as Role | null;
    if (stored && ["all", "doctor", "nursing"].includes(stored)) {
      setRoleState(stored);
    }
  }, []);

  const setRole = (r: Role) => {
    setRoleState(r);
    localStorage.setItem("role_filter", r);
  };

  return <RoleContext.Provider value={{ role, setRole }}>{children}</RoleContext.Provider>;
}

export const useRole = () => useContext(RoleContext);
