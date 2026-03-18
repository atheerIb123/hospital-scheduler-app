"use client";
import { RoleProvider } from "@/contexts/RoleContext";
import type { ReactNode } from "react";

export function ClientProviders({ children }: { children: ReactNode }) {
  return <RoleProvider>{children}</RoleProvider>;
}
