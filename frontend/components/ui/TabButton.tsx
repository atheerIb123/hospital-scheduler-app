import React from "react";

// Tab button for use inside a pill container (bg-slate-100 p-1 rounded-xl).
// Active: white card with shadow. Inactive: grey text, no background.
// Padding is NOT included — pass it via className (e.g. className="px-4 py-2").
interface TabButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

export function TabButton({ active = false, className = "", children, ...props }: TabButtonProps) {
  return (
    <button
      type="button"
      className={`flex items-center border-b-2 gap-2 cursor-pointer text-sm font-semibold transition-all ${
        active ? "text-blue-700 border-b border-blue-600" : "border-transparent text-slate-600 hover:text-slate-500 "
      } ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}
