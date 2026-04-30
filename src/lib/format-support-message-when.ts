/**
 * Local time for support bubbles: `MM/DD/YY  hh:mm am` (two spaces after the year; 12-hour;
 * zero-padded month, day, and hour).
 */
export function formatSupportMessageWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  const h24 = d.getHours();
  const min = String(d.getMinutes()).padStart(2, "0");
  const isPm = h24 >= 12;
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  const hh = String(h12).padStart(2, "0");
  const ap = isPm ? "pm" : "am";
  return `${mm}/${dd}/${yy}  ${hh}:${min} ${ap}`;
}
