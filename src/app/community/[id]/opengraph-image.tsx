import { getPost } from "@/lib/queries";
import { OG_SIZE, renderPostOg } from "@/lib/ogImage";

// Dynamic share card for community posts. Cached ≥1h — scrapers must
// never trigger a fresh 2-image fetch+render per share.
export const revalidate = 3600;
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function OgImage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const post = await getPost(id).catch(() => null);
  return renderPostOg(
    post
      ? {
          title: post.title,
          content: post.content,
          kind: (post as { kind?: string | null }).kind ?? null,
          hidden: post.hidden,
          images: (post.images ?? []).map((i) => ({ url: i.url })),
        }
      : null
  );
}
