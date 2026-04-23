import Link from "next/link";
import {
  adminSupportMarkResolved,
  adminSupportMarkUnresolved,
  adminSupportSendMessage,
} from "@/actions/admin-support";
import { AdminSupportThreadStatusSubmitButton } from "@/components/admin/AdminSupportThreadStatusSubmitButton";
import { SupportThreadResolvedMarkerRow } from "@/components/SupportThreadResolvedMarkerRow";
import { SupportMessageAuthor } from "@/generated/prisma/enums";
import { formatSupportMessageWhen } from "@/lib/format-support-message-when";
import { mergeSupportChatTimeline } from "@/lib/support-chat-timeline";

export type AdminSupportThreadListRow = {
  shopId: string;
  shopDisplayName: string;
  shopSlug: string;
  ownerEmail: string;
  updatedAt: string;
  /** True when the thread needs admin follow-up (never resolved, or creator posted after resolve). */
  needsReply: boolean;
};

export type AdminSupportMessageRow = {
  id: string;
  authorRole: "creator" | "admin";
  body: string;
  createdAt: string;
};

export type AdminSupportThreadDetail = {
  shopId: string;
  shopDisplayName: string;
  shopSlug: string;
  ownerEmail: string;
  needsReply: boolean;
  resolvedAtIso: string | null;
  messages: AdminSupportMessageRow[];
};

export function AdminSupportMessagesTab(props: {
  threads: AdminSupportThreadListRow[];
  detail: AdminSupportThreadDetail | null;
  selectedShopId: string | undefined;
}) {
  const { threads, detail, selectedShopId } = props;

  return (
    <section aria-label="Support messages">
      <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Support messages</h2>
      <p className="mt-2 text-xs text-zinc-600">
        Conversations started from creator dashboards. Pick a shop to read history and reply.
      </p>
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,14rem)_1fr]">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-600">Shops</p>
          <ul className="mt-2 max-h-[min(32rem,60vh)] space-y-1 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950/40 p-1">
            {threads.length === 0 ? (
              <li className="px-2 py-3 text-xs text-zinc-500">No conversations yet.</li>
            ) : (
              threads.map((t) => {
                const active = selectedShopId === t.shopId;
                const supportHref = `/admin?tab=support&supportShop=${encodeURIComponent(t.shopId)}`;
                return (
                  <li key={t.shopId} className="group relative">
                    <Link
                      href={supportHref}
                      className={`absolute inset-0 z-0 rounded-md transition ${
                        active ? "" : "hover:bg-zinc-900/80"
                      }`}
                      aria-label={`Open support chat with ${t.shopDisplayName}`}
                    />
                    <div
                      className={`pointer-events-none relative z-10 rounded-md px-2 py-2 text-left text-xs transition ${
                        active
                          ? "bg-zinc-800 text-zinc-100 ring-1 ring-zinc-600"
                          : "text-zinc-400 group-hover:text-zinc-200"
                      }`}
                    >
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <Link
                          href={`/admin?tab=shop-watch&watchShop=${encodeURIComponent(t.shopId)}`}
                          className="pointer-events-auto relative z-20 font-medium text-zinc-200 underline-offset-2 hover:text-zinc-50 hover:underline"
                        >
                          {t.shopDisplayName}
                        </Link>
                        {t.needsReply ? (
                          <span className="rounded bg-amber-950/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200/90 ring-1 ring-amber-900/50">
                            Open
                          </span>
                        ) : (
                          <span className="rounded bg-zinc-800/80 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500 ring-1 ring-zinc-700/80">
                            Resolved
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 font-mono text-[10px] text-zinc-600">/s/{t.shopSlug}</p>
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </div>
        <div className="min-w-0 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
          {!detail ? (
            <p className="text-sm text-zinc-500">
              {threads.length === 0
                ? "When a creator sends a message from their dashboard, the thread appears here."
                : "Select a shop to view messages and reply."}
            </p>
          ) : (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-semibold text-zinc-100">{detail.shopDisplayName}</h3>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500">
                  <Link
                    href={`/admin?tab=shop-watch&watchShop=${encodeURIComponent(detail.shopId)}`}
                    className="text-zinc-300 underline-offset-2 hover:text-zinc-100 hover:underline"
                  >
                    Shop Data
                  </Link>
                  <span className="text-zinc-700" aria-hidden>
                    ·
                  </span>
                  <Link
                    href={`/s/${encodeURIComponent(detail.shopSlug)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400/90 underline-offset-2 hover:text-blue-300 hover:underline"
                  >
                    View storefront
                  </Link>
                  <span className="text-zinc-700" aria-hidden>
                    ·
                  </span>
                  <span className="font-mono text-zinc-600">/s/{detail.shopSlug}</span>
                  <span className="text-zinc-700" aria-hidden>
                    ·
                  </span>
                  <span className="text-zinc-400">{detail.ownerEmail}</span>
                </p>
                {detail.messages.length > 0 ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {detail.needsReply ? (
                      <p className="rounded-md border border-amber-900/45 bg-amber-950/25 px-2.5 py-1.5 text-[11px] text-amber-200/90">
                        This thread needs a reply or you can mark it resolved when you are done.
                      </p>
                    ) : (
                      <p className="rounded-md border border-emerald-900/40 bg-emerald-950/20 px-2.5 py-1.5 text-[11px] text-emerald-200/85">
                        Marked resolved
                        {detail.resolvedAtIso
                          ? ` · ${new Date(detail.resolvedAtIso).toLocaleString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })}`
                          : null}
                      </p>
                    )}
                    {detail.needsReply ? (
                      <form action={adminSupportMarkResolved}>
                        <input type="hidden" name="shopId" value={detail.shopId} />
                        <AdminSupportThreadStatusSubmitButton
                          idleLabel="Mark resolved"
                          pendingLabel="Resolving…"
                          className="rounded-lg border border-emerald-900/50 bg-emerald-950/35 px-3 py-1.5 text-xs font-medium text-emerald-100/90 hover:border-emerald-800/60 hover:bg-emerald-950/50 disabled:opacity-50"
                        />
                      </form>
                    ) : (
                      <form action={adminSupportMarkUnresolved}>
                        <input type="hidden" name="shopId" value={detail.shopId} />
                        <AdminSupportThreadStatusSubmitButton
                          idleLabel="Mark as open"
                          pendingLabel="Reopening…"
                          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:border-zinc-600 hover:bg-zinc-800 disabled:opacity-50"
                        />
                      </form>
                    )}
                  </div>
                ) : null}
              </div>
              <div className="max-h-[min(26rem,50vh)] space-y-3 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
                {detail.messages.length === 0 && !detail.resolvedAtIso ? (
                  <p className="py-4 text-center text-xs text-zinc-500">No messages in this thread yet.</p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {mergeSupportChatTimeline(detail.messages, detail.resolvedAtIso).map((item) => {
                      if (item.kind === "resolved") {
                        return <SupportThreadResolvedMarkerRow key={`resolved-${item.atIso}`} atIso={item.atIso} />;
                      }
                      const m = item.message;
                      const isAdmin = m.authorRole === SupportMessageAuthor.admin;
                      return (
                        <li key={m.id} className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}>
                          <div
                            className={`max-w-[min(100%,32rem)] rounded-lg px-3 py-2 text-sm leading-relaxed ${
                              isAdmin
                                ? "bg-sky-950/45 text-sky-100/90 ring-1 ring-sky-900/50"
                                : "bg-zinc-800/90 text-zinc-200 ring-1 ring-zinc-700/80"
                            }`}
                          >
                            <p className="whitespace-pre-wrap break-words">{m.body}</p>
                            <time
                              className="mt-1 block text-[10px] font-medium tracking-wide text-zinc-500"
                              dateTime={m.createdAt}
                            >
                              {formatSupportMessageWhen(m.createdAt)}
                              {isAdmin ? " · You (admin)" : " · Creator"}
                            </time>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              <form action={adminSupportSendMessage} className="space-y-2 border-t border-zinc-800 pt-4">
                <input type="hidden" name="shopId" value={detail.shopId} />
                <label className="block text-xs font-medium text-zinc-500" htmlFor="support-body-admin">
                  Reply
                </label>
                <textarea
                  id="support-body-admin"
                  name="body"
                  required
                  minLength={1}
                  maxLength={10000}
                  rows={4}
                  placeholder="Write a reply…"
                  className="w-full resize-y rounded-lg border border-zinc-700 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                />
                <button
                  type="submit"
                  className="rounded-lg border border-sky-900/50 bg-sky-950/35 px-4 py-2 text-sm font-medium text-sky-100/90 hover:border-sky-800/60 hover:bg-sky-950/50"
                >
                  Send reply
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
