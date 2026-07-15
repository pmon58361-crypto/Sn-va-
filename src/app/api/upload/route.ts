import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  MAX_IMAGES_PER_POST,
  MAX_IMAGE_BYTES,
  ALLOWED_IMAGE_TYPES,
} from "@/lib/types";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

// Handles multipart image uploads. Each request may include one or more files
// and an optional `postId`. Images are written to /public/uploads and a URL is
// returned for each. We enforce MAX_IMAGES_PER_POST against an existing post.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    if (post.authorId !== session.user.id) {
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

  // Ensure upload dir exists
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadDir, { recursive: true });

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
    const ext = file.type.split("/")[1] || "jpg";
    const fname = `${randomUUID()}.${ext}`;
    const fpath = path.join(uploadDir, fname);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(fpath, buffer);
    urls.push(`/uploads/${fname}`);
  }

  return NextResponse.json({ urls, errors });
}
