import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { MapPinIcon, MessageIcon, BriefcaseIcon } from "@/components/ui/Icons";
import { PostActions } from "@/components/posts/PostActions";
import { ImageGrid } from "@/components/posts/ImageGrid";
import { PostEmbeds } from "@/components/posts/PostEmbeds";
import { InterestPrompt } from "@/components/posts/InterestPrompt";
import { timeAgo, parseTags } from "@/lib/utils";
import { CATEGORY_META } from "@/lib/types";
import { reactionCounts, type PostWithRelations } from "@/lib/queries";
import { isFoundingMember } from "@/lib/founding";

function detailPath(category: string, id: string) {
  const meta = CATEGORY_META[category as keyof typeof CATEGORY_META];
  const section = meta?.section || "community";
  return `/${section}/${id}`;
}

export async function PostCard({
  post,
  viewerId,
  showFeedback,
}: {
  post: PostWithRelations;
  viewerId?: string;
  showFeedback?: boolean;
}) {
  if (!post) return null;
  const founding =
    post.author?.createdAt != null
      ? await isFoundingMember(post.author.id, post.author.createdAt)
      : false;
  const tags = parseTags(post.tags);
  const meta = CATEGORY_META[post.category as keyof typeof CATEGORY_META];
  const allReactions = (post.reactions as { type: string; userId: string }[]) ?? [];
  const { likes, dislikes } = reactionCounts(allReactions);
  const viewerReaction = viewerId
    ? allReactions.find((r) => r.userId === viewerId)?.type ?? null
    : null;
  const bookmarked = Array.isArray(
    (post as { bookmarks?: { userId: string }[] }).bookmarks
  )
    ? (post as { bookmarks: { userId: string }[] }).bookmarks.length > 0
    : false;
  const images = post.images ?? [];

  return (
    <article className="group bg-surface sm:card sm:card-hover overflow-hidden sm:rounded-2xl">
      <Link href={detailPath(post.category, post.id)} className="block">
        {/* Row 1: Avatar → name + meta */}
        <div className="flex items-center gap-2.5 px-4 pt-3 sm:px-5">
          <Avatar name={post.author?.name} image={post.author?.image} size={34} />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-semibold text-ink">
              {post.author?.name || "Unknown"}
              {founding && (
                <span
                  className="ml-1.5 align-middle badge bg-accent-tint text-[10px] font-semibold uppercase tracking-wide text-accent"
                  title="Founding Member — first 500 accounts"
                >
                  ★ Founding
                </span>
              )}
            </p>
            <div className="flex flex-wrap items-center gap-x-2 text-xs text-ink-faint">
              <span>{timeAgo(post.createdAt)}</span>
              {post.author?.location && (
                <span className="inline-flex items-center gap-0.5">
                  · <MapPinIcon className="h-3 w-3" /> {post.author.location}
                </span>
              )}
            </div>
          </div>
          <span
            className={`badge shrink-0 ${
              post.category === "JOB_OFFER"
                ? "bg-accent-tint text-accent"
                : post.category === "JOB_REQUEST"
                ? "bg-warm-tint text-warm"
                : post.category === "JOB_LISTING"
                ? "bg-soft text-deep"
                : "bg-accent-tint text-accent"
            }`}
          >
            {meta?.label || post.category}
          </span>
        </div>

        {/* Row 2: Caption/text — ALWAYS above images */}
        <div className="px-4 pt-2.5 sm:px-5">
          <h3 className="text-base font-bold leading-snug text-ink transition-colors group-hover:text-accent">
            {post.title}
          </h3>
          <p className="mt-1 line-clamp-4 text-sm leading-relaxed text-ink-muted">
            {post.content}
          </p>

          {/* Video link embed — first recognized YouTube/TikTok/Reels URL */}
          <PostEmbeds content={post.content} />

          {/* Job metadata */}
          {(post.budget || post.location || post.type) && (
            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
              {post.type && (
                <span className="inline-flex items-center gap-1">
                  <BriefcaseIcon className="h-3.5 w-3.5" />
                  {post.type}
                </span>
              )}
              {post.budget && (
                <span className="font-semibold text-ink-soft">{post.budget}</span>
              )}
              {post.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPinIcon className="h-3.5 w-3.5" />
                  {post.location}
                </span>
              )}
            </div>
          )}

          {tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {tags.slice(0, 5).map((t) => (
                <span key={t} className="badge bg-soft text-ink-muted">
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>
      </Link>

      {/* Row 3: Image grid — Facebook-style. Separate from the link so
          individual tiles can navigate independently. */}
      {images.length > 0 && (
        <div className="mt-2.5">
          <ImageGrid images={images} post={post} />
        </div>
      )}

      {/* Row 4: Actions — relative z-10 gives the report popover a stacking
          context above later feed cards, which otherwise intercept its
          clicks (absolute z-30 alone loses to subsequent siblings). */}
      <div className="relative z-10 flex items-center gap-3 border-t border-line px-4 py-2 sm:px-5 sm:py-2.5">
        <PostActions
          postId={post.id}
          likes={likes}
          dislikes={dislikes}
          comments={post._count?.comments || 0}
          liked={viewerReaction === "like"}
          disliked={viewerReaction === "dislike"}
          bookmarked={bookmarked}
          signedIn={!!viewerId}
          isOwner={!!viewerId && viewerId === post.authorId}
        />
        <Link
          href={detailPath(post.category, post.id)}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-ink-faint transition hover:bg-soft hover:text-accent"
        >
          {post.category === "JOB_LISTING" ? (
            <>
              <BriefcaseIcon className="h-3.5 w-3.5" />
              {post._count?.applications || 0} applicants
            </>
          ) : (
            <>
              <MessageIcon className="h-3.5 w-3.5" />
              {post._count?.comments || 0} replies
            </>
          )}
        </Link>
      </div>

      {/* Ask only on TAGGED posts the viewer hasn't rated yet — answers
          on untagged content can't generalize to other posts, and
          re-asking on rated ones wastes the session budget. */}
      {showFeedback && viewerId && tags.length > 0 && !post.feedback?.length && (
        <InterestPrompt postId={post.id} />
      )}
    </article>
  );
}

// ── Facebook-style multi-image grid ──
//
// 1 → full width, NATURAL ratio (object-contain, no crop)
// 2 → side by side, fixed height, object-cover
// 3 → top full width, bottom two split, fixed heights
// 4 → 2×2, fixed height
// 5+ → 2×2 with last tile showing "+N" overlay
//
// Key: single image = no crop (contain). Multi = cover with FIXED heights
// (ImageGrid lives in ./ImageGrid.tsx — imported at the top.)

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center justify-center px-6 py-20 text-center">
      <h3 className="text-lg font-semibold text-ink">{title}</h3>
      {description && (
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-muted">
          {description}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

