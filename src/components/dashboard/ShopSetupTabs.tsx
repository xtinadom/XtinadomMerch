"use client";

import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  updateShopProfileSetup,
  uploadShopProfileImageSetup,
  submitFirstListingSetup,
  type ShopSetupActionResult,
} from "@/actions/dashboard-shop-setup";
import { dashboardStartStripeConnect } from "@/actions/dashboard-marketplace";
import {
  SHOP_SOCIAL_KEYS,
  type ShopSocialKey,
  normalizedShopSocialUrl,
  parseShopSocialLinksJson,
  socialLinkAddValidationMessage,
} from "@/lib/shop-social-links";
import {
  encodeBaselinePickAllVariants,
  flattenShopBaselineCatalogGroups,
  type ShopSetupCatalogGroup,
} from "@/lib/shop-baseline-catalog";

export type ShopSetupShopPayload = {
  displayName: string;
  profileImageUrl: string | null;
  welcomeMessage: string | null;
  socialLinks: unknown;
  stripeConnectAccountId: string | null;
  connectChargesEnabled: boolean;
  payoutsEnabled: boolean;
};

export type ShopSetupSteps = {
  stripe: boolean;
  profile: boolean;
  listing: boolean;
};

const SOCIAL_LABELS: Record<ShopSocialKey, string> = {
  reddit: "Reddit",
  x: "X",
  bluesky: "Bluesky",
  twitch: "Twitch",
  loyalfans: "Loyalfans",
  onlyfans: "OnlyFans",
  instagram: "Instagram",
};

function socialRecordFromShop(links: unknown): Record<ShopSocialKey, string> {
  const p = parseShopSocialLinksJson(links);
  return Object.fromEntries(SHOP_SOCIAL_KEYS.map((k) => [k, p[k] ?? ""])) as Record<
    ShopSocialKey,
    string
  >;
}

const btnPrimary =
  "rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white disabled:cursor-not-allowed";
const btnPrimaryDisabled = "rounded-lg bg-zinc-900/50 px-4 py-2 text-sm font-medium text-zinc-500 ring-1 ring-zinc-800";
const btnPrimarySaving =
  "cursor-wait rounded-lg bg-zinc-100/70 px-4 py-2 text-sm font-medium text-zinc-700 ring-1 ring-zinc-300/60";
const btnPrimarySaved =
  "cursor-default rounded-lg border border-emerald-800/50 bg-emerald-950/30 px-4 py-2 text-sm font-medium text-emerald-300 ring-1 ring-emerald-800/40";

const btnSecondary =
  "rounded bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700 disabled:cursor-not-allowed";
const btnSecondaryDisabled =
  "cursor-not-allowed rounded bg-zinc-900/50 px-3 py-1.5 text-xs font-medium text-zinc-500 ring-1 ring-zinc-800";
const btnSecondarySaving = "cursor-wait rounded bg-zinc-800/80 px-3 py-1.5 text-xs font-medium text-zinc-300";
const btnSecondarySaved =
  "cursor-default rounded border border-emerald-900/40 bg-zinc-900/50 px-3 py-1.5 text-xs font-medium text-emerald-300/90";

function StepIcon({ done }: { done: boolean }) {
  if (done) {
    return (
      <span
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600/90 text-[10px] font-bold text-white"
        aria-hidden
      >
        ✓
      </span>
    );
  }
  return (
    <span
      className="h-5 w-5 shrink-0 rounded-full border-2 border-zinc-600"
      aria-hidden
    />
  );
}

function SocialGlyph({ platform }: { platform: ShopSocialKey }) {
  const common =
    "flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-zinc-800 text-[10px] font-semibold text-zinc-300";
  const map: Record<ShopSocialKey, string> = {
    reddit: "R",
    x: "𝕏",
    bluesky: "bs",
    twitch: "Tw",
    loyalfans: "LF",
    onlyfans: "OF",
    instagram: "IG",
  };
  return <span className={common}>{map[platform]}</span>;
}

function StripeConnectSubmitButton({ defaultLabel }: { defaultLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={pending ? btnPrimarySaving : btnPrimary}
    >
      {pending ? "Saving..." : defaultLabel}
    </button>
  );
}

function formatUsdFromCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Math.max(0, cents) / 100);
}

/**
 * Temporary shop-owner profit hint until a real cost formula exists.
 * Exactly at catalog minimum → $5; any amount above minimum → $5+.
 */
function listingProfitHint(priceDollarsStr: string, minPriceCents: number): string | null {
  const parsed = parseFloat(priceDollarsStr.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  const cents = Math.round(parsed * 100);
  if (cents < minPriceCents) return null;
  if (cents === minPriceCents) return "Est. profit: $5";
  return "Est. profit: $5+";
}

function CatalogExampleLink({ href }: { href: string }) {
  const className =
    "shrink-0 text-[11px] text-zinc-600 underline-offset-2 hover:text-zinc-400 hover:underline";
  const external = /^https?:\/\//i.test(href);
  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        title="Open example reference"
        className={className}
        onClick={(e) => e.stopPropagation()}
      >
        Example
      </a>
    );
  }
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title="Open example reference"
      className={className}
      onClick={(e) => e.stopPropagation()}
    >
      Example
    </Link>
  );
}

export function ShopSetupTabs(props: {
  shop: ShopSetupShopPayload;
  catalogGroups: ShopSetupCatalogGroup[];
  steps: ShopSetupSteps;
  listingFeePolicySummary: string;
  r2Configured: boolean;
  /** When the picker is empty, shows whether the admin baseline list has any rows. */
  listingPickerDiagnostics?: {
    adminCatalogItemCount: number;
  };
}) {
  const {
    shop,
    catalogGroups,
    steps,
    listingFeePolicySummary,
    r2Configured,
    listingPickerDiagnostics,
  } = props;

  const catalogOptions = useMemo(
    () => flattenShopBaselineCatalogGroups(catalogGroups),
    [catalogGroups],
  );
  const router = useRouter();
  const [tab, setTab] = useState<"stripe" | "profile" | "listing">(() => {
    if (!steps.profile) return "profile";
    if (!steps.listing) return "listing";
    if (!steps.stripe) return "stripe";
    return "stripe";
  });
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const [isProfilePending, startProfileTransition] = useTransition();
  const [isAvatarPending, startAvatarTransition] = useTransition();
  const [isListingPending, startListingTransition] = useTransition();

  const [displayName, setDisplayName] = useState(shop.displayName);
  const [welcomeMessage, setWelcomeMessage] = useState(shop.welcomeMessage ?? "");
  const [social, setSocial] = useState(() => socialRecordFromShop(shop.socialLinks));
  const [socialAddKey, setSocialAddKey] = useState<"" | ShopSocialKey>("");
  const [socialAddUrl, setSocialAddUrl] = useState("");
  const [socialAddError, setSocialAddError] = useState<string | null>(null);
  const [profileSavedFlash, setProfileSavedFlash] = useState(false);

  const [avatarHasFile, setAvatarHasFile] = useState(false);
  const [avatarSavedFlash, setAvatarSavedFlash] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [listingProductId, setListingProductId] = useState("");
  const [listingPrice, setListingPrice] = useState("");
  const [variantListingPrices, setVariantListingPrices] = useState<Record<string, string>>({});
  const [listingHasFile, setListingHasFile] = useState(false);
  const [listingArtworkPreviewUrl, setListingArtworkPreviewUrl] = useState<string | null>(null);
  const [listingSavedFlash, setListingSavedFlash] = useState(false);
  const listingFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!listingArtworkPreviewUrl) return;
    return () => {
      URL.revokeObjectURL(listingArtworkPreviewUrl);
    };
  }, [listingArtworkPreviewUrl]);

  useEffect(() => {
    setDisplayName(shop.displayName);
    setWelcomeMessage(shop.welcomeMessage ?? "");
    setSocial(socialRecordFromShop(shop.socialLinks));
    setProfileSavedFlash(false);
  }, [shop.displayName, shop.welcomeMessage, shop.socialLinks]);

  useEffect(() => {
    setAvatarHasFile(false);
    setAvatarSavedFlash(false);
    if (avatarInputRef.current) avatarInputRef.current.value = "";
  }, [shop.profileImageUrl]);

  const baselineSocial = useMemo(
    () => parseShopSocialLinksJson(shop.socialLinks),
    [shop.socialLinks],
  );

  const profileDirty = useMemo(() => {
    if (displayName.trim() !== shop.displayName.trim()) return true;
    if (welcomeMessage.trim() !== (shop.welcomeMessage ?? "").trim()) return true;
    for (const k of SHOP_SOCIAL_KEYS) {
      if ((social[k] ?? "").trim() !== (baselineSocial[k] ?? "").trim()) return true;
    }
    return false;
  }, [displayName, welcomeMessage, social, shop.displayName, shop.welcomeMessage, baselineSocial]);

  useEffect(() => {
    if (profileDirty) setProfileSavedFlash(false);
  }, [profileDirty]);

  useEffect(() => {
    setSocialAddError(null);
  }, [socialAddKey, socialAddUrl]);

  useEffect(() => {
    if (avatarHasFile) setAvatarSavedFlash(false);
  }, [avatarHasFile]);

  useEffect(() => {
    if (listingProductId || listingPrice || listingHasFile) setListingSavedFlash(false);
  }, [listingProductId, listingPrice, listingHasFile]);

  useEffect(() => {
    setListingSavedFlash(false);
  }, [variantListingPrices]);

  useEffect(() => {
    setVariantListingPrices((prev) => {
      const out: Record<string, string> = {};
      for (const g of catalogGroups) {
        if (g.kind !== "variants") continue;
        for (const v of g.variants) {
          const prior = prev[v.productId];
          out[v.productId] =
            prior !== undefined ? prior : (v.minPriceCents / 100).toFixed(2);
        }
      }
      return out;
    });
  }, [catalogGroups]);

  const selectionIsSingleItem = useMemo(
    () =>
      catalogGroups.some(
        (g) => g.kind === "single" && g.option.productId === listingProductId,
      ),
    [catalogGroups, listingProductId],
  );

  useEffect(() => {
    if (!listingProductId) {
      setListingPrice("");
      return;
    }
    const isSingle = catalogGroups.some(
      (g) => g.kind === "single" && g.option.productId === listingProductId,
    );
    if (!isSingle) return;
    const o = catalogOptions.find((x) => x.productId === listingProductId);
    if (o) setListingPrice((o.minPriceCents / 100).toFixed(2));
  }, [listingProductId, catalogOptions, catalogGroups]);

  const listingPriceMeetsMinimum = useMemo(() => {
    if (!listingProductId) return false;
    if (selectionIsSingleItem) {
      const o = catalogOptions.find((x) => x.productId === listingProductId);
      if (!o) return false;
      const parsed = parseFloat(listingPrice.replace(/[^0-9.]/g, ""));
      if (!Number.isFinite(parsed) || parsed <= 0) return false;
      return Math.round(parsed * 100) >= o.minPriceCents;
    }
    let variantGroup: Extract<ShopSetupCatalogGroup, { kind: "variants" }> | undefined;
    for (const g of catalogGroups) {
      if (g.kind !== "variants") continue;
      if (encodeBaselinePickAllVariants(g.itemId) === listingProductId) {
        variantGroup = g;
        break;
      }
    }
    if (!variantGroup) return false;
    for (const v of variantGroup.variants) {
      const str = variantListingPrices[v.productId] ?? "";
      const parsed = parseFloat(str.replace(/[^0-9.]/g, ""));
      if (!Number.isFinite(parsed) || parsed <= 0) return false;
      if (Math.round(parsed * 100) < v.minPriceCents) return false;
    }
    return true;
  }, [
    listingProductId,
    selectionIsSingleItem,
    catalogOptions,
    listingPrice,
    catalogGroups,
    variantListingPrices,
  ]);

  async function handleProfileSubmit(fd: FormData) {
    setMessage(null);
    startProfileTransition(async () => {
      const r: ShopSetupActionResult = await updateShopProfileSetup(fd);
      if (r.ok) {
        setMessage({ tone: "ok", text: "Profile saved." });
        setProfileSavedFlash(true);
        window.setTimeout(() => setProfileSavedFlash(false), 2500);
        router.refresh();
      } else {
        setMessage({ tone: "err", text: r.error });
      }
    });
  }

  async function handleAvatarSubmit(fd: FormData) {
    setMessage(null);
    startAvatarTransition(async () => {
      const r: ShopSetupActionResult = await uploadShopProfileImageSetup(fd);
      if (r.ok) {
        setMessage({ tone: "ok", text: "Profile photo updated." });
        setAvatarSavedFlash(true);
        window.setTimeout(() => setAvatarSavedFlash(false), 2500);
        if (avatarInputRef.current) avatarInputRef.current.value = "";
        setAvatarHasFile(false);
        router.refresh();
      } else {
        setMessage({ tone: "err", text: r.error });
      }
    });
  }

  async function handleListingSubmit(fd: FormData) {
    setMessage(null);
    startListingTransition(async () => {
      const r: ShopSetupActionResult = await submitFirstListingSetup(fd);
      if (r.ok) {
        setMessage({
          tone: "ok",
          text: "Listing submitted for review. Check the Listings tab for any publication fee (your first listings may be free), then wait for admin approval (usually 1–3 days).",
        });
        setListingSavedFlash(true);
        window.setTimeout(() => setListingSavedFlash(false), 2500);
        setListingProductId("");
        setListingPrice("");
        setVariantListingPrices({});
        setListingHasFile(false);
        setListingArtworkPreviewUrl(null);
        if (listingFileRef.current) listingFileRef.current.value = "";
        router.refresh();
      } else {
        setMessage({ tone: "err", text: r.error });
      }
    });
  }

  const profileBtnLabel = isProfilePending
    ? "Saving..."
    : profileSavedFlash && !profileDirty
      ? "Saved"
      : "Save profile";
  const profileBtnClass = isProfilePending
    ? btnPrimarySaving
    : !profileDirty
      ? profileSavedFlash
        ? btnPrimarySaved
        : btnPrimaryDisabled
      : btnPrimary;

  const avatarBtnLabel = isAvatarPending
    ? "Saving..."
    : avatarSavedFlash && !avatarHasFile
      ? "Saved"
      : "Upload photo";
  const avatarBtnClass = isAvatarPending
    ? btnSecondarySaving
    : !avatarHasFile
      ? avatarSavedFlash
        ? btnSecondarySaved
        : btnSecondaryDisabled
      : btnSecondary;

  const listingCanSubmit =
    Boolean(listingProductId) && listingPriceMeetsMinimum && listingHasFile;
  const listingSubmitSubmittedFlash =
    listingSavedFlash && !listingCanSubmit && !isListingPending;
  const listingBtnClass = isListingPending
    ? btnPrimarySaving
    : !listingCanSubmit
      ? listingSavedFlash
        ? btnPrimarySaved
        : btnPrimaryDisabled
      : btnPrimary;

  const stripeLabel = shop.stripeConnectAccountId
    ? "Continue Stripe onboarding"
    : "Start Stripe onboarding";

  const setSocialField = useCallback((key: ShopSocialKey, value: string) => {
    setSocial((prev) => ({ ...prev, [key]: value }));
  }, []);

  return (
    <section className="mt-8 rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 sm:p-6">
      <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
        Shop setup
      </h2>
      <p className="mt-1 text-xs text-zinc-600">
        Complete each step. Your shop URL stays the same; display name is what buyers see first.
      </p>

      <div className="mt-6 flex flex-col gap-6 lg:flex-row">
        <nav className="flex shrink-0 flex-col gap-1 lg:w-52" aria-label="Setup steps">
          {(
            [
              ["profile", "Setup shop profile", steps.profile],
              ["listing", "Request first listing", steps.listing],
              ["stripe", "Setup Stripe Connect", steps.stripe],
            ] as const
          ).map(([id, label, done]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${
                tab === id
                  ? "bg-zinc-800/80 text-zinc-100 ring-1 ring-zinc-600"
                  : "text-zinc-400 hover:bg-zinc-900/80 hover:text-zinc-200"
              }`}
            >
              <StepIcon done={done} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="min-w-0 flex-1 border-t border-zinc-800 pt-6 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          {message ? (
            <p
              className={
                message.tone === "ok"
                  ? "mb-4 rounded-lg border border-emerald-900/50 bg-emerald-950/25 px-3 py-2 text-xs text-emerald-200/90"
                  : "mb-4 rounded-lg border border-amber-900/50 bg-amber-950/25 px-3 py-2 text-xs text-amber-200/90"
              }
              role="status"
            >
              {message.text}
            </p>
          ) : null}

          {tab === "stripe" ? (
            <div className="space-y-4 text-sm text-zinc-300">
              <p>
                Connect Stripe so payouts can reach your bank when{" "}
                <code className="text-zinc-500">MARKETPLACE_STRIPE_CONNECT=1</code> is enabled for
                checkout.
              </p>
              <ul className="list-inside list-disc text-xs text-zinc-500">
                <li>Charges enabled: {shop.connectChargesEnabled ? "yes" : "no"}</li>
                <li>Payouts enabled: {shop.payoutsEnabled ? "yes" : "no"}</li>
                <li className="truncate">
                  Account: {shop.stripeConnectAccountId ?? "not created yet"}
                </li>
              </ul>
              <form action={dashboardStartStripeConnect}>
                <StripeConnectSubmitButton defaultLabel={stripeLabel} />
              </form>
            </div>
          ) : null}

          {tab === "profile" ? (
            <div className="space-y-6 text-sm text-zinc-300">
              <p className="text-xs text-zinc-500">
                Display name is shown to customers (your shop URL is fixed). Welcome message is
                short (max 280 characters). Profile photo is compressed to at most 100 KiB for fast
                loading.
              </p>
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!profileDirty || isProfilePending) return;
                  void handleProfileSubmit(new FormData(e.currentTarget));
                }}
              >
                <label className="block text-xs text-zinc-500">
                  Shop display name
                  <input
                    name="displayName"
                    required
                    maxLength={120}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100"
                  />
                </label>
                <label className="block text-xs text-zinc-500">
                  Welcome message (max 280 characters)
                  <textarea
                    name="welcomeMessage"
                    rows={3}
                    maxLength={280}
                    value={welcomeMessage}
                    onChange={(e) => setWelcomeMessage(e.target.value)}
                    placeholder="A short hello for visitors…"
                    className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100"
                  />
                </label>
                <div className="border-t border-zinc-800 pt-4">
                  <p className="text-xs text-zinc-500">Profile photo</p>
                  {shop.profileImageUrl ? (
                    <p className="mt-1 break-all text-[11px] text-zinc-600">{shop.profileImageUrl}</p>
                  ) : (
                    <p className="mt-1 text-[11px] text-zinc-600">No photo yet.</p>
                  )}
                  {!r2Configured ? (
                    <p className="mt-2 text-xs text-amber-200/80">
                      R2 uploads are not configured on this server — contact the platform operator.
                    </p>
                  ) : (
                    <div className="mt-3 flex flex-wrap items-end gap-2">
                      <input
                        ref={avatarInputRef}
                        type="file"
                        name="profileImage"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        onChange={(e) => setAvatarHasFile(Boolean(e.target.files?.length))}
                        className="max-w-full text-xs text-zinc-400 file:mr-2 file:rounded file:border-0 file:bg-zinc-800 file:px-2 file:py-1 file:text-zinc-200"
                      />
                      <button
                        type="button"
                        disabled={!avatarHasFile || isAvatarPending}
                        className={avatarBtnClass}
                        onClick={() => {
                          const file = avatarInputRef.current?.files?.[0];
                          if (!file || isAvatarPending) return;
                          const fd = new FormData();
                          fd.set("profileImage", file);
                          void handleAvatarSubmit(fd);
                        }}
                      >
                        {avatarBtnLabel}
                      </button>
                    </div>
                  )}
                </div>
                <div className="space-y-3 border-t border-zinc-800 pt-4">
                  <p className="text-xs font-medium text-zinc-500">Social links (optional)</p>
                  <p className="text-[11px] text-zinc-600">
                    Choose a network, paste its URL, then add it. Only networks you add are shown on your shop.
                  </p>
                  <ul className="space-y-2">
                    {SHOP_SOCIAL_KEYS.filter((key) => (social[key] ?? "").trim()).map((key) => (
                      <li
                        key={key}
                        className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/50 px-2 py-2"
                      >
                        <SocialGlyph platform={key} />
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-medium text-zinc-400">{SOCIAL_LABELS[key]}</p>
                          <p className="truncate font-mono text-[11px] text-zinc-500">{social[key]}</p>
                        </div>
                        <button
                          type="button"
                          className="shrink-0 rounded border border-zinc-700 px-2 py-1 text-[11px] text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                          onClick={() => setSocialField(key, "")}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
                    <label className="block min-w-[10rem] flex-1 text-xs text-zinc-500">
                      Network
                      <select
                        value={socialAddKey}
                        onChange={(e) =>
                          setSocialAddKey((e.target.value || "") as "" | ShopSocialKey)
                        }
                        className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 text-sm text-zinc-200"
                      >
                        <option value="">Choose a network…</option>
                        {SHOP_SOCIAL_KEYS.map((key) => (
                          <option key={key} value={key}>
                            {SOCIAL_LABELS[key]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block min-w-0 flex-1 text-xs text-zinc-500 sm:min-w-[12rem]">
                      Profile URL
                      <input
                        type="url"
                        value={socialAddUrl}
                        onChange={(e) => setSocialAddUrl(e.target.value)}
                        placeholder="https://…"
                        className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 font-mono text-xs text-zinc-200"
                      />
                    </label>
                    <button
                      type="button"
                      className="rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={!socialAddKey || !socialAddUrl.trim()}
                      onClick={() => {
                        if (!socialAddKey || !socialAddUrl.trim()) return;
                        const err = socialLinkAddValidationMessage(socialAddKey, socialAddUrl);
                        if (err) {
                          setSocialAddError(err);
                          return;
                        }
                        const stored = normalizedShopSocialUrl(socialAddUrl);
                        if (!stored) {
                          setSocialAddError("Enter a valid http(s) URL.");
                          return;
                        }
                        setSocialAddError(null);
                        setSocialField(socialAddKey, stored);
                        setSocialAddUrl("");
                        setSocialAddKey("");
                      }}
                    >
                      Add link
                    </button>
                  </div>
                  {socialAddError ? (
                    <p className="text-xs text-red-400/90" role="alert">
                      {socialAddError}
                    </p>
                  ) : null}
                </div>
                {SHOP_SOCIAL_KEYS.map((key) => (
                  <input key={key} type="hidden" name={`social_${key}`} value={social[key] ?? ""} />
                ))}
                <button
                  type="submit"
                  disabled={!profileDirty || isProfilePending}
                  className={profileBtnClass}
                >
                  {profileBtnLabel}
                </button>
              </form>
            </div>
          ) : null}

          {tab === "listing" ? (
            <div className="space-y-4 text-sm text-zinc-300">
              <h3 className="text-base font-semibold text-zinc-100">Add a product to your store</h3>
              <p className="text-xs leading-relaxed text-zinc-400">
                Choose one of the items the platform allows under <strong className="text-zinc-300">Admin → List</strong>{" "}
                (names, variants, example links, and minimum prices come straight from that list). Set your public
                price, upload <strong className="text-zinc-500">print‑ready</strong> artwork, then submit. Admin reviews
                before it goes live — usually <strong className="text-zinc-500">1–3 business days</strong>.
              </p>
              <p className="text-xs text-zinc-500">
                Uploads are stored as WebP for review and printing. Artwork must follow the{" "}
                <Link href="/shop-regulations" className="text-blue-400/90 underline">
                  shop regulations
                </Link>
                . {listingFeePolicySummary} Pay from the Listings tab when your row appears if a fee applies.
              </p>
              {catalogGroups.length === 0 ? (
                <p className="text-xs text-amber-200/80">
                  <strong className="text-amber-100/90">No items to add yet.</strong>{" "}
                  {listingPickerDiagnostics ? (
                    listingPickerDiagnostics.adminCatalogItemCount === 0 ? (
                      <>
                        The allowed-items list under <strong className="font-medium text-amber-100/90">Admin → List</strong>{" "}
                        has no rows yet — add items there first.
                      </>
                    ) : (
                      <>
                        Admin → List has rows but none could be loaded as choices — ensure each variant has a name and
                        a valid minimum price (or use item-level pricing when there are no variants).
                      </>
                    )
                  ) : (
                    <>
                      The allowed-items list under <strong className="font-medium text-amber-100/90">Admin → List</strong>{" "}
                      is empty or unavailable.
                    </>
                  )}{" "}
                  Refresh this page after updating the list.
                </p>
              ) : !r2Configured ? (
                <p className="text-xs text-amber-200/80">
                  R2 uploads are not configured — artwork upload is unavailable until the operator sets
                  R2 keys.
                </p>
              ) : (
                <form
                  className="space-y-4"
                  encType="multipart/form-data"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!listingCanSubmit || isListingPending) return;
                    const fd = new FormData();
                    fd.set("productId", listingProductId);
                    if (selectionIsSingleItem) {
                      fd.set("listingPriceDollars", listingPrice);
                    } else {
                      for (const g of catalogGroups) {
                        if (g.kind !== "variants") continue;
                        if (encodeBaselinePickAllVariants(g.itemId) !== listingProductId) continue;
                        const prices: Record<string, string> = {};
                        for (const v of g.variants) {
                          prices[v.productId] = variantListingPrices[v.productId] ?? "";
                        }
                        fd.set("listingVariantPricesJson", JSON.stringify(prices));
                        break;
                      }
                    }
                    const art = listingFileRef.current?.files?.[0];
                    if (art) fd.set("listingArtwork", art);
                    void handleListingSubmit(fd);
                  }}
                >
                  <div>
                    <p className="text-xs font-medium text-zinc-400">Allowed items (Admin → List)</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-zinc-600">
                      Minimums are shown on each line. Select the main product name. If it has options (sizes, etc.), set a
                      list price for every option — one submission adds all of them with the same artwork.
                    </p>
                    <ul
                      className="mt-2 h-[400px] divide-y divide-zinc-800/80 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950/40"
                      role="listbox"
                      aria-label="Items from admin catalog"
                    >
                      {catalogGroups.map((g) => {
                        if (g.kind === "single") {
                          const selected = listingProductId === g.option.productId;
                          return (
                            <li key={g.itemId}>
                              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2.5">
                                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-sm text-zinc-200">
                                  <input
                                    type="radio"
                                    name="catalogProductPick"
                                    value={g.option.productId}
                                    checked={selected}
                                    onChange={() => setListingProductId(g.option.productId)}
                                    className="shrink-0 border-zinc-600 bg-zinc-900 text-blue-600"
                                  />
                                  <span className="min-w-0 truncate">{g.itemName}</span>
                                </label>
                                <span className="shrink-0 text-xs tabular-nums text-zinc-500">
                                  Min {formatUsdFromCents(g.option.minPriceCents)}
                                </span>
                                {g.option.exampleHref ? (
                                  <CatalogExampleLink href={g.option.exampleHref} />
                                ) : (
                                  <span className="shrink-0 text-[11px] text-zinc-700">—</span>
                                )}
                              </div>
                              {selected ? (
                                <div className="border-t border-zinc-800/60 px-3 py-3 pl-10">
                                  <label
                                    className="block text-xs text-zinc-500"
                                    htmlFor={`listing-price-${g.itemId}`}
                                  >
                                    Your list price (USD)
                                  </label>
                                  <input
                                    id={`listing-price-${g.itemId}`}
                                    type="text"
                                    inputMode="decimal"
                                    autoComplete="off"
                                    value={listingPrice}
                                    onChange={(e) => setListingPrice(e.target.value)}
                                    onBlur={() => {
                                      const minC = g.option.minPriceCents;
                                      const parsed = parseFloat(listingPrice.replace(/[^0-9.]/g, ""));
                                      if (!Number.isFinite(parsed) || Math.round(parsed * 100) < minC) {
                                        setListingPrice((minC / 100).toFixed(2));
                                      }
                                    }}
                                    className="mt-1 block w-full max-w-xs rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-sm text-zinc-100"
                                  />
                                  {(() => {
                                    const h = listingProfitHint(listingPrice, g.option.minPriceCents);
                                    return h ? (
                                      <p className="mt-1.5 text-xs text-blue-400/90">{h}</p>
                                    ) : null;
                                  })()}
                                </div>
                              ) : null}
                            </li>
                          );
                        }
                        const variantMins = g.variants.map((v) => v.minPriceCents);
                        const minLow = Math.min(...variantMins);
                        const minHigh = Math.max(...variantMins);
                        const minRangeLabel =
                          minLow === minHigh
                            ? formatUsdFromCents(minLow)
                            : `${formatUsdFromCents(minLow)} – ${formatUsdFromCents(minHigh)}`;
                        const groupPick = encodeBaselinePickAllVariants(g.itemId);
                        const groupSelected = listingProductId === groupPick;
                        return (
                          <li key={g.itemId}>
                            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2.5">
                              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-sm text-zinc-200">
                                <input
                                  type="radio"
                                  name="catalogProductPick"
                                  value={groupPick}
                                  checked={groupSelected}
                                  onChange={() => setListingProductId(groupPick)}
                                  className="shrink-0 border-zinc-600 bg-zinc-900 text-blue-600"
                                />
                                <span className="min-w-0 truncate font-medium">{g.itemName}</span>
                              </label>
                              <span className="shrink-0 text-xs tabular-nums text-zinc-500">
                                Min {minRangeLabel}
                              </span>
                              <span className="shrink-0 text-[11px] text-zinc-700">—</span>
                            </div>
                            <div className="divide-y divide-zinc-800/50 border-t border-zinc-800/60 py-1 pl-10 pr-3">
                              {g.variants.map((v) => {
                                const variantPriceStr = variantListingPrices[v.productId] ?? "";
                                const profitHint = listingProfitHint(variantPriceStr, v.minPriceCents);
                                return (
                                  <div
                                    key={v.productId}
                                    className="flex flex-wrap items-end gap-3 py-2.5 sm:flex-nowrap"
                                  >
                                    <span className="min-w-[5rem] pb-2 text-sm text-zinc-300">{v.variantLabel}</span>
                                    <span className="shrink-0 pb-2 text-xs tabular-nums text-zinc-500">
                                      Min {formatUsdFromCents(v.minPriceCents)}
                                    </span>
                                    {groupSelected ? (
                                      <div className="flex min-w-0 flex-1 flex-col gap-0.5 pb-0.5 sm:max-w-[11rem]">
                                        <label
                                          className="text-[10px] font-medium uppercase tracking-wide text-zinc-600"
                                          htmlFor={`variant-price-${v.productId}`}
                                        >
                                          List price
                                        </label>
                                        <input
                                          id={`variant-price-${v.productId}`}
                                          type="text"
                                          inputMode="decimal"
                                          autoComplete="off"
                                          value={variantPriceStr}
                                          onChange={(e) =>
                                            setVariantListingPrices((prev) => ({
                                              ...prev,
                                              [v.productId]: e.target.value,
                                            }))
                                          }
                                          onBlur={() => {
                                            const raw = variantListingPrices[v.productId] ?? "";
                                            const parsed = parseFloat(raw.replace(/[^0-9.]/g, ""));
                                            const minC = v.minPriceCents;
                                            if (!Number.isFinite(parsed) || Math.round(parsed * 100) < minC) {
                                              setVariantListingPrices((prev) => ({
                                                ...prev,
                                                [v.productId]: (minC / 100).toFixed(2),
                                              }));
                                            }
                                          }}
                                          className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 font-mono text-xs text-zinc-100"
                                        />
                                        {profitHint ? (
                                          <p className="text-[11px] text-blue-400/90">{profitHint}</p>
                                        ) : null}
                                      </div>
                                    ) : null}
                                    {v.exampleHref ? (
                                      <div className="flex shrink-0 items-center pb-2">
                                        <CatalogExampleLink href={v.exampleHref} />
                                      </div>
                                    ) : (
                                      <span className="shrink-0 pb-2 text-[11px] text-zinc-700">—</span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                  <p className="text-xs leading-relaxed text-zinc-600">
                    List prices must meet each line’s minimum. Customers may add tips at checkout on eligible carts.
                  </p>
                  <label className="block text-xs text-zinc-500">
                    Artwork file (PNG or JPEG recommended)
                    <input
                      ref={listingFileRef}
                      type="file"
                      name="listingArtwork"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        setListingHasFile(Boolean(file));
                        if (file && file.type.startsWith("image/")) {
                          setListingArtworkPreviewUrl(URL.createObjectURL(file));
                        } else {
                          setListingArtworkPreviewUrl(null);
                        }
                      }}
                      className="mt-1 block w-full text-xs text-zinc-400 file:mr-2 file:rounded file:border-0 file:bg-zinc-800 file:px-2 file:py-1 file:text-zinc-200"
                    />
                    {listingArtworkPreviewUrl ? (
                      <div className="mt-3">
                        <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-zinc-600">
                          Preview
                        </p>
                        {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
                        <img
                          src={listingArtworkPreviewUrl}
                          alt=""
                          className="max-h-40 max-w-full rounded-lg border border-zinc-700 bg-zinc-900 object-contain"
                        />
                      </div>
                    ) : null}
                  </label>
                  <button
                    type="submit"
                    disabled={!listingCanSubmit || isListingPending}
                    className={`inline-flex min-h-[2.5rem] items-center justify-center gap-2 ${listingBtnClass}`}
                    aria-busy={isListingPending}
                  >
                    {isListingPending ? (
                      <>
                        <span
                          className="size-4 shrink-0 animate-spin rounded-full border-2 border-zinc-500/80 border-t-zinc-950"
                          aria-hidden
                        />
                        <span>Submitting…</span>
                      </>
                    ) : listingSubmitSubmittedFlash ? (
                      <>
                        <svg
                          className="size-4 shrink-0 text-emerald-400"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          aria-hidden
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.704 4.153a.75.75 0 01.143 1.052l-7.5 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 6.848-9.817a.75.75 0 011.051-.143z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <span>Submitted</span>
                      </>
                    ) : (
                      <span>Submit for admin review</span>
                    )}
                  </button>
                </form>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
