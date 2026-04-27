import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deleteR2ObjectsByKeys, isR2UploadConfigured } from "@/lib/r2-upload";

const RETAIN_DAYS = 30;

function isVercelCron(req: Request) {
  return req.headers.get("x-vercel-cron") === "1";
}

export async function GET(req: Request) {
  // Prefer Vercel Cron header; allow local/manual calls too.
  if (process.env.NODE_ENV === "production" && !isVercelCron(req)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dryRun") === "1";

  if (!isR2UploadConfigured()) {
    return NextResponse.json({ ok: false, error: "r2_not_configured" }, { status: 500 });
  }

  const cutoff = new Date(Date.now() - RETAIN_DAYS * 24 * 60 * 60 * 1000);
  const rows = await prisma.bugFeedbackReport.findMany({
    where: {
      imageR2Key: { not: null },
      imageDeletedAt: null,
      imageUploadedAt: { lt: cutoff },
    },
    select: { id: true, imageR2Key: true },
    take: 500,
  });

  const keys = rows.map((r) => r.imageR2Key).filter((k): k is string => Boolean(k));
  if (keys.length === 0) {
    return NextResponse.json({ ok: true, deleted: 0, dryRun, cutoffIso: cutoff.toISOString() });
  }

  if (!dryRun) {
    await deleteR2ObjectsByKeys(keys);
    await prisma.bugFeedbackReport.updateMany({
      where: { id: { in: rows.map((r) => r.id) } },
      data: {
        imageUrl: null,
        imageR2Key: null,
        imageDeletedAt: new Date(),
      },
    });
  }

  return NextResponse.json({
    ok: true,
    candidateCount: rows.length,
    deleted: dryRun ? 0 : keys.length,
    dryRun,
    cutoffIso: cutoff.toISOString(),
  });
}

