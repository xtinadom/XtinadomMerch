"use client";

export type AdminPrintifyProductOption = { id: string; name: string };

export function AdminPrintifyProductSelect({
  value,
  onChange,
  products,
  id,
  label = "Printify product (optional)",
  hint,
}: {
  value: string;
  onChange: (v: string) => void;
  products: AdminPrintifyProductOption[];
  id?: string;
  label?: string;
  hint?: string;
}) {
  return (
    <label className="block min-w-0 text-[11px] text-zinc-500">
      {label}
      {hint ? (
        <span className="mt-0.5 block font-normal text-zinc-600">{hint}</span>
      ) : null}
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-0.5 block w-full max-w-xl rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100"
      >
        <option value="">— None —</option>
        {products.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  );
}
