import { Fragment } from "react";
import { AdminInboxReplyForm } from "@/components/admin/AdminInboxReplyForm";

export type AdminInboxRow = {
  id: string;
  resendEmailId: string;
  fromAddress: string;
  toAddress: string;
  subject: string;
  textBody: string | null;
  htmlBody: string | null;
  receivedAt: string;
};

function formatWhen(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function AdminInboxTab(props: {
  rows: AdminInboxRow[];
  inboxAddress: string;
  webhookEndpoint: string | null;
}) {
  const { rows, inboxAddress, webhookEndpoint } = props;

  return (
    <section aria-label="Admin inbox">
      <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Inbox</h2>
      <p className="mt-1 max-w-3xl text-xs text-zinc-600">
        Messages to <strong className="font-medium text-zinc-400">{inboxAddress}</strong> appear here when
        Resend <strong className="font-medium text-zinc-400">Inbound</strong> is enabled for that domain and an{" "}
        <code className="rounded bg-zinc-900 px-1 py-0.5 font-mono text-[11px] text-zinc-400">email.received</code>{" "}
        webhook posts to your deployment. Set{" "}
        <code className="rounded bg-zinc-900 px-1 py-0.5 font-mono text-[11px] text-zinc-400">
          RESEND_INBOUND_WEBHOOK_SECRET
        </code>{" "}
        (or <code className="font-mono text-[11px] text-zinc-400">RESEND_WEBHOOK_SECRET</code>) to the signing secret
        from the Resend webhook, and keep <code className="font-mono text-[11px] text-zinc-400">RESEND_API_KEY</code>{" "}
        for fetching message bodies and for <strong className="font-medium text-zinc-400">replies</strong> from this
        tab (same key; your sending domain must be verified in Resend). Optional full{" "}
        <code className="rounded bg-zinc-900 px-1 py-0.5 font-mono text-[11px] text-zinc-400">
          ADMIN_INBOX_REPLY_FROM
        </code>{" "}
        overrides the default From line.
      </p>
      {webhookEndpoint ? (
        <p className="mt-2 break-all font-mono text-[11px] text-zinc-500">
          Webhook URL: <span className="text-zinc-400">{webhookEndpoint}</span>
        </p>
      ) : (
        <p className="mt-2 text-xs text-amber-300/90">
          Set <code className="font-mono">NEXT_PUBLIC_APP_URL</code> (or deploy to Vercel) so the webhook URL is
          known.
        </p>
      )}

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-500">
              <th className="py-2 pr-3 font-medium">Received</th>
              <th className="py-2 pr-3 font-medium">From</th>
              <th className="py-2 pr-3 font-medium">To</th>
              <th className="py-2 font-medium">Subject / preview</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <Fragment key={r.id}>
                <tr className="border-b border-zinc-900 align-top text-zinc-300">
                  <td className="whitespace-nowrap py-2 pr-3 text-zinc-500">{formatWhen(r.receivedAt)}</td>
                  <td className="max-w-[10rem] py-2 pr-3 break-all text-zinc-400">{r.fromAddress}</td>
                  <td className="max-w-[10rem] py-2 pr-3 break-all text-zinc-500">{r.toAddress}</td>
                  <td className="py-2">
                    <p className="font-medium text-zinc-200">{r.subject}</p>
                    {r.textBody ? (
                      <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded border border-zinc-800/80 bg-zinc-950/60 p-2 font-sans text-[11px] leading-snug text-zinc-500">
                        {r.textBody}
                      </pre>
                    ) : r.htmlBody ? (
                      <p className="mt-1 text-[11px] text-zinc-600">HTML body only — open raw in Resend dashboard.</p>
                    ) : (
                      <p className="mt-1 text-[11px] text-zinc-600">No body text stored.</p>
                    )}
                  </td>
                </tr>
                <tr className="border-b border-zinc-900 bg-zinc-950/30 align-top text-zinc-300">
                  <td colSpan={4} className="py-3 pr-2 pl-2 sm:pl-3">
                    <AdminInboxReplyForm inboundId={r.id} />
                  </td>
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-600">No messages yet. Send a test to {inboxAddress} after inbound is live.</p>
      ) : null}
    </section>
  );
}
