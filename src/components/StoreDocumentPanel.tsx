import Link from "next/link";

type Props = {
  children: React.ReactNode;
  backHref: string;
  backLabel: string;
  /** Small uppercase label above title (e.g. product type) */
  kicker?: string;
  title?: string;
  /**
   * When true, the header has no H1; caller renders the title in page content (e.g. product PDP
   * beside gallery).
   */
  omitHeaderTitle?: boolean;
  /** Centered column like template “card” */
  narrow?: boolean;
};

export function StoreDocumentPanel({
  children,
  backHref,
  backLabel,
  kicker,
  title,
  omitHeaderTitle = false,
  narrow = true,
}: Props) {
  return (
    <article
      className={`store-dimension-panel animate-store-panel-in relative px-5 py-8 sm:px-10 sm:py-10 ${narrow ? "mx-auto max-w-3xl" : ""}`}
    >
      <header className="mb-8 border-b border-zinc-800/80 pb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link
              href={backHref}
              className="store-kicker inline-block text-blue-400/85 transition hover:text-blue-300"
            >
              ← {backLabel}
            </Link>
            {kicker ? (
              <p className="store-kicker mt-3 text-zinc-500">{kicker}</p>
            ) : null}
            {omitHeaderTitle || !title ? null : (
              <h1 className="store-dimension-page-title mt-2 text-2xl text-zinc-50 sm:text-3xl">
                {title}
              </h1>
            )}
          </div>
        </div>
      </header>
      <div className="text-zinc-300">{children}</div>
    </article>
  );
}
