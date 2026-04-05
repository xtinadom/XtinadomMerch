import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ShopTagMenu } from "@/components/ShopTagMenu";

export async function SiteHeader() {
  const tags = await prisma.tag.findMany({
    orderBy: [{ collection: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });

  return (
    <header className="relative z-[1000] border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link
          href="/shop"
          className="text-lg font-semibold tracking-tight text-zinc-100"
        >
          Xtinadom
        </Link>
        <nav className="flex flex-1 items-center justify-end gap-6">
          <ShopTagMenu tags={tags} />
          <Link
            href="/cart"
            className="text-sm text-zinc-400 transition hover:text-zinc-100"
          >
            Cart
          </Link>
          <Link
            href="/admin"
            className="text-xs text-zinc-600 transition hover:text-zinc-400"
          >
            Admin
          </Link>
        </nav>
      </div>
    </header>
  );
}
