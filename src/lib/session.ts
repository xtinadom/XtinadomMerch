import { SessionOptions, getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { CART_SESSION_QUANTITY_CEILING } from "@/lib/cart-limits";
import {
  hydrateCartListingKeys,
  inferShopIdFromListingIds,
} from "@/lib/cart-hydration";

/** One cart row per shop listing; printifyVariantId set when the listing has multiple Printify variants. */
export type CartLine = { quantity: number; printifyVariantId?: string };

export type CartSession = {
  /** All lines belong to this shop (single-shop cart). */
  shopId?: string | null;
  items: Record<string, CartLine>;
};

function normalizeCartValue(v: unknown): CartLine | undefined {
  if (typeof v === "number" && v > 0) {
    return {
      quantity: Math.min(
        CART_SESSION_QUANTITY_CEILING,
        Math.max(1, Math.floor(v)),
      ),
    };
  }
  if (v && typeof v === "object" && "quantity" in v) {
    const q = (v as CartLine).quantity;
    if (typeof q !== "number" || !Number.isFinite(q) || q <= 0) return undefined;
    const vid = (v as CartLine).printifyVariantId;
    const trimmed = typeof vid === "string" ? vid.trim() : "";
    return {
      quantity: Math.min(CART_SESSION_QUANTITY_CEILING, Math.max(1, Math.floor(q))),
      ...(trimmed ? { printifyVariantId: trimmed } : {}),
    };
  }
  return undefined;
}

function normalizeCartItems(raw: unknown): Record<string, CartLine> {
  if (raw == null || typeof raw !== "object") return {};
  const out: Record<string, CartLine> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (k === "shopId") continue;
    const line = normalizeCartValue(v);
    if (line) out[k] = line;
  }
  return out;
}

function readShopIdFromRaw(raw: unknown): string | null | undefined {
  if (raw == null || typeof raw !== "object") return undefined;
  const sid = (raw as Record<string, unknown>).shopId;
  if (typeof sid === "string" && sid.trim()) return sid.trim();
  if (sid === null) return null;
  return undefined;
}

async function finalizeCartSessionShape(
  raw: unknown,
  items: Record<string, CartLine>,
): Promise<{ shopId: string | null; items: Record<string, CartLine> }> {
  const hydrated = await hydrateCartListingKeys(items);
  const keys = Object.keys(hydrated);
  const inferred =
    keys.length > 0 ? await inferShopIdFromListingIds(keys) : null;
  const explicit = readShopIdFromRaw(raw);
  const shopId = explicit ?? inferred ?? null;
  return { shopId, items: hydrated };
}

export type AdminSession = {
  isAdmin?: boolean;
};

export type ShopOwnerSession = {
  shopUserId?: string;
};

function requireSessionSecret(): string {
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret || sessionSecret.length < 32) {
    throw new Error("SESSION_SECRET must be set and at least 32 characters");
  }
  return sessionSecret;
}

let loggedCartSessionSecretFallback = false;

/**
 * Cart reads run on every storefront layout (shop, product, cart). If `SESSION_SECRET` is missing
 * on production, throwing here breaks the whole shop with 500 while `/` still works (no cart session).
 * Use a stable fallback so pages render; cart cookies from a previous real secret may not decrypt.
 */
function cartSessionPassword(): string {
  const s = process.env.SESSION_SECRET?.trim();
  if (s && s.length >= 32) return s;
  if (!loggedCartSessionSecretFallback) {
    loggedCartSessionSecretFallback = true;
    console.error(
      "[xtinadom] SESSION_SECRET is missing or shorter than 32 characters. Store pages use a fallback cart key so the shop can load; set SESSION_SECRET in Vercel (see .env.example) and redeploy.",
    );
  }
  return "xtinadom-fallback-cart-session-key!!";
}

const cartBase: Omit<SessionOptions, "password"> = {
  cookieName: "xtina_cart",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  },
};

const adminBase: Omit<SessionOptions, "password"> = {
  cookieName: "xtina_admin",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  },
};

const shopOwnerBase: Omit<SessionOptions, "password"> = {
  cookieName: "xtina_shop_owner",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  },
};

/**
 * Full iron-session (mutate `items` then `save()`). Used by cart server actions.
 * Do not wrap in try/catch here — callers that only read `items` should use `getCartSessionReadonly`.
 */
export async function getCartSession() {
  const session = await getIronSession<CartSession>(await cookies(), {
    ...cartBase,
    password: cartSessionPassword(),
  });
  const raw = session as unknown as Record<string, unknown>;
  const normalized = normalizeCartItems(session.items);
  const fin = await finalizeCartSessionShape(raw, normalized);
  session.items = fin.items;
  session.shopId = fin.shopId;
  return session;
}

/**
 * Plain cart payload for storefront layout and checkout reads. Never throws: bad/missing cookies or
 * crypto failures yield an empty cart so shop pages still render.
 */
export async function getCartSessionReadonly(): Promise<CartSession> {
  try {
    const session = await getIronSession<CartSession>(await cookies(), {
      ...cartBase,
      password: cartSessionPassword(),
    });
    const raw = session as unknown as Record<string, unknown>;
    const normalized = normalizeCartItems(session.items);
    const fin = await finalizeCartSessionShape(raw, normalized);
    return { shopId: fin.shopId, items: fin.items };
  } catch (e) {
    console.error("[getCartSessionReadonly]", e);
    return { shopId: null, items: {} };
  }
}

export async function getAdminSession() {
  return getIronSession<AdminSession>(await cookies(), {
    ...adminBase,
    password: requireSessionSecret(),
  });
}

/** Shop owner session for server actions that mutate the cookie (login / logout). */
export async function getShopOwnerSession() {
  return getIronSession<ShopOwnerSession>(await cookies(), {
    ...shopOwnerBase,
    password: requireSessionSecret(),
  });
}

/** Read-only shop owner payload; never throws (bad secret / corrupt cookie). */
export async function getShopOwnerSessionReadonly(): Promise<ShopOwnerSession> {
  try {
    return await getIronSession<ShopOwnerSession>(await cookies(), {
      ...shopOwnerBase,
      password: requireSessionSecret(),
    });
  } catch (e) {
    console.error("[getShopOwnerSessionReadonly]", e);
    return {};
  }
}
