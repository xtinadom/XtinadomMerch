/**
 * Split merchandise revenue for one order line: optional goods/services (COGS) retained by the platform,
 * then `MARKETPLACE_PLATFORM_FEE_PERCENT` on the remainder. Values are persisted on `OrderLine`.
 */
export function splitMerchandiseLineForCheckoutCents(params: {
  lineMerchandiseCents: number;
  goodsServicesLineCents: number;
}): { goodsServicesCostCents: number; platformCutCents: number; shopCutCents: number } {
  const M = Math.max(0, Math.round(params.lineMerchandiseCents));
  const gRaw = Math.max(0, Math.round(params.goodsServicesLineCents));
  const goodsServicesCostCents = Math.min(gRaw, M);
  const pool = M - goodsServicesCostCents;

  const raw = process.env.MARKETPLACE_PLATFORM_FEE_PERCENT;
  const pct = raw ? parseInt(raw, 10) : 10;
  const rate = Math.min(100, Math.max(0, Number.isFinite(pct) ? pct : 10)) / 100;
  const platformCutCents = Math.floor(pool * rate);
  const shopCutCents = pool - platformCutCents;
  return { goodsServicesCostCents, platformCutCents, shopCutCents };
}

/**
 * Shop profit for one merchandise unit at list price (same split as checkout / order lines):
 * sale − goods/services − platform fee on the remainder.
 */
export function expectedShopProfitMerchandiseUnitCents(params: {
  listPriceCents: number;
  goodsServicesUnitCents: number;
}): number {
  const { shopCutCents } = splitMerchandiseLineForCheckoutCents({
    lineMerchandiseCents: params.listPriceCents,
    goodsServicesLineCents: params.goodsServicesUnitCents,
  });
  return shopCutCents;
}

/** Back-compat: no goods/services cost (same as passing 0). */
export function splitLineRevenueMerchandiseCents(lineMerchandiseCents: number): {
  platformCutCents: number;
  shopCutCents: number;
} {
  const r = splitMerchandiseLineForCheckoutCents({
    lineMerchandiseCents,
    goodsServicesLineCents: 0,
  });
  return { platformCutCents: r.platformCutCents, shopCutCents: r.shopCutCents };
}
