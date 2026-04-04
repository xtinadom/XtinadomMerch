"use server";

import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { getCartSession } from "@/lib/session";
import { cartHasTipEligibleProduct } from "@/lib/tip-eligibility";
import { resolvePrintifyCheckoutLine } from "@/lib/printify-variants";
import { FulfillmentType, OrderStatus } from "@/generated/prisma/enums";

export type CheckoutResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

function appUrl() {
  const u = process.env.NEXT_PUBLIC_APP_URL;
  if (!u) {
    return { ok: false as const, error: "NEXT_PUBLIC_APP_URL is not configured." };
  }
  return { ok: true as const, url: u.replace(/\/$/, "") };
}

function shippingCents() {
  const raw = process.env.SHIPPING_FLAT_CENTS;
  const n = raw ? parseInt(raw, 10) : 500;
  return Number.isFinite(n) && n >= 0 ? n : 500;
}

export async function startCheckout(formData: FormData): Promise<CheckoutResult> {
  const base = appUrl();
  if (!base.ok) return base;

  const session = await getCartSession();
  const ids = Object.keys(session.items).filter(
    (id) => (session.items[id]?.quantity ?? 0) > 0,
  );
  if (ids.length === 0) {
    return { ok: false, error: "Your cart is empty." };
  }

  const [products, categoryTree] = await Promise.all([
    prisma.product.findMany({
      where: { id: { in: ids }, active: true },
      include: { category: true, extraCategories: true },
    }),
    prisma.category.findMany({
      select: { id: true, slug: true, name: true, parentId: true, sortOrder: true },
    }),
  ]);

  if (products.length !== ids.length) {
    return { ok: false, error: "Some products are no longer available. Refresh your cart." };
  }

  const tipRaw = formData.get("tipCents");
  let tipCents = 0;
  if (tipRaw !== null && tipRaw !== "") {
    tipCents = parseInt(String(tipRaw), 10);
    if (!Number.isFinite(tipCents) || tipCents < 0) {
      return { ok: false, error: "Invalid tip amount." };
    }
  }

  const tipAllowed = cartHasTipEligibleProduct(products, categoryTree);
  if (!tipAllowed && tipCents > 0) {
    return { ok: false, error: "Tips apply only when your cart includes sub catalog items." };
  }

  let subtotalCents = 0;
  const lineInputs: {
    product: (typeof products)[0];
    quantity: number;
    lineTotal: number;
    unitPriceCents: number;
    stripeProductName: string;
    orderPrintifyVariantId: string | null;
  }[] = [];

  for (const p of products) {
    const cartLine = session.items[p.id];
    const quantity = cartLine?.quantity ?? 0;
    if (quantity <= 0) continue;

    if (p.fulfillmentType === FulfillmentType.manual && p.trackInventory) {
      if (p.stockQuantity < quantity) {
        return { ok: false, error: `Not enough stock for “${p.name}”.` };
      }
    }

    let unitPriceCents = p.priceCents;
    let stripeProductName = p.name;
    let orderPrintifyVariantId: string | null = p.printifyVariantId;

    if (p.fulfillmentType === FulfillmentType.printify) {
      const resolved = resolvePrintifyCheckoutLine(p, cartLine);
      if (!resolved) {
        return {
          ok: false,
          error: `“${p.name}” is missing Printify variant data. Remove it from your cart and add it again from the product page.`,
        };
      }
      unitPriceCents = resolved.unitPriceCents;
      stripeProductName = resolved.stripeName;
      orderPrintifyVariantId = resolved.printifyVariantId;
    }

    const lineTotal = unitPriceCents * quantity;
    subtotalCents += lineTotal;
    lineInputs.push({
      product: p,
      quantity,
      lineTotal,
      unitPriceCents,
      stripeProductName,
      orderPrintifyVariantId,
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
        metadata?: { productId: string };
      };
    };
  }> = [];

  for (const {
    product: p,
    quantity,
    unitPriceCents,
    stripeProductName,
  } of lineInputs) {
    stripeLineItems.push({
      quantity,
      price_data: {
        currency: "usd",
        unit_amount: unitPriceCents,
        product_data: {
          name: stripeProductName,
          description: p.description ?? undefined,
          metadata: { productId: p.id },
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
        status: OrderStatus.pending_payment,
        subtotalCents,
        tipCents,
        shippingCents: ship,
        totalCents,
        currency: "usd",
        lines: {
          create: lineInputs.map(
            ({
              product: p,
              quantity,
              unitPriceCents,
              stripeProductName,
              orderPrintifyVariantId,
            }) => ({
              quantity,
              unitPriceCents,
              productName: stripeProductName,
              fulfillmentType: p.fulfillmentType,
              productId: p.id,
              printifyProductId: p.printifyProductId,
              printifyVariantId: orderPrintifyVariantId,
            }),
          ),
        },
      },
    });
    return o;
  });

  const allowCard = products.every((p) => p.payCard);
  const allowCashApp = products.every((p) => p.payCashApp);
  const payment_method_types: ("card" | "cashapp")[] = [];
  if (allowCard) payment_method_types.push("card");
  if (allowCashApp) payment_method_types.push("cashapp");
  if (payment_method_types.length === 0) payment_method_types.push("card");

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
      metadata: { orderId: order.id },
      client_reference_id: order.id,
      success_url: `${base.url}/order/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base.url}/cart`,
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
