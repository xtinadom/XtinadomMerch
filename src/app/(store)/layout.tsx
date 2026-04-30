import { Suspense } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteHeaderFallback } from "@/components/SiteHeaderFallback";
import { SiteLegalFooter } from "@/components/SiteLegalFooter";

export const dynamic = "force-dynamic";

/** @see comment on `(site-nav)/layout.tsx` — storefront routes need enough wall clock for Prisma + header. */
export const maxDuration = 300;

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
      <div className="mx-auto max-w-[1124px] px-4 py-8 sm:px-6 sm:py-10">{children}</div>
      <div className="mx-auto max-w-[1124px] px-4 pb-10 sm:px-6">
        <SiteLegalFooter />
      </div>
      {modal}
    </div>
  );
}
