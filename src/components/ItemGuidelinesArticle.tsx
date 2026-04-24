/**
 * Canonical item-guidelines copy (creator onboarding). Reused on the public shop regulations page.
 */
export function ItemGuidelinesArticle(props: { className?: string }) {
  const { className = "space-y-4 text-sm leading-relaxed text-zinc-300" } = props;

  return (
    <div className={className}>
      <p className="text-sm text-zinc-400">
        Read this before requesting listings. Submitting a listing means you agree to these rules.
      </p>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Rights to images</h3>
        <p className="mt-2 text-sm text-zinc-400">
          You must own every photo, artwork file, and reference image you upload or link for a listing. You are solely
          responsible for what you upload.
        </p>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Platform review</h3>
        <p className="mt-2 text-sm text-zinc-400">
          Admin review (including approval of images) is not legal clearance. If a rights or content issue is
          discovered later, you remain responsible. The platform is not liable for having approved an image that is
          later shown to infringe someone else&apos;s rights or violate these guidelines.
        </p>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Content standards</h3>
        <p className="mt-2 text-sm text-zinc-400">
          Images must pass typical social-media style checks: no nudity, no depicted sex acts, and no explicit sexual
          content. Artful, suggestive content may be acceptable when it stays within those bounds. The platform may
          reject or remove listings that do not meet this standard.
        </p>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Fees</h3>
        <p className="mt-2 text-sm text-zinc-400">Your first 3 listings are free. Listings after that are 25 cents.</p>
        <p className="mt-2 text-sm text-zinc-400">
          Listing fees paid for items that are rejected or removed later for not following these guidelines, are{" "}
          <strong className="text-zinc-200">non-refundable</strong>.
        </p>
      </div>
    </div>
  );
}
