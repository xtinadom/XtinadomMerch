import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Legacy URL: forwards to admin Printify tab with the same query string (e.g. sync results). */
export default async function AdminPrintifyRedirect({ searchParams }: PageProps) {
  const sp = await searchParams;
  const params = new URLSearchParams();
  params.set("tab", "printify");
  for (const [key, val] of Object.entries(sp)) {
    if (key === "tab") continue;
    if (typeof val === "string") params.set(key, val);
    else if (Array.isArray(val) && val[0]) params.set(key, val[0]);
  }
  redirect(`/admin?${params.toString()}`);
}
