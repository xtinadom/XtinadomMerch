"use server";

import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getShopOwnerSession } from "@/lib/session";
import { isR2UploadConfigured, putPublicR2Object } from "@/lib/r2-upload";
import { compressShopListingSupplementPhotoWebp } from "@/lib/shop-setup-image";

export type BugFeedbackSubmitResult =
  | { ok: true; reportId: string }
  | { ok: false; error: string };

const HAPPENED_MAX = 4000;
const EXPECTED_MAX = 4000;
const STEPS_MAX = 4000;
const PAGE_URL_MAX = 2048;
const UA_MAX = 2000;

async function requireShopOwnerForBugFeedback() {
  const session = await getShopOwnerSession();
  if (!session.shopUserId) redirect("/dashboard/login");
  const user = await prisma.shopUser.findUnique({
    where: { id: session.shopUserId },
    include: { shop: true },
  });
  if (!user) {
    session.destroy();
    redirect("/dashboard/login");
  }
  return user;
}

function bugFeedbackImageKey(shopId: string, reportId: string) {
  return `shops/${shopId}/bug-feedback/${reportId}.webp`;
}

export async function submitBugFeedbackReport(
  formData: FormData,
): Promise<BugFeedbackSubmitResult> {
  const user = await requireShopOwnerForBugFeedback();
  const shop = user.shop;

  const happened = String(formData.get("happened") ?? "").trim();
  const expected = String(formData.get("expected") ?? "").trim();
  const stepsToReproduce = String(formData.get("stepsToReproduce") ?? "").trim();
  const pageUrl = String(formData.get("pageUrl") ?? "").trim();
  const userAgent = String(formData.get("userAgent") ?? "").trim();

  if (!happened) return { ok: false, error: "What happened is required." };
  if (!expected) return { ok: false, error: "What you expected is required." };
  if (happened.length > HAPPENED_MAX) return { ok: false, error: `What happened is too long (max ${HAPPENED_MAX}).` };
  if (expected.length > EXPECTED_MAX) return { ok: false, error: `What you expected is too long (max ${EXPECTED_MAX}).` };
  if (stepsToReproduce.length > STEPS_MAX) return { ok: false, error: `Steps to reproduce is too long (max ${STEPS_MAX}).` };
  if (pageUrl.length > PAGE_URL_MAX) return { ok: false, error: "Page URL is too long." };
  if (userAgent.length > UA_MAX) return { ok: false, error: "User agent is too long." };

  const id = randomUUID();

  let imageUrl: string | null = null;
  let imageR2Key: string | null = null;
  let imageUploadedAt: Date | null = null;

  const file = formData.get("image");
  if (file) {
    if (!(file instanceof Blob) || file.size === 0) {
      return { ok: false, error: "Invalid image upload." };
    }
    if (!isR2UploadConfigured()) {
      return { ok: false, error: "Image uploads are not configured on the server." };
    }
    if (file.size > 15 * 1024 * 1024) {
      return { ok: false, error: "Image is too large before processing (max 15 MB)." };
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const webp = await compressShopListingSupplementPhotoWebp(buf);
    if (!webp) {
      return { ok: false, error: "Could not compress that image to under 100 KiB. Try a simpler screenshot." };
    }
    imageR2Key = bugFeedbackImageKey(shop.id, id);
    imageUrl = await putPublicR2Object({
      key: imageR2Key,
      body: webp,
      contentType: "image/webp",
    });
    imageUploadedAt = new Date();
  }

  await prisma.bugFeedbackReport.create({
    data: {
      id,
      shopId: shop.id,
      happened,
      expected,
      stepsToReproduce: stepsToReproduce || null,
      pageUrl: pageUrl || null,
      userAgent: userAgent || null,
      imageUrl,
      imageR2Key,
      imageUploadedAt,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/admin");
  return { ok: true, reportId: id };
}

