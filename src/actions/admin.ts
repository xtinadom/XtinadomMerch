"use server";

import { randomBytes } from "node:crypto";
import { put } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { getAdminSession } from "@/lib/session";
import { Audience, FulfillmentType } from "@/generated/prisma/enums";
import { fetchPrintifyCatalogEnriched } from "@/lib/printify";
import { pickImageForVariant } from "@/lib/printify-catalog";
import { slugify } from "@/lib/slugify";
import {
  parseImageUrlList,
  toGalleryJson,
} from "@/lib/product-media";
import { parseProductTagIdsFromForm } from "@/lib/product-tag-form";
import {
  audienceFromCollectionAssignment,
  parseCollectionAssignmentFromForm,
} from "@/lib/collection-assignment";
import { assertTagsValidForAudience } from "@/actions/admin-tags";

function revalidateShopSurface() {
  revalidatePath("/");
  revalidatePath("/shop/all");
  revalidatePath("/shop/sub");
  revalidatePath("/shop/domme");
  revalidatePath("/cart");
  revalidatePath("/checkout");
}

export async function loginAdmin(
  formData: FormData,
): Promise<{ error: string } | void> {
  const password = String(formData.get("password") ?? "");
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || password !== expected) {
    return { error: "Invalid password." };
  }
  const session = await getAdminSession();
  session.isAdmin = true;
  await session.save();
  redirect("/admin");
}

export async function logoutAdmin() {
  const session = await getAdminSession();
  session.destroy();
  await session.save();
  redirect("/admin/login");
}

const MAX_NAME_LEN = 200;
const MAX_DESC_LEN = 8000;

export async function updateProductDetails(
  productId: string,
  formData: FormData,
): Promise<void> {
  const admin = await getAdminSession();
  if (!admin.isAdmin) return;

  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { tags: true },
  });
  if (!product) return;

  const name = String(formData.get("name") ?? "").trim().slice(0, MAX_NAME_LEN);
  if (!name) return;

  const descRaw = String(formData.get("description") ?? "");
  const description =
    descRaw.trim() === "" ? null : descRaw.trim().slice(0, MAX_DESC_LEN);

  const priceRaw = String(formData.get("price") ?? "").trim();
  const priceFloat = parseFloat(priceRaw.replace(/,/g, ""));
  if (!Number.isFinite(priceFloat) || priceFloat < 0) return;
  const priceCents = Math.round(priceFloat * 100);
  if (priceCents > 99_999_999) return;

  const galleryRaw = String(formData.get("gallery") ?? "");
  const urls = parseImageUrlList(galleryRaw);
  const imageUrl = urls[0] ?? null;
  const imageGallery = toGalleryJson(urls);

  const { sub: colSub, domme: colDomme } =
    parseCollectionAssignmentFromForm(formData);
  const audienceNext = audienceFromCollectionAssignment(colSub, colDomme);
  if (!audienceNext) return;

  const data: Prisma.ProductUpdateInput = {
    name,
    description,
    priceCents,
    imageUrl,
    imageGallery,
    active: formData.get("active") === "on",
    checkoutTipEligible: formData.get("checkoutTipEligible") === "on",
    audience: audienceNext,
  };

  if (
    product.fulfillmentType === FulfillmentType.manual ||
    product.fulfillmentType === FulfillmentType.printify
  ) {
    const payCashApp = formData.get("payCashApp") === "on";
    let payCard = formData.get("payCard") === "on";
    if (!payCard && !payCashApp) payCard = true;
    data.payCard = payCard;
    data.payCashApp = payCashApp;
  }

  const tagIds = parseProductTagIdsFromForm(formData);
  if (tagIds.length > 0) {
    const valid = await assertTagsValidForAudience(audienceNext, tagIds);
    if (!valid.ok) return;
    const primary = tagIds[0]!;
    data.primaryTag = { connect: { id: primary } };
    data.tags = {
      deleteMany: {},
      create: tagIds.map((tagId) => ({ tagId })),
    };
  }

  await prisma.product.update({
    where: { id: productId },
    data,
  });

  revalidatePath("/admin");
  revalidateShopSurface();
  revalidatePath("/product/" + product.slug);

  const tab =
    product.fulfillmentType === FulfillmentType.printify ? "printify" : "manual";
  redirect(
    `/admin?saved=product&tab=${tab}&listing=${encodeURIComponent(productId)}`,
  );
}

/** Stock update from admin form — shows confirmation after save. */
export async function submitManualStockForm(
  productId: string,
  formData: FormData,
): Promise<void> {
  const admin = await getAdminSession();
  if (!admin.isAdmin) return;
  const raw = String(formData.get("stock") ?? "");
  const q = parseInt(raw, 10);
  if (!Number.isFinite(q)) {
    redirect("/admin?tab=manual&stock_err=invalid");
  }
  const r = await updateManualStock(productId, q);
  if (!r.ok) {
    redirect("/admin?tab=manual&stock_err=1");
  }
  redirect("/admin?saved=stock&tab=manual");
}

export async function updateManualStock(productId: string, stockQuantity: number) {
  const admin = await getAdminSession();
  if (!admin.isAdmin) {
    return { ok: false as const, error: "Unauthorized." };
  }
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product || product.fulfillmentType !== "manual") {
    return { ok: false as const, error: "Invalid product." };
  }
  const q = Math.max(0, Math.min(999999, Math.floor(stockQuantity)));
  await prisma.product.update({
    where: { id: productId },
    data: { stockQuantity: q },
  });
  revalidatePath("/admin");
  revalidateShopSurface();
  revalidatePath("/product/" + product.slug);
  return { ok: true as const };
}

export async function createManualUsedProduct(formData: FormData): Promise<void> {
  const admin = await getAdminSession();
  if (!admin.isAdmin) return;

  const name = String(formData.get("name") ?? "").trim().slice(0, MAX_NAME_LEN);
  if (!name) redirect("/admin?create=err&reason=name&tab=manual");

  const descRaw = String(formData.get("description") ?? "");
  const description =
    descRaw.trim() === "" ? null : descRaw.trim().slice(0, MAX_DESC_LEN);

  const priceRaw = String(formData.get("price") ?? "").trim();
  const priceFloat = parseFloat(priceRaw.replace(/,/g, ""));
  if (!Number.isFinite(priceFloat) || priceFloat < 0) {
    redirect("/admin?create=err&reason=price&tab=manual");
  }
  const priceCents = Math.round(priceFloat * 100);
  if (priceCents > 99_999_999) redirect("/admin?create=err&reason=price&tab=manual");

  const galleryRaw = String(formData.get("gallery") ?? "");
  const urls = parseImageUrlList(galleryRaw);
  const stockRaw = parseInt(String(formData.get("stock") ?? "0"), 10);
  const stockQuantity = Number.isFinite(stockRaw)
    ? Math.max(0, Math.min(999999, stockRaw))
    : 0;

  const payCashApp = formData.get("payCashApp") === "on";
  let payCard = formData.get("payCard") === "on";
  if (!payCard && !payCashApp) payCard = true;

  const tagIds = parseProductTagIdsFromForm(formData);
  if (tagIds.length === 0) {
    redirect("/admin?create=err&reason=category&tab=manual");
  }

  const { sub: colSub, domme: colDomme } =
    parseCollectionAssignmentFromForm(formData);
  const audienceNew = audienceFromCollectionAssignment(colSub, colDomme);
  if (!audienceNew) {
    redirect("/admin?create=err&reason=collection&tab=manual");
  }

  const valid = await assertTagsValidForAudience(audienceNew, tagIds);
  if (!valid.ok) {
    redirect("/admin?create=err&reason=category&tab=manual");
  }
  const primary = tagIds[0]!;

  const slug = await uniqueProductSlug(slugify(name));

  await prisma.product.create({
    data: {
      slug,
      name,
      description,
      priceCents,
      imageUrl: urls[0] ?? null,
      imageGallery: toGalleryJson(urls),
      payCard,
      payCashApp,
      audience: audienceNew,
      fulfillmentType: FulfillmentType.manual,
      primaryTagId: primary,
      checkoutTipEligible: formData.get("checkoutTipEligible") === "on",
      tags: { create: tagIds.map((tagId) => ({ tagId })) },
      stockQuantity,
      trackInventory: true,
      active: true,
    },
  });

  revalidatePath("/admin");
  revalidateShopSurface();
  redirect("/admin?create=ok&tab=manual");
}

export async function deleteManualUsedProduct(productId: string): Promise<void> {
  const admin = await getAdminSession();
  if (!admin.isAdmin) return;

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product || product.fulfillmentType !== "manual") return;

  const lines = await prisma.orderLine.count({ where: { productId } });
  if (lines > 0) {
    await prisma.product.update({
      where: { id: productId },
      data: { active: false },
    });
    revalidatePath("/admin");
    revalidateShopSurface();
    revalidatePath("/product/" + product.slug);
    redirect("/admin?delete=archived&tab=manual");
  }

  await prisma.product.delete({ where: { id: productId } });

  revalidatePath("/admin");
  revalidateShopSurface();
  revalidatePath("/product/" + product.slug);
  redirect("/admin?delete=ok&tab=manual");
}

export async function updateProductPrintifyIds(
  productId: string,
  formData: FormData,
): Promise<void> {
  const admin = await getAdminSession();
  if (!admin.isAdmin) return;

  const printifyProductId = String(formData.get("printifyProductId") ?? "").trim();
  const printifyVariantId = String(formData.get("printifyVariantId") ?? "").trim();

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product || product.fulfillmentType !== FulfillmentType.printify) return;

  await prisma.product.update({
    where: { id: productId },
    data: {
      printifyProductId: printifyProductId || null,
      printifyVariantId: printifyVariantId || null,
    },
  });
  revalidatePath("/admin");
  revalidateShopSurface();
  revalidatePath("/product/" + product.slug);
  redirect(
    `/admin?saved=product&tab=printify&listing=${encodeURIComponent(productId)}`,
  );
}

const unmappedPrintifyWhere = {
  fulfillmentType: FulfillmentType.printify,
  printifyProductId: null,
  printifyVariantId: null,
} as const;

async function uniqueProductSlug(base: string): Promise<string> {
  let slug = base.slice(0, 96);
  let n = 0;
  while (await prisma.product.findUnique({ where: { slug } })) {
    n += 1;
    slug = `${base}-${n}`.slice(0, 96);
  }
  return slug;
}

function importAudience(): Audience {
  const v = process.env.PRINTIFY_IMPORT_AUDIENCE?.trim().toLowerCase();
  if (v === "sub" || v === "domme" || v === "both") {
    return v as Audience;
  }
  return Audience.both;
}

async function resolveImportTagId(): Promise<string | null> {
  const slug = process.env.PRINTIFY_IMPORT_TAG_SLUG?.trim() || "mug";
  const tag = await prisma.tag.findUnique({
    where: { slug },
  });
  return tag?.id ?? null;
}

async function deleteOrArchivePrintifyListingById(
  productId: string,
): Promise<"deleted" | "archived" | "noop"> {
  const row = await prisma.product.findUnique({
    where: { id: productId },
    select: { slug: true },
  });
  if (!row) return "noop";

  const lines = await prisma.orderLine.count({ where: { productId } });
  if (lines > 0) {
    await prisma.product.update({
      where: { id: productId },
      data: {
        active: false,
        printifyProductId: null,
        printifyVariantId: null,
        printifyVariants: Prisma.DbNull,
      },
    });
    revalidatePath("/product/" + row.slug);
    return "archived";
  }

  await prisma.product.delete({ where: { id: productId } });
  revalidatePath("/product/" + row.slug);
  return "deleted";
}

/** Printify sync updates omitted tags; storefront groups products by ProductTag rows. */
async function ensurePrintifyProductTagged(
  productId: string,
  fallbackTagId: string,
): Promise<void> {
  const row = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      primaryTagId: true,
      _count: { select: { tags: true } },
    },
  });
  if (!row || row._count.tags > 0) return;
  const tagId = row.primaryTagId ?? fallbackTagId;
  await prisma.product.update({
    where: { id: productId },
    data: {
      primaryTagId: tagId,
      tags: { create: [{ tagId }] },
    },
  });
}

async function archiveOrDeleteOtherPrintifyRows(
  printifyProductId: string,
  keepId: string,
): Promise<void> {
  const others = await prisma.product.findMany({
    where: {
      id: { not: keepId },
      fulfillmentType: FulfillmentType.printify,
      printifyProductId,
    },
  });
  for (const o of others) {
    await deleteOrArchivePrintifyListingById(o.id);
  }
}

export async function syncPrintifyFromCatalog(formData: FormData): Promise<void> {
  const admin = await getAdminSession();
  if (!admin.isAdmin) {
    redirect("/admin/login");
  }

  const shopId = process.env.PRINTIFY_SHOP_ID?.trim();
  if (!shopId) {
    redirect("/admin?tab=printify&sync=err&reason=no_shop");
  }

  const syncModeRaw = String(formData.get("syncMode") ?? "full");
  const syncMode: "full" | "new" | "resync" =
    syncModeRaw === "new" || syncModeRaw === "resync" ? syncModeRaw : "full";
  const importTagId = await resolveImportTagId();
  if (!importTagId) {
    redirect("/admin?tab=printify&sync=err&reason=no_tag");
  }

  let updated = 0;
  let created = 0;
  let skipped = 0;
  let removed = 0;

  const catalog = await fetchPrintifyCatalogEnriched(shopId);
  const catalogIds = new Set(catalog.map((c) => c.id));

  for (const p of catalog) {
    const enabledVariants = p.variants.filter((v) => v.enabled);
    if (enabledVariants.length === 0) {
      if (syncMode !== "new") {
        const noVariantRows = await prisma.product.findMany({
          where: {
            fulfillmentType: FulfillmentType.printify,
            printifyProductId: p.id,
          },
          select: { id: true },
        });
        for (const row of noVariantRows) {
          const outcome = await deleteOrArchivePrintifyListingById(row.id);
          if (outcome === "deleted" || outcome === "archived") {
            removed += 1;
          }
        }
      }
      continue;
    }

    const variantRows = enabledVariants.map((v) => {
      const imageUrl = pickImageForVariant(p.images, v.id);
      const priceCents = v.priceCents > 0 ? v.priceCents : 100;
      return {
        id: String(v.id),
        title: v.title.trim() || `Variant ${v.id}`,
        priceCents,
        imageUrl: imageUrl ?? null,
      };
    });

    const first = variantRows[0]!;
    const galleryUrls: string[] = [];
    const seen = new Set<string>();
    for (const vr of variantRows) {
      if (vr.imageUrl && !seen.has(vr.imageUrl)) {
        seen.add(vr.imageUrl);
        galleryUrls.push(vr.imageUrl);
        if (galleryUrls.length >= 20) break;
      }
    }
    const heroImage =
      first.imageUrl ??
      pickImageForVariant(p.images, enabledVariants[0]!.id) ??
      null;

    const name = p.title.slice(0, MAX_NAME_LEN);
    const variantsJson = variantRows as unknown as Prisma.InputJsonValue;

    const existingForProduct = await prisma.product.findMany({
      where: {
        fulfillmentType: FulfillmentType.printify,
        printifyProductId: p.id,
      },
      orderBy: { createdAt: "asc" },
    });

    if (existingForProduct.length > 0) {
      if (syncMode === "new") {
        skipped += 1;
        continue;
      }
      const preferredSlug = slugify(p.title);
      const keep =
        existingForProduct.find((row) => row.slug === preferredSlug) ??
        existingForProduct[0]!;
      await archiveOrDeleteOtherPrintifyRows(p.id, keep.id);
      await prisma.product.update({
        where: { id: keep.id },
        data: {
          name,
          printifyProductId: p.id,
          printifyVariantId: first.id,
          printifyVariants: variantsJson,
          priceCents: first.priceCents,
          ...(typeof p.description === "string" ? { description: p.description } : {}),
          imageUrl: heroImage,
          imageGallery: toGalleryJson(
            galleryUrls.length > 0 ? galleryUrls : heroImage ? [heroImage] : [],
          ),
          active: true,
        },
      });
      await ensurePrintifyProductTagged(keep.id, importTagId);
      updated += 1;
      continue;
    }

    let match =
      (await prisma.product.findFirst({
        where: { ...unmappedPrintifyWhere, slug: slugify(p.title) },
      })) ?? null;

    if (!match) {
      match = await prisma.product.findFirst({
        where: { ...unmappedPrintifyWhere, name },
      });
    }

    if (match) {
      if (syncMode === "new") {
        skipped += 1;
        continue;
      }
      await prisma.product.update({
        where: { id: match.id },
        data: {
          name,
          printifyProductId: p.id,
          printifyVariantId: first.id,
          printifyVariants: variantsJson,
          priceCents: first.priceCents,
          ...(typeof p.description === "string" ? { description: p.description } : {}),
          imageUrl: heroImage,
          imageGallery: toGalleryJson(
            galleryUrls.length > 0 ? galleryUrls : heroImage ? [heroImage] : [],
          ),
          active: true,
        },
      });
      await ensurePrintifyProductTagged(match.id, importTagId);
      updated += 1;
      continue;
    }

    if (syncMode === "resync") {
      skipped += 1;
      continue;
    }

    const aud = importAudience();
    const slug = await uniqueProductSlug(slugify(p.title));
    await prisma.product.create({
      data: {
        slug,
        name,
        description: p.description,
        priceCents: first.priceCents,
        imageUrl: heroImage,
        imageGallery: toGalleryJson(
          galleryUrls.length > 0 ? galleryUrls : heroImage ? [heroImage] : [],
        ),
        audience: aud,
        fulfillmentType: FulfillmentType.printify,
        primaryTagId: importTagId,
        tags: { create: [{ tagId: importTagId }] },
        printifyProductId: p.id,
        printifyVariantId: first.id,
        printifyVariants: variantsJson,
        stockQuantity: 0,
        trackInventory: false,
        active: true,
      },
    });
    created += 1;
  }

  if (syncMode !== "new") {
    const orphans = await prisma.product.findMany({
      where:
        catalogIds.size > 0
          ? {
              fulfillmentType: FulfillmentType.printify,
              OR: [
                { printifyProductId: null },
                { printifyProductId: { notIn: [...catalogIds] } },
              ],
            }
          : {
              fulfillmentType: FulfillmentType.printify,
            },
      select: { id: true },
    });

    for (const o of orphans) {
      const outcome = await deleteOrArchivePrintifyListingById(o.id);
      if (outcome === "deleted" || outcome === "archived") {
        removed += 1;
      }
    }
  }

  revalidatePath("/admin");
  revalidateShopSurface();
  const allTags = await prisma.tag.findMany({ select: { slug: true } });
  for (const t of allTags) {
    revalidatePath(`/shop/sub/tag/${t.slug}`);
    revalidatePath(`/shop/domme/tag/${t.slug}`);
    revalidatePath(`/shop/tag/${t.slug}`);
  }
  const allSlugs = await prisma.product.findMany({ select: { slug: true } });
  for (const pr of allSlugs) {
    revalidatePath("/product/" + pr.slug);
  }

  redirect(
    `/admin?tab=printify&sync=ok&syncMode=${syncMode}&updated=${updated}&created=${created}&skipped=${skipped}&removed=${removed}`,
  );
}

const MAX_LISTING_UPLOAD_BYTES = 8 * 1024 * 1024;
const LISTING_UPLOAD_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

/** Upload a product listing image to Vercel Blob (requires BLOB_READ_WRITE_TOKEN). */
export async function uploadListingImage(
  formData: FormData,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const admin = await getAdminSession();
  if (!admin.isAdmin) return { ok: false, error: "Unauthorized." };
  if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    return {
      ok: false,
      error:
        "Uploads need BLOB_READ_WRITE_TOKEN (Vercel Blob). Paste image URLs instead, or add the token from your Vercel project.",
    };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "No file uploaded." };
  }
  if (file.size > MAX_LISTING_UPLOAD_BYTES) {
    return { ok: false, error: "File too large (max 8 MB)." };
  }
  if (!LISTING_UPLOAD_MIME.has(file.type)) {
    return { ok: false, error: "Use JPEG, PNG, WebP, or GIF." };
  }

  const ext =
    file.type === "image/jpeg"
      ? "jpg"
      : file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
          ? "webp"
          : "gif";
  const pathname = `listing/${Date.now()}-${randomBytes(8).toString("hex")}.${ext}`;

  const blob = await put(pathname, file, {
    access: "public",
    addRandomSuffix: true,
  });

  return { ok: true, url: blob.url };
}
