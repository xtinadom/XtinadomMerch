/** Message row shape required to merge a “resolved” marker into chronological order. */
export type SupportChatTimelineMessage = {
  id: string;
  createdAt: string;
};

/**
 * Inserts a synthetic “resolved” event into ascending `createdAt` message order at `resolvedAtIso`.
 * If every message is before resolve, the marker is appended. If `resolvedAtIso` is null, returns only messages.
 */
export function mergeSupportChatTimeline<T extends SupportChatTimelineMessage>(
  messages: readonly T[],
  resolvedAtIso: string | null,
): Array<{ kind: "message"; message: T } | { kind: "resolved"; atIso: string }> {
  if (!resolvedAtIso) return messages.map((message) => ({ kind: "message" as const, message }));
  const resolvedMs = new Date(resolvedAtIso).getTime();
  if (!Number.isFinite(resolvedMs)) return messages.map((message) => ({ kind: "message" as const, message }));

  const out: Array<{ kind: "message"; message: T } | { kind: "resolved"; atIso: string }> = [];
  let inserted = false;
  for (const message of messages) {
    const mMs = new Date(message.createdAt).getTime();
    if (!inserted && Number.isFinite(mMs) && mMs >= resolvedMs) {
      out.push({ kind: "resolved", atIso: resolvedAtIso });
      inserted = true;
    }
    out.push({ kind: "message", message });
  }
  if (!inserted) {
    out.push({ kind: "resolved", atIso: resolvedAtIso });
  }
  return out;
}
