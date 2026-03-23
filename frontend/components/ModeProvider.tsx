"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

export type AppMode = "doctors" | "nursing" | "cleaning" | null;

interface ModeContextType {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
}

const ModeContext = createContext<ModeContextType | undefined>(undefined);

export function ModeProvider({ children }: { readonly children: React.ReactNode }) {
  const [mode, setModeState] = useState<AppMode>(null);
  const [isMounted, setIsMounted] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    setIsMounted(true);
    const stored = localStorage.getItem("app_mode") as AppMode;
    if (stored && ["doctors", "nursing", "cleaning"].includes(stored)) {
      setModeState(stored);
    }
  }, []);

  const setMode = (newMode: AppMode) => {
    setModeState(newMode);
    if (newMode) {
      localStorage.setItem("app_mode", newMode);
      // Trigger a raw storage event so other tabs (and api.ts) know about the update
      window.dispatchEvent(new Event("storage"));
    } else {
      localStorage.removeItem("app_mode");
    }
  };

  useEffect(() => {
    if (!isMounted) return;
    // If we're not on the root page and no mode is selected, redirect to root
    if (!mode && pathname !== "/") {
      router.replace("/");
    }
  }, [mode, pathname, isMounted, router]);

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
