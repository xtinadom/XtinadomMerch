import { NextResponse } from "next/server";
import { submitBugFeedbackReport } from "@/actions/dashboard-bug-feedback";

export async function POST(req: Request) {
  let fd: FormData;
  try {
    fd = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid form data." }, { status: 400 });
  }
  try {
    const r = await submitBugFeedbackReport(fd);
    if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: 400 });
    return NextResponse.json({ ok: true, reportId: r.reportId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[api/bug-feedback]", msg);
    return NextResponse.json({ ok: false, error: "Server error." }, { status: 500 });
  }
}

