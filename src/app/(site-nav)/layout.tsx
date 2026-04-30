import { Suspense } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteHeaderFallback } from "@/components/SiteHeaderFallback";

export const dynamic = "force-dynamic";

/**
 * Match `/dashboard` — without this, Vercel can cut the RSC at ~10s while the client stays on
 * `app/loading.tsx` (looks like an infinite load). These layouts run `SiteHeader` (Prisma + session).
 */
export const maxDuration = 300;

/** Platform marketing + browse pages: same top nav as the storefront (Shops, All products, Browse, Cart). */
export default function SiteNavLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <>
      <Suspense fallback={<SiteHeaderFallback />}>
        <SiteHeader browseMenu />
      </Suspense>
      {children}
      {modal}
    </>
  );
}
