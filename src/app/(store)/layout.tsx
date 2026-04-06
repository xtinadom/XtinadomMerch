import { Suspense } from "react";
import { SiteHeader } from "@/components/SiteHeader";

export const dynamic = "force-dynamic";

function SiteHeaderFallback() {
  return (
    <header className="relative z-[1000] border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <div className="h-7 w-28 animate-pulse rounded bg-zinc-800" />
        <div className="flex flex-1 justify-end gap-6">
          <div className="h-5 w-24 animate-pulse rounded bg-zinc-800" />
          <div className="h-4 w-10 animate-pulse rounded bg-zinc-800" />
        </div>
      </div>
    </header>
  );
}

export default function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Suspense fallback={<SiteHeaderFallback />}>
        <SiteHeader />
      </Suspense>
      <div className="mx-auto max-w-5xl px-4 py-8">{children}</div>
    </>
  );
}
