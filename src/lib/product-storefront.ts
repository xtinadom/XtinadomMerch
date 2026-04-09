import { prisma } from "@/lib/prisma";

const include = {
  primaryTag: true,
  tags: { include: { tag: true } },
} as const;

export type StorefrontProduct = NonNullable<
  Awaited<ReturnType<typeof loadStorefrontProductBySlug>>
>;

export async function loadStorefrontProductBySlug(slug: string) {
  return prisma.product.findUnique({
    where: { slug, active: true },
    include,
  });
}
