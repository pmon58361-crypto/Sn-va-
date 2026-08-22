import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import {
  MapPinIcon,
  BriefcaseIcon,
  ChevronLeftIcon,
} from "@/components/ui/Icons";
import { PostActions } from "@/components/posts/PostActions";
import { OwnerControls } from "@/components/posts/OwnerControls";
import { timeAgo, formatDate, parseTags } from "@/lib/utils";
import { cdnUrl } from "@/lib/cdn";
import { CATEGORY_META } from "@/lib/types";
import { reactionCounts, type PostWithRelations } from "@/lib/queries";

function backHref(category: string) {
  return CATEGORY_META[category as keyof typeof CATEGORY_META]?.section
    ? `/${CATEGORY_META[category as keyof typeof CATEGORY_META].section}`
    : "/community";
}

export function PostDetail({
  post,
  viewerId,
}: {
  post: NonNullable<PostWithRelations>;
  viewerId?: string;
}) {
  const tags = parseTags(post.tags);
  const meta = CATEGORY_META[post.category as keyof typeof CATEGORY_META];
  const allReactions =
    (post.reactions as { type: string; userId: string }[]) ?? [];
  const { likes, dislikes } = reactionCounts(allReactions);
  const viewerReaction = viewerId
    ? allReactions.find((r) => r.userId === viewerId)?.type ?? null
    : null;
  const bookmarked = Array.isArray(
    (post as { bookmarks?: { userId: string }[] }).bookmarks
  )
    ? (post as { bookmarks: { userId: string }[] }).bookmarks.length > 0
    : false;

  return (
    <article className="fade-in">
      <Link
        href={backHref(post.category)}
        className="mb-4 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-accent"
      >
        <ChevronLeftIcon className="h-4 w-4" />
        Back to {meta?.label || "posts"}
      </Link>

      <div className="card overflow-hidden">
        <div className="p-6">
          {/* Author row */}
          <div className="mb-4 flex items-center justify-between">
            <Link
              href={`/profile/${post.author?.id}`}
              className="flex items-center gap-3"
            >
              <Avatar
                name={post.author?.name}
                image={post.author?.image}
                size={44}
              />
              <div className="leading-tight">
                <p className="text-sm font-semibold text-ink hover:text-accent">
                  {post.author?.name || "Unknown"}
                </p>
                <p className="text-xs text-ink-faint">
                  {timeAgo(post.createdAt)} · {formatDate(post.createdAt)}
                </p>
              </div>
            </Link>
            <span
              className={`badge ${
                post.category === "JOB_OFFER"
                  ? "bg-accent-tint text-accent"
                  : post.category === "JOB_REQUEST"
                  ? "bg-warm-tint text-warm"
                  : post.category === "JOB_LISTING"
                  ? "bg-soft text-deep"
                  : "bg-accent-tint text-accent"
              }`}
            >
              {meta?.label}
            </span>
          </div>

          {viewerId === post.authorId && (
            <div className="mb-3 flex justify-end">
              <OwnerControls postId={post.id} category={post.category} />
            </div>
          )}

          <h1 className="mb-2 text-2xl font-bold text-ink">
            {post.title}
          </h1>

          {/* Job meta */}
          {(post.budget || post.location || post.type) && (
            <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg bg-soft px-4 py-3 text-sm">
              {post.budget && (
                <span>
                  <span className="text-ink-faint">Budget:</span>{" "}
                  <span className="font-semibold text-ink">
                    {post.budget}
                  </span>
                </span>
              )}
              {post.type && (
                <span className="inline-flex items-center gap-1 text-ink-muted">
                  <BriefcaseIcon className="h-4 w-4" />
                  {post.type}
                </span>
              )}
              {post.location && (
                <span className="inline-flex items-center gap-1 text-ink-muted">
                  <MapPinIcon className="h-4 w-4" />
                  {post.location}
                </span>
              )}
              {post.status === "closed" && (
                <span className="badge bg-soft text-ink-muted">
                  Closed
                </span>
              )}
            </div>
          )}

          <div className="max-w-none whitespace-pre-wrap leading-relaxed text-ink-soft">
            {post.content}
          </div>

          {tags.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <span
                  key={t}
                  className="badge bg-soft text-ink-muted"
                >
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Image gallery — natural aspect ratios, no forced crop.
            Single image gets max width; multiple images grid side by side. */}
        {post.images && post.images.length > 0 && (
          <div
            className={`border-t border-line p-4 ${
              post.images.length === 1 ? "" : "grid gap-2 sm:grid-cols-2"
            }`}
          >
            {post.images.map((img, i) => (
              <div
                key={img.id}
                className="overflow-hidden rounded-lg border border-line bg-soft"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={cdnUrl(img.url, 1080)}
                  alt={`image ${i + 1}`}
                  className={`mx-auto w-full object-contain ${
                    post.images.length === 1 ? "max-h-[700px]" : "max-h-[400px]"
                  }`}
                  loading={i > 0 ? "lazy" : "eager"}
                />
              </div>
            ))}
          </div>
        )}

        {/* Action row */}
        <div className="flex items-center gap-2 border-t border-line px-6 py-4">
          <PostActions
            postId={post.id}
            likes={likes}
            dislikes={dislikes}
            comments={post._count?.comments || 0}
            liked={viewerReaction === "like"}
            disliked={viewerReaction === "dislike"}
            bookmarked={bookmarked}
            signedIn={!!viewerId}
            variant="detail"
          />
        </div>
      </div>
    </article>
  );
}

export function CommentList({
  comments,
}: {
  comments: Awaited<ReturnType<typeof import("@/lib/queries").getComments>>;
}) {
  if (comments.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-ink-faint">
        No comments yet — be the first to reply.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {comments.map((c) => (
        <div key={c.id} className="card flex gap-3 p-4">
          <Avatar name={c.author?.name} image={c.author?.image} size={32} />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Link
                href={`/profile/${c.author?.id}`}
                className="text-sm font-medium text-ink hover:text-accent"
              >
                {c.author?.name || "Unknown"}
              </Link>
              <span className="text-xs text-ink-faint">{timeAgo(c.createdAt)}</span>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm text-ink-soft">
              {c.content}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

