"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/session";
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
  const admin = await getAdminSession();
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

  await prisma.tag.update({
    where: { id },
    data: { name, slug, sortOrder },
  });

  revalidatePath("/admin");
  revalidatePath("/shop/all");
  revalidatePath("/shop/sub");
  revalidatePath("/shop/domme");
  for (const slugPart of [existing.slug, slug]) {
    revalidatePath(`/shop/sub/tag/${slugPart}`);
    revalidatePath(`/shop/domme/tag/${slugPart}`);
    revalidatePath(`/shop/tag/${slugPart}`);
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
  revalidatePath("/shop/all");
  revalidatePath("/shop/sub");
  revalidatePath("/shop/domme");
  revalidatePath(`/shop/sub/tag/${existing.slug}`);
  revalidatePath(`/shop/domme/tag/${existing.slug}`);
  revalidatePath(`/shop/tag/${existing.slug}`);
  return { ok: true };
}

export async function adminCreateTagForm(formData: FormData): Promise<void> {
  const r = await adminCreateTag(formData);
  if (!r.ok) {
    redirect(`/admin?tag_err=${encodeURIComponent(r.error)}#tags`);
  }
  redirect("/admin#tags");
}

export async function adminUpdateTagForm(formData: FormData): Promise<void> {
  const r = await adminUpdateTag(formData);
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
