import type { SupportMessageAuthor } from "@/generated/prisma/enums";

/**
 * Messages from staff after the creator’s last message — treated as “new” for the Support tab badge.
 * If the creator has never written, every admin message counts.
 */
export function countNewSupportMessagesFromStaff(
  messages: { authorRole: SupportMessageAuthor; createdAt: Date }[],
): number {
  if (messages.length === 0) return 0;
  const sorted = [...messages].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );
  let lastCreatorAt: Date | null = null;
  for (const m of sorted) {
    if (m.authorRole === "creator") {
      lastCreatorAt = m.createdAt;
    }
  }
  return sorted.filter(
    (m) =>
      m.authorRole === "admin" &&
      (lastCreatorAt == null || m.createdAt > lastCreatorAt),
  ).length;
}
