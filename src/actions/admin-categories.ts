"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/session";
import { slugify } from "@/lib/slugify";
import { CatalogGroup } from "@/generated/prisma/enums";

const MAX_NAME = 120;
const MAX_DESC = 2000;
const MAX_SLUG_LEN = 80;

export type AdminCategoryActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

function revalidateCategorySurface(prevSlug?: string | null, nextSlug?: string | null) {
  if (prevSlug) revalidatePath(`/category/${prevSlug}`);
  if (nextSlug && nextSlug !== prevSlug) revalidatePath(`/category/${nextSlug}`);
  revalidatePath("/shop");
  revalidatePath("/collection/sub");
  revalidatePath("/collection/domme");
  revalidatePath("/cart");
  revalidatePath("/checkout");
  revalidatePath("/admin");
  revalidatePath("/", "layout");
}

async function uniqueCategorySlug(base: string): Promise<string> {
  let s = base.slice(0, MAX_SLUG_LEN);
  let n = 0;
  while (await prisma.category.findUnique({ where: { slug: s } })) {
    n += 1;
    const suffix = `-${n}`;
    s = `${base.slice(0, MAX_SLUG_LEN - suffix.length)}${suffix}`;
  }
  return s;
}

function parseCatalogGroup(raw: string): CatalogGroup | null {
  if (raw === "sub") return CatalogGroup.sub;
  if (raw === "domme") return CatalogGroup.domme;
  return null;
}

export async function adminCreateParentCategory(
  formData: FormData,
): Promise<AdminCategoryActionResult> {
  const admin = await getAdminSession();
  if (!admin.isAdmin) return { ok: false, error: "Not authorized." };

  const group = parseCatalogGroup(String(formData.get("catalogGroup") ?? ""));
  if (!group) return { ok: false, error: "Choose Sub or Domme collection." };

  const name = String(formData.get("name") ?? "").trim().slice(0, MAX_NAME);
  if (!name) return { ok: false, error: "Name is required." };

  let slug = String(formData.get("slug") ?? "").trim().slice(0, MAX_SLUG_LEN);
  if (!slug) slug = slugify(name);
  else slug = slugify(slug);
  if (!slug) return { ok: false, error: "Invalid slug." };

  const sortRaw = String(formData.get("sortOrder") ?? "0").trim();
  const sortOrder = Number.isFinite(Number(sortRaw)) ? Math.floor(Number(sortRaw)) : 0;

  const descRaw = String(formData.get("description") ?? "").trim();
  const description = descRaw ? descRaw.slice(0, MAX_DESC) : null;

  slug = await uniqueCategorySlug(slug);

  const created = await prisma.category.create({
    data: {
      name,
      slug,
      description,
      sortOrder: sortOrder,
      parentId: null,
      catalogGroup: group,
    },
  });

  revalidateCategorySurface(null, slug);
  return { ok: true, id: created.id };
}

export async function adminCreateSubcategory(
  formData: FormData,
): Promise<AdminCategoryActionResult> {
  const admin = await getAdminSession();
  if (!admin.isAdmin) return { ok: false, error: "Not authorized." };

  const parentId = String(formData.get("parentId") ?? "").trim();
  if (!parentId) return { ok: false, error: "Parent category is required." };

  const parent = await prisma.category.findUnique({ where: { id: parentId } });
  if (!parent || parent.parentId !== null) {
    return { ok: false, error: "Invalid parent category." };
  }

  const name = String(formData.get("name") ?? "").trim().slice(0, MAX_NAME);
  if (!name) return { ok: false, error: "Name is required." };

  let slug = String(formData.get("slug") ?? "").trim().slice(0, MAX_SLUG_LEN);
  if (!slug) slug = slugify(name);
  else slug = slugify(slug);
  if (!slug) return { ok: false, error: "Invalid slug." };

  const sortRaw = String(formData.get("sortOrder") ?? "0").trim();
  const sortOrder = Number.isFinite(Number(sortRaw)) ? Math.floor(Number(sortRaw)) : 0;

  const descRaw = String(formData.get("description") ?? "").trim();
  const description = descRaw ? descRaw.slice(0, MAX_DESC) : null;

  slug = await uniqueCategorySlug(slug);

  const created = await prisma.category.create({
    data: {
      name,
      slug,
      description,
      sortOrder,
      parentId: parent.id,
      catalogGroup: null,
    },
  });

  revalidateCategorySurface(parent.slug, slug);
  return { ok: true, id: created.id };
}

export async function adminUpdateCategory(
  formData: FormData,
): Promise<AdminCategoryActionResult> {
  const admin = await getAdminSession();
  if (!admin.isAdmin) return { ok: false, error: "Not authorized." };

  const id = String(formData.get("categoryId") ?? "").trim();
  if (!id) return { ok: false, error: "Missing category." };

  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "Category not found." };

  const prevSlug = existing.slug;

  const name = String(formData.get("name") ?? "").trim().slice(0, MAX_NAME);
  if (!name) return { ok: false, error: "Name is required." };

  let slug = String(formData.get("slug") ?? "").trim();
  if (!slug) return { ok: false, error: "Slug is required." };
  slug = slugify(slug).slice(0, MAX_SLUG_LEN);
  if (!slug) return { ok: false, error: "Invalid slug." };

  if (slug !== existing.slug) {
    const taken = await prisma.category.findUnique({ where: { slug } });
    if (taken) return { ok: false, error: "That slug is already in use." };
  }

  const sortRaw = String(formData.get("sortOrder") ?? "0").trim();
  const sortOrder = Number.isFinite(Number(sortRaw)) ? Math.floor(Number(sortRaw)) : 0;

  const descRaw = String(formData.get("description") ?? "").trim();
  const description = descRaw ? descRaw.slice(0, MAX_DESC) : null;

  const isRoot = existing.parentId === null;
  let catalogGroup = existing.catalogGroup;
  if (isRoot) {
    const g = parseCatalogGroup(String(formData.get("catalogGroup") ?? ""));
    if (!g) return { ok: false, error: "Choose Sub or Domme for this parent category." };
    catalogGroup = g;
  }

  await prisma.category.update({
    where: { id },
    data: {
      name,
      slug,
      description,
      sortOrder,
      ...(isRoot ? { catalogGroup } : {}),
    },
  });

  revalidateCategorySurface(prevSlug, slug);
  return { ok: true };
}

export async function adminDeleteCategory(
  formData: FormData,
): Promise<AdminCategoryActionResult> {
  const admin = await getAdminSession();
  if (!admin.isAdmin) return { ok: false, error: "Not authorized." };

  const id = String(formData.get("categoryId") ?? "").trim();
  if (!id) return { ok: false, error: "Missing category." };

  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "Category not found." };

  const childCount = await prisma.category.count({ where: { parentId: id } });
  if (childCount > 0) {
    return { ok: false, error: "Remove or reassign subcategories first." };
  }

  const productCount = await prisma.product.count({
    where: {
      OR: [
        { categoryId: id },
        { extraCategories: { some: { categoryId: id } } },
      ],
    },
  });
  if (productCount > 0) {
    return { ok: false, error: "Reassign products to another category before deleting." };
  }

  await prisma.category.delete({ where: { id } });

  revalidateCategorySurface(existing.slug, null);
  return { ok: true };
}
