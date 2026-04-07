import Link from "next/link";
import { getStoreTags } from "@/lib/store-tags";
import { ShopTagMenu } from "@/components/ShopTagMenu";
import { SHOP_ALL_ROUTE } from "@/lib/constants";

export async function SiteHeader() {
  const tags = await getStoreTags();

  return (
    <header className="relative z-[1000] border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link
          href="/"
          className="text-lg font-semibold tracking-tight text-zinc-100"
        >
          Xtinadom
        </Link>
        <nav className="flex flex-1 items-center justify-end gap-6">
          <Link
            href={SHOP_ALL_ROUTE}
            className="text-sm text-zinc-400 transition hover:text-zinc-100"
          >
            All products
          </Link>
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
