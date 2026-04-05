import { Audience, CatalogGroup } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

export function audienceWhereForCollection(
  collection: CatalogGroup,
): Prisma.ProductWhereInput["audience"] {
  if (collection === CatalogGroup.sub) {
    return { in: [Audience.sub, Audience.both] };
  }
  return { in: [Audience.domme, Audience.both] };
}
