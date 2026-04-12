import { SessionOptions, getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { CART_SESSION_QUANTITY_CEILING } from "@/lib/cart-limits";

/** One cart row per product; printifyVariantId set when the listing has multiple Printify variants. */
export type CartLine = { quantity: number; printifyVariantId?: string };

export type CartSession = {
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

export type AdminSession = {
  isAdmin?: boolean;
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

export async function getCartSession() {
  const session = await getIronSession<CartSession>(await cookies(), {
    ...cartBase,
    password: cartSessionPassword(),
  });
  if (!session.items) session.items = {};
  const normalized: Record<string, CartLine> = {};
  const raw = session.items as unknown as Record<string, unknown>;
  for (const [k, v] of Object.entries(raw)) {
    const line = normalizeCartValue(v);
    if (line) normalized[k] = line;
  }
  session.items = normalized;
  return session;
}

export async function getAdminSession() {
  return getIronSession<AdminSession>(await cookies(), {
    ...adminBase,
    password: requireSessionSecret(),
  });
}
