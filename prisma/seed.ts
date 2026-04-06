import "dotenv/config";
import { prisma } from "../src/lib/prisma";

const TYPE_TAGS: { slug: string; name: string; sortOrder: number }[] = [
  { slug: "mug", name: "Mug", sortOrder: 1 },
  { slug: "t-shirt", name: "T-shirt", sortOrder: 2 },
  { slug: "keychain", name: "Keychain", sortOrder: 3 },
  { slug: "sticker", name: "Sticker", sortOrder: 4 },
  { slug: "canvas-print", name: "Canvas print", sortOrder: 5 },
  { slug: "mousepad", name: "Mousepad", sortOrder: 6 },
];

async function main() {
  await prisma.orderLine.deleteMany();
  await prisma.fulfillmentJob.deleteMany();
  await prisma.processedStripeEvent.deleteMany();
  await prisma.order.deleteMany();
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
      slug: "sample-used-item",
      name: "Sample used item",
      description: "Example one-of-a-kind piece. Stock is managed in admin.",
      priceCents: 3500,
      imageUrl: null,
      audience: "sub",
      fulfillmentType: "manual",
      checkoutTipEligible: true,
      primaryTagId: tid("sticker"),
      stockQuantity: 1,
      trackInventory: true,
      active: true,
      tags: { create: [{ tagId: tid("sticker") }] },
    },
  });

  await prisma.product.create({
    data: {
      slug: "domme-tee",
      name: "Domme graphic tee",
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
      name: "Domme statement mug",
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

  console.log("Seed complete: tags + sample products.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
