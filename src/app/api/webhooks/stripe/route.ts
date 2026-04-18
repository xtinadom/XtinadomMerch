import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { coercePrintifyOrderVariantId, createPrintifyOrder } from "@/lib/printify";
import { Prisma } from "@/generated/prisma/client";
import {
  FulfillmentType,
  FulfillmentJobStatus,
  ListingRequestStatus,
  OrderStatus,
} from "@/generated/prisma/enums";
import { revalidatePath } from "next/cache";
import { activateProductWhenShopListingGoesLive } from "@/lib/shop-listing-publish";

export const runtime = "nodejs";

function splitName(full: string | null | undefined): { first: string; last: string } {
  if (!full?.trim()) return { first: "Customer", last: "." };
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: "." };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

/**
 * Listing-fee Checkout Sessions (no `Order` row). Returns true when this event was handled here.
 */
async function fulfillListingFeeCheckout(session: Stripe.Checkout.Session): Promise<boolean> {
  if (session.metadata?.kind !== "listing_fee") return false;
  const listingId = session.metadata.shopListingId;
  if (!listingId || typeof listingId !== "string") return true;
  const row = await prisma.shopListing.findUnique({
    where: { id: listingId },
    select: {
      requestStatus: true,
      active: true,
      shopId: true,
      productId: true,
      adminRemovedFromShopAt: true,
      shop: { select: { slug: true } },
    },
  });
  if (!row) return true;
  const publishAfterFee =
    row.requestStatus === ListingRequestStatus.approved &&
    !row.active &&
    row.adminRemovedFromShopAt == null;
  const statusBefore = row.requestStatus;
  await prisma.shopListing.update({
    where: { id: listingId },
    data: {
      listingFeePaidAt: new Date(),
      ...(publishAfterFee ? { active: true } : {}),
    },
  });
  if (publishAfterFee) {
    await activateProductWhenShopListingGoesLive(row.productId, row.shop.slug);
    await prisma.shopOwnerNotice.create({
      data: {
        shopId: row.shopId,
        kind: "listing_fee_paid",
        body:
          "Your listing publication fee was received. That listing is now live in your shop.",
      },
    });
    revalidatePath("/dashboard");
  } else if (statusBefore === ListingRequestStatus.draft) {
    await prisma.shopOwnerNotice.create({
      data: {
        shopId: row.shopId,
        kind: "listing_fee_paid",
        body:
          "Your listing publication fee was received. Open the Listings tab and submit that draft for admin review when you are ready.",
      },
    });
    revalidatePath("/dashboard");
  } else if (
    statusBefore === ListingRequestStatus.submitted ||
    statusBefore === ListingRequestStatus.images_ok ||
    statusBefore === ListingRequestStatus.printify_item_created
  ) {
    await prisma.shopOwnerNotice.create({
      data: {
        shopId: row.shopId,
        kind: "listing_fee_paid",
        body: "Your listing publication fee was received. Admin review continues as usual.",
      },
    });
    revalidatePath("/dashboard");
  }
  return true;
}

/** Voluntary platform tip — no Order row; acknowledge so we don’t treat it as a merch checkout. */
async function fulfillSupportTipCheckout(session: Stripe.Checkout.Session): Promise<boolean> {
  return session.metadata?.kind === "support_tip";
}

async function fulfillOrder(session: Stripe.Checkout.Session) {
  const orderId = session.metadata?.orderId;
  if (!orderId) return;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { lines: { include: { product: true } } },
  });
  if (!order) return;

  const stripe = getStripe();
  const full = await stripe.checkout.sessions.retrieve(session.id, {
    expand: ["customer_details"],
  });

  const email =
    full.customer_details?.email ?? full.customer_email ?? session.customer_email ?? null;
  const phone = full.customer_details?.phone ?? "";
  const shipping = full.collected_information?.shipping_details;
  const shipName = shipping?.name ?? "";
  const addr = shipping?.address;
  const { first: firstName, last: lastName } = splitName(shipName);

  const paymentIntentId =
    typeof full.payment_intent === "string"
      ? full.payment_intent
      : full.payment_intent?.id ?? null;

  await prisma.$transaction(async (tx) => {
    const updated = await tx.order.updateMany({
      where: { id: orderId, status: OrderStatus.pending_payment },
      data: {
        status: OrderStatus.paid,
        email,
        stripePaymentIntentId: paymentIntentId,
        shippingName: shipName || null,
        shippingLine1: addr?.line1 ?? null,
        shippingLine2: addr?.line2 ?? null,
        shippingCity: addr?.city ?? null,
        shippingState: addr?.state ?? null,
        shippingPostal: addr?.postal_code ?? null,
        shippingCountry: addr?.country ?? null,
        shippingPhone: phone || null,
      },
    });

    if ((updated?.count ?? 0) === 0) return;

    const merchandiseCents = order.lines.reduce(
      (s, l) => s + l.unitPriceCents * l.quantity,
      0,
    );
    if (order.shopId && merchandiseCents > 0) {
      await tx.shop.update({
        where: { id: order.shopId },
        data: { totalSalesCents: { increment: merchandiseCents } },
      });
    }

    for (const line of order.lines) {
      if (
        line.fulfillmentType === FulfillmentType.manual &&
        line.product.trackInventory
      ) {
        const r = await tx.product.updateMany({
          where: {
            id: line.productId,
            stockQuantity: { gte: line.quantity },
          },
          data: { stockQuantity: { decrement: line.quantity } },
        });
        if ((r?.count ?? 0) === 0) {
          console.error(
            `[webhook] Stock race for product ${line.productId} order ${orderId}`,
          );
        }
      }
    }
  });

  const paid = await prisma.order.findUnique({
    where: { id: orderId },
    include: { lines: true, fulfillmentJobs: true },
  });
  if (!paid || paid.status !== OrderStatus.paid) return;

  const hasPrintifyJob = paid.fulfillmentJobs.some((j) => j.provider === "printify");
  if (hasPrintifyJob) return;

  const orderWantsPrintify = paid.lines.some(
    (l) => l.fulfillmentType === FulfillmentType.printify,
  );
  if (!orderWantsPrintify) return;

  const printifyLines = paid.lines.filter(
    (l) =>
      l.fulfillmentType === FulfillmentType.printify &&
      l.printifyProductId &&
      l.printifyVariantId,
  );

  if (printifyLines.length === 0) {
    await prisma.fulfillmentJob.create({
      data: {
        orderId: paid.id,
        provider: "printify",
        status: FulfillmentJobStatus.failed,
        lastError:
          "Printify line items missing product/variant IDs — set printifyProductId and printifyVariantId on products.",
        attempts: 1,
      },
    });
    return;
  }

  const variantItems = printifyLines
    .map((l) => {
      const vidRaw = l.printifyVariantId!.trim();
      if (!vidRaw) return null;
      const variant_id = coercePrintifyOrderVariantId(vidRaw);
      if (variant_id === "") return null;
      return {
        product_id: l.printifyProductId!,
        variant_id,
        quantity: l.quantity,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  if (variantItems.length === 0) {
    await prisma.fulfillmentJob.create({
      data: {
        orderId: paid.id,
        provider: "printify",
        status: FulfillmentJobStatus.failed,
        lastError: "Invalid Printify variant ids on order lines.",
        attempts: 1,
      },
    });
    return;
  }

  const job = await prisma.fulfillmentJob.create({
    data: {
      orderId: paid.id,
      provider: "printify",
      status: FulfillmentJobStatus.processing,
      attempts: 1,
    },
  });

  try {
    const { id: externalId, raw } = await createPrintifyOrder({
      externalId: paid.id,
      label: `Xtinadom ${paid.id.slice(0, 8)}`,
      lineItems: variantItems,
      addressTo: {
        first_name: firstName,
        last_name: lastName,
        email: email ?? "customer@example.com",
        phone: phone || "0000000000",
        country: addr?.country ?? "US",
        region: addr?.state ?? "",
        address1: addr?.line1 ?? "",
        address2: addr?.line2 ?? undefined,
        city: addr?.city ?? "",
        zip: addr?.postal_code ?? "",
      },
    });

    await prisma.fulfillmentJob.update({
      where: { id: job.id },
      data: {
        status: FulfillmentJobStatus.succeeded,
        externalId,
        payload: raw as object,
        lastError: null,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[webhook] Printify error:", msg);
    await prisma.fulfillmentJob.update({
      where: { id: job.id },
      data: {
        status: FulfillmentJobStatus.failed,
        lastError: msg,
      },
    });
  }
}

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET not configured" },
      { status: 500 },
    );
  }

  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid payload";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    await prisma.processedStripeEvent.create({
      data: { stripeEventId: event.id },
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return NextResponse.json({ received: true });
    }
    throw e;
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const listingFee = await fulfillListingFeeCheckout(session);
    if (listingFee) {
      return NextResponse.json({ received: true });
    }
    const supportTip = await fulfillSupportTipCheckout(session);
    if (supportTip) {
      return NextResponse.json({ received: true });
    }
    await fulfillOrder(session);
  }

  return NextResponse.json({ received: true });
}
