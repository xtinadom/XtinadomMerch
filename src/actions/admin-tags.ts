"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAdminSessionReadonly } from "@/lib/session";
import { Audience } from "@/generated/prisma/enums";
import { slugify } from "@/lib/slugify";

export type AdminTagActionResult =
  | { ok: true }
  | { ok: false; error: string };

async function tagDuplicate(
  name: string,
  slug: string,
  excludeId?: string,
): Promise<boolean> {
  const dup = await prisma.tag.findFirst({
    where: {
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
      OR: [
        { slug: { equals: slug, mode: "insensitive" } },
        { name: { equals: name, mode: "insensitive" } },
      ],
    },
  });
  return dup !== null;
}

export async function adminCreateTag(
  formData: FormData,
): Promise<AdminTagActionResult> {
  const admin = await getAdminSessionReadonly();
  if (!admin.isAdmin) return { ok: false, error: "Unauthorized." };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "Name is required." };

  let slug = String(formData.get("slug") ?? "").trim();
  if (!slug) slug = slugify(name);
  else slug = slugify(slug);

  if (await tagDuplicate(name, slug)) {
    return { ok: false, error: "tag already exists" };
  }

  const sortRaw = String(formData.get("sortOrder") ?? "99");
  const sortOrder = Number.isFinite(parseInt(sortRaw, 10))
    ? parseInt(sortRaw, 10)
    : 99;

  await prisma.tag.create({
    data: { name, slug, sortOrder },
  });

  revalidatePath("/admin");
  revalidatePath("/shop/all");
  return { ok: true };
}

export async function adminUpdateTag(
  formData: FormData,
): Promise<AdminTagActionResult> {
  const admin = await getAdminSessionReadonly();
  if (!admin.isAdmin) return { ok: false, error: "Unauthorized." };

  const id = String(formData.get("tagId") ?? "").trim();
  if (!id) return { ok: false, error: "Missing tag." };

  const existing = await prisma.tag.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "Tag not found." };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "Name is required." };

  let slug = String(formData.get("slug") ?? "").trim();
  if (!slug) slug = existing.slug;
  slug = slugify(slug);

  if (await tagDuplicate(name, slug, existing.id)) {
    return { ok: false, error: "tag already exists" };
  }

  const sortRaw = String(formData.get("sortOrder") ?? "0");
  const sortOrder = Number.isFinite(parseInt(sortRaw, 10))
    ? parseInt(sortRaw, 10)
    : existing.sortOrder;

  async function parseByItemSpotlight(
    raw: string,
  ): Promise<{ ok: true; id: string | null } | { ok: false; error: string }> {
    const trimmed = raw.trim();
    if (trimmed === "" || trimmed === "__auto__") {
      return { ok: true, id: null };
    }
    const link = await prisma.productTag.findUnique({
      where: { productId_tagId: { productId: trimmed, tagId: id } },
    });
    if (!link) {
      return {
        ok: false,
        error: "Top pick must be a product that has this tag.",
      };
    }
    const product = await prisma.product.findUnique({
      where: { id: trimmed },
      select: { id: true },
    });
    if (!product) {
      return { ok: false, error: "Product not found." };
    }
    return { ok: true, id: trimmed };
  }

  const rawSpotlight = String(
    formData.get("byItemSpotlightProductId") ?? "",
  ).trim();

  const pick = await parseByItemSpotlight(rawSpotlight);
  if (!pick.ok) return { ok: false, error: pick.error };

  await prisma.tag.update({
    where: { id },
    data: {
      name,
      slug,
      sortOrder,
      subCollectionSpotlightProductId: pick.id,
      dommeCollectionSpotlightProductId: pick.id,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/shop/all");
  for (const slugPart of [existing.slug, slug]) {
    revalidatePath(`/shop/tag/${slugPart}`);
  }
  return { ok: true };
}

export async function adminDeleteTag(
  formData: FormData,
): Promise<AdminTagActionResult> {
  const admin = await getAdminSessionReadonly();
  if (!admin.isAdmin) return { ok: false, error: "Unauthorized." };

  const id = String(formData.get("tagId") ?? "").trim();
  if (!id) return { ok: false, error: "Missing tag." };

  const existing = await prisma.tag.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "Tag not found." };

  const used = await prisma.productTag.count({ where: { tagId: id } });
  if (used > 0) {
    return {
      ok: false,
      error: "Remove this tag from all products before deleting.",
    };
  }

  await prisma.tag.delete({ where: { id } });

  revalidatePath("/admin");
  revalidatePath("/shop/all");
  revalidatePath(`/shop/tag/${existing.slug}`);
  return { ok: true };
}

export async function adminCreateTagForm(formData: FormData): Promise<void> {
  const r = await adminCreateTag(formData);
  if (!r.ok) {
    redirect(`/admin?tab=tags&tag_err=${encodeURIComponent(r.error)}#tags`);
  }
  redirect("/admin?tab=tags&tag_saved=created#tags");
}

export async function adminUpdateTagForm(formData: FormData): Promise<void> {
  const savedTagId = String(formData.get("tagId") ?? "").trim();
  const r = await adminUpdateTag(formData);
  if (!r.ok) {
    redirect(`/admin?tab=tags&tag_err=${encodeURIComponent(r.error)}#tags`);
  }
  const q = new URLSearchParams({
    tab: "tags",
    tag_saved: "updated",
    ...(savedTagId ? { saved_tag_id: savedTagId } : {}),
  });
  redirect(`/admin?${q.toString()}#tags`);
}

export async function adminDeleteTagForm(formData: FormData): Promise<void> {
  const r = await adminDeleteTag(formData);
  if (!r.ok) {
    redirect(`/admin?tab=tags&tag_err=${encodeURIComponent(r.error)}#tags`);
  }
  redirect("/admin?tab=tags&tag_saved=deleted#tags");
}

export type AdminEnsureTagRow = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
};

export type AdminEnsureTagByNameResult =
  | { ok: true; tag: AdminEnsureTagRow }
  | { ok: false; error: string };

/** Find existing tag by name/slug (case-insensitive) or create one for listing editors. */
export async function adminEnsureTagByName(
  rawName: string,
): Promise<AdminEnsureTagByNameResult> {
  const admin = await getAdminSessionReadonly();
  if (!admin.isAdmin) return { ok: false, error: "Unauthorized." };

  const name = rawName.trim();
  if (!name) return { ok: false, error: "Name is required." };

  const baseSlug = slugify(name);
  const existing = await prisma.tag.findFirst({
    where: {
      OR: [
        { name: { equals: name, mode: "insensitive" } },
        { slug: { equals: baseSlug, mode: "insensitive" } },
      ],
    },
  });
  if (existing) {
    return {
      ok: true,
      tag: {
        id: existing.id,
        name: existing.name,
        slug: existing.slug,
        sortOrder: existing.sortOrder,
      },
    };
  }

  let slug = baseSlug;
  let n = 2;
  while (await prisma.tag.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${n++}`;
  }

  const created = await prisma.tag.create({
    data: { name, slug, sortOrder: 99 },
  });

  revalidatePath("/admin");
  revalidatePath("/shop/all");

  return {
    ok: true,
    tag: {
      id: created.id,
      name: created.name,
      slug: created.slug,
      sortOrder: created.sortOrder,
    },
  };
}

/** Tags are universal; only require that selected ids exist. */
export async function assertTagsValidForAudience(
  _audience: Audience,
  tagIds: string[],
): Promise<AdminTagActionResult> {
  if (tagIds.length === 0) {
    return { ok: false, error: "Select at least one tag." };
  }
  const tags = await prisma.tag.findMany({
    where: { id: { in: tagIds } },
  });
  if (tags.length !== tagIds.length) {
    return { ok: false, error: "One or more tags are invalid." };
  }
  return { ok: true };
}
