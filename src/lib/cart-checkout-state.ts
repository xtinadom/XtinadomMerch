import { getShippingFlatCents } from "@/lib/shipping";
import {
  estimatedTaxCents,
  parseEstimatedSalesTaxRate,
} from "@/lib/checkout-estimates";
import { cartHasTipEligibleProduct } from "@/lib/tip-eligibility";
import { loadActiveCartRows } from "@/lib/cart-rows-active";

export type CartCheckoutLine = {
  productId: string;
  slug: string;
  name: string;
  quantity: number;
  lineCents: number;
  unitCents: number;
  variantSub: string | null;
  primaryTagName: string | null;
  fulfillmentType: string;
};

export type CartCheckoutState = {
  lines: CartCheckoutLine[];
  subtotalCents: number;
  shippingCents: number;
  taxCents: number | null;
  estimatedTotalCents: number | null;
  estimatedSalesTaxRate: number | null;
  tipAllowed: boolean;
};

export async function loadCartCheckoutState(): Promise<CartCheckoutState> {
  const { rows, subtotal } = await loadActiveCartRows();
  const shippingCents = getShippingFlatCents();
  const rate = parseEstimatedSalesTaxRate();
  const taxCents = estimatedTaxCents(subtotal, rate);
  const estimatedTotalCents =
    taxCents != null ? subtotal + shippingCents + taxCents : null;
  const tipAllowed = cartHasTipEligibleProduct(rows.map((r) => r.product));

  return {
    lines: rows.map((r) => ({
      productId: r.product.id,
      slug: r.product.slug,
      name: r.product.name,
      quantity: r.quantity,
      lineCents: r.line,
      unitCents: r.unit,
      variantSub: r.variantSub,
      primaryTagName: r.product.primaryTag?.name ?? null,
      fulfillmentType: r.product.fulfillmentType,
    })),
    subtotalCents: subtotal,
    shippingCents,
    taxCents,
    estimatedTotalCents,
    estimatedSalesTaxRate: rate,
    tipAllowed,
  };
}
