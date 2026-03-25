import React from "react";

// Structural classes only. Color classes (bg-*, text-*, border-*) must be passed via className.
// Example: <Badge className="bg-purple-100 text-purple-700 border-purple-200">label</Badge>
const BADGE_CLASSES = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border";

interface BadgeProps {
  className?: string;
  children: React.ReactNode;
}

export function Badge({ className = "", children }: BadgeProps) {
  return <span className={`${BADGE_CLASSES} ${className}`.trim()}>{children}</span>;
}
