export function getShippingFlatCents() {
  const raw = process.env.SHIPPING_FLAT_CENTS;
  const n = raw ? parseInt(raw, 10) : 500;
  return Number.isFinite(n) && n >= 0 ? n : 500;
}
