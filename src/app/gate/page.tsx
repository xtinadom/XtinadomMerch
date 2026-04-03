import { Suspense } from "react";
import { GateClient } from "./GateClient";

export default function GatePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950" aria-label="Loading" />
      }
    >
      <GateClient />
    </Suspense>
  );
}
