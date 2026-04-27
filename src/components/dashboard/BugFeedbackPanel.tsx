"use client";

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function BugFeedbackPanel({ embedded = false }: { embedded?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const [happened, setHappened] = useState("");
  const [expected, setExpected] = useState("");
  const [steps, setSteps] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const dirty = useMemo(
    () => happened.trim() !== "" || expected.trim() !== "" || steps.trim() !== "" || Boolean(fileRef.current?.files?.length),
    [happened, expected, steps],
  );

  const onSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (pending) return;
      setMessage(null);

      const fd = new FormData();
      fd.set("happened", happened.trim());
      fd.set("expected", expected.trim());
      fd.set("stepsToReproduce", steps.trim());
      fd.set("pageUrl", typeof window !== "undefined" ? window.location.href : "");
      fd.set("userAgent", typeof navigator !== "undefined" ? navigator.userAgent : "");
      const f = fileRef.current?.files?.[0];
      if (f) fd.set("image", f);

      startTransition(async () => {
        // Action is implemented in the next todo (submit-action-upload).
        const r = await fetch("/api/bug-feedback", { method: "POST", body: fd });
        const json = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (!r.ok || !json.ok) {
          setMessage({ tone: "err", text: json.error ?? "Could not submit feedback." });
          return;
        }
        setMessage({ tone: "ok", text: "Thanks — your report was sent to the admin queue." });
        setHappened("");
        setExpected("");
        setSteps("");
        if (fileRef.current) fileRef.current.value = "";
        router.refresh();
      });
    },
    [pending, happened, expected, steps, router],
  );

  return (
    <section className={`rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 sm:p-6 ${embedded ? "mt-0" : "mt-8"}`}>
      <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Bug / Feedback</h2>
      <p className="mt-2 text-sm text-zinc-300">
        Tell us what went wrong and what you expected. Screenshots help.
      </p>

      {message?.tone === "err" ? (
        <p className="mt-4 rounded-lg border border-amber-900/50 bg-amber-950/25 px-3 py-2 text-xs text-amber-200/90" role="alert">
          {message.text}
        </p>
      ) : message?.tone === "ok" ? (
        <p className="mt-4 rounded-lg border border-emerald-900/40 bg-emerald-950/20 px-3 py-2 text-xs text-emerald-200/90" role="status">
          {message.text}
        </p>
      ) : null}

      <form className="mt-6 space-y-4" onSubmit={onSubmit} encType="multipart/form-data">
        <label className="block text-xs text-zinc-500">
          What happened?
          <textarea
            required
            rows={4}
            value={happened}
            onChange={(e) => setHappened(e.target.value)}
            placeholder="Describe what you did and what you saw…"
            className="mt-1 block w-full resize-y rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm leading-snug text-zinc-100 placeholder:text-zinc-600"
          />
        </label>

        <label className="block text-xs text-zinc-500">
          What did you expect?
          <textarea
            required
            rows={3}
            value={expected}
            onChange={(e) => setExpected(e.target.value)}
            placeholder="What should have happened instead?"
            className="mt-1 block w-full resize-y rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm leading-snug text-zinc-100 placeholder:text-zinc-600"
          />
        </label>

        <label className="block text-xs text-zinc-500">
          Steps to reproduce (optional)
          <textarea
            rows={3}
            value={steps}
            onChange={(e) => setSteps(e.target.value)}
            placeholder="1) … 2) …"
            className="mt-1 block w-full resize-y rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm leading-snug text-zinc-100 placeholder:text-zinc-600"
          />
        </label>

        <div className="space-y-1">
          <p className="text-xs text-zinc-500">Screenshot (optional)</p>
          <input
            ref={fileRef}
            type="file"
            name="image"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="max-w-full text-xs text-zinc-400 file:mr-2 file:rounded file:border-0 file:bg-zinc-800 file:px-2 file:py-1 file:text-zinc-200"
          />
          <p className="text-[11px] text-zinc-600">Images are compressed to about 100 KiB.</p>
        </div>

        <button
          type="submit"
          disabled={pending || !dirty}
          className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Sending…" : "Send report"}
        </button>
      </form>
    </section>
  );
}

