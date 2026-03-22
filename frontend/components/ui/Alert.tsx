import React from "react";
import { CheckCircle2, XCircle, AlertTriangle, X } from "lucide-react";

const STYLES = {
  success: "bg-emerald-50 border-emerald-200 text-emerald-800",
  error:   "bg-red-50 border-red-200 text-red-800",
  warning: "bg-amber-50 border-amber-200 text-amber-800",
} as const;

const ICONS = {
  success: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
  error:   <XCircle className="w-5 h-5 text-red-500" />,
  warning: <AlertTriangle className="w-5 h-5 text-amber-500" />,
};

interface AlertProps {
  type: "success" | "error" | "warning";
  children: React.ReactNode;
  onClose?: () => void;
}

export function Alert({ type, children, onClose }: AlertProps) {
  return (
    <div className={`flex items-start gap-3 border rounded-xl p-4 ${STYLES[type]}`} dir="rtl">
      <span className="mt-0.5 shrink-0">{ICONS[type]}</span>
      <div className="flex-1 text-sm">{children}</div>
      {onClose && (
        <button onClick={onClose} className="opacity-60 hover:opacity-100">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
