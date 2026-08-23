import { NextRequest, NextResponse } from "next/server";
import { requireActiveUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  MAX_IMAGES_PER_POST,
  MAX_IMAGE_BYTES,
  ALLOWED_IMAGE_TYPES,
} from "@/lib/types";
import { cloudinary } from "@/lib/cloudinary";
import type { UploadApiResponse } from "cloudinary";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

// Handles multipart image uploads. Each request may include one or more files
// and an optional `postId`. Images are enforced against MAX_IMAGES_PER_POST.
//
// Storage strategy:
//  - CLOUDINARY_URL set  -> Cloudinary (required on Vercel; the serverless
//    filesystem is ephemeral, so disk-written images would vanish).
//  - otherwise           -> local /public/uploads (local development only).
async function storeImage(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());

  if (process.env.CLOUDINARY_URL) {
    const res = await new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: "snivat/posts", resource_type: "image" },
        (err, result) => {
          if (err || !result) reject(err ?? new Error("upload failed"));
          else resolve(result);
        }
      );
      stream.end(buffer);
    });
    return res.secure_url;
  }

  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadDir, { recursive: true });
  const ext = file.type.split("/")[1] || "jpg";
  const fname = `${randomUUID()}.${ext}`;
  await writeFile(path.join(uploadDir, fname), buffer);
  return `/uploads/${fname}`;
}

export async function POST(req: NextRequest) {
  // Ban-aware: suspended users can't upload.
  let me: string;
  try {
    me = (await requireActiveUser()).id;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Production hard-fail: writing uploads to the serverless filesystem
  // creates DB rows pointing at files that vanish on the next deploy
  // (observed live: pre-Cloudinary uploads now 404 after redeploys).
  // The local-disk fallback below stays available for development only.
  if (!process.env.CLOUDINARY_URL && process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Image uploads are temporarily unavailable. Please try again later." },
      { status: 503 }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  // Daily per-user upload cap across posts + stories. Free-tier insurance
  // against a runaway script or compromised account burning storage quota.
  const DAILY_UPLOAD_CAP = Number(process.env.DAILY_UPLOAD_CAP || 40);
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const [imagesToday, storiesToday] = await Promise.all([
    prisma.postImage.count({
      where: {
        createdAt: { gte: startOfDay },
        post: { authorId: me },
      },
    }),
    prisma.story.count({
      where: { authorId: me, createdAt: { gte: startOfDay } },
    }),
  ]);
  if (imagesToday + storiesToday + files.length > DAILY_UPLOAD_CAP) {
    return NextResponse.json(
      {
        error: `Daily upload limit reached (${DAILY_UPLOAD_CAP}/day). Used today: ${
          imagesToday + storiesToday
        }.`,
      },
      { status: 429 }
    );
  }

  const postId = (form.get("postId") as string) || undefined;

  // If tied to a post, enforce the per-post image cap.
  if (postId) {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { authorId: true, _count: { select: { images: true } } },
    });
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }
    if (post.authorId !== me) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (post._count.images + files.length > MAX_IMAGES_PER_POST) {
      return NextResponse.json(
        {
          error: `Max ${MAX_IMAGES_PER_POST} images per post. You already have ${post._count.images}.`,
        },
        { status: 400 }
      );
    }
  }

  const urls: string[] = [];
  const errors: string[] = [];

  for (const file of files) {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      errors.push(`${file.name}: unsupported type (${file.type})`);
      continue;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      errors.push(`${file.name}: exceeds 5MB`);
      continue;
    }
    try {
      urls.push(await storeImage(file));
    } catch (err) {
      console.error("[upload] failed:", err);
      errors.push(`${file.name}: upload failed`);
    }
  }

  return NextResponse.json({ urls, errors });
}
