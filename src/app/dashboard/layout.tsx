import { Suspense } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteHeaderFallback } from "@/components/SiteHeaderFallback";

export const dynamic = "force-dynamic";

/**
 * `/dashboard` runs many Prisma calls + optional Stripe. On Vercel the default function
 * wall clock is often ~10s; without this, the RSC can be cut off while the UI stays on
 * `loading.tsx` (“stuck loading”). Vercel Pro allows up to 300s; Hobby remains ~10s.
 * @see https://vercel.com/docs/functions/limitations
 */
export const maxDuration = 300;

export default function DashboardSectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Suspense fallback={<SiteHeaderFallback />}>
        <SiteHeader browseMenu />
      </Suspense>
      {children}
    </>
  );
}
