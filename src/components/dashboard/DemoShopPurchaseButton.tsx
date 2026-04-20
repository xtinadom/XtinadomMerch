"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { simulateShopDemoPurchase } from "@/actions/dashboard-demo-order";

export function DemoShopPurchaseButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  return (
    <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2">
      <p className="text-[11px] text-zinc-500">
        Demo: record a fake <strong className="text-zinc-400">paid</strong> order (1× your newest live listing +
        shipping) without Stripe or Printify.
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setMsg(null);
          setBusy(true);
          void simulateShopDemoPurchase()
            .then((r) => {
              if (r.ok) {
                setMsg({ tone: "ok", text: "Demo order recorded. Scroll down or refresh the list." });
                router.refresh();
              } else {
                setMsg({ tone: "err", text: r.error });
              }
            })
            .catch(() => {
              setMsg({ tone: "err", text: "Request failed. Try again." });
            })
            .finally(() => setBusy(false));
        }}
        className="mt-2 rounded-md border border-amber-800/60 bg-amber-950/35 px-3 py-1.5 text-xs font-medium text-amber-100/95 hover:bg-amber-950/50 disabled:opacity-50"
      >
        {busy ? "Recording…" : "Simulate demo purchase"}
      </button>
      {msg ? (
        <p
          className={`mt-2 text-xs ${msg.tone === "ok" ? "text-emerald-300/90" : "text-amber-200/90"}`}
          role="status"
        >
          {msg.text}
        </p>
      ) : null}
    </div>
  );
}
