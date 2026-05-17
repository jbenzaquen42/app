"use client";

import type { ReactNode } from "react";

export function ConfirmSubmitButton({ children, message, className = "btn-danger" }: { children: ReactNode; message: string; className?: string }) {
  return (
    <button
      className={className}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
