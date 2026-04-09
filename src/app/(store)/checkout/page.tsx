import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { SHOP_ALL_ROUTE } from "@/lib/constants";
import { getCartSession } from "@/lib/session";
import { cartHasTipEligibleProduct } from "@/lib/tip-eligibility";
import { cartLineUnitPriceCents } from "@/lib/printify-variants";
import { getShippingFlatCents } from "@/lib/shipping";
import { parseEstimatedSalesTaxRate } from "@/lib/checkout-estimates";
import { CheckoutForm } from "@/components/CheckoutForm";

export const dynamic = "force-dynamic";

function formatPrice(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export default async function CheckoutPage() {
  const session = await getCartSession();
  const ids = Object.keys(session.items).filter(
    (id) => (session.items[id]?.quantity ?? 0) > 0,
  );
  const products = await prisma.product.findMany({
    where: { id: { in: ids }, active: true },
  });

  if (ids.length === 0 || products.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-zinc-50">Checkout</h1>
        <p className="mt-4 text-sm text-zinc-500">
          Your cart is empty.{" "}
          <Link href={SHOP_ALL_ROUTE} className="text-rose-400/90 hover:underline">
            Browse all products
          </Link>
        </p>
      </div>
    );
  }

  let subtotalCents = 0;
  for (const p of products) {
    const cartLine = session.items[p.id];
    const q = cartLine?.quantity ?? 0;
    subtotalCents += cartLineUnitPriceCents(p, cartLine) * q;
  }

  const tipAllowed = cartHasTipEligibleProduct(products);
  const shippingCents = getShippingFlatCents();
  const estimatedSalesTaxRate = parseEstimatedSalesTaxRate();

  const allowCard = products.every((p) => p.payCard);
  const allowCashApp = products.every((p) => p.payCashApp);
  const paymentLabels: string[] = [];
  if (allowCard) paymentLabels.push("card");
  if (allowCashApp) paymentLabels.push("Cash App");
  const paymentNote =
    paymentLabels.length > 0
      ? paymentLabels.join(" and ")
      : "card";

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-50">Checkout</h1>
      <p className="mt-2 text-sm text-zinc-500">
        Review your order. Shipping is a flat {formatPrice(shippingCents)} at payment. Stripe will offer:{" "}
        <span className="text-zinc-400">{paymentNote}</span> (all items in the cart must allow each method).
      </p>

      <ul className="mt-8 space-y-3 rounded-xl border border-zinc-800 p-4 text-sm">
        {products.map((p) => {
          const cartLine = session.items[p.id];
          const q = cartLine?.quantity ?? 0;
          const unit = cartLineUnitPriceCents(p, cartLine);
          return (
            <li key={p.id} className="flex justify-between text-zinc-300">
              <span>
                {p.name} × {q}
              </span>
              <span>{formatPrice(unit * q)}</span>
            </li>
          );
        })}
      </ul>

      <div className="mt-8 max-w-md">
        <CheckoutForm
          tipAllowed={tipAllowed}
          subtotalCents={subtotalCents}
          shippingCents={shippingCents}
          estimatedSalesTaxRate={estimatedSalesTaxRate}
        />
      </div>

      <Link
        href="/cart"
        className="mt-6 inline-block text-xs text-zinc-600 hover:text-zinc-400"
      >
        ← Back to cart
      </Link>
    </div>
  );
}
