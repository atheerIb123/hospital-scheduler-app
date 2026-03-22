import React from "react";

interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  /** Standard toggle: text label shown next to the track */
  label?: string;
  /** Segmented toggle: text for the false/off side */
  labelOff?: string;
  /** Segmented toggle: text for the true/on side */
  labelOn?: string;
  className?: string;
}

/** The sliding track. Always rendered dir="ltr" so translate-x works
 *  correctly regardless of the surrounding RTL context. */
function Track({ checked, onClick }: { checked: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onClick}
      dir="ltr"
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full p-0.5 transition-colors duration-200 focus:outline-none ${
        checked ? "bg-blue-500" : "bg-slate-200"
      }`}
    >
      <span
        className={`h-4 w-4 shrink-0 rounded-full bg-white shadow-sm transition-transform duration-200 ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}

/**
 * Toggle — two variants:
 *
 * 1. Standard (`label` prop): label text + sliding track.
 * 2. Segmented (`labelOff` + `labelOn`): pill container with two labeled
 *    buttons; the active one gets a blue background that "moves" to it.
 */
const BUTTON_CLASSES =
  "px-3 py-1.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 focus:outline-none";

const TOGGLED_CLASSES =
  "bg-slate-500 text-white";

const UNTOGGLED_CLASSES =
  "text-slate-500 hover:text-slate-700 cursor-pointer";

export function Toggle({ checked, onChange, label, labelOff, labelOn, className = "" }: ToggleProps) {
  const isSegmented = labelOff !== undefined && labelOn !== undefined;

  if (isSegmented) {
    return (
      <div
        className={`ring-1 ring-slate-300 rounded-xl select-none overflow-clip ${className}`}
        dir="ltr"
      >
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`${BUTTON_CLASSES}  ${
            !checked
              ? `${TOGGLED_CLASSES}`
              : `${UNTOGGLED_CLASSES}`
          }`}
        >
          {labelOff}
        </button>
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`${BUTTON_CLASSES} ${
            checked
              ? `${TOGGLED_CLASSES}`
              : `${UNTOGGLED_CLASSES}`
          }`}
        >
          {labelOn}
        </button>
      </div>
    );
  }

  return (
    <label className={`flex items-center gap-2 cursor-pointer select-none ${className}`}>
      {label && (
        <span className="text-sm font-semibold text-slate-600 whitespace-nowrap">{label}</span>
      )}
      <Track checked={checked} onClick={() => onChange(!checked)} />
    </label>
  );
}
