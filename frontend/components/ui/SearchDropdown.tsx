"use client";
import React, { useState, useRef, useEffect } from "react";
import { Search, X } from "lucide-react";

// SearchDropdown – a search input with autocomplete suggestions from a known list.
//
// Filter mode (default): `value` is the typed search text; clicking a suggestion
//   fills `value` via `onChange`. The list below the input is filtered live.
//
// Select mode (`selectMode`): `value` is the currently-selected item shown when
//   the dropdown is closed. While open the field shows an internal search string.
//   Picking an option calls `onSelect(option)` instead of `onChange`.

interface SearchDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
  dir?: string;
  // select mode
  selectMode?: boolean;
  onSelect?: (option: string) => void;
  renderOption?: (option: string, isSelected: boolean) => React.ReactNode;
  emptyLabel?: string;
}

export function SearchDropdown({
  value,
  onChange,
  options,
  placeholder = "חיפוש...",
  className = "",
  dir,
  selectMode = false,
  onSelect,
  renderOption,
  emptyLabel = "לא נמצאו תוצאות",
}: SearchDropdownProps) {
  const [open, setOpen] = useState(false);
  const [internalSearch, setInternalSearch] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        setInternalSearch("");
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const searchText = selectMode ? internalSearch : value;
  const displayValue = selectMode ? (open ? internalSearch : value) : value;

  const filtered = searchText.trim()
    ? options.filter((o) => o.toLowerCase().includes(searchText.trim().toLowerCase()))
    : options;

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (selectMode) {
      setInternalSearch(e.target.value);
    } else {
      onChange(e.target.value);
    }
  }

  function handleFocus() {
    if (selectMode) {
      setInternalSearch("");
    }
    setOpen(true);
  }

  function handleSelect(option: string) {
    if (selectMode && onSelect) {
      onSelect(option);
    } else {
      onChange(option);
    }
    setOpen(false);
    setInternalSearch("");
  }

  function handleClear() {
    onChange("");
    setInternalSearch("");
    setOpen(false);
  }

  const showClear = selectMode ? !!value : !!value;

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      {/* Search icon */}
      <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none z-10" />

      <input
        type="text"
        dir={dir}
        placeholder={placeholder}
        value={displayValue}
        onChange={handleInputChange}
        onFocus={handleFocus}
        className="w-full pr-9 pl-7 py-1.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-transparent focus:border-slate-400 bg-transparent transition-all placeholder:text-slate-400"
      />

      {/* Clear button */}
      {showClear && (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleClear}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Dropdown */}
      {open && options.length > 0 && (
        <div className="absolute top-full mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg z-20 max-h-52 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-400 text-right" dir="rtl">
              {emptyLabel}
            </p>
          ) : (
            filtered.map((option) => (
              <button
                key={option}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(option)}
                className={`w-full text-right px-4 py-2 text-sm border-b border-slate-50 last:border-0 transition-colors ${
                  selectMode && option === value
                    ? "bg-blue-50 text-blue-700 font-semibold"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
                dir="rtl"
              >
                {renderOption ? renderOption(option, option === value) : option}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
