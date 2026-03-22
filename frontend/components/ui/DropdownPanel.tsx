import React from "react";

interface DropdownPanelProps {
  open: boolean;
  onClose: () => void;
  className?: string;
  children: React.ReactNode;
}

export function DropdownPanel({ open, onClose, className = "", children }: DropdownPanelProps) {
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className={`absolute z-50 bg-white shadow-xl border border-slate-200 ${className}`.trim()}>
        {children}
      </div>
    </>
  );
}
