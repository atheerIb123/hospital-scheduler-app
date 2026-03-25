"use client";
import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

interface MultiSelectProps {
  options: { value: string; label: string }[];
  value: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function MultiSelect({ options, value, onChange, placeholder = "בחר...", className = "" }: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    if (!open) return;
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPanelPos({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 160) });
    }
    const onDown = (e: MouseEvent) => {
      if (!btnRef.current?.contains(e.target as Node) && !panelRef.current?.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const toggle = (v: string) => {
    onChange(value.includes(v) ? value.filter(x => x !== v) : [...value, v]);
  };

  const displayText =
    value.length === 0
      ? placeholder
      : value.length === 1
        ? (options.find(o => o.value === value[0])?.label ?? placeholder)
        : `${value.length} נבחרו`;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(p => !p)}
        dir="rtl"
        className={`flex items-center justify-between gap-2 px-3 py-1.5 text-sm font-medium border border-slate-300 hover:border-slate-400 rounded-xl bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-100 transition-all cursor-pointer ${className}`}
      >
        <span className="truncate">{displayText}</span>
        <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
      </button>
      {open && createPortal(
        <div
          ref={panelRef}
          style={{ top: panelPos.top, left: panelPos.left, minWidth: panelPos.width }}
          className="fixed z-[9999] bg-white border border-slate-200 rounded-xl shadow-lg py-1 max-h-52 overflow-auto"
          dir="rtl"
        >
          {options.map(opt => (
            <label key={opt.value} className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 cursor-pointer text-sm text-slate-700">
              <input
                type="checkbox"
                checked={value.includes(opt.value)}
                onChange={() => toggle(opt.value)}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}
