"use client";

import { useActionState, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  adminResetSiteEmailTemplate,
  adminSaveSiteEmailTemplate,
  type AdminSaveSiteEmailTemplateResult,
} from "@/actions/admin-site-email-templates";
import {
  replaceActionUrlInHtmlTemplate,
  replaceContactQuotePlaceholders,
  wrapEmailHtmlFragmentForPreview,
} from "@/lib/email-template-placeholders";
import type { AdminEmailFormatEntry } from "@/lib/site-email-template-service";
import type { SiteEmailTemplateKey } from "@/lib/site-email-template-keys";
import { useRouter } from "next/navigation";

function previewHtmlDocument(renderedBody: string): string {
  if (/^\s*<!doctype/i.test(renderedBody)) {
    return renderedBody;
  }
  return wrapEmailHtmlFragmentForPreview(renderedBody);
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function insertAroundSelection(
  textarea: HTMLTextAreaElement | null,
  body: string,
  setBody: (s: string) => void,
  open: string,
  close: string,
  placeholder = "text",
) {
  if (!textarea) return;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = body.slice(start, end);
  const inner = selected || placeholder;
  const insertion = `${open}${inner}${close}`;
  const next = body.slice(0, start) + insertion + body.slice(end);
  setBody(next);
  requestAnimationFrame(() => {
    textarea.focus();
    if (!selected) {
      const a = start + open.length;
      const b = a + inner.length;
      textarea.setSelectionRange(a, b);
    } else {
      const pos = start + insertion.length;
      textarea.setSelectionRange(pos, pos);
    }
  });
}

function insertAtCursor(
  textarea: HTMLTextAreaElement | null,
  body: string,
  setBody: (s: string) => void,
  snippet: string,
) {
  if (!textarea) return;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const next = body.slice(0, start) + snippet + body.slice(end);
  setBody(next);
  requestAnimationFrame(() => {
    textarea.focus();
    const cursor = start + snippet.length;
    textarea.setSelectionRange(cursor, cursor);
  });
}

function insertSnippetAndSelect(
  textarea: HTMLTextAreaElement | null,
  body: string,
  setBody: (s: string) => void,
  snippet: string,
  selectStartInSnippet: number,
  selectEndInSnippet: number,
) {
  if (!textarea) return;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const next = body.slice(0, start) + snippet + body.slice(end);
  setBody(next);
  requestAnimationFrame(() => {
    textarea.focus();
    textarea.setSelectionRange(start + selectStartInSnippet, start + selectEndInSnippet);
  });
}

const FONT_SIZES = ["12px", "14px", "16px", "18px", "20px", "24px", "28px"] as const;
/** CSS `font-family:` value safe inside `style="font-family:…"` (use `&quot;` for multi-word faces). */
const FONT_FAMILIES = [
  { label: "Arial", css: "Arial, Helvetica, sans-serif" },
  { label: "Georgia", css: "Georgia, serif" },
  { label: "Tahoma", css: "Tahoma, Geneva, sans-serif" },
  { label: "Times", css: "&quot;Times New Roman&quot;, Times, serif" },
  { label: "Verdana", css: "Verdana, Geneva, sans-serif" },
  { label: "Trebuchet", css: "&quot;Trebuchet MS&quot;, Helvetica, sans-serif" },
] as const;

function EmailHtmlFormatToolbar(props: {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  body: string;
  setBody: (s: string) => void;
}) {
  const { textareaRef, body, setBody } = props;

  const btn =
    "rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-[11px] font-medium text-zinc-200 hover:bg-zinc-700";

  return (
    <div
      role="toolbar"
      aria-label="HTML formatting"
      className="mt-2 flex max-w-[996px] flex-wrap items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 p-2"
    >
      <span className="mr-1 text-[10px] uppercase tracking-wide text-zinc-600">Insert</span>
      <button
        type="button"
        className={btn}
        onClick={() =>
          insertAroundSelection(textareaRef.current, body, setBody, "<strong>", "</strong>")
        }
      >
        Bold
      </button>
      <button
        type="button"
        className={btn}
        onClick={() => insertAroundSelection(textareaRef.current, body, setBody, "<em>", "</em>")}
      >
        Italic
      </button>
      <button
        type="button"
        className={btn}
        onClick={() =>
          insertAroundSelection(
            textareaRef.current,
            body,
            setBody,
            '<span style="text-decoration:underline">',
            "</span>",
          )
        }
      >
        Underline
      </button>
      <button
        type="button"
        className={btn}
        onClick={() => insertAtCursor(textareaRef.current, body, setBody, "<br/>")}
      >
        Line break
      </button>
      <button
        type="button"
        className={btn}
        onClick={() =>
          insertAroundSelection(
            textareaRef.current,
            body,
            setBody,
            '<p style="margin:0 0 12px 0;">',
            "</p>",
            "Your paragraph",
          )
        }
      >
        Paragraph
      </button>
      <button
        type="button"
        className={btn}
        onClick={() => {
          const snippet =
            '<ul style="margin:0 0 12px 1.1em;padding:0;">\n  <li>New item</li>\n</ul>';
          const rel = snippet.indexOf("New item");
          insertSnippetAndSelect(textareaRef.current, body, setBody, snippet, rel, rel + 8);
        }}
      >
        Bulleted list
      </button>
      <button
        type="button"
        className={btn}
        onClick={() => {
          const snippet =
            '<ol style="margin:0 0 12px 1.1em;padding:0;">\n  <li>First item</li>\n</ol>';
          const rel = snippet.indexOf("First item");
          insertSnippetAndSelect(textareaRef.current, body, setBody, snippet, rel, rel + 10);
        }}
      >
        Numbered list
      </button>
      <button
        type="button"
        className={btn}
        onClick={() => {
          const url = window.prompt("Link URL (https://…)", "https://");
          if (url == null || !url.trim()) return;
          const ta = textareaRef.current;
          if (!ta) return;
          const start = ta.selectionStart;
          const end = ta.selectionEnd;
          const selected = body.slice(start, end);
          const label = selected || window.prompt("Link text", "Click here") || "link";
          if (!label) return;
          const href = escapeHtmlAttribute(url.trim());
          const open = `<a href="${href}" style="color:#2563eb;text-decoration:underline;">`;
          const close = "</a>";
          const inner = selected || label;
          const insertion = `${open}${inner}${close}`;
          const next = body.slice(0, start) + insertion + body.slice(end);
          setBody(next);
          requestAnimationFrame(() => {
            ta.focus();
            if (!selected) {
              const i = start + open.length;
              ta.setSelectionRange(i, i + inner.length);
            } else {
              ta.setSelectionRange(start + insertion.length, start + insertion.length);
            }
          });
        }}
      >
        Link
      </button>
      <span className="mx-1 hidden h-4 w-px bg-zinc-700 sm:inline" aria-hidden />
      <span className="flex items-center gap-1 text-[10px] text-zinc-500">
        <span className="text-zinc-500">Size</span>
        <select
          aria-label="Wrap selection in font size"
          className="rounded border border-zinc-600 bg-zinc-900 px-1.5 py-1 text-[11px] text-zinc-200"
          defaultValue=""
          onChange={(e) => {
            const v = e.target.value;
            if (!v) return;
            insertAroundSelection(
              textareaRef.current,
              body,
              setBody,
              `<span style="font-size:${escapeHtmlAttribute(v)}">`,
              "</span>",
            );
            e.target.value = "";
          }}
        >
          <option value="">—</option>
          {FONT_SIZES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </span>
      <span className="flex items-center gap-1 text-[10px] text-zinc-500">
        <span className="text-zinc-500">Font</span>
        <select
          aria-label="Wrap selection in font family"
          className="max-w-[7.5rem] rounded border border-zinc-600 bg-zinc-900 px-1.5 py-1 text-[11px] text-zinc-200"
          defaultValue=""
          onChange={(e) => {
            const key = e.target.value;
            if (!key) return;
            const row = FONT_FAMILIES.find((f) => f.label === key);
            e.target.value = "";
            if (!row) return;
            insertAroundSelection(
              textareaRef.current,
              body,
              setBody,
              `<span style="font-family:${row.css}">`,
              "</span>",
            );
          }}
        >
          <option value="">—</option>
          {FONT_FAMILIES.map((f) => (
            <option key={f.label} value={f.label}>
              {f.label}
            </option>
          ))}
        </select>
      </span>
    </div>
  );
}

export function AdminEmailFormatTab(props: { entries: AdminEmailFormatEntry[] }) {
  const router = useRouter();
  const firstKey = props.entries[0]?.key;
  const [selectedKey, setSelectedKey] = useState<SiteEmailTemplateKey>(
    (firstKey ?? "shop_dashboard_email_verification") as SiteEmailTemplateKey,
  );

  const entry = useMemo(
    () => props.entries.find((e) => e.key === selectedKey) ?? props.entries[0],
    [props.entries, selectedKey],
  );

  const [subject, setSubject] = useState(entry?.subject ?? "");
  const [body, setBody] = useState(entry?.body ?? "");

  useEffect(() => {
    if (!entry) return;
    setSubject(entry.subject);
    setBody(entry.body);
  }, [entry.key, entry.subject, entry.body]);

  const [saveState, saveAction, savePending] = useActionState<
    AdminSaveSiteEmailTemplateResult | undefined,
    FormData
  >(adminSaveSiteEmailTemplate, undefined);

  const refreshedAfterLatestSave = useRef(false);
  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (savePending) {
      refreshedAfterLatestSave.current = false;
      return;
    }
    if (saveState?.ok && !refreshedAfterLatestSave.current) {
      refreshedAfterLatestSave.current = true;
      void router.refresh();
    }
  }, [savePending, saveState, router]);

  const previewContent = useMemo(() => {
    if (!entry) return { kind: "empty" as const, value: "" };
    if (entry.kind === "text") {
      const text = replaceContactQuotePlaceholders(body, entry.samplePreview);
      return { kind: "text" as const, value: text };
    }
    const url = entry.sampleActionUrl ?? "https://example.com/preview";
    const html = replaceActionUrlInHtmlTemplate(body, url);
    return { kind: "html" as const, value: previewHtmlDocument(html) };
  }, [body, entry]);

  if (!entry) {
    return <p className="text-sm text-zinc-500">No email templates configured.</p>;
  }

  return (
    <section aria-label="Email format" className="space-y-6">
      <div>
        <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Email format</h2>
        <p className="mt-1 max-w-2xl text-xs text-zinc-600">
          Edit subjects and bodies stored in the database. HTML templates must keep{" "}
          <code className="font-mono text-zinc-400">{"{{ACTION_URL}}"}</code> where the signed link should go.
          The preview substitutes sample data so you can check layout before saving.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="block min-w-[14rem] text-xs text-zinc-500">
          Template
          <select
            className="mt-1 block w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
            value={selectedKey}
            onChange={(e) => setSelectedKey(e.target.value as SiteEmailTemplateKey)}
          >
            {props.entries.map((e) => (
              <option key={e.key} value={e.key}>
                {e.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="text-xs text-zinc-500">{entry.description}</p>

      {saveState && !saveState.ok ? (
        <p
          role="alert"
          className="rounded-lg border border-rose-900/60 bg-rose-950/35 px-3 py-2 text-sm text-rose-100/95"
        >
          {saveState.error}
        </p>
      ) : null}
      <form action={saveAction} className="space-y-4">
        <input type="hidden" name="key" value={entry.key} />
        <label className="block text-xs text-zinc-500">
          Subject line
          <input
            name="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="mt-1 block w-full max-w-2xl rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
          />
        </label>
        <label className="block text-xs text-zinc-500">
          {entry.kind === "html" ? "HTML body" : "Plain text body"}
          {entry.kind === "html" ? (
            <p className="mt-1 max-w-[996px] text-[11px] leading-snug text-zinc-600">
              Select text (optional), then use the toolbar to wrap it in tags. With no selection, a placeholder is
              inserted and highlighted so you can type over it.
            </p>
          ) : null}
          {entry.kind === "html" ? (
            <EmailHtmlFormatToolbar textareaRef={bodyTextareaRef} body={body} setBody={setBody} />
          ) : null}
          <textarea
            ref={bodyTextareaRef}
            name="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={entry.kind === "html" ? 14 : 10}
            spellCheck={false}
            className="mt-1 block w-full max-w-[996px] rounded border border-zinc-700 bg-zinc-900 px-2 py-2 font-mono text-[13px] leading-relaxed text-zinc-100"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={savePending}
            className="rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-700 disabled:opacity-50"
          >
            {savePending ? "Saving…" : "Save template"}
          </button>
          <button
            type="button"
            disabled={savePending}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-900/80 hover:text-zinc-200 disabled:opacity-50"
            onClick={() => {
              setSubject(entry.defaultSubject);
              setBody(entry.defaultBody);
            }}
          >
            Reset fields to site default (not saved)
          </button>
        </div>
      </form>

      <div className="border-t border-zinc-800 pt-4">
        <button
          type="button"
          className="text-xs text-amber-400/90 hover:underline"
          onClick={async () => {
            if (
              !window.confirm(
                "Remove the database override for this template? The app will go back to built-in defaults.",
              )
            ) {
              return;
            }
            const fd = new FormData();
            fd.set("key", entry.key);
            await adminResetSiteEmailTemplate(fd);
            router.refresh();
          }}
        >
          Clear saved override for this template
        </button>
      </div>

      <div className="border-t border-zinc-800 pt-6">
        <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">Preview</h3>
        <p className="mt-1 text-[11px] text-zinc-600">
          {entry.kind === "html"
            ? "Approximates a mail client: full documents render as-is; short fragments get a simple wrapper."
            : "Plain text as sent to your inbox (sample name / email / message)."}
        </p>
        {previewContent.kind === "html" ? (
          <iframe
            title="Email HTML preview"
            sandbox=""
            className="mt-3 h-[min(70vh,520px)] w-full max-w-[996px] rounded-lg border border-zinc-700 bg-white shadow-lg"
            srcDoc={previewContent.value}
          />
        ) : previewContent.kind === "text" ? (
          <pre className="mt-3 max-h-[min(70vh,520px)] w-full max-w-[996px] overflow-auto whitespace-pre-wrap rounded-lg border border-zinc-700 bg-zinc-900/80 p-4 font-mono text-[13px] leading-relaxed text-zinc-200">
            {previewContent.value}
          </pre>
        ) : null}
      </div>
    </section>
  );
}
