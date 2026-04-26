import { Suspense } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteHeaderFallback } from "@/components/SiteHeaderFallback";
import { SiteLegalFooter } from "@/components/SiteLegalFooter";

export const dynamic = "force-dynamic";

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <Suspense fallback={<SiteHeaderFallback />}>
        <SiteHeader browseMenu />
      </Suspense>
      <div className="relative mx-auto max-w-[996px] px-4 py-10">{children}</div>
      <div className="mx-auto max-w-[996px] px-4 pb-10">
        <SiteLegalFooter />
      </div>
    </div>
  );
}
