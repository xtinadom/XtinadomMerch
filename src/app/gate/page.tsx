import { GateClient } from "./GateClient";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function GatePage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const raw = sp.from;
  const redirectFrom =
    typeof raw === "string" ? raw : Array.isArray(raw) ? (raw[0] ?? null) : null;

  return <GateClient redirectFrom={redirectFrom} />;
}
