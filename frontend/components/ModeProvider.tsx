"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

export type AppMode = string;

interface ModeContextType {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
}

const ModeContext = createContext<ModeContextType | undefined>(undefined);

export function ModeProvider({ children }: { readonly children: React.ReactNode }) {
  const [mode, setModeState] = useState<AppMode>("doctors");
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const stored = localStorage.getItem("app_mode") as AppMode;
    if (stored) {
      setModeState(stored);
    } else {
      setModeState("doctors");
      localStorage.setItem("app_mode", "doctors");
    }
  }, []);

  const setMode = (newMode: AppMode) => {
    setModeState(newMode);
    localStorage.setItem("app_mode", newMode);
    // Reload the page completely to ensure all data and hooks reset
    window.location.reload();
  };

  if (!isMounted) return null; // Avoid hydration mismatch

  return (
    <ModeContext.Provider value={{ mode, setMode }}>
      {children}
    </ModeContext.Provider>
  );
}

export function useMode() {
  const context = useContext(ModeContext);
  if (context === undefined) {
    throw new Error("useMode must be used within a ModeProvider");
  }
  return context;
}
