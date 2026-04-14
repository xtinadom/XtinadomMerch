import Link from "next/link";
import { adminSupportSendMessage } from "@/actions/admin-support";
import { SupportMessageAuthor } from "@/generated/prisma/enums";

export type AdminSupportThreadListRow = {
  shopId: string;
  shopDisplayName: string;
  shopSlug: string;
  ownerEmail: string;
  updatedAt: string;
  lastPreview: string;
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
                return (
                  <li key={t.shopId}>
                    <Link
                      href={`/admin?tab=support&supportShop=${encodeURIComponent(t.shopId)}`}
                      className={`block rounded-md px-2 py-2 text-left text-xs transition ${
                        active
                          ? "bg-zinc-800 text-zinc-100 ring-1 ring-zinc-600"
                          : "text-zinc-400 hover:bg-zinc-900/80 hover:text-zinc-200"
                      }`}
                    >
                      <span className="font-medium text-zinc-200">{t.shopDisplayName}</span>
                      <span className="mt-0.5 block font-mono text-[10px] text-zinc-600">/s/{t.shopSlug}</span>
                      {t.lastPreview ? (
                        <span className="mt-1 line-clamp-2 block text-[11px] text-zinc-500">{t.lastPreview}</span>
                      ) : null}
                    </Link>
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
                <p className="mt-1 text-xs text-zinc-500">
                  <span className="font-mono text-zinc-600">/s/{detail.shopSlug}</span>
                  {" · "}
                  <span className="text-zinc-400">{detail.ownerEmail}</span>
                </p>
              </div>
              <div className="max-h-[min(26rem,50vh)] space-y-3 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
                {detail.messages.length === 0 ? (
                  <p className="py-4 text-center text-xs text-zinc-500">No messages in this thread yet.</p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {detail.messages.map((m) => {
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
                              className="mt-1 block text-[10px] font-medium uppercase tracking-wide text-zinc-500"
                              dateTime={m.createdAt}
                            >
                              {m.createdAt.slice(0, 16).replace("T", " ")}
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
