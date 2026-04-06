import type { Audience } from "@/generated/prisma/enums";
import {
  COLLECTION_DOMME_FIELD,
  COLLECTION_SUB_FIELD,
  collectionAssignmentFromAudience,
} from "@/lib/collection-assignment";

type Props = {
  /** When omitted (e.g. create form), both shops default checked. */
  audience?: Audience;
};

export function CollectionAssignmentFields({ audience }: Props) {
  const { sub, domme } = audience
    ? collectionAssignmentFromAudience(audience)
    : { sub: true, domme: true };

  return (
    <fieldset className="space-y-2">
      <legend className="text-xs font-medium text-zinc-500">
        Collection assignment
      </legend>
      <p className="text-[11px] text-zinc-600">
        Choose which shop(s) this product appears in. At least one is required.
      </p>
      <div className="flex flex-wrap gap-4">
        <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
          <input
            type="checkbox"
            name={COLLECTION_SUB_FIELD}
            defaultChecked={sub}
            className="rounded border-zinc-600"
          />
          Sub shop
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
          <input
            type="checkbox"
            name={COLLECTION_DOMME_FIELD}
            defaultChecked={domme}
            className="rounded border-zinc-600"
          />
          Domme shop
        </label>
      </div>
    </fieldset>
  );
}
