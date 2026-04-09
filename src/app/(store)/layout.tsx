import { Suspense } from "react";
import { SiteHeader } from "@/components/SiteHeader";

export const dynamic = "force-dynamic";

function SiteHeaderFallback() {
  return (
    <header className="relative z-[1000] border-b border-zinc-800/40 bg-zinc-950/40 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
        <div className="h-7 w-28 animate-pulse rounded bg-zinc-800/80" />
        <div className="flex flex-1 justify-end gap-6">
          <div className="h-4 w-24 animate-pulse rounded bg-zinc-800/80" />
          <div className="h-4 w-16 animate-pulse rounded bg-zinc-800/80" />
        </div>
      </div>
    </header>
  );
}

export default function StoreLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <div className="store-dimension-bg">
      <Suspense fallback={<SiteHeaderFallback />}>
        <SiteHeader />
      </Suspense>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">{children}</div>
      {modal}
    </div>
  );
}
