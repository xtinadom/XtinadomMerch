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
  parseShopSocialLinksJson,
} from "@/lib/shop-social-links";
import type { ShopSetupCatalogOption } from "@/lib/shop-setup-catalog-options";

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
  "cursor-wait rounded-lg bg-zinc-100/70 px-4 py-2 text-sm font-medium text-zinc-700";
const btnPrimarySaved =
  "cursor-default rounded-lg border border-emerald-900/40 bg-zinc-900/50 px-4 py-2 text-sm font-medium text-emerald-300/90";

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
  catalogOptions: ShopSetupCatalogOption[];
  steps: ShopSetupSteps;
  listingFeeLabel: string;
  r2Configured: boolean;
}) {
  const { shop, catalogOptions, steps, listingFeeLabel, r2Configured } = props;
  const router = useRouter();
  const [tab, setTab] = useState<"stripe" | "profile" | "listing">(() => {
    if (!steps.stripe) return "stripe";
    if (!steps.profile) return "profile";
    if (!steps.listing) return "listing";
    return "stripe";
  });
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const [isProfilePending, startProfileTransition] = useTransition();
  const [isAvatarPending, startAvatarTransition] = useTransition();
  const [isListingPending, startListingTransition] = useTransition();

  const [displayName, setDisplayName] = useState(shop.displayName);
  const [welcomeMessage, setWelcomeMessage] = useState(shop.welcomeMessage ?? "");
  const [social, setSocial] = useState(() => socialRecordFromShop(shop.socialLinks));
  const [profileSavedFlash, setProfileSavedFlash] = useState(false);

  const [avatarHasFile, setAvatarHasFile] = useState(false);
  const [avatarSavedFlash, setAvatarSavedFlash] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [listingProductId, setListingProductId] = useState("");
  const [listingPrice, setListingPrice] = useState("");
  const [listingHasFile, setListingHasFile] = useState(false);
  const [listingSavedFlash, setListingSavedFlash] = useState(false);
  const listingFileRef = useRef<HTMLInputElement>(null);

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
    if (avatarHasFile) setAvatarSavedFlash(false);
  }, [avatarHasFile]);

  useEffect(() => {
    if (listingProductId || listingPrice || listingHasFile) setListingSavedFlash(false);
  }, [listingProductId, listingPrice, listingHasFile]);

  const selectedCatalogOption = useMemo(
    () => catalogOptions.find((x) => x.productId === listingProductId) ?? null,
    [catalogOptions, listingProductId],
  );

  const prevListingProductId = useRef("");
  useEffect(() => {
    if (listingProductId === prevListingProductId.current) return;
    prevListingProductId.current = listingProductId;
    if (!listingProductId) {
      setListingPrice("");
      return;
    }
    const o = catalogOptions.find((x) => x.productId === listingProductId);
    if (o) setListingPrice((o.minPriceCents / 100).toFixed(2));
  }, [listingProductId, catalogOptions]);

  const listingPriceMeetsMinimum = useMemo(() => {
    if (!selectedCatalogOption) return false;
    const parsed = parseFloat(listingPrice.replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(parsed) || parsed <= 0) return false;
    const cents = Math.round(parsed * 100);
    return cents >= selectedCatalogOption.minPriceCents;
  }, [listingPrice, selectedCatalogOption]);

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
          text: "Listing submitted for review. Pay the listing fee on your dashboard if you have not yet, then wait for admin approval (usually 1–3 days).",
        });
        setListingSavedFlash(true);
        window.setTimeout(() => setListingSavedFlash(false), 2500);
        setListingProductId("");
        setListingPrice("");
        setListingHasFile(false);
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
  const listingBtnLabel = isListingPending
    ? "Saving..."
    : listingSavedFlash && !listingCanSubmit
      ? "Saved"
      : "Submit for admin review";
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
              ["stripe", "Stripe Connect", steps.stripe],
              ["profile", "Shop profile", steps.profile],
              ["listing", "List item", steps.listing],
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
                <div className="space-y-3">
                  <p className="text-xs font-medium text-zinc-500">Social links (optional)</p>
                  <p className="text-[11px] text-zinc-600">
                    Paste full URLs. Only filled networks are shown on your shop.
                  </p>
                  <ul className="space-y-3">
                    {SHOP_SOCIAL_KEYS.map((key) => (
                      <li key={key} className="flex items-center gap-3">
                        <SocialGlyph platform={key} />
                        <label className="min-w-0 flex-1 text-xs text-zinc-500">
                          <span className="sr-only">{SOCIAL_LABELS[key]}</span>
                          <input
                            type="url"
                            name={`social_${key}`}
                            placeholder={`${SOCIAL_LABELS[key]} URL`}
                            value={social[key]}
                            onChange={(e) => setSocialField(key, e.target.value)}
                            className="mt-0.5 block w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 font-mono text-[11px] text-zinc-200"
                          />
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
                <button
                  type="submit"
                  disabled={!profileDirty || isProfilePending}
                  className={profileBtnClass}
                >
                  {profileBtnLabel}
                </button>
              </form>

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
                  <form
                    className="mt-3 flex flex-wrap items-end gap-2"
                    encType="multipart/form-data"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!avatarHasFile || isAvatarPending) return;
                      void handleAvatarSubmit(new FormData(e.currentTarget));
                    }}
                  >
                    <input
                      ref={avatarInputRef}
                      type="file"
                      name="profileImage"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={(e) => setAvatarHasFile(Boolean(e.target.files?.length))}
                      className="max-w-full text-xs text-zinc-400 file:mr-2 file:rounded file:border-0 file:bg-zinc-800 file:px-2 file:py-1 file:text-zinc-200"
                    />
                    <button
                      type="submit"
                      disabled={!avatarHasFile || isAvatarPending}
                      className={avatarBtnClass}
                    >
                      {avatarBtnLabel}
                    </button>
                  </form>
                )}
              </div>
            </div>
          ) : null}

          {tab === "listing" ? (
            <div className="space-y-4 text-sm text-zinc-300">
              <p className="text-xs leading-relaxed text-zinc-400">
                Pick a product from the catalog and upload a{" "}
                <strong className="text-zinc-500">high‑quality</strong> image for printing. Your submission is
                reviewed before it goes live — typically within{" "}
                <strong className="text-zinc-500">1–3 business days</strong>.
              </p>
              <p className="text-xs text-zinc-500">
                We store your upload as a large WebP for review and printing. Artwork must follow the{" "}
                <Link href="/shop-regulations" className="text-blue-400/90 underline">
                  shop regulations
                </Link>
                . Listing fee after submission: {listingFeeLabel} (pay from the listings list below when your row
                appears).
              </p>
              {catalogOptions.length === 0 ? (
                <p className="text-xs text-amber-200/80">
                  No catalog products are available yet. The platform admin maintains this list under{" "}
                  <strong className="font-medium text-amber-100/90">Admin → List</strong>. Each row can use the optional{" "}
                  <strong className="font-medium text-amber-100/85">Printify product</strong> picker (no example URL
                  needed), or link via <code className="font-mono text-amber-200/70">listing=</code>, a{" "}
                  <code className="font-mono text-amber-200/70">/product/…</code> or{" "}
                  <code className="font-mono text-amber-200/70">/embed/product/…</code> slug, or a name that matches a
                  synced Printify product.
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
                    void handleListingSubmit(new FormData(e.currentTarget));
                  }}
                >
                  <div>
                    <p className="text-xs text-zinc-500">Product catalog</p>
                    <input type="hidden" name="productId" value={listingProductId} />
                    <ul
                      className="mt-2 max-h-52 divide-y divide-zinc-800/80 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950/40"
                      role="listbox"
                      aria-label="Product catalog"
                    >
                      {catalogOptions.map((opt) => {
                        const selected = listingProductId === opt.productId;
                        return (
                          <li key={opt.productId}>
                            <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-sm text-zinc-200">
                                <input
                                  type="radio"
                                  name="catalogProductPick"
                                  value={opt.productId}
                                  checked={selected}
                                  onChange={() => setListingProductId(opt.productId)}
                                  className="shrink-0 border-zinc-600 bg-zinc-900 text-blue-600"
                                />
                                <span className="min-w-0 truncate">{opt.label}</span>
                              </label>
                              <CatalogExampleLink href={opt.exampleHref} />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500" htmlFor="listing-list-price">
                      Your list price (USD)
                    </label>
                    <input
                      id="listing-list-price"
                      type="text"
                      name="listingPriceDollars"
                      required
                      inputMode="decimal"
                      autoComplete="off"
                      value={listingPrice}
                      onChange={(e) => setListingPrice(e.target.value)}
                      onBlur={() => {
                        if (!selectedCatalogOption) return;
                        const minC = selectedCatalogOption.minPriceCents;
                        const parsed = parseFloat(listingPrice.replace(/[^0-9.]/g, ""));
                        if (!Number.isFinite(parsed) || Math.round(parsed * 100) < minC) {
                          setListingPrice((minC / 100).toFixed(2));
                        }
                      }}
                      placeholder={selectedCatalogOption ? undefined : "0.00"}
                      className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-zinc-100"
                    />
                    <p className="mt-2 text-xs leading-relaxed text-zinc-600">
                      Each product has a minimum price to cover raw materials, printing cost, and platform fees.
                      Customers may add tips at checkout on eligible carts.
                    </p>
                  </div>
                  <label className="block text-xs text-zinc-500">
                    Artwork file (PNG or JPEG recommended)
                    <input
                      ref={listingFileRef}
                      type="file"
                      name="listingArtwork"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => setListingHasFile(Boolean(e.target.files?.length))}
                      className="mt-1 block w-full text-xs text-zinc-400 file:mr-2 file:rounded file:border-0 file:bg-zinc-800 file:px-2 file:py-1 file:text-zinc-200"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={!listingCanSubmit || isListingPending}
                    className={listingBtnClass}
                  >
                    {listingBtnLabel}
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
