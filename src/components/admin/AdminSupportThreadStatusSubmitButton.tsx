"use client";

import { useFormStatus } from "react-dom";

export function AdminSupportThreadStatusSubmitButton(props: {
  idleLabel: string;
  pendingLabel: string;
  className: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={props.className}
    >
      {pending ? props.pendingLabel : props.idleLabel}
    </button>
  );
}
