import "dotenv/config";
import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";

function sqliteUrl(): string {
  const fromEnv = process.env.DATABASE_URL;
  const defaultPath = path.join(process.cwd(), "prisma", "dev.db");
  const raw = fromEnv?.trim() || `file:${defaultPath}`;
  if (raw.startsWith("file:")) {
    const w = raw.slice("file:".length).replace(/^\/+/, "");
    const abs = path.isAbsolute(w) ? w : path.join(process.cwd(), w);
    return `file:${abs}`;
  }
  return `file:${path.join(process.cwd(), raw)}`;
}

const adapter = new PrismaBetterSqlite3({ url: sqliteUrl() });
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.orderLine.deleteMany();
  await prisma.fulfillmentJob.deleteMany();
  await prisma.processedStripeEvent.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();

  const photoPrinted = await prisma.category.create({
    data: {
      slug: "photo-printed",
      name: "Photo printed",
      description:
        "Photo printed goods — mugs, mousepads, keychains, canvas prints. Print on demand.",
      sortOrder: 1,
    },
  });

  const used = await prisma.category.create({
    data: {
      slug: "used",
      name: "Used items",
      description: "Shipped directly by Xtinadom. Limited availability.",
      sortOrder: 2,
    },
  });

  const dommeMugs = await prisma.category.create({
    data: {
      slug: "domme-mugs",
      name: "Mugs",
      description: "Domme collection — mugs, print on demand.",
      sortOrder: 3,
    },
  });

  const dommeTees = await prisma.category.create({
    data: {
      slug: "domme-tees",
      name: "Tees",
      description: "Domme collection — tees, print on demand.",
      sortOrder: 4,
    },
  });

  await prisma.category.create({
    data: {
      slug: "domme-website-services",
      name: "Website services",
      description:
        "Custom merch storefronts — Printify, Stripe, and your branding. Request a quote below.",
      sortOrder: 5,
    },
  });

  await prisma.product.createMany({
    data: [
      {
        slug: "ceramic-mug-photo",
        name: "Ceramic mug (photo print)",
        description: "11oz ceramic mug with gallery-quality print.",
        priceCents: 1899,
        imageUrl: null,
        audience: "sub",
        fulfillmentType: "printify",
        categoryId: photoPrinted.id,
        printifyProductId: null,
        printifyVariantId: null,
        stockQuantity: 0,
        trackInventory: false,
        active: true,
      },
      {
        slug: "canvas-print-12",
        name: 'Canvas print 12"',
        description: "Wrapped canvas, ready to hang.",
        priceCents: 4499,
        imageUrl: null,
        audience: "sub",
        fulfillmentType: "printify",
        categoryId: photoPrinted.id,
        printifyProductId: null,
        printifyVariantId: null,
        stockQuantity: 0,
        trackInventory: false,
        active: true,
      },
      {
        slug: "sample-used-item",
        name: "Sample used item",
        description: "Example one-of-a-kind piece. Stock is managed in admin.",
        priceCents: 3500,
        imageUrl: null,
        audience: "sub",
        fulfillmentType: "manual",
        categoryId: used.id,
        stockQuantity: 1,
        trackInventory: true,
        active: true,
      },
      {
        slug: "domme-tee",
        name: "Domme graphic tee",
        description: "Soft cotton tee, printed to order.",
        priceCents: 2999,
        imageUrl: null,
        audience: "domme",
        fulfillmentType: "printify",
        categoryId: dommeTees.id,
        printifyProductId: null,
        printifyVariantId: null,
        stockQuantity: 0,
        trackInventory: false,
        active: true,
      },
      {
        slug: "domme-mug",
        name: "Domme statement mug",
        description: "Bold design on premium ceramic.",
        priceCents: 1999,
        imageUrl: null,
        audience: "domme",
        fulfillmentType: "printify",
        categoryId: dommeMugs.id,
        printifyProductId: null,
        printifyVariantId: null,
        stockQuantity: 0,
        trackInventory: false,
        active: true,
      },
    ],
  });

  console.log("Seed complete: categories + sample products.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
