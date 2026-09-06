import { NextResponse } from "next/server";
import { getComments } from "@/lib/queries";

/**
 * GET /api/posts/[id]/comments — comment thread for the photo theater.
 * Read-only and public, matching feed visibility (the feed itself renders
 * signed-out). Dates serialized to ISO for the client.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const rows = await getComments(id);
  return NextResponse.json({
    comments: rows.map((c) => ({
      id: c.id,
      content: c.content,
      createdAt:
        c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
      author: c.author
        ? { id: c.author.id, name: c.author.name, image: c.author.image }
        : null,
    })),
  });
}
