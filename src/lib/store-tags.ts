import { cache } from "react";
import { prisma } from "@/lib/prisma";

/** One Prisma round-trip per request (layout + shop pages share this). */
export const getStoreTags = cache(async () => {
  return prisma.tag.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
});
