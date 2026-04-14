"use client";

import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  updateShopProfileSetup,
  uploadShopProfileImageSetup,
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

export function ShopSetupTabs(props: {
  shop: ShopSetupShopPayload;
  steps: ShopSetupSteps;
  r2Configured: boolean;
  /** When true, used inside dashboard tab panel (no top margin). */
  embedded?: boolean;
}) {
  const { shop, steps, r2Configured, embedded = false } = props;

  const router = useRouter();
  const [tab, setTab] = useState<"stripe" | "profile">(() => {
    if (!steps.profile) return "profile";
    return "stripe";
  });
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const [isProfilePending, startProfileTransition] = useTransition();
  const [isAvatarPending, startAvatarTransition] = useTransition();

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

  const stripeLabel = shop.stripeConnectAccountId
    ? "Continue Stripe onboarding"
    : "Start Stripe onboarding";

  const setSocialField = useCallback((key: ShopSocialKey, value: string) => {
    setSocial((prev) => ({ ...prev, [key]: value }));
  }, []);

  return (
    <section
      className={`rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 sm:p-6 ${embedded ? "mt-0" : "mt-8"}`}
    >
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
          <Link
            href="/dashboard?dash=requestListing"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-zinc-400 transition hover:bg-zinc-900/80 hover:text-zinc-200"
          >
            <StepIcon done={steps.listing} />
            <span>Request listing</span>
          </Link>
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
        </div>
      </div>
    </section>
  );
}
