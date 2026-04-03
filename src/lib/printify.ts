import {
  type PrintifyCatalogProduct,
  catalogRowNeedsDetail,
  parsePrintifyProductRow,
} from "./printify-catalog";

export type {
  PrintifyCatalogImage,
  PrintifyCatalogProduct,
  PrintifyCatalogVariant,
} from "./printify-catalog";

const PRINTIFY_BASE = "https://api.printify.com/v1";

/** Token + shop id — required for checkout → Printify order creation. */
export function isPrintifyConfigured(): boolean {
  return Boolean(
    process.env.PRINTIFY_API_TOKEN?.trim() && process.env.PRINTIFY_SHOP_ID?.trim(),
  );
}

/** Only the API token — enough to list shops and discover PRINTIFY_SHOP_ID. */
export function hasPrintifyApiToken(): boolean {
  return Boolean(process.env.PRINTIFY_API_TOKEN?.trim());
}

async function printifyAuthorizedFetch(path: string): Promise<Response> {
  const token = process.env.PRINTIFY_API_TOKEN?.trim();
  if (!token) {
    throw new Error("PRINTIFY_API_TOKEN is not set");
  }
  const url = `${PRINTIFY_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  return fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
}

export type PrintifyShopSummary = { id: number; title: string };

export async function fetchPrintifyShops(): Promise<PrintifyShopSummary[]> {
  const res = await printifyAuthorizedFetch("/shops.json");
  const raw = await res.json();
  if (!res.ok) {
    const rec = raw as Record<string, unknown>;
    const msg =
      typeof rec.message === "string"
        ? rec.message
        : typeof rec.error === "string"
          ? rec.error
          : JSON.stringify(raw);
    throw new Error(`Printify shops failed (${res.status}): ${msg}`);
  }
  // API returns either a top-level array or { data: [...] }
  const data = Array.isArray(raw)
    ? raw
    : (raw as Record<string, unknown>).data;
  if (!Array.isArray(data)) return [];
  const out: PrintifyShopSummary[] = [];
  for (const row of data) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const id = typeof r.id === "number" ? r.id : Number(r.id);
    const title = typeof r.title === "string" ? r.title : `Shop ${id}`;
    if (Number.isFinite(id)) out.push({ id, title });
  }
  return out;
}

function parseCatalogPage(raw: unknown): {
  items: PrintifyCatalogProduct[];
  lastPage: number;
} {
  const o = raw as Record<string, unknown>;
  const lastPage =
    typeof o.last_page === "number" && o.last_page >= 1 ? o.last_page : 1;
  const data = o.data;
  if (!Array.isArray(data)) return { items: [], lastPage: 1 };
  const items: PrintifyCatalogProduct[] = [];
  for (const row of data) {
    const parsed = parsePrintifyProductRow(row);
    if (parsed) items.push(parsed);
  }
  return { items, lastPage };
}

/** All published products in the shop (paginated against Printify API). */
export async function fetchPrintifyCatalog(shopId: string): Promise<PrintifyCatalogProduct[]> {
  const sid = shopId.trim();
  if (!sid) throw new Error("PRINTIFY_SHOP_ID is empty");

  const all: PrintifyCatalogProduct[] = [];
  let page = 1;
  let lastPage = 1;
  const limit = 50;
  const maxPages = 30;

  do {
    const res = await printifyAuthorizedFetch(
      `/shops/${encodeURIComponent(sid)}/products.json?limit=${limit}&page=${page}`,
    );
    const raw = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      const msg =
        typeof raw.message === "string"
          ? raw.message
          : typeof raw.error === "string"
            ? raw.error
            : JSON.stringify(raw);
      throw new Error(`Printify products failed (${res.status}): ${msg}`);
    }
    const { items, lastPage: lp } = parseCatalogPage(raw);
    lastPage = lp;
    all.push(...items);
    page += 1;
  } while (page <= lastPage && page <= maxPages);

  return all;
}

/** Single product (full images / variant prices). */
export async function fetchPrintifyProductDetail(
  shopId: string,
  productId: string,
): Promise<PrintifyCatalogProduct | null> {
  const sid = shopId.trim();
  const pid = productId.trim();
  if (!sid || !pid) return null;
  const res = await printifyAuthorizedFetch(
    `/shops/${encodeURIComponent(sid)}/products/${encodeURIComponent(pid)}.json`,
  );
  const raw = await res.json();
  if (!res.ok) return null;
  return parsePrintifyProductRow(raw);
}

/** Catalog with per-product detail fetch when list payload lacks images or prices. */
export async function fetchPrintifyCatalogEnriched(
  shopId: string,
): Promise<PrintifyCatalogProduct[]> {
  const basic = await fetchPrintifyCatalog(shopId);
  const out: PrintifyCatalogProduct[] = [];
  for (const p of basic) {
    if (catalogRowNeedsDetail(p)) {
      const detail = await fetchPrintifyProductDetail(shopId, p.id);
      out.push(detail ?? p);
    } else {
      out.push(p);
    }
  }
  return out;
}

export type PrintifyAddress = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  country: string;
  region: string;
  address1: string;
  address2?: string;
  city: string;
  zip: string;
};

export type PrintifyLineItem = {
  product_id: string;
  variant_id: number;
  quantity: number;
};

export async function createPrintifyOrder(params: {
  externalId: string;
  label: string;
  lineItems: PrintifyLineItem[];
  addressTo: PrintifyAddress;
  shippingMethod?: number;
}): Promise<{ id: string; raw: unknown }> {
  const token = process.env.PRINTIFY_API_TOKEN;
  const shopId = process.env.PRINTIFY_SHOP_ID;
  if (!token || !shopId) {
    throw new Error("PRINTIFY_API_TOKEN or PRINTIFY_SHOP_ID is not set");
  }

  const shippingMethod = params.shippingMethod ?? Number(process.env.PRINTIFY_SHIPPING_METHOD ?? "1");

  const body = {
    external_id: params.externalId,
    label: params.label,
    line_items: params.lineItems,
    shipping_method: shippingMethod,
    send_shipping_notification: false,
    address_to: params.addressTo,
  };

  const res = await fetch(`${PRINTIFY_BASE}/shops/${shopId}/orders.json`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const raw = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const msg =
      typeof raw.errors === "object" && raw.errors !== null
        ? JSON.stringify(raw.errors)
        : JSON.stringify(raw);
    throw new Error(`Printify order failed (${res.status}): ${msg}`);
  }

  const id = String(raw.id ?? "");
  return { id, raw };
}
