import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { ProfileHover } from "@/components/profile/ProfileHover";
import { MessageIcon } from "@/components/ui/Icons";
import { PostActions } from "@/components/posts/PostActions";
import { PinButton } from "@/components/groups/GroupModeration";
import { timeAgo } from "@/lib/utils";
import { CATEGORY_META } from "@/lib/types";
import { reactionCounts, type PostWithRelations } from "@/lib/queries";

function detailPath(category: string, id: string) {
  const meta = CATEGORY_META[category as keyof typeof CATEGORY_META];
  const section = meta?.section || "community";
  return `/${section}/${id}`;
}

// Compact Reddit-style feed row for group detail pages: identity line,
// title, two-line snippet, optional thumbnail, action rail. Dense on
// purpose — rooms read like forums, not card decks. Detail navigation goes
// through explicit links (title, replies); the row itself is not a link.
export function GroupPostRow({
  post,
  viewerId,
  pinContext,
}: {
  post: PostWithRelations;
  viewerId?: string;
  pinContext?: { groupId: string; canPin: boolean };
}) {
  if (!post) return null;
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
  const thumb = post.images?.[0]?.url ?? null;

  return (
    <article className="flex gap-3 px-4 py-3 transition-colors hover:bg-surface-hover/40 sm:px-5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-xs text-ink-faint">
          {post.author?.id ? (
            <ProfileHover userId={post.author.id}>
              <span className="inline-flex shrink-0 items-center gap-1.5">
                <Avatar
                  name={post.author?.name}
                  image={post.author?.image}
                  size={20}
                />
                <span className="max-w-[160px] truncate font-medium text-ink-soft hover:underline">
                  {post.author?.name || "Someone"}
                </span>
              </span>
            </ProfileHover>
          ) : (
            <span className="inline-flex shrink-0 items-center gap-1.5">
              <Avatar name={post.author?.name} image={post.author?.image} size={20} />
              <span className="font-medium text-ink-soft">
                {post.author?.name || "Someone"}
              </span>
            </span>
          )}
          <span aria-hidden>·</span>
          <span className="shrink-0">{timeAgo(post.createdAt)}</span>
        </div>

        <Link
          href={detailPath(post.category, post.id)}
          className="mt-1 block text-[15px] font-bold leading-snug text-ink hover:underline"
        >
          {post.title}
        </Link>
        {post.content && (
          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-ink-muted">
            {post.content}
          </p>
        )}

        <div className="mt-2 flex items-center gap-1">
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
          {pinContext?.canPin && (
            <PinButton
              groupId={pinContext.groupId}
              postId={post.id}
              pinned={!!(post as { isPinned?: boolean }).isPinned}
            />
          )}
          <Link
            href={detailPath(post.category, post.id)}
            className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-1 text-xs font-medium text-ink-faint transition hover:bg-soft hover:text-accent"
          >
            <MessageIcon className="h-3.5 w-3.5" />
            {post._count?.comments || 0}{" "}
            {(post._count?.comments || 0) === 1 ? "reply" : "replies"}
          </Link>
        </div>
      </div>

      {thumb && (
        <Link
          href={detailPath(post.category, post.id)}
          className="w-20 shrink-0 self-start overflow-hidden rounded-lg border border-line sm:w-24"
          tabIndex={-1}
          aria-hidden
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={thumb} alt="" loading="lazy" className="aspect-video w-full object-cover" />
        </Link>
      )}
    </article>
  );
}
