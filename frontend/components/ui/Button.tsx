import React from "react";
import { Trash2 } from "lucide-react";

type Variant = "primary" | "secondary" | "danger" | "success" | "ghost" | "gradient" | "icon";
type Size = "large" | "small" | "compact";
type IconSide = "before" | "after";

const SIZE_PADDING: Record<Size, string> = {
  large: "px-5 py-2.5 text-sm",
  small: "py-1.5 px-3 text-sm",
  compact: "py-0 px-0 text-xs",
};

// Variant classes without padding (padding injected via size)
const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-blue-600 text-white rounded-xl font-medium flex items-center gap-2 " +
    "hover:bg-blue-700 disabled:opacity-50 active:scale-95 transition-all",
  secondary:
    "rounded-xl font-medium border border-slate-300 bg-transparent flex items-center gap-2" +
    "text-slate-700 hover:border-slate-400 active:scale-95 " +
    "disabled:opacity-50 transition-all",
  danger:
    "font-medium text-red-600 border border-red-300 rounded-xl flex items-center gap-2" +
    "hover:bg-red-50 disabled:opacity-50 transition-colors",
  success:
    "rounded-xl font-medium border border-emerald-300 bg-emerald-50 " +
    "text-emerald-700 hover:bg-emerald-100 active:scale-95 disabled:opacity-50 transition-all flex items-center gap-2",
  ghost:
    "rounded-xl text-xs font-medium transition-colors disabled:opacity-40 flex items-center gap-2",
  gradient:
    "flex items-center gap-2 rounded-xl font-medium text-white " +
    "transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed " +
    "active:scale-95",
  icon: "text-slate-400 hover:opacity-50 transition-all disabled:opacity-50 flex items-center gap-2",
};

// Variants that don't use size-based padding (manage their own or have none)
const SIZELESS_VARIANTS: Set<Variant> = new Set(["ghost"]);

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Lucide icon or any React node to render alongside the button text */
  icon?: React.ReactNode;
  /** Which side to place the icon relative to children. Defaults to "before". */
  iconSide?: IconSide;
  /** Loading state — disables the button, not forwarded to DOM */
  loading?: boolean;
}

export function Button({
  variant = "primary",
  size = "small",
  className = "",
  children,
  icon,
  iconSide = "before",
  loading,
  disabled,
  ...props
}: ButtonProps) {
  const padding = SIZELESS_VARIANTS.has(variant) ? "" : SIZE_PADDING[size];

  const inner =
    icon !== undefined ? (
      <span className="inline-flex items-center gap-1.5">
        {iconSide === "before" && <span className="inline-flex shrink-0 current-color">{icon}</span>}
        {children}
        {iconSide === "after" && <span className="inline-flex shrink-0 current-color">{icon}</span>}
      </span>
    ) : (
      children
    );

  return (
    <button className={`${padding} ${VARIANT_CLASSES[variant]} ${className}`.trim()} disabled={disabled || loading} {...props}>
      {inner}
    </button>
  );
}

const DELETE_ICON_CLASSES =
  "w-7 h-7 rounded-lg inline-flex items-center justify-center text-slate-300 " +
  "hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-40";

export function DeleteIconButton({ className = "", title = "מחק", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`${DELETE_ICON_CLASSES} ${className}`.trim()}
      title={title}
      type="button"
      {...props}
    >
      <Trash2 className="w-4 h-4" />
    </button>
  );
}
