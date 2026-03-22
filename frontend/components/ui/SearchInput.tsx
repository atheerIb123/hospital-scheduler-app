"use client";
import React from "react";
import { Search, X } from "lucide-react";

// Search input with built-in search icon (right) and clear button (left).
// Used wherever a text search field with icon is needed.
// Pass className to control the wrapper width (e.g. className="w-48" or className="max-w-xs w-full").
interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  dir?: string;
}

export function SearchInput({
  value,
  onChange,
  placeholder = "חיפוש...",
  className = "",
  dir,
}: SearchInputProps) {
  return (
    <div className={`relative ${className}`}>
      <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
      <input
        type="text"
        dir={dir}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full pr-9 pl-2 py-1.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-transparent focus:border-slate-400 bg-transparent transition-all placeholder:text-slate-400"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
