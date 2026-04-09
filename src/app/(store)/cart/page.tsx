import Link from "next/link";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { SHOP_ALL_ROUTE } from "@/lib/constants";
import { getCartSession } from "@/lib/session";
import { setCartQuantity } from "@/actions/cart";
import {
  cartLineUnitPriceCents,
  cartLineVariantSubtitle,
} from "@/lib/printify-variants";
import { getShippingFlatCents } from "@/lib/shipping";
import {
  estimatedTaxCents,
  parseEstimatedSalesTaxRate,
} from "@/lib/checkout-estimates";
import { FulfillmentType } from "@/generated/prisma/enums";
import { CART_MAX_PRINTIFY_LINE_QTY, CART_MAX_MANUAL_LINE_QTY } from "@/lib/cart-limits";

export const dynamic = "force-dynamic";

function formatPrice(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export default async function CartPage() {
  const session = await getCartSession();
  const ids = Object.keys(session.items).filter(
    (id) => (session.items[id]?.quantity ?? 0) > 0,
  );
  const products = await prisma.product.findMany({
    where: { id: { in: ids }, active: true },
    include: { primaryTag: true },
  });

  const rows = products.map((p) => {
    const cartLine = session.items[p.id];
    const q = cartLine?.quantity ?? 0;
    const unit = cartLineUnitPriceCents(p, cartLine);
    const line = unit * q;
    return { product: p, quantity: q, line, unit, variantSub: cartLineVariantSubtitle(p, cartLine) };
  });
  const subtotal = rows.reduce((s, r) => s + r.line, 0);
  const shippingCents = getShippingFlatCents();
  const taxRate = parseEstimatedSalesTaxRate();
  const taxCents = estimatedTaxCents(subtotal, taxRate);
  const estimatedTotal =
    taxCents != null ? subtotal + shippingCents + taxCents : null;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-50">Cart</h1>
      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-500">
          Your cart is empty.{" "}
          <Link href={SHOP_ALL_ROUTE} className="text-rose-400/90 hover:underline">
            Continue shopping
          </Link>
        </p>
      ) : (
        <>
          <ul className="mt-8 divide-y divide-zinc-800 border-y border-zinc-800">
            {rows.map(({ product: p, quantity: q, line, unit, variantSub }) => (
              <li key={p.id} className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <Link
                    href={`/product/${p.slug}`}
                    className="font-medium text-zinc-100 hover:text-rose-300"
                  >
                    {p.name}
                  </Link>
                  <p className="text-xs text-zinc-500">
                    {p.primaryTag?.name ?? "Product"}
                  </p>
                  {variantSub ? (
                    <p className="text-xs text-zinc-400">{variantSub}</p>
                  ) : null}
                  <p className="mt-1 text-sm text-zinc-400">
                    {formatPrice(unit)} each
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                  <form
                    action={async (fd) => {
                      "use server";
                      const n = parseInt(String(fd.get("qty")), 10);
                      if (Number.isFinite(n)) await setCartQuantity(p.id, n);
                    }}
                    className="flex items-center gap-2"
                  >
                    <label className="text-xs text-zinc-500">
                      Qty
                      <input
                        type="number"
                        name="qty"
                        min={1}
                        max={
                          p.fulfillmentType === FulfillmentType.printify
                            ? CART_MAX_PRINTIFY_LINE_QTY
                            : CART_MAX_MANUAL_LINE_QTY
                        }
                        defaultValue={q}
                        className="ml-2 w-16 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm"
                      />
                    </label>
                    <button
                      type="submit"
                      className="rounded-lg bg-zinc-800 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-700"
                    >
                      Update
                    </button>
                  </form>
                  <form
                    action={async () => {
                      "use server";
                      await setCartQuantity(p.id, 0);
                      revalidatePath("/product/" + p.slug);
                    }}
                  >
                    <button
                      type="submit"
                      className="rounded-lg border border-zinc-700 px-3 py-1 text-xs text-rose-400/90 hover:border-rose-800/80 hover:bg-rose-950/40 hover:text-rose-300"
                    >
                      Remove
                    </button>
                  </form>
                  <span className="text-sm text-zinc-300">{formatPrice(line)}</span>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-8 w-full max-w-md sm:ml-auto">
            <div className="rounded-xl border border-zinc-800 p-5 text-sm text-zinc-400">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="text-zinc-200">{formatPrice(subtotal)}</span>
              </div>
              <div className="mt-2 flex justify-between">
                <span>Shipping (flat)</span>
                <span className="text-zinc-200">{formatPrice(shippingCents)}</span>
              </div>
              <div className="mt-2 flex justify-between">
                <span>Estimated sales tax</span>
                {taxCents != null ? (
                  <span className="text-zinc-200">{formatPrice(taxCents)}</span>
                ) : (
                  <span className="text-right text-zinc-500">
                    At checkout
                  </span>
                )}
              </div>
              <div className="mt-3 flex justify-between border-t border-zinc-800 pt-3 font-medium text-zinc-100">
                <span>Estimated total</span>
                <span>
                  {estimatedTotal != null
                    ? formatPrice(estimatedTotal)
                    : `${formatPrice(subtotal + shippingCents)} + tax`}
                </span>
              </div>
              <p className="mt-3 text-xs text-zinc-600">
                Tax is finalized at payment from your shipping address. Shipping is the flat rate used at checkout.
              </p>
            </div>
            <div className="mt-4 flex justify-end">
              <Link
                href="/checkout"
                className="rounded-xl bg-rose-700 px-6 py-3 text-sm font-medium text-white hover:bg-rose-600"
              >
                Checkout
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
