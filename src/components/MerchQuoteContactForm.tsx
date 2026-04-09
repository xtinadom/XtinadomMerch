"use client";

import { useActionState } from "react";
import {
  submitMerchQuoteContact,
  type MerchQuoteFormState,
} from "@/actions/contact-quote";

const initial: MerchQuoteFormState = {
  ok: false,
  error: "",
};

export function MerchQuoteContactForm() {
  const [state, formAction, pending] = useActionState(
    submitMerchQuoteContact,
    initial,
  );

  if (state.ok) {
    return (
      <p className="mt-6 rounded-lg border border-zinc-700 bg-zinc-900/50 px-4 py-3 text-sm text-zinc-300">
        {state.message}
      </p>
    );
  }

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <div>
        <label htmlFor="quote-name" className="block text-xs font-medium text-zinc-500">
          Name
        </label>
        <input
          id="quote-name"
          name="name"
          type="text"
          required
          autoComplete="name"
          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-500/40"
        />
      </div>
      <div>
        <label htmlFor="quote-email" className="block text-xs font-medium text-zinc-500">
          Email
        </label>
        <input
          id="quote-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-500/40"
        />
      </div>
      <div>
        <label htmlFor="quote-message" className="block text-xs font-medium text-zinc-500">
          What do you need?
        </label>
        <textarea
          id="quote-message"
          name="message"
          required
          rows={5}
          minLength={10}
          placeholder="Brand name, product types, timeline, anything we should know…"
          className="mt-1 w-full resize-y rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-500/40"
        />
      </div>

      {state.error ? (
        <p className="text-sm text-amber-400" role="alert">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-blue-900 py-3 text-sm font-medium text-white transition hover:bg-blue-800 disabled:opacity-50"
      >
        {pending ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
