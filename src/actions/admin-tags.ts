"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/session";
import { Audience, CatalogGroup } from "@/generated/prisma/enums";
import { slugify } from "@/lib/slugify";

export type AdminTagActionResult =
  | { ok: true }
  | { ok: false; error: string };

function parseCollection(v: string): CatalogGroup | null {
  const s = v.trim().toLowerCase();
  if (s === "sub") return CatalogGroup.sub;
  if (s === "domme") return CatalogGroup.domme;
  return null;
}

async function uniqueTagSlug(
  collection: CatalogGroup,
  base: string,
): Promise<string> {
  let s = base.slice(0, 80);
  let n = 0;
  while (
    await prisma.tag.findUnique({
      where: { collection_slug: { collection, slug: s } },
    })
  ) {
    n += 1;
    s = `${base}-${n}`.slice(0, 80);
  }
  return s;
}

export async function adminCreateTag(
  formData: FormData,
): Promise<AdminTagActionResult> {
  const admin = await getAdminSession();
  if (!admin.isAdmin) return { ok: false, error: "Unauthorized." };

  const collection = parseCollection(String(formData.get("collection") ?? ""));
  if (!collection) return { ok: false, error: "Choose Sub or Domme." };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "Name is required." };

  let slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  if (!slug) slug = slugify(name);
  slug = await uniqueTagSlug(collection, slugify(slug));

  const sortRaw = String(formData.get("sortOrder") ?? "99");
  const sortOrder = Number.isFinite(parseInt(sortRaw, 10))
    ? parseInt(sortRaw, 10)
    : 99;

  await prisma.tag.create({
    data: { name, slug, sortOrder, collection },
  });

  revalidatePath("/admin");
  revalidatePath("/shop/sub");
  revalidatePath("/shop/domme");
  return { ok: true };
}

export async function adminUpdateTag(
  formData: FormData,
): Promise<AdminTagActionResult> {
  const admin = await getAdminSession();
  if (!admin.isAdmin) return { ok: false, error: "Unauthorized." };

  const id = String(formData.get("tagId") ?? "").trim();
  if (!id) return { ok: false, error: "Missing tag." };

  const existing = await prisma.tag.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "Tag not found." };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "Name is required." };

  let slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  if (!slug) slug = existing.slug;
  slug = slugify(slug);

  if (slug !== existing.slug) {
    const taken = await prisma.tag.findUnique({
      where: {
        collection_slug: { collection: existing.collection, slug },
      },
    });
    if (taken && taken.id !== id) {
      return { ok: false, error: "That slug is already used in this shop." };
    }
  }

  const sortRaw = String(formData.get("sortOrder") ?? "0");
  const sortOrder = Number.isFinite(parseInt(sortRaw, 10))
    ? parseInt(sortRaw, 10)
    : existing.sortOrder;

  await prisma.tag.update({
    where: { id },
    data: { name, slug, sortOrder },
  });

  revalidatePath("/admin");
  revalidatePath("/shop/sub");
  revalidatePath("/shop/domme");
  for (const slugPart of [existing.slug, slug]) {
    revalidatePath(`/shop/sub/tag/${slugPart}`);
    revalidatePath(`/shop/domme/tag/${slugPart}`);
  }
  return { ok: true };
}

export async function adminDeleteTag(
  formData: FormData,
): Promise<AdminTagActionResult> {
  const admin = await getAdminSession();
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
  revalidatePath("/shop/sub");
  revalidatePath("/shop/domme");
  revalidatePath(`/shop/sub/tag/${existing.slug}`);
  revalidatePath(`/shop/domme/tag/${existing.slug}`);
  return { ok: true };
}

export async function adminCreateTagForm(formData: FormData): Promise<void> {
  const r = await adminCreateTag(formData);
  if (!r.ok) {
    redirect(`/admin?tag_err=${encodeURIComponent(r.error)}#tags`);
  }
  redirect("/admin#tags");
}

export async function adminDeleteTagForm(formData: FormData): Promise<void> {
  const r = await adminDeleteTag(formData);
  if (!r.ok) {
    redirect(`/admin?tag_err=${encodeURIComponent(r.error)}#tags`);
  }
  redirect("/admin#tags");
}

/** Ensure tag assignments are allowed for the product audience. */
export async function assertTagsValidForAudience(
  audience: Audience,
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
  for (const t of tags) {
    if (audience === Audience.sub && t.collection !== CatalogGroup.sub) {
      return {
        ok: false,
        error: "Sub products can only use Sub shop tags.",
      };
    }
    if (audience === Audience.domme && t.collection !== CatalogGroup.domme) {
      return {
        ok: false,
        error: "Domme products can only use Domme shop tags.",
      };
    }
  }
  if (audience === Audience.both) {
    const cols = new Set(tags.map((x) => x.collection));
    if (cols.size > 1) {
      return {
        ok: false,
        error: "“Both” products cannot mix Sub and Domme tags — pick one side.",
      };
    }
  }
  return { ok: true };
}
