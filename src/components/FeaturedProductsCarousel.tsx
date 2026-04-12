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

const ROTATE_MS = 2500;
const SLIDE_GAP_PX = 40;
const ADVANCE_DURATION_MS = 560;
const EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

/**
 * Iteration-one layout: large center square + smaller side squares, `items-center`.
 * Row height is driven by the center square; scale that to this max edge length.
 */
const CENTER_SQUARE_PX = 300;
/** Side ≈ min(22%,200px)-style width vs ~448px center; +20% vs that baseline. */
const SIDE_SQUARE_PX = Math.round(CENTER_SQUARE_PX * (200 / 448) * 1.2);

/** Horizontal distance (px) between adjacent slot centers (left↔center or center↔right). */
function slotCenterDeltaX(): number {
  return -(SLIDE_GAP_PX + CENTER_SQUARE_PX / 2 + SIDE_SQUARE_PX / 2);
}

type Props = {
  items: FeaturedCarouselItem[];
  /** Screen-reader label, e.g. "Featured in Sub collection". */
  label?: string;
};

export function FeaturedProductsCarousel({ items, label = "Featured products" }: Props) {
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

  const dx = slotCenterDeltaX();
  const scaleCenterToSide = SIDE_SQUARE_PX / CENTER_SQUARE_PX;
  const scaleSideToCenter = CENTER_SQUARE_PX / SIDE_SQUARE_PX;

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

  useLayoutEffect(() => {
    if (phase !== "advancing" || animArmed) return;
    const id = requestAnimationFrame(() => {
      setAnimArmed(true);
    });
    return () => cancelAnimationFrame(id);
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
    "--fc-center": `${CENTER_SQUARE_PX}px`,
    "--fc-side": `${SIDE_SQUARE_PX}px`,
  } as CSSProperties;

  const isAnimating = phase === "advancing" && animArmed;
  const transition = isAnimating
    ? `transform ${ADVANCE_DURATION_MS}ms ${EASING}`
    : "transform 0ms";
  const opacityTransition = isAnimating
    ? `opacity ${ADVANCE_DURATION_MS}ms ${EASING}`
    : "opacity 0ms";

  const centerMotion: CSSProperties = isAnimating
    ? {
        transform: `translateX(${dx}px) scale(${scaleCenterToSide})`,
        transition,
        transformOrigin: "center center",
        willChange: "transform",
      }
    : {
        transform: "none",
        transition: "transform 0ms",
        transformOrigin: "center center",
        willChange: "auto",
      };

  /** Opacity goes full immediately when animating so the rail doesn’t lag behind center/left. */
  const rightMotion: CSSProperties = isAnimating
    ? {
        transform: `translateX(${dx}px) scale(${scaleSideToCenter})`,
        opacity: 1,
        transition,
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

  /** Left rail fades out in place (same duration as center/right — no cross-screen motion). */
  const leftMotion: CSSProperties = isAnimating
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
  const incomingRightMotion: CSSProperties = isAnimating
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
      <div className="mx-auto max-w-4xl" style={frameStyle}>
        <p className="mb-2 text-center text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-500">
          Featured
        </p>
        <div className="mx-auto flex w-full max-w-full flex-col items-center">
          <div className="flex min-h-[var(--fc-center)] items-center justify-center gap-[40px] overflow-visible">
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
              href={`/product/${curr.slug}`}
              scroll={false}
              aria-label={curr.name}
              className="group relative z-10 w-[min(100%,var(--fc-center))] shrink-0 overflow-visible"
              style={{ zIndex: isAnimating ? 5 : 10 }}
            >
              <div ref={centerMotionRef} style={centerMotion}>
                <div className="aspect-square w-full overflow-hidden rounded-xl border border-zinc-600/90 bg-zinc-900 shadow-lg shadow-black/40 transition group-hover:border-blue-500/50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={curr.imageUrl}
                    alt=""
                    className="h-full w-full object-cover transition duration-500 ease-out group-hover:scale-[1.02]"
                  />
                </div>
              </div>
            </Link>

            {n > 1 && next ? (
              <div className="relative hidden w-[var(--fc-side)] shrink-0 md:block">
                {/* Underlay: following list photo fades onto the rail as the front tile moves to center */}
                <div
                  className={`absolute inset-0 z-0 aspect-square overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/60 ${!isAnimating ? "pointer-events-none" : ""}`}
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

          <Link
            href={`/product/${curr.slug}`}
            scroll={false}
            className="mt-2.5 line-clamp-2 w-[min(100%,var(--fc-center))] text-center text-xs font-medium leading-snug text-zinc-200 transition hover:text-blue-200/95 sm:text-sm"
          >
            {curr.name}
          </Link>
        </div>

        {n > 1 ? (
          <div className="mt-4 flex justify-center gap-1.5" aria-hidden="true">
            {items.map((item, i) => (
              <span
                key={item.slug}
                className={
                  i === index
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
