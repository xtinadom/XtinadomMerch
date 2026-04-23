import { formatSupportMessageWhen } from "@/lib/format-support-message-when";

/** Subtle system line when an admin marks the support inquiry resolved (creator + admin chat). */
export function SupportThreadResolvedMarkerRow(props: { atIso: string }) {
  return (
    <li className="flex justify-center px-2 py-1" role="status">
      <p className="max-w-md text-center text-[11px] leading-snug text-zinc-500">
        Inquiry marked resolved
        <time
          className="mt-0.5 block text-[10px] font-normal tabular-nums text-zinc-600"
          dateTime={props.atIso}
        >
          {formatSupportMessageWhen(props.atIso)}
        </time>
      </p>
    </li>
  );
}
