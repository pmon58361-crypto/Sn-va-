"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireActiveUser } from "@/lib/session";
import { assertClean } from "@/lib/filter";
import { claimUploads } from "@/lib/uploads";

// Business ownership claim. Proof bar is deliberately public-evidence:
// a website, registry entry, official social page, or storefront photo an
// admin can open and match to the claimant. No DMs, no "trust me".
// Bare domains are accepted ("example.com" → "https://example.com") —
// rejecting them burned every tester on the first try.
function httpsOrNull(value: unknown): string | null {
  let s = String(value ?? "").trim();
  if (!s) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = `https://${s}`;
  let url: URL;
  try {
    url = new URL(s);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  return url.toString().slice(0, 500);
}

export async function submitBusinessClaim(formData: FormData): Promise<void> {
  const me = await requireActiveUser();

  const businessName = String(formData.get("businessName") || "").trim().slice(0, 60);
  const website = httpsOrNull(formData.get("website"));
  const proofUrl = httpsOrNull(formData.get("proofUrl"));
  const proofImageUrl = httpsOrNull(formData.get("proofImageUrl"));

  if (!businessName) redirect("/verify-business?error=name");
  if (!website && !proofUrl && !proofImageUrl) redirect("/verify-business?error=proof");

  const user = await prisma.user.findUnique({
    where: { id: me.id },
    select: { businessVerifiedAt: true },
  });
  if (user?.businessVerifiedAt) redirect("/verify-business?error=verified");

  const pending = await prisma.businessClaim.findFirst({
    where: { userId: me.id, status: "pending" },
    select: { id: true },
  });
  if (pending) redirect("/verify-business?error=pending");

  try {
    assertClean(businessName, "Business name");
  } catch {
    redirect("/verify-business?error=name");
  }

  await prisma.businessClaim.create({
    data: {
      userId: me.id,
      businessName,
      website,
      proofUrl,
      proofImageUrl,
    },
  });
  // Ledger claim (best-effort): proof photos uploaded through /api/upload
  // would otherwise read as orphans to the future sweeper.
  if (proofImageUrl) {
    await claimUploads(me.id, [proofImageUrl], "business");
  }
  revalidatePath("/verify-business");
  redirect("/verify-business?submitted=1");
}
