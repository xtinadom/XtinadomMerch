"use client";

import type { ReactNode } from "react";

export function ConfirmDeleteForm({
  action,
  message,
  children,
}: {
  action: () => void | Promise<void>;
  message: string;
  children: ReactNode;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </form>
  );
}
