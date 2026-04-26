import { dashboardSupportSendMessage } from "@/actions/dashboard-support";
import { SupportThreadResolvedMarkerRow } from "@/components/SupportThreadResolvedMarkerRow";
import { formatSupportMessageWhen } from "@/lib/format-support-message-when";
import { mergeSupportChatTimeline } from "@/lib/support-chat-timeline";

export type DashboardSupportMessageRow = {
  id: string;
  authorRole: "creator" | "admin";
  body: string;
  createdAt: string;
};

export function DashboardSupportChatPanel(props: {
  messages: DashboardSupportMessageRow[];
  /** When set, a subtle “Inquiry marked resolved” line is merged into the timeline (same as admin view). */
  resolvedAtIso?: string | null;
}) {
  const { messages, resolvedAtIso = null } = props;
  const timeline = mergeSupportChatTimeline(messages, resolvedAtIso);

  return (
    <div className="space-y-4">
      <p className="text-xs text-zinc-600">
        Message the platform. Your full conversation stays here; we reply when we can.
      </p>
      <div className="max-h-[min(28rem,55vh)] space-y-3 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
        {messages.length === 0 && !resolvedAtIso ? (
          <p className="py-6 text-center text-sm text-zinc-500">No messages yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {timeline.map((item) => {
              if (item.kind === "resolved") {
                return <SupportThreadResolvedMarkerRow key={`resolved-${item.atIso}`} atIso={item.atIso} />;
              }
              const m = item.message;
              const isCreator = m.authorRole === "creator";
              return (
                <li key={m.id} className={`flex ${isCreator ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[min(100%,28rem)] rounded-lg px-3 py-2 text-sm leading-relaxed ${
                      isCreator
                        ? "bg-emerald-950/50 text-emerald-100/90 ring-1 ring-emerald-900/45"
                        : "bg-zinc-800/90 text-zinc-200 ring-1 ring-zinc-700/80"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    <time
                      className="mt-1 block text-[10px] font-medium tracking-wide text-zinc-500"
                      dateTime={m.createdAt}
                    >
                      {formatSupportMessageWhen(m.createdAt)}
                      {isCreator ? " · You" : " · Support"}
                    </time>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <form action={dashboardSupportSendMessage} className="space-y-2">
        <label className="block text-xs font-medium text-zinc-500" htmlFor="support-body-dashboard">
          Your message
        </label>
        <textarea
          id="support-body-dashboard"
          name="body"
          required
          minLength={1}
          maxLength={10000}
          rows={4}
          placeholder="Describe what you need help with…"
          className="w-full resize-y rounded-lg border border-zinc-700 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
        <button
          type="submit"
          className="rounded-lg border border-zinc-600 bg-zinc-800/80 px-4 py-2 text-sm font-medium text-zinc-200 hover:border-zinc-500 hover:bg-zinc-800"
        >
          Send message
        </button>
      </form>
    </div>
  );
}
