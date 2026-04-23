"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  updateShopProfileSetup,
  uploadShopProfileImageSetup,
  type ShopSetupActionResult,
} from "@/actions/dashboard-shop-setup";
import {
  SHOP_SOCIAL_KEYS,
  type ShopSocialKey,
  normalizedShopSocialUrl,
  parseShopSocialLinksJson,
  socialLinkAddValidationMessage,
} from "@/lib/shop-social-links";
import type { ShopSetupShopPayload } from "@/components/dashboard/ShopSetupTabs";
import { ShopDangerZonePanel } from "@/components/dashboard/ShopDangerZonePanel";

const SOCIAL_LABELS: Record<ShopSocialKey, string> = {
  reddit: "Reddit",
  x: "X",
  bluesky: "Bluesky",
  twitch: "Twitch",
  instagram: "Instagram",
};

function socialRecordFromShop(links: unknown): Record<ShopSocialKey, string> {
  const p = parseShopSocialLinksJson(links);
  return Object.fromEntries(SHOP_SOCIAL_KEYS.map((k) => [k, p[k] ?? ""])) as Record<
    ShopSocialKey,
    string
  >;
}

function buildShopProfileFormData(
  shopSlug: string,
  displayName: string,
  welcomeMessage: string,
  social: Record<ShopSocialKey, string>,
): FormData {
  const fd = new FormData();
  fd.set("shopUsername", shopSlug);
  fd.set("displayName", displayName.trim());
  fd.set("welcomeMessage", welcomeMessage.trim());
  for (const k of SHOP_SOCIAL_KEYS) {
    fd.set(`social_${k}`, (social[k] ?? "").trim());
  }
  return fd;
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

function initialsFromDisplayName(name: string): string {
  const t = name.trim();
  if (!t) return "?";
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0][0];
    const b = parts[1][0];
    if (a && b) return (a + b).toUpperCase();
  }
  return t.slice(0, 2).toUpperCase();
}

function SocialGlyph({ platform }: { platform: ShopSocialKey }) {
  const common =
    "flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-zinc-800 text-[10px] font-semibold text-zinc-300";
  const map: Record<ShopSocialKey, string> = {
    reddit: "R",
    x: "𝕏",
    bluesky: "bs",
    twitch: "Tw",
    instagram: "IG",
  };
  return <span className={common}>{map[platform]}</span>;
}

export function ShopProfileSetupPanel(props: {
  shop: ShopSetupShopPayload;
  r2Configured: boolean;
  /** When true, used inside dashboard tab panel (no top margin). */
  embedded?: boolean;
}) {
  const { shop, r2Configured, embedded = false } = props;

  const router = useRouter();
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const [isProfilePending, startProfileTransition] = useTransition();
  const [isAvatarPending, startAvatarTransition] = useTransition();
  const [isSocialSavePending, startSocialSaveTransition] = useTransition();

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

  useEffect(() => {
    setDisplayName(shop.displayName);
    setWelcomeMessage(shop.welcomeMessage ?? "");
    setSocial(socialRecordFromShop(shop.socialLinks));
    setProfileSavedFlash(false);
  }, [shop.shopSlug, shop.displayName, shop.welcomeMessage, shop.socialLinks]);

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

  async function handleProfileSubmit(fd: FormData) {
    setMessage(null);
    startProfileTransition(async () => {
      const r: ShopSetupActionResult = await updateShopProfileSetup(fd);
      if (r.ok) {
        setMessage(null);
        setProfileSavedFlash(true);
        window.setTimeout(() => setProfileSavedFlash(false), 2500);
        router.refresh();
      } else {
        setMessage({ tone: "err", text: r.error });
      }
    });
  }

  function persistSocialLinks(nextSocial: Record<ShopSocialKey, string>, prevSocial: Record<ShopSocialKey, string>) {
    startSocialSaveTransition(async () => {
      setMessage(null);
      const r: ShopSetupActionResult = await updateShopProfileSetup(
        buildShopProfileFormData(shop.shopSlug, displayName, welcomeMessage, nextSocial),
      );
      if (!r.ok) {
        setSocial(prevSocial);
        setMessage({ tone: "err", text: r.error });
        return;
      }
      router.refresh();
    });
  }

  async function handleAvatarSubmit(fd: FormData) {
    setMessage(null);
    startAvatarTransition(async () => {
      const r: ShopSetupActionResult = await uploadShopProfileImageSetup(fd);
      if (r.ok) {
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

  return (
    <section
      className={`rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 sm:p-6 ${embedded ? "mt-0" : "mt-8"}`}
    >
      <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Shop profile</h2>

      <div className="mt-6 flex flex-wrap items-center gap-4 rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-4 py-3">
        {shop.profileImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- R2 / external shop avatars
          <img
            src={shop.profileImageUrl}
            alt=""
            className="h-14 w-14 shrink-0 rounded-full object-cover ring-1 ring-zinc-700"
          />
        ) : (
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-sm font-semibold text-zinc-300 ring-1 ring-zinc-700"
            aria-hidden
          >
            {initialsFromDisplayName(shop.displayName)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-zinc-100">{shop.displayName}</p>
          <p className="font-mono text-xs text-zinc-500">/s/{shop.shopSlug}</p>
        </div>
        <Link
          href={`/s/${shop.shopSlug}`}
          className="shrink-0 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:border-zinc-500 hover:text-zinc-100"
        >
          View storefront
        </Link>
      </div>

      <div className="mt-8 space-y-6 text-sm text-zinc-300">
        {message?.tone === "err" ? (
          <p
            className="rounded-lg border border-amber-900/50 bg-amber-950/25 px-3 py-2 text-xs text-amber-200/90"
            role="alert"
          >
            {message.text}
          </p>
        ) : null}

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!profileDirty || isProfilePending || isSocialSavePending) return;
            void handleProfileSubmit(new FormData(e.currentTarget));
          }}
        >
          <input type="hidden" name="shopUsername" value={shop.shopSlug} />
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
          {SHOP_SOCIAL_KEYS.map((key) => (
            <input key={key} type="hidden" name={`social_${key}`} value={social[key] ?? ""} />
          ))}
          <button
            type="submit"
            disabled={!profileDirty || isProfilePending || isSocialSavePending}
            className={profileBtnClass}
          >
            {profileBtnLabel}
          </button>
          <div className="border-t border-zinc-800 pt-4">
            <p className="text-xs text-zinc-500">Profile photo</p>
            {shop.profileImageUrl ? (
              <div className="mt-3 space-y-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- R2 / external shop avatars */}
                <img
                  src={shop.profileImageUrl}
                  alt="Current profile photo"
                  className="h-24 w-24 rounded-lg object-cover ring-1 ring-zinc-700"
                />
                <p className="break-all text-[11px] text-zinc-600">{shop.profileImageUrl}</p>
              </div>
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
                    disabled={isSocialSavePending}
                    className="shrink-0 rounded border border-zinc-700 px-2 py-1 text-[11px] text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
                    onClick={() => {
                      if (isSocialSavePending) return;
                      const prevSocial = { ...social };
                      const nextSocial = { ...social, [key]: "" };
                      setSocial(nextSocial);
                      persistSocialLinks(nextSocial, prevSocial);
                    }}
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
                  disabled={isSocialSavePending}
                  onChange={(e) => setSocialAddKey((e.target.value || "") as "" | ShopSocialKey)}
                  className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 text-sm text-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
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
                  disabled={isSocialSavePending}
                  onChange={(e) => setSocialAddUrl(e.target.value)}
                  onBlur={() => {
                    if (!socialAddKey || !socialAddUrl.trim()) {
                      setSocialAddError(null);
                      return;
                    }
                    setSocialAddError(socialLinkAddValidationMessage(socialAddKey, socialAddUrl));
                  }}
                  placeholder="https://…"
                  aria-invalid={socialAddError ? true : undefined}
                  className={`mt-1 block w-full rounded-lg border bg-zinc-900 px-2 py-2 font-mono text-xs text-zinc-200 disabled:cursor-not-allowed disabled:opacity-50 ${
                    socialAddError ? "border-amber-700/80" : "border-zinc-700"
                  }`}
                />
              </label>
              <button
                type="button"
                className="rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!socialAddKey || !socialAddUrl.trim() || isSocialSavePending}
                onClick={() => {
                  if (!socialAddKey || !socialAddUrl.trim() || isSocialSavePending) return;
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
                  const prevSocial = { ...social };
                  const nextSocial = { ...social, [socialAddKey]: stored };
                  setSocial(nextSocial);
                  setSocialAddUrl("");
                  setSocialAddKey("");
                  persistSocialLinks(nextSocial, prevSocial);
                }}
              >
                {isSocialSavePending ? "Saving…" : "Add link"}
              </button>
            </div>
            {socialAddError ? (
              <p className="text-xs text-red-400/90" role="alert">
                {socialAddError}
              </p>
            ) : null}
          </div>
        </form>
      </div>

      <div className="mt-10 border-t border-zinc-800 pt-8">
        <ShopDangerZonePanel
          accountDeletionRequestedAt={shop.accountDeletionRequestedAt}
          accountDeletionEmailConfirmedAt={shop.accountDeletionEmailConfirmedAt}
          stripeConnectAccountId={shop.stripeConnectAccountId}
          stripeConnectBalance={shop.stripeConnectBalance}
        />
      </div>
    </section>
  );
}
