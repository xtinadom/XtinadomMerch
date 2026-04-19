import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { createBaselineAdminCatalogFromProducts } from "../src/lib/seed-baseline-admin-catalog";

const TYPE_TAGS: { slug: string; name: string; sortOrder: number }[] = [
  { slug: "mug", name: "Mug", sortOrder: 1 },
  { slug: "t-shirt", name: "T-shirt", sortOrder: 2 },
  { slug: "keychain", name: "Keychain", sortOrder: 3 },
  { slug: "sticker", name: "Sticker", sortOrder: 4 },
  { slug: "canvas-print", name: "Canvas print", sortOrder: 5 },
  { slug: "mousepad", name: "Mousepad", sortOrder: 6 },
  { slug: "no-tag", name: "No tag", sortOrder: 999 },
];

async function main() {
  await prisma.orderLine.deleteMany();
  await prisma.fulfillmentJob.deleteMany();
  await prisma.processedStripeEvent.deleteMany();
  await prisma.order.deleteMany();
  await prisma.adminCatalogItem.deleteMany();
  await prisma.productTag.deleteMany();
  await prisma.product.deleteMany();
  await prisma.tag.deleteMany();

  const tagIds = new Map<string, string>();

  for (const t of TYPE_TAGS) {
    const row = await prisma.tag.create({
      data: {
        slug: t.slug,
        name: t.name,
        sortOrder: t.sortOrder,
      },
    });
    tagIds.set(t.slug, row.id);
  }

  const tid = (slug: string) => tagIds.get(slug)!;

  await prisma.product.create({
    data: {
      slug: "ceramic-mug-photo",
      name: "Ceramic mug (photo print)",
      description: "11oz ceramic mug with gallery-quality print.",
      priceCents: 1899,
      imageUrl: null,
      audience: "sub",
      fulfillmentType: "printify",
      checkoutTipEligible: true,
      primaryTagId: tid("mug"),
      printifyProductId: null,
      printifyVariantId: null,
      stockQuantity: 0,
      trackInventory: false,
      active: true,
      tags: { create: [{ tagId: tid("mug") }] },
    },
  });

  await prisma.product.create({
    data: {
      slug: "canvas-print-12",
      name: 'Canvas print 12"',
      description: "Wrapped canvas, ready to hang.",
      priceCents: 4499,
      imageUrl: null,
      audience: "sub",
      fulfillmentType: "printify",
      checkoutTipEligible: true,
      primaryTagId: tid("canvas-print"),
      printifyProductId: null,
      printifyVariantId: null,
      stockQuantity: 0,
      trackInventory: false,
      active: true,
      tags: { create: [{ tagId: tid("canvas-print") }] },
    },
  });

  await prisma.product.create({
    data: {
      slug: "domme-tee",
      name: "Creator graphic tee",
      description: "Soft cotton tee, printed to order.",
      priceCents: 2999,
      imageUrl: null,
      audience: "domme",
      fulfillmentType: "printify",
      checkoutTipEligible: false,
      primaryTagId: tid("t-shirt"),
      printifyProductId: null,
      printifyVariantId: null,
      stockQuantity: 0,
      trackInventory: false,
      active: true,
      tags: { create: [{ tagId: tid("t-shirt") }] },
    },
  });

  await prisma.product.create({
    data: {
      slug: "domme-mug",
      name: "Creator statement mug",
      description: "Bold design on premium ceramic.",
      priceCents: 1999,
      imageUrl: null,
      audience: "domme",
      fulfillmentType: "printify",
      checkoutTipEligible: false,
      primaryTagId: tid("mug"),
      printifyProductId: null,
      printifyVariantId: null,
      stockQuantity: 0,
      trackInventory: false,
      active: true,
      tags: { create: [{ tagId: tid("mug") }] },
    },
  });

  const adminCatalogCreated = await createBaselineAdminCatalogFromProducts(prisma);
  console.log(
    `Seed complete: tags + sample products + ${adminCatalogCreated} admin catalog list row(s) (creator listing requests).`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
