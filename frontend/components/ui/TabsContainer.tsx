// container for the TabButton component, to be used in the stats page. Provides a pill-shaped background and handles layout of the buttons.
import React from "react";

interface TabsContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function TabsContainer({ children, className = "" }: TabsContainerProps) {
  return (
    <div className={`border-b border-slate-300 inline-flex w-full ${className}`.trim()}>
      {children}
    </div>
  );
}