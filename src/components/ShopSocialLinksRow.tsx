import {
  SHOP_SOCIAL_KEYS,
  type ShopSocialKey,
  parseShopSocialLinksJson,
} from "@/lib/shop-social-links";

const LABELS: Record<ShopSocialKey, string> = {
  reddit: "Reddit",
  x: "X",
  bluesky: "Bluesky",
  twitch: "Twitch",
  instagram: "Instagram",
};

const GLYPHS: Record<ShopSocialKey, string> = {
  reddit: "R",
  x: "𝕏",
  bluesky: "bs",
  twitch: "Tw",
  instagram: "IG",
};

export function ShopSocialLinksRow({ raw }: { raw: unknown }) {
  const links = parseShopSocialLinksJson(raw);
  const entries = SHOP_SOCIAL_KEYS.filter((k) => links[k]).map(
    (k) => [k, links[k]!] as const,
  );
  if (entries.length === 0) return null;

  return (
    <ul className="mt-4 flex flex-wrap justify-center gap-2">
      {entries.map(([key, href]) => (
        <li key={key}>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-1.5 text-xs text-zinc-200 hover:border-zinc-500"
          >
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-zinc-800 text-[10px] font-semibold text-zinc-300"
              aria-hidden
            >
              {GLYPHS[key]}
            </span>
            <span className="sr-only">{LABELS[key]}</span>
            <span className="font-medium text-zinc-300">{LABELS[key]}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
