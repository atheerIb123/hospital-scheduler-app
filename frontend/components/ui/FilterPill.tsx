import React from "react";

// Pill-shaped toggle button for filter/tag multi-selection.
// Default active color is blue-600; pass activeClassName to override for
// contextual colors (e.g. "bg-orange-600 text-white border-orange-600").
// Padding is included in the base class — override with className if needed.
interface FilterPillProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  activeClassName?: string;
}

export function FilterPill({
  active = false,
  activeClassName = "bg-blue-600 text-white border-blue-600",
  className = "",
  children,
  ...props
}: FilterPillProps) {
  return (
    <button
      type="button"
      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
        active
          ? `${activeClassName} shadow-sm`
          : "bg-slate-50 text-slate-600 border-slate-200 hover:border-blue-300"
      } ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}
