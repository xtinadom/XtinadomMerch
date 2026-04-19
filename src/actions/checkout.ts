"use server";

import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import {
  isMockCheckoutEnabled,
  MOCK_SESSION_PREFIX,
} from "@/lib/checkout-mock";
import { getCartSessionReadonly } from "@/lib/session";
import { cartHasTipEligibleProduct } from "@/lib/tip-eligibility";
import { FulfillmentType, OrderStatus } from "@/generated/prisma/enums";
import { publicAppBaseUrl } from "@/lib/public-app-url";
import { listingCartUnitCents } from "@/lib/listing-cart-price";
import { listingStripeProductName } from "@/lib/listing-cart-stripe-name";
import { splitLineRevenueMerchandiseCents } from "@/lib/marketplace-fee";
import { PLATFORM_SHOP_SLUG } from "@/lib/marketplace-constants";
import { storefrontShopListingWhere } from "@/lib/shop-listing-storefront-visibility";

export type CheckoutResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

function appUrl() {
  const u = publicAppBaseUrl();
  if (!u) {
    return { ok: false as const, error: "NEXT_PUBLIC_APP_URL is not configured." };
  }
  return { ok: true as const, url: u };
}

function shippingCents() {
  const raw = process.env.SHIPPING_FLAT_CENTS;
  const n = raw ? parseInt(raw, 10) : 500;
  return Number.isFinite(n) && n >= 0 ? n : 500;
}

export async function startCheckout(formData: FormData): Promise<CheckoutResult> {
  const base = appUrl();
  if (!base.ok) return base;

  const session = await getCartSessionReadonly();
  const listingIds = Object.keys(session.items).filter(
    (id) => (session.items[id]?.quantity ?? 0) > 0,
  );
  if (listingIds.length === 0) {
    return { ok: false, error: "Your cart is empty." };
  }

  const listings = await prisma.shopListing.findMany({
    where: { id: { in: listingIds }, ...storefrontShopListingWhere },
    include: {
      product: true,
      shop: { select: { id: true, slug: true } },
    },
  });

  if (listings.length === 0) {
    return { ok: false, error: "Some products are no longer available. Refresh your cart." };
  }

  const shopIds = new Set(listings.map((l) => l.shopId));
  if (shopIds.size !== 1) {
    return { ok: false, error: "Your cart mixes different shops. Check out one shop at a time." };
  }
  const shopId = [...shopIds][0]!;

  const tipRaw = formData.get("tipCents");
  let tipCents = 0;
  if (tipRaw !== null && tipRaw !== "") {
    tipCents = parseInt(String(tipRaw), 10);
    if (!Number.isFinite(tipCents) || tipCents < 0) {
      return { ok: false, error: "Invalid tip amount." };
    }
  }

  const products = listings.map((l) => l.product);
  const tipAllowed = cartHasTipEligibleProduct(products);
  if (!tipAllowed && tipCents > 0) {
    return { ok: false, error: "Tips apply only when your cart includes sub catalog items." };
  }

  let subtotalCents = 0;
  const lineInputs: {
    listing: (typeof listings)[0];
    product: (typeof listings)[0]["product"];
    quantity: number;
    lineTotal: number;
    unitPriceCents: number;
    stripeProductName: string;
    orderPrintifyVariantId: string | null;
    platformCutCents: number;
    shopCutCents: number;
  }[] = [];

  for (const listing of listings) {
    const p = listing.product;
    const cartLine = session.items[listing.id];
    const quantity = cartLine?.quantity ?? 0;
    if (quantity <= 0) continue;

    const unitPriceCents = listingCartUnitCents(listing, cartLine);
    const { name: stripeProductName, printifyVariantId: orderPrintifyVariantId } =
      listingStripeProductName(listing, cartLine);

    if (p.fulfillmentType === FulfillmentType.printify && !orderPrintifyVariantId) {
      return {
        ok: false,
        error: `“${p.name}” is missing Printify variant data. Remove it from your cart and add it again from the product page.`,
      };
    }

    const lineTotal = unitPriceCents * quantity;
    const { platformCutCents, shopCutCents } =
      splitLineRevenueMerchandiseCents(lineTotal);
    subtotalCents += lineTotal;
    lineInputs.push({
      listing,
      product: p,
      quantity,
      lineTotal,
      unitPriceCents,
      stripeProductName,
      orderPrintifyVariantId,
      platformCutCents,
      shopCutCents,
    });
  }

  if (lineInputs.length === 0) {
    return { ok: false, error: "Your cart is empty." };
  }

  const ship = shippingCents();
  const totalCents = subtotalCents + tipCents + ship;

  const stripeLineItems: Array<{
    quantity: number;
    price_data: {
      currency: "usd";
      unit_amount: number;
      product_data: {
        name: string;
        description?: string;
        metadata?: { productId: string; shopListingId: string };
      };
    };
  }> = [];

  for (const row of lineInputs) {
    const p = row.product;
    stripeLineItems.push({
      quantity: row.quantity,
      price_data: {
        currency: "usd",
        unit_amount: row.unitPriceCents,
        product_data: {
          name: row.stripeProductName,
          description: p.description ?? undefined,
          metadata: { productId: p.id, shopListingId: row.listing.id },
        },
      },
    });
  }

  if (tipCents > 0) {
    stripeLineItems.push({
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: tipCents,
        product_data: { name: "Tip (thank you)" },
      },
    });
  }

  const order = await prisma.$transaction(async (tx) => {
    const o = await tx.order.create({
      data: {
        shopId,
        status: OrderStatus.pending_payment,
        subtotalCents,
        tipCents,
        shippingCents: ship,
        totalCents,
        currency: "usd",
        lines: {
          create: lineInputs.map(
            ({
              listing,
              product: p,
              quantity,
              unitPriceCents,
              stripeProductName,
              orderPrintifyVariantId,
              platformCutCents,
              shopCutCents,
            }) => ({
              quantity,
              unitPriceCents,
              productName: stripeProductName,
              fulfillmentType: p.fulfillmentType,
              productId: p.id,
              printifyProductId: listing.listingPrintifyProductId ?? p.printifyProductId,
              printifyVariantId: orderPrintifyVariantId,
              shopId,
              shopListingId: listing.id,
              platformCutCents,
              shopCutCents,
            }),
          ),
        },
      },
    });
    return o;
  });

  const mockSessionId = `${MOCK_SESSION_PREFIX}${order.id}`;

  if (isMockCheckoutEnabled()) {
    await prisma.order.update({
      where: { id: order.id },
      data: { stripeSessionId: mockSessionId },
    });
    return {
      ok: true,
      url: `${base.url}/order/success?session_id=${encodeURIComponent(mockSessionId)}`,
    };
  }

  const lineProducts = lineInputs.map((x) => x.product);
  const allowCard = lineProducts.every((p) => p.payCard);
  const allowCashApp = lineProducts.every((p) => p.payCashApp);
  const payment_method_types: ("card" | "cashapp")[] = [];
  if (allowCard) payment_method_types.push("card");
  if (allowCashApp) payment_method_types.push("cashapp");
  if (payment_method_types.length === 0) payment_method_types.push("card");

  const cancelShopSlug = lineInputs[0]!.listing.shop.slug;
  const cancelPath =
    cancelShopSlug === PLATFORM_SHOP_SLUG ? "/cart" : `/s/${cancelShopSlug}/cart`;

  const shopRecord = await prisma.shop.findUnique({
    where: { id: shopId },
    select: {
      stripeConnectAccountId: true,
      connectChargesEnabled: true,
    },
  });
  const useStripeConnect =
    process.env.MARKETPLACE_STRIPE_CONNECT === "1" &&
    shopRecord?.stripeConnectAccountId &&
    shopRecord.connectChargesEnabled;
  const applicationFeeCents =
    lineInputs.reduce((s, x) => s + x.platformCutCents, 0) + tipCents;

  let checkoutSession;
  try {
    checkoutSession = await getStripe().checkout.sessions.create({
      mode: "payment",
      payment_method_types,
      line_items: stripeLineItems,
      shipping_address_collection: { allowed_countries: ["US", "CA"] },
      shipping_options: [
        {
          shipping_rate_data: {
            type: "fixed_amount",
            fixed_amount: { amount: ship, currency: "usd" },
            display_name: "Standard shipping",
          },
        },
      ],
      metadata: { orderId: order.id, shopId },
      client_reference_id: order.id,
      success_url: `${base.url}/order/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base.url}${cancelPath}`,
      ...(useStripeConnect
        ? {
            payment_intent_data: {
              application_fee_amount: applicationFeeCents,
              transfer_data: {
                destination: shopRecord.stripeConnectAccountId!,
              },
            },
          }
        : {}),
    });
  } catch (e) {
    await prisma.order.delete({ where: { id: order.id } });
    const message = e instanceof Error ? e.message : "Payment setup failed.";
    return { ok: false, error: message };
  }

  await prisma.order.update({
    where: { id: order.id },
    data: { stripeSessionId: checkoutSession.id },
  });

  if (!checkoutSession.url) {
    return { ok: false, error: "Stripe did not return a checkout URL." };
  }

  return { ok: true, url: checkoutSession.url };
}
