"use server";

import { randomBytes } from "node:crypto";
import { Buffer } from "node:buffer";
import { revalidatePath } from "next/cache";
import { revalidateAdminViews } from "@/lib/revalidate-admin-views";
import { ADMIN_BACKEND_BASE_PATH } from "@/lib/admin-dashboard-urls";
import { redirect, unstable_rethrow } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { getAdminSession, getAdminSessionReadonly } from "@/lib/session";
import { Audience, FulfillmentType } from "@/generated/prisma/enums";
import {
  fetchPrintifyCatalogEnriched,
  fetchPrintifyProductDetail,
  setPrintifyProductPublishingFailed,
  setPrintifyProductPublishingSucceeded,
  type PrintifyCatalogProduct,
} from "@/lib/printify";
import { pickImageForVariant } from "@/lib/printify-catalog";
import {
  getPrintifyVariantsForProduct,
  parsePrintifyVariantsJson,
} from "@/lib/printify-variants";
import {
  buildListingPrintifyUserUploadKey,
  isPrintifyManagedListingImageUrl,
  mergePrintifyResyncGallery,
  resolvePrintifyPrimaryImageUrl,
} from "@/lib/printify-import-image";
import { pruneOrphanListingImagesFromR2 } from "@/lib/r2-listing-prune";
import {
  deleteListingImagesFromR2,
  isR2UploadConfigured,
  putPublicR2Object,
} from "@/lib/r2-upload";
import { slugify } from "@/lib/slugify";
import {
  parseImageUrlList,
  productAllStoredImageUrls,
  productImageUrlsUnionHero,
  toGalleryJson,
} from "@/lib/product-media";
import { parseDesignNamesFromForm } from "@/lib/product-design-name-form";
import { parseProductTagIdsFromForm } from "@/lib/product-tag-form";
import { toDesignNamesJson } from "@/lib/product-design-names";
import { assertTagsValidForAudience } from "@/actions/admin-tags";
import {
  normalizeProductTagIds,
  resolveNoTagId,
} from "@/lib/no-tag";

function revalidateShopSurface() {
  revalidatePath("/");
  revalidatePath("/shop/all");
  revalidatePath("/cart", "layout");
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
  const admin = await getAdminSessionReadonly();
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

  const printifyVariantRows = getPrintifyVariantsForProduct(product);
  let priceCents: number;
  let printifyVariantsNext: Prisma.InputJsonValue | undefined;

  if (
    product.fulfillmentType === FulfillmentType.printify &&
    printifyVariantRows.length > 0
  ) {
    const nextVariants: {
      id: string;
      title: string;
      priceCents: number;
      imageUrl: string | null;
    }[] = [];
    for (const v of printifyVariantRows) {
      const raw = String(formData.get(`variantPrice_${v.id}`) ?? "").trim();
      const priceFloat = parseFloat(raw.replace(/,/g, ""));
      if (!Number.isFinite(priceFloat) || priceFloat < 0) return;
      const pc = Math.round(priceFloat * 100);
      if (pc > 99_999_999) return;
      nextVariants.push({
        id: v.id,
        title: v.title,
        priceCents: pc,
        imageUrl: v.imageUrl ?? null,
      });
    }
    printifyVariantsNext = nextVariants;
    priceCents = nextVariants[0]!.priceCents;
  } else {
    const priceRaw = String(formData.get("price") ?? "").trim();
    const priceFloat = parseFloat(priceRaw.replace(/,/g, ""));
    if (!Number.isFinite(priceFloat) || priceFloat < 0) return;
    priceCents = Math.round(priceFloat * 100);
    if (priceCents > 99_999_999) return;
  }

  const galleryRaw = String(formData.get("gallery") ?? "");
  const urls = parseImageUrlList(galleryRaw);
  const imageUrl = urls[0] ?? null;
  const imageGallery = toGalleryJson(urls);
  const previousUrls = productAllStoredImageUrls(product);
  const stillReferenced = new Set(urls.map((s) => s.trim()).filter(Boolean));
  for (const v of parsePrintifyVariantsJson(product.printifyVariants)) {
    const u = v.imageUrl?.trim();
    if (u) stillReferenced.add(u);
  }
  const removedImageUrls = previousUrls.filter((u) => !stillReferenced.has(u.trim()));

  const designNameList = parseDesignNamesFromForm(formData);

  const data: Prisma.ProductUpdateInput = {
    name,
    description,
    priceCents,
    imageUrl,
    imageGallery,
    designNames: toDesignNamesJson(designNameList),
    active: formData.get("active") === "on",
    checkoutTipEligible: formData.get("checkoutTipEligible") === "on",
    audience: Audience.both,
    ...(printifyVariantsNext !== undefined
      ? { printifyVariants: printifyVariantsNext }
      : {}),
  };

  const payCashApp = formData.get("payCashApp") === "on";
  let payCard = formData.get("payCard") === "on";
  if (!payCard && !payCashApp) payCard = true;
  data.payCard = payCard;
  data.payCashApp = payCashApp;
  data.trackInventory = false;

  const noTagId = await resolveNoTagId();
  const tagIds = normalizeProductTagIds(
    parseProductTagIdsFromForm(formData),
    noTagId,
  );
  const valid = await assertTagsValidForAudience(Audience.both, tagIds);
  if (!valid.ok) return;
  const primary = tagIds[0]!;
  data.primaryTag = { connect: { id: primary } };
  data.tags = {
    deleteMany: {},
    create: tagIds.map((tagId) => ({ tagId })),
  };

  const slugBase = slugify(name).slice(0, 96);
  const slugNext = await uniqueProductSlug(slugBase, { excludeProductId: productId });
  data.slug = slugNext;

  const previousSlug = product.slug;

  await prisma.product.update({
    where: { id: productId },
    data,
  });

  await deleteListingImagesFromR2(removedImageUrls);

  revalidateAdminViews();
  revalidateShopSurface();
  revalidatePath("/product/" + previousSlug);
  if (slugNext !== previousSlug) {
    revalidatePath("/product/" + slugNext);
  }

  redirect(
    `${ADMIN_BACKEND_BASE_PATH}?saved=product&tab=printify&listing=${encodeURIComponent(productId)}`,
  );
}

export async function updateProductPrintifyIds(
  productId: string,
  formData: FormData,
): Promise<void> {
  const admin = await getAdminSessionReadonly();
  if (!admin.isAdmin) return;

  const printifyProductId = String(formData.get("printifyProductId") ?? "").trim();
  const printifyVariantId = String(formData.get("printifyVariantId") ?? "").trim();

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return;

  await prisma.product.update({
    where: { id: productId },
    data: {
      printifyProductId: printifyProductId || null,
      printifyVariantId: printifyVariantId || null,
      trackInventory: false,
    },
  });
  revalidateAdminViews();
  revalidateShopSurface();
  revalidatePath("/product/" + product.slug);
  redirect(
    `${ADMIN_BACKEND_BASE_PATH}?saved=product&tab=printify&listing=${encodeURIComponent(productId)}`,
  );
}

const unmappedPrintifyWhere = {
  fulfillmentType: FulfillmentType.printify,
  printifyProductId: null,
  printifyVariantId: null,
} as const;

async function uniqueProductSlug(
  base: string,
  options?: { excludeProductId?: string },
): Promise<string> {
  const excludeId = options?.excludeProductId;
  let slug = base.slice(0, 96);
  let n = 0;
  while (true) {
    const row = await prisma.product.findUnique({ where: { slug } });
    if (!row || row.id === excludeId) break;
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

/**
 * Printify full/resync must never `DELETE` a `Product` — `ShopListing` uses onDelete: Cascade
 * and would remove creator rows. Unlinked / duplicate / orphan rows are only deactivated and
 * stripped of Printify ids (same as the former “archive” path).
 */
async function deleteOrArchivePrintifyListingById(
  productId: string,
): Promise<"archived" | "noop"> {
  const row = await prisma.product.findUnique({
    where: { id: productId },
    select: { slug: true },
  });
  if (!row) return "noop";

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

async function ensurePrintifyProductTagged(productId: string): Promise<void> {
  const noTagId = await resolveNoTagId();
  const row = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      primaryTagId: true,
      _count: { select: { tags: true } },
    },
  });
  if (!row || row._count.tags > 0) return;
  const tagId = row.primaryTagId ?? noTagId;
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

type SyncOnePrintifyRowResult = {
  updated: number;
  created: number;
  skipped: number;
  removed: number;
};

async function processOnePrintifyCatalogProduct(
  p: PrintifyCatalogProduct,
  syncMode: "full" | "new" | "resync" | "single",
  noTagId: string,
): Promise<SyncOnePrintifyRowResult> {
  let updated = 0;
  let created = 0;
  let skipped = 0;
  let removed = 0;

  /** Resync / single: keep storefront title, description. Gallery always merges a fresh Printify hero with manual uploads. */
  const resyncPreservesStorefront = syncMode === "resync" || syncMode === "single";

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
        if (outcome === "archived") {
          removed += 1;
        }
      }
    }
    return { updated, created, skipped, removed };
  }

  const variantRows = enabledVariants.map((v) => {
    const imageUrl = pickImageForVariant(p.images, v.id);
    const priceCents = v.priceCents > 0 ? v.priceCents : 100;
    return {
      id: String(v.id),
      title: v.title.trim() || `Variant ${v.id}`,
      priceCents,
      imageUrl: imageUrl ?? null,
      sku: v.sku ?? null,
    };
  });

  const first = variantRows[0]!;
  const heroImage =
    first.imageUrl ??
    pickImageForVariant(p.images, enabledVariants[0]!.id) ??
    null;
  const primaryImageUrl = await resolvePrintifyPrimaryImageUrl(heroImage, p.id);

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
      return { updated: 0, created: 0, skipped: 1, removed: 0 };
    }
    const preferredSlug = slugify(p.title);
    const keep =
      existingForProduct.find((row) => row.slug === preferredSlug) ??
      existingForProduct[0]!;
    await archiveOrDeleteOtherPrintifyRows(p.id, keep.id);
    const previousAll = productAllStoredImageUrls(keep);
    const nextUrls = mergePrintifyResyncGallery(
      productImageUrlsUnionHero(keep),
      primaryImageUrl,
    );
    const variantImageUrls = variantRows
      .map((v) => v.imageUrl?.trim())
      .filter((u): u is string => Boolean(u));
    const nextSet = new Set(
      [...nextUrls, ...variantImageUrls].map((x) => x.trim()).filter(Boolean),
    );
    const printifyOrphansToDelete = previousAll.filter(
      (u) => isPrintifyManagedListingImageUrl(u) && !nextSet.has(u.trim()),
    );
    await prisma.product.update({
      where: { id: keep.id },
      data: {
        ...(resyncPreservesStorefront ? {} : { name }),
        printifyProductId: p.id,
        printifyVariantId: first.id,
        printifyVariants: variantsJson,
        priceCents: first.priceCents,
        ...(resyncPreservesStorefront
          ? {}
          : typeof p.description === "string"
            ? { description: p.description }
            : {}),
        imageUrl: nextUrls[0] ?? null,
        imageGallery: toGalleryJson(nextUrls),
        active: true,
        trackInventory: false,
      },
    });
    await deleteListingImagesFromR2(printifyOrphansToDelete);
    await ensurePrintifyProductTagged(keep.id);
    return { updated: 1, created: 0, skipped: 0, removed: 0 };
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
      return { updated: 0, created: 0, skipped: 1, removed: 0 };
    }
    const previousAll = productAllStoredImageUrls(match);
    const nextUrls = mergePrintifyResyncGallery(
      productImageUrlsUnionHero(match),
      primaryImageUrl,
    );
    const variantImageUrls = variantRows
      .map((v) => v.imageUrl?.trim())
      .filter((u): u is string => Boolean(u));
    const nextSet = new Set(
      [...nextUrls, ...variantImageUrls].map((x) => x.trim()).filter(Boolean),
    );
    const printifyOrphansToDelete = previousAll.filter(
      (u) => isPrintifyManagedListingImageUrl(u) && !nextSet.has(u.trim()),
    );
    await prisma.product.update({
      where: { id: match.id },
      data: {
        ...(resyncPreservesStorefront ? {} : { name }),
        printifyProductId: p.id,
        printifyVariantId: first.id,
        printifyVariants: variantsJson,
        priceCents: first.priceCents,
        ...(resyncPreservesStorefront
          ? {}
          : typeof p.description === "string"
            ? { description: p.description }
            : {}),
        imageUrl: nextUrls[0] ?? null,
        imageGallery: toGalleryJson(nextUrls),
        active: true,
        trackInventory: false,
      },
    });
    await deleteListingImagesFromR2(printifyOrphansToDelete);
    await ensurePrintifyProductTagged(match.id);
    return { updated: 1, created: 0, skipped: 0, removed: 0 };
  }

  if (syncMode === "resync" || syncMode === "single") {
    return { updated: 0, created: 0, skipped: 1, removed: 0 };
  }

  const aud = importAudience();
  const slug = await uniqueProductSlug(slugify(p.title));
  await prisma.product.create({
    data: {
      slug,
      name,
      description: p.description,
      priceCents: first.priceCents,
      imageUrl: primaryImageUrl,
      imageGallery: toGalleryJson(primaryImageUrl ? [primaryImageUrl] : []),
      audience: aud,
      fulfillmentType: FulfillmentType.printify,
      primaryTagId: noTagId,
      tags: { create: [{ tagId: noTagId }] },
      printifyProductId: p.id,
      printifyVariantId: first.id,
      printifyVariants: variantsJson,
      stockQuantity: 0,
      trackInventory: false,
      active: true,
    },
  });
  return { updated: 0, created: 1, skipped: 0, removed: 0 };
}

async function revalidatePrintifyDependentPaths(): Promise<void> {
  revalidateAdminViews();
  revalidateShopSurface();
  const allTags = await prisma.tag.findMany({ select: { slug: true } });
  for (const t of allTags) {
    revalidatePath(`/shop/tag/${t.slug}`);
  }
  const allSlugs = await prisma.product.findMany({ select: { slug: true } });
  for (const pr of allSlugs) {
    revalidatePath("/product/" + pr.slug);
  }
}

export async function syncPrintifyFromCatalog(formData: FormData): Promise<void> {
  const admin = await getAdminSessionReadonly();
  if (!admin.isAdmin) {
    redirect("/admin/login");
  }

  const shopId = process.env.PRINTIFY_SHOP_ID?.trim();
  if (!shopId) {
    redirect(`${ADMIN_BACKEND_BASE_PATH}?tab=printify&sync=err&reason=no_shop`);
  }

  const syncModeRaw = String(formData.get("syncMode") ?? "full");
  const syncMode: "full" | "new" | "resync" | "single" =
    syncModeRaw === "new" || syncModeRaw === "resync" || syncModeRaw === "single"
      ? syncModeRaw
      : "full";
  const noTagId = await resolveNoTagId();

  let updated = 0;
  let created = 0;
  let skipped = 0;
  let removed = 0;

  const catalog = await fetchPrintifyCatalogEnriched(shopId, {
    forceProductDetail: syncMode === "full" || syncMode === "resync",
  });
  const catalogIds = new Set(catalog.map((c) => c.id));

  for (const p of catalog) {
    const r = await processOnePrintifyCatalogProduct(p, syncMode, noTagId);
    updated += r.updated;
    created += r.created;
    skipped += r.skipped;
    removed += r.removed;
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
      if (outcome === "archived") {
        removed += 1;
      }
    }
  }

  await revalidatePrintifyDependentPaths();

  const fullSyncAtQuery =
    syncMode === "full"
      ? `&fullSyncAt=${encodeURIComponent(new Date().toISOString())}`
      : "";
  redirect(
    `${ADMIN_BACKEND_BASE_PATH}?tab=printify&sync=ok&syncMode=${syncMode}&updated=${updated}&created=${created}&skipped=${skipped}&removed=${removed}${fullSyncAtQuery}`,
  );
}

export async function resyncPrintifyCatalogProduct(formData: FormData): Promise<void> {
  const admin = await getAdminSessionReadonly();
  if (!admin.isAdmin) {
    redirect("/admin/login");
  }

  const printifyProductId = String(formData.get("printifyProductId") ?? "").trim();
  if (!printifyProductId) {
    redirect(`${ADMIN_BACKEND_BASE_PATH}?tab=printify&sync=err&reason=no_product`);
  }

  const shopId = process.env.PRINTIFY_SHOP_ID?.trim();
  if (!shopId) {
    redirect(`${ADMIN_BACKEND_BASE_PATH}?tab=printify&sync=err&reason=no_shop`);
  }

  const noTagId = await resolveNoTagId();

  const p = await fetchPrintifyProductDetail(shopId, printifyProductId);
  if (!p) {
    redirect(`${ADMIN_BACKEND_BASE_PATH}?tab=printify&sync=err&reason=catalog_not_found`);
  }

  const r = await processOnePrintifyCatalogProduct(p, "single", noTagId);

  await revalidatePrintifyDependentPaths();

  redirect(
    `${ADMIN_BACKEND_BASE_PATH}?tab=printify&sync=ok&syncMode=single&updated=${r.updated}&created=${r.created}&skipped=${r.skipped}&removed=${r.removed}&printifyId=${encodeURIComponent(printifyProductId)}`,
  );
}

export async function adminPruneOrphanListingImagesR2(formData: FormData): Promise<void> {
  const admin = await getAdminSessionReadonly();
  if (!admin.isAdmin) {
    redirect("/admin/login");
  }

  const intent = String(formData.get("intent") ?? "preview").trim();
  const dryRun = intent !== "delete";

  if (dryRun === false && formData.get("confirm") !== "on") {
    redirect(`${ADMIN_BACKEND_BASE_PATH}?tab=printify&r2Prune=err&r2PruneReason=confirm_required`);
  }

  if (!isR2UploadConfigured()) {
    redirect(`${ADMIN_BACKEND_BASE_PATH}?tab=printify&r2Prune=err&r2PruneReason=no_r2`);
  }

  try {
    const r = await pruneOrphanListingImagesFromR2({ dryRun });
    const q = new URLSearchParams({
      tab: "printify",
      r2Prune: dryRun ? "preview" : "ok",
      r2Listed: String(r.listedObjectCount),
      r2Ref: String(r.referencedKeyCount),
      r2Orphans: String(r.orphanKeyCount),
      r2Deleted: String(r.deletedCount),
    });
    redirect(`${ADMIN_BACKEND_BASE_PATH}?${q.toString()}`);
  } catch (e) {
    unstable_rethrow(e);
    const msg = e instanceof Error ? e.message : String(e);
    redirect(
      `${ADMIN_BACKEND_BASE_PATH}?tab=printify&r2Prune=err&r2PruneReason=${encodeURIComponent(msg.replace(/\s+/g, " ").slice(0, 240))}`,
    );
  }
}

export async function notifyPrintifyPublishingSucceeded(formData: FormData): Promise<void> {
  const admin = await getAdminSessionReadonly();
  if (!admin.isAdmin) {
    redirect("/admin/login");
  }

  const printifyProductId = String(formData.get("printifyProductId") ?? "").trim();
  const shopId = process.env.PRINTIFY_SHOP_ID?.trim();
  if (!shopId) {
    redirect(`${ADMIN_BACKEND_BASE_PATH}?tab=printify&pub=err&pubReason=no_shop`);
  }
  if (!printifyProductId) {
    redirect(`${ADMIN_BACKEND_BASE_PATH}?tab=printify&pub=err&pubReason=no_product`);
  }

  const r = await setPrintifyProductPublishingSucceeded(shopId, printifyProductId);
  if (!r.ok) {
    redirect(
      `${ADMIN_BACKEND_BASE_PATH}?tab=printify&pub=err&pubReason=api&pubPid=${encodeURIComponent(printifyProductId)}&pubDetail=${encodeURIComponent(r.body.replace(/\s+/g, " ").slice(0, 280))}`,
    );
  }

  redirect(
    `${ADMIN_BACKEND_BASE_PATH}?tab=printify&pub=ok&pubKind=succeeded&pubPid=${encodeURIComponent(printifyProductId)}`,
  );
}

export async function notifyPrintifyPublishingFailed(formData: FormData): Promise<void> {
  const admin = await getAdminSessionReadonly();
  if (!admin.isAdmin) {
    redirect("/admin/login");
  }

  const printifyProductId = String(formData.get("printifyProductId") ?? "").trim();
  const shopId = process.env.PRINTIFY_SHOP_ID?.trim();
  if (!shopId) {
    redirect(`${ADMIN_BACKEND_BASE_PATH}?tab=printify&pub=err&pubReason=no_shop`);
  }
  if (!printifyProductId) {
    redirect(`${ADMIN_BACKEND_BASE_PATH}?tab=printify&pub=err&pubReason=no_product`);
  }

  const r = await setPrintifyProductPublishingFailed(shopId, printifyProductId);
  if (!r.ok) {
    redirect(
      `${ADMIN_BACKEND_BASE_PATH}?tab=printify&pub=err&pubReason=api&pubPid=${encodeURIComponent(printifyProductId)}&pubDetail=${encodeURIComponent(r.body.replace(/\s+/g, " ").slice(0, 280))}`,
    );
  }

  redirect(
    `${ADMIN_BACKEND_BASE_PATH}?tab=printify&pub=ok&pubKind=failed&pubPid=${encodeURIComponent(printifyProductId)}`,
  );
}

const MAX_LISTING_UPLOAD_BYTES = 8 * 1024 * 1024;
const LISTING_UPLOAD_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export async function uploadListingImage(
  formData: FormData,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const admin = await getAdminSessionReadonly();
  if (!admin.isAdmin) return { ok: false, error: "Unauthorized." };
  if (!isR2UploadConfigured()) {
    return {
      ok: false,
      error:
        "Set R2_ACCOUNT_ID (or R2_ENDPOINT), R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, and R2_PUBLIC_BASE_URL — or paste image URLs.",
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

  const listingUploadVariant = String(formData.get("listingUploadVariant") ?? "").trim();
  const printifyProductIdForUpload = String(formData.get("printifyProductId") ?? "").trim();
  const key =
    listingUploadVariant === "printify"
      ? buildListingPrintifyUserUploadKey(
          printifyProductIdForUpload || null,
          ext,
        )
      : `listing/${Date.now()}-${randomBytes(8).toString("hex")}.${ext}`;

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const url = await putPublicR2Object({
      key,
      body: buf,
      contentType: file.type,
    });
    return { ok: true, url };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `R2 upload failed: ${msg}` };
  }
}
