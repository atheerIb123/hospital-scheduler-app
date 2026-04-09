import React, { useRef, useEffect, useState, forwardRef } from "react";

const FORM_CLASSES =
  "border border-slate-300 bg-transparent rounded-xl px-2 py-1.5 text-sm text-slate-800 " +
  "placeholder-slate-300 focus:outline-none focus:ring-1 focus:ring-transparent " +
  "transition-all";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  inputPrefix?: string;
}

const SIZER_STYLE: React.CSSProperties = {
  position: "absolute",
  visibility: "hidden",
  whiteSpace: "pre",
  pointerEvents: "none",
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ className = "", inputPrefix, style, value, defaultValue, onChange, ...props }, ref) {
  const prefixRef = useRef<HTMLSpanElement>(null);
  const valueSizerRef = useRef<HTMLSpanElement>(null);
  const [paddingRight, setPaddingRight] = useState<number | undefined>(undefined);
  const [wrapperWidth, setWrapperWidth] = useState<number | undefined>(undefined);

  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState<string>(String(defaultValue ?? ""));
  const displayValue = isControlled ? String(value) : internalValue;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isControlled) setInternalValue(e.target.value);
    onChange?.(e);
  };

  useEffect(() => {
    const prefixWidth = prefixRef.current?.offsetWidth ?? 0;
    const valueWidth = valueSizerRef.current?.offsetWidth ?? 0;
    setPaddingRight(prefixWidth + 8);
    setWrapperWidth(prefixWidth + valueWidth + 48);
  }, [inputPrefix, displayValue]);

  return (
    <div
      className="relative inline-flex items-center"
      dir="rtl"
      style={{ width: wrapperWidth ? `${wrapperWidth}px` : undefined }}
    >
      {inputPrefix && (
        <span
          className="absolute right-2 text-sm text-slate-400 pointer-events-none select-none"
          aria-hidden
        >
          {inputPrefix}&nbsp;
        </span>
      )}
      <input
        ref={ref}
        dir="rtl"
        className={`${FORM_CLASSES} w-full ${className}`.trim()}
        style={{ paddingRight: paddingRight ? `${paddingRight}px` : undefined, ...style }}
        value={isControlled ? value : internalValue}
        onChange={handleChange}
        {...props}
      />
      {inputPrefix && (
        <span ref={prefixRef} className="text-sm" style={SIZER_STYLE} aria-hidden>
          {inputPrefix}&nbsp;
        </span>
      )}
      <span ref={valueSizerRef} className="text-sm" style={SIZER_STYLE} aria-hidden>
        {displayValue || props.placeholder || ""}
      </span>
    </div>
  );
});