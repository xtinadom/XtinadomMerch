"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import type { FeaturedCarouselItem } from "@/lib/shop-featured-carousel";
import { PLATFORM_SHOP_SLUG, productHref } from "@/lib/marketplace-constants";

const ROTATE_MS = 2500;
const ADVANCE_DURATION_MS = 560;
const EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

/** Default layout: large center square + smaller side squares. Base ≈ 70% of original. */
const DEFAULT_CENTER_PX = Math.round(300 * 0.7);
const DEFAULT_SLIDE_GAP_PX = Math.round(40 * 0.7);

/** Same formula as side rails: scales with center tile. */
function sidePxFromCenter(centerPx: number): number {
  return Math.round(centerPx * (200 / 448) * 1.2);
}

/** Side-rail width for the default (non-compact) carousel — compact mode uses this as hero size so it matches those rails. */
const DEFAULT_SIDE_PX = sidePxFromCenter(DEFAULT_CENTER_PX);

function carouselTileMetrics(compact: boolean): {
  centerPx: number;
  sidePx: number;
  slideGapPx: number;
} {
  const centerPx = compact ? DEFAULT_SIDE_PX : DEFAULT_CENTER_PX;
  const sidePx = sidePxFromCenter(centerPx);
  const slideGapPx = compact ? DEFAULT_SLIDE_GAP_PX / 2 : DEFAULT_SLIDE_GAP_PX;
  return { centerPx, sidePx, slideGapPx };
}

type Props = {
  items: FeaturedCarouselItem[];
  /** Small uppercase kicker above the row (e.g. “Top sellers”). */
  eyebrow?: string;
  /**
   * When false, show a small uppercase kicker above the row (default: hidden so section headings aren’t duplicated).
   */
  hideKicker?: boolean;
  /** Screen-reader label for the carousel region. */
  label?: string;
  /**
   * When items omit `listingShopSlug`, product links use this shop (e.g. creator `/s/...` “All products”).
   * Falls back to platform `/product/...` when unset.
   */
  defaultListingShopSlug?: string;
  /** Half-size tiles and tighter gap (e.g. featured shops on platform home). */
  compact?: boolean;
};

function carouselItemHref(item: FeaturedCarouselItem, defaultListingShopSlug?: string): string {
  if (item.href) return item.href;
  return productHref(
    item.listingShopSlug ?? defaultListingShopSlug ?? PLATFORM_SHOP_SLUG,
    item.slug,
  );
}

export function FeaturedProductsCarousel({
  items,
  eyebrow = "Featured",
  hideKicker = true,
  label = "Featured products",
  defaultListingShopSlug,
  compact = false,
}: Props) {
  const { centerPx, sidePx, slideGapPx } = carouselTileMetrics(compact);
  const dx = -(slideGapPx + centerPx / 2 + sidePx / 2);

  const n = items.length;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [isMd, setIsMd] = useState(false);
  const [phase, setPhase] = useState<"idle" | "advancing">("idle");
  const [animArmed, setAnimArmed] = useState(false);
  const centerMotionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = () => setIsMd(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const scaleCenterToSide = sidePx / centerPx;
  const scaleSideToCenter = centerPx / sidePx;

  const beginAdvance = useCallback(() => {
    if (n <= 1 || phase !== "idle") return;
    if (paused) return;
    if (reduceMotion || !isMd) {
      setIndex((i) => (i + 1) % n);
      return;
    }
    setAnimArmed(false);
    setPhase("advancing");
  }, [n, phase, paused, reduceMotion, isMd]);

  /** Arm motion in the same layout pass as `advancing` so opacity + transform start together (no extra frame). */
  useLayoutEffect(() => {
    if (phase !== "advancing" || animArmed) return;
    const node = centerMotionRef.current;
    if (node) void node.offsetWidth;
    setAnimArmed(true);
  }, [phase, animArmed]);

  useEffect(() => {
    if (phase !== "advancing" || !animArmed) return;
    const node = centerMotionRef.current;
    let finished = false;

    const commit = () => {
      if (finished) return;
      finished = true;
      setIndex((i) => (i + 1) % n);
      setPhase("idle");
      setAnimArmed(false);
    };

    const onTransitionEnd = (e: TransitionEvent) => {
      if (e.target !== node) return;
      if (e.propertyName !== "transform") return;
      commit();
    };

    node?.addEventListener("transitionend", onTransitionEnd);
    const fallback = window.setTimeout(commit, ADVANCE_DURATION_MS + 80);

    return () => {
      node?.removeEventListener("transitionend", onTransitionEnd);
      window.clearTimeout(fallback);
    };
  }, [phase, animArmed, n]);

  useEffect(() => {
    if (n <= 1 || reduceMotion || paused) return;
    const t = window.setInterval(beginAdvance, ROTATE_MS);
    return () => window.clearInterval(t);
  }, [n, reduceMotion, paused, beginAdvance]);

  const preloadUrlsJson =
    n > 1
      ? JSON.stringify(
          [1, 2, 3].map((k) => items[(index + k) % n]?.imageUrl ?? ""),
        )
      : "";
  useEffect(() => {
    if (!preloadUrlsJson) return;
    const urls = JSON.parse(preloadUrlsJson) as string[];
    for (const u of urls) {
      if (!u) continue;
      const img = new Image();
      img.src = u;
    }
  }, [preloadUrlsJson]);

  if (n === 0) return null;

  const prev = n > 1 ? items[(index - 1 + n) % n] : null;
  const curr = items[index];
  const next = n > 1 ? items[(index + 1) % n] : null;

  const frameStyle = {
    "--fc-center": `${centerPx}px`,
    "--fc-side": `${sidePx}px`,
  } as CSSProperties;

  /** Advance step is active (dims + left fade start immediately). */
  const motionLive = phase === "advancing";
  /** FLIP transform armed after layout flush — same instant as motionLive in practice. */
  const transformLive = motionLive && animArmed;

  /** Incoming slide (`next`): show caption & dot as soon as the rail moves; `index`/`curr` lag until transition end. */
  const captionItem = n > 1 && transformLive && next ? next : curr;
  const activeDotIndex = n > 1 && transformLive ? (index + 1) % n : index;

  const transformTransition = transformLive
    ? `transform ${ADVANCE_DURATION_MS}ms ${EASING}`
    : "transform 0ms";
  const opacityEase = `opacity ${ADVANCE_DURATION_MS}ms ${EASING}`;
  const opacityTransition = motionLive ? opacityEase : "opacity 0ms";
  const centerDimTransition = motionLive ? opacityEase : "opacity 0ms";

  const centerMotion: CSSProperties = transformLive
    ? {
        transform: `translateX(${dx}px) scale(${scaleCenterToSide})`,
        transition: transformTransition,
        transformOrigin: "center center",
        willChange: "transform",
      }
    : {
        transform: "none",
        transition: "transform 0ms",
        transformOrigin: "center center",
        willChange: "auto",
      };

  /** Hero dims like side rails: same opacity as idle rail tiles (no grayscale). */
  const centerCardTone: CSSProperties = motionLive
    ? {
        opacity: 0.4,
        transition: centerDimTransition,
      }
    : {
        opacity: 1,
        transition: centerDimTransition,
      };

  /** Opacity goes full when the rail transform runs. */
  const rightMotion: CSSProperties = transformLive
    ? {
        transform: `translateX(${dx}px) scale(${scaleSideToCenter})`,
        opacity: 1,
        transition: transformTransition,
        transformOrigin: "center center",
        willChange: "transform",
      }
    : {
        transform: "none",
        opacity: 0.4,
        transition: "transform 0ms, opacity 0ms",
        transformOrigin: "center center",
        willChange: "auto",
      };

  /** Left rail fades in lockstep with center hero dim — both keyed off `motionLive`, not transform arm. */
  const leftMotion: CSSProperties = motionLive
    ? {
        transform: "none",
        opacity: 0,
        transition: opacityTransition,
      }
    : {
        transform: "none",
        opacity: 0.4,
        transition: "opacity 0ms",
      };

  /** Next list item after `next`, shown on the right rail as the outgoing tile moves to center. */
  const afterNext = n > 1 ? items[(index + 2) % n] : null;
  const incomingRightMotion: CSSProperties = motionLive
    ? {
        opacity: 0.4,
        transition: opacityTransition,
      }
    : {
        opacity: 0,
        transition: "opacity 0ms",
      };

  return (
    <section
      className="mb-8"
      aria-roledescription="carousel"
      aria-label={label}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
    >
      <div className="mx-auto max-w-[996px]" style={frameStyle}>
        {hideKicker ? null : (
          <p className="mb-2 text-center text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-500">
            {eyebrow}
          </p>
        )}
        <div className="mx-auto flex w-full max-w-full flex-col items-center">
          <div
            className="flex min-h-[var(--fc-center)] items-center justify-center overflow-visible"
            style={{ gap: `${slideGapPx}px` }}
          >
            {n > 1 && prev ? (
              <div className="relative hidden w-[var(--fc-side)] shrink-0 md:block">
                <div
                  className="aspect-square w-full overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/60"
                  style={leftMotion}
                  aria-hidden="true"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={prev.imageUrl}
                    alt=""
                    className="h-full w-full object-cover"
                    decoding="async"
                    fetchPriority="low"
                  />
                </div>
              </div>
            ) : null}

            <Link
              href={carouselItemHref(curr, defaultListingShopSlug)}
              scroll={false}
              aria-label={curr.name}
              className="group relative z-10 w-[min(100%,var(--fc-center))] shrink-0 overflow-visible"
              style={{ zIndex: transformLive ? 5 : 10 }}
            >
              <div ref={centerMotionRef} style={centerMotion}>
                <div
                  className="aspect-square w-full overflow-hidden rounded-xl border border-zinc-600/90 bg-zinc-900 shadow-lg shadow-black/40 transition-colors group-hover:border-blue-500/50"
                  style={centerCardTone}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={curr.imageUrl}
                    alt=""
                    className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.02]"
                  />
                </div>
              </div>
            </Link>

            {n > 1 && next ? (
              <div className="relative hidden w-[var(--fc-side)] shrink-0 md:block">
                {/* Underlay: following list photo fades onto the rail as the front tile moves to center */}
                <div
                  className={`absolute inset-0 z-0 aspect-square overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/60 ${!motionLive ? "pointer-events-none" : ""}`}
                  style={incomingRightMotion}
                  aria-hidden="true"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={afterNext?.imageUrl ?? ""}
                    alt=""
                    className="h-full w-full object-cover"
                    decoding="async"
                    fetchPriority="high"
                  />
                </div>
                <div
                  className="relative z-10 aspect-square w-full overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/60"
                  style={rightMotion}
                  aria-hidden="true"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={next.imageUrl}
                    alt=""
                    className="h-full w-full object-cover"
                    decoding="async"
                    fetchPriority="high"
                  />
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-2.5 w-[min(100%,var(--fc-center))] text-center">
            <Link
              href={carouselItemHref(captionItem, defaultListingShopSlug)}
              scroll={false}
              className="line-clamp-2 text-xs font-medium leading-snug text-zinc-200 transition hover:text-blue-200/95 sm:text-sm"
            >
              {captionItem.name}
            </Link>
            {captionItem.catalogProductName ? (
              <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-zinc-500">{captionItem.catalogProductName}</p>
            ) : null}
          </div>
        </div>

        {n > 1 ? (
          <div className="mt-4 flex justify-center gap-1.5" aria-hidden="true">
            {items.map((item, i) => (
              <span
                key={`${item.href ?? ""}:${item.listingShopSlug ?? defaultListingShopSlug ?? ""}:${item.slug}:${i}`}
                className={
                  i === activeDotIndex
                    ? "h-1.5 w-6 rounded-full bg-blue-400/90 transition-[width,background-color] duration-300"
                    : "h-1.5 w-1.5 rounded-full bg-zinc-600 transition-[width,background-color] duration-300"
                }
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
