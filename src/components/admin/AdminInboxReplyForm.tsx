"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { sendAdminInboxReply } from "@/actions/admin-inbox-reply";
import {
  ADMIN_INBOX_REPLY_BODY_MAX,
  type AdminInboxReplyState,
} from "@/lib/admin-inbox-reply-shared";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg border border-sky-900/50 bg-sky-950/35 px-4 py-2 text-sm font-medium text-sky-100/90 hover:border-sky-800/60 hover:bg-sky-950/50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Sending…" : "Send email reply"}
    </button>
  );
}

export function AdminInboxReplyForm(props: { inboundId: string }) {
  const { inboundId } = props;
  const [state, action] = useActionState<AdminInboxReplyState, FormData>(sendAdminInboxReply, null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (state?.status === "success" && taRef.current) {
      taRef.current.value = "";
    }
  }, [state]);

  return (
    <form action={action} className="space-y-2 border-t border-zinc-800/90 pt-3">
      <input type="hidden" name="inboundId" value={inboundId} />
      {state?.status === "error" ? (
        <p className="text-xs text-red-300/90" role="alert">
          {state.message}
        </p>
      ) : null}
      {state?.status === "success" ? (
        <p className="text-xs text-emerald-300/90" role="status">
          Reply sent.
        </p>
      ) : null}
      <label className="block text-xs font-medium text-zinc-500" htmlFor={`inbox-reply-${inboundId}`}>
        Reply by email
      </label>
      <textarea
        ref={taRef}
        id={`inbox-reply-${inboundId}`}
        name="body"
        required
        minLength={1}
        maxLength={ADMIN_INBOX_REPLY_BODY_MAX}
        rows={4}
        placeholder="Plain-text reply (sent via Resend from your inbox address)…"
        className="w-full resize-y rounded-lg border border-zinc-700 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
      />
      <SubmitButton />
    </form>
  );
}
