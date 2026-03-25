import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, X } from "lucide-react";

type Variant = "default" | "compact";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  variant?: Variant;
  optionPrefix?: string;
  showSelectedPill?: boolean;
  onClearPill?: () => void;
}

const CHEVRON_DEFAULT = (
  <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
    <ChevronDown className="w-4 h-4" />
  </div>
);

const CHEVRON_COMPACT = (
  <div className="pointer-events-none absolute left-1.5 top-1/2 -translate-y-1/2 text-slate-400">
    <ChevronDown className="w-3 h-3" />
  </div>
);

function getOptionLabel(children: React.ReactNode, value: string): string | null {
  let found: string | null = null;
  React.Children.forEach(children, (child) => {
    if (found || !React.isValidElement(child)) return;
    if (child.type === "option") {
      const optVal = child.props.value ?? child.props.children;
      if (String(optVal) === String(value)) {
        found = String(child.props.children);
      }
    } else if (child.type === "optgroup") {
      const nested = getOptionLabel(child.props.children, value);
      if (nested) found = nested;
    }
  });
  return found;
}

const SIZER_STYLE: React.CSSProperties = {
  position: "absolute",
  visibility: "hidden",
  whiteSpace: "pre",
  pointerEvents: "none",
};

export function Select({ variant = "default", optionPrefix, className = "", showSelectedPill, onClearPill, children, onChange, value, defaultValue, ...props }: SelectProps) {
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState<string>(String(defaultValue ?? ""));
  const displayValue = isControlled ? String(value) : internalValue;

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!isControlled) setInternalValue(e.target.value);
    onChange?.(e);
  };

  const selectedLabel = getOptionLabel(children, displayValue);
  const isCompact = variant === "compact";

  const sizerRef = useRef<HTMLSpanElement>(null);
  const [selectWidth, setSelectWidth] = useState<number | undefined>(undefined);

  const chevronWidth = isCompact ? 20 : 36;
  const horizontalPadding = isCompact ? 16 : 20;

  useEffect(() => {
    if (sizerRef.current) {
      const textWidth = sizerRef.current.offsetWidth;
      setSelectWidth(textWidth + horizontalPadding + chevronWidth);
    }
  }, [selectedLabel, optionPrefix, horizontalPadding, chevronWidth]);

  const overlayClass = isCompact
    ? "absolute inset-0 flex items-center pr-2 pl-5 pointer-events-none"
    : "absolute inset-0 flex items-center pr-4 pl-9 pointer-events-none";

  const selectClass = isCompact
    ? "appearance-none w-full text-xs font-semibold border border-slate-200 bg-slate-50 rounded-lg px-2 py-1 pl-5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition-all text-transparent [&>option]:text-slate-900 [&>optgroup]:text-slate-900"
    : "appearance-none w-full px-2 py-1.5 pl-9 rounded-xl text-sm font-medium border border-slate-300 hover:border-slate-400 focus:outline-none focus:border-transparent focus:ring-1 focus:ring-blue-100 transition-all cursor-pointer disabled:opacity-50 text-transparent [&>option]:text-slate-900 [&>optgroup]:text-slate-900";

  const sizerTextClass = isCompact ? "text-xs font-semibold" : "text-sm font-medium";

  const pill = showSelectedPill && selectedLabel && displayValue !== "" && (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 select-none bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
      {selectedLabel}
      {onClearPill && (
        <button type="button" onClick={onClearPill} className="hover:text-blue-900 transition-colors ml-0.5">
          <X className="w-3 h-3" />
        </button>
      )}
    </span>
  );

  const selectEl = (
    <div
      className={`relative inline-flex items-center ${!showSelectedPill ? className : ""}`}
      style={{ width: selectWidth ? `${selectWidth}px` : undefined }}
    >
      <select
        dir="rtl"
        className={selectClass}
        value={isControlled ? value : internalValue}
        onChange={handleChange}
        {...props}
      >
        {children}
      </select>

      {isCompact ? CHEVRON_COMPACT : CHEVRON_DEFAULT}

      {selectedLabel && (
        <div className={overlayClass} dir="rtl">
          {optionPrefix && (
            <span className={`${isCompact ? "text-xs" : "text-sm"} font-medium text-slate-400 shrink-0`}>
              {optionPrefix}&nbsp;
            </span>
          )}
          <span className={`${isCompact ? "text-xs font-semibold" : "text-sm font-medium"} text-slate-700 truncate`}>
            {selectedLabel}
          </span>
        </div>
      )}

      <span
        ref={sizerRef}
        className={sizerTextClass}
        style={SIZER_STYLE}
        aria-hidden
      >
        {optionPrefix ? `${optionPrefix}\u00A0${selectedLabel ?? ""}` : (selectedLabel ?? "")}
      </span>
    </div>
  );

  if (!showSelectedPill) return selectEl;

  return (
    <div className={`inline-flex items-center flex-wrap gap-2 select-none ${className}`}>
      {selectEl}
      {pill}
    </div>
  );
}