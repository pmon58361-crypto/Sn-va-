import { NextRequest, NextResponse } from "next/server";
import { requireActiveUser } from "@/lib/session";
import { cloudinary } from "@/lib/cloudinary";
import { checkDailyUploadQuota, DAILY_UPLOAD_CAP } from "@/lib/quota";
import { recordUpload, type UploadPurpose } from "@/lib/uploads";

export const runtime = "nodejs";

const PURPOSE_FOLDERS: Record<string, string> = {
  "post:before_after": "snivat/before_after",
  post: "snivat/posts",
  story: "snivat/stories",
  dm: "snivat/messages",
  group_chat: "snivat/messages",
  avatar: "snivat/avatars",
  group_avatar: "snivat/groups",
  group_cover: "snivat/groups",
  highlight: "snivat/highlights",
  ad: "snivat/ads",
};

function folderFor(purpose: string): string {
  return PURPOSE_FOLDERS[purpose] || "snivat/posts";
}

// GET /api/uploads?purpose=… — mint a signature for a direct
// browser→Cloudinary upload. Deliberately minimal: only timestamp+folder
// are signed (dimension caps happen client-side via compression), which
// keeps client/server param serialization identical by construction.
export async function GET(req: NextRequest) {
  let me: string;
  try {
    me = (await requireActiveUser()).id;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.CLOUDINARY_URL) {
    return NextResponse.json(
      { error: "Direct uploads unavailable" },
      { status: 503 }
    );
  }
  const purpose = req.nextUrl.searchParams.get("purpose") || "post";
  const folder = folderFor(purpose);
  const timestamp = Math.floor(Date.now() / 1000);
  const cfg = cloudinary.config() as {
    cloud_name?: string;
    api_key?: string;
    api_secret?: string;
  };
  if (!cfg.cloud_name || !cfg.api_key || !cfg.api_secret) {
    return NextResponse.json(
      { error: "Direct uploads unavailable" },
      { status: 503 }
    );
  }
  // Quota pre-check so the browser doesn't upload bytes that registration
  // will refuse (registration re-checks — the trust boundary).
  const quota = await checkDailyUploadQuota(me, 1);
  if (!quota.ok) {
    return NextResponse.json(
      {
        error: `Daily upload limit reached (${DAILY_UPLOAD_CAP}/day). Used today: ${quota.used}.`,
      },
      { status: 429 }
    );
  }
  const signature = cloudinary.utils.api_sign_request(
    { timestamp, folder },
    cfg.api_secret
  );
  return NextResponse.json({
    cloudName: cfg.cloud_name,
    apiKey: cfg.api_key,
    timestamp,
    folder,
    signature,
  });
}

// POST /api/uploads — register a completed direct upload in the ledger.
// Quota-enforced: this is the trust boundary (signing only pre-checks).
export async function POST(req: NextRequest) {
  let me: string;
  try {
    me = (await requireActiveUser()).id;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: { url?: unknown; publicId?: unknown; purpose?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const url = typeof body.url === "string" ? body.url.trim() : "";
  const publicId =
    typeof body.publicId === "string" && body.publicId.trim()
      ? body.publicId.trim()
      : null;
  const purpose =
    typeof body.purpose === "string" && body.purpose ? body.purpose : "post";
  if (!url.startsWith("https://")) {
    return NextResponse.json({ error: "Invalid upload URL" }, { status: 400 });
  }
  const quota = await checkDailyUploadQuota(me, 1);
  if (!quota.ok) {
    return NextResponse.json(
      {
        error: `Daily upload limit reached (${DAILY_UPLOAD_CAP}/day). Used today: ${quota.used}.`,
      },
      { status: 429 }
    );
  }
  try {
    await recordUpload({
      url,
      publicId,
      uploaderId: me,
      purpose: purpose as UploadPurpose,
    });
  } catch {
    return NextResponse.json(
      { error: "Upload registration failed" },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}
