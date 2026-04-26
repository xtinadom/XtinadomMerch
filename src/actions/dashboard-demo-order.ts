"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { FulfillmentType, OrderStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { getShopOwnerSession } from "@/lib/session";
import { listingCartUnitCents } from "@/lib/listing-cart-price";
import { listingStripeProductName } from "@/lib/listing-cart-stripe-name";
import { baselineGoodsServicesUnitCents } from "@/lib/baseline-goods-services-unit-cents";
import { splitMerchandiseLineForCheckoutCents } from "@/lib/marketplace-fee";
import { parseBaselinePick } from "@/lib/shop-baseline-catalog";
import { PLATFORM_SHOP_SLUG } from "@/lib/marketplace-constants";
import { shopDemoPurchaseFeatureEnabled } from "@/lib/shop-demo-purchase-feature";
import { storefrontShopListingWhere } from "@/lib/shop-listing-storefront-visibility";

function flatShippingCents(): number {
  const raw = process.env.SHIPPING_FLAT_CENTS;
  const n = raw ? parseInt(raw, 10) : 500;
  return Number.isFinite(n) && n >= 0 ? n : 500;
}

export type SimulateShopDemoPurchaseResult = { ok: true } | { ok: false; error: string };

/**
 * Inserts a **paid** order for the signed-in shop (one line, qty 1) so the dashboard **Orders**
 * workflow can be tested without Stripe. Only under `next dev` with `SHOP_DEMO_PURCHASE_BUTTON=1`.
 */
export async function simulateShopDemoPurchase(): Promise<SimulateShopDemoPurchaseResult> {
  try {
    if (!shopDemoPurchaseFeatureEnabled()) {
      return {
        ok: false,
        error:
          "Demo purchase is only available in local development (`next dev`) with SHOP_DEMO_PURCHASE_BUTTON=1.",
      };
    }

    const session = await getShopOwnerSession();
    if (!session.shopUserId) {
      return { ok: false, error: "You need to be signed in." };
    }

    const user = await prisma.shopUser.findUnique({
      where: { id: session.shopUserId },
      include: { shop: true },
    });
    if (!user) {
      return { ok: false, error: "Session is no longer valid." };
    }
    if (user.shop.slug === PLATFORM_SHOP_SLUG) {
      return { ok: false, error: "Not available for the platform catalog shop." };
    }

    const listing = await prisma.shopListing.findFirst({
      where: {
        shopId: user.shopId,
        ...storefrontShopListingWhere,
        product: { active: true },
      },
      orderBy: { updatedAt: "desc" },
      include: { product: true },
    });

    if (!listing) {
      return {
        ok: false,
        error:
          "No live listing found. Approve a listing and make sure it is active on your storefront first.",
      };
    }

    const p = listing.product;
    const unitPriceCents = listingCartUnitCents(listing, undefined);
    const { name: productName, printifyVariantId: orderPrintifyVariantId } = listingStripeProductName(
      listing,
      undefined,
    );

    if (p.fulfillmentType === FulfillmentType.printify && !orderPrintifyVariantId?.trim()) {
      return {
        ok: false,
        error:
          "That listing is missing a Printify variant id — fix it in admin / listing setup before simulating.",
      };
    }

    const quantity = 1;
    const lineMerchCents = unitPriceCents * quantity;
    let catalogRow: { itemGoodsServicesCostCents: number } | undefined;
    const pick = parseBaselinePick(listing.baselineCatalogPickEncoded ?? "");
    if (pick) {
      catalogRow =
        (await prisma.adminCatalogItem.findUnique({
          where: { id: pick.itemId },
          select: { itemGoodsServicesCostCents: true },
        })) ?? undefined;
    }
    const goodsUnit = baselineGoodsServicesUnitCents({
      baselineCatalogPickEncoded: listing.baselineCatalogPickEncoded,
      selectedVariantId: orderPrintifyVariantId,
      catalogRow,
      productPrintifyVariantsJson: p.printifyVariants,
    });
    const goodsLine = Math.min(lineMerchCents, Math.max(0, goodsUnit) * quantity);
    const { goodsServicesCostCents, platformCutCents, shopCutCents } =
      splitMerchandiseLineForCheckoutCents({
        lineMerchandiseCents: lineMerchCents,
        goodsServicesLineCents: goodsLine,
      });
    const ship = flatShippingCents();
    const tipCents = 0;
    const subtotalCents = lineMerchCents;
    const totalCents = subtotalCents + tipCents + ship;

    const stripeSessionId = `demo_${randomUUID()}`;

    await prisma.$transaction(async (tx) => {
      await tx.order.create({
        data: {
          shopId: user.shopId,
          status: OrderStatus.paid,
          stripeSessionId,
          email: "demo@example.invalid",
          subtotalCents,
          tipCents,
          shippingCents: ship,
          totalCents,
          currency: "usd",
          shippingName: "Demo Buyer",
          lines: {
            create: [
              {
                shopId: user.shopId,
                shopListingId: listing.id,
                productId: p.id,
                quantity,
                unitPriceCents,
                productName,
                fulfillmentType: p.fulfillmentType,
                printifyProductId: listing.listingPrintifyProductId ?? p.printifyProductId,
                printifyVariantId: orderPrintifyVariantId,
                goodsServicesCostCents,
                platformCutCents,
                shopCutCents,
              },
            ],
          },
        },
      });

      if (lineMerchCents > 0) {
        await tx.shop.update({
          where: { id: user.shopId },
          data: { totalSalesCents: { increment: lineMerchCents } },
        });
      }
    });

    revalidatePath("/dashboard");
    revalidatePath("/shops");
    revalidatePath(`/s/${user.shop.slug}`);

    return { ok: true };
  } catch (e) {
    console.error("[simulateShopDemoPurchase]", e);
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      return {
        ok: false,
        error: `Could not save the demo order (${e.code}). Check the database connection and migrations.`,
      };
    }
    if (e instanceof Error && e.message) {
      return { ok: false, error: e.message };
    }
    return { ok: false, error: "Something went wrong creating the demo order." };
  }
}
