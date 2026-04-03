import { SiteHeader } from "@/components/SiteHeader";

export const dynamic = "force-dynamic";

export default function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <div className="mx-auto max-w-5xl px-4 py-8">{children}</div>
    </>
  );
}
