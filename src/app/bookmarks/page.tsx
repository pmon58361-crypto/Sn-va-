import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getBookmarkedPosts } from "@/lib/social";
import { PostCard } from "@/components/posts/PostCard";

export const metadata = { title: "Bookmarks" };
export const dynamic = "force-dynamic";

export default async function BookmarksPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin?callbackUrl=/bookmarks");
  const meId = session.user.id;

  const posts = await getBookmarkedPosts(meId);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="display-3 mb-6">Bookmarks</h1>

      {posts.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-ink-muted">
            Nothing saved yet. Tap the bookmark icon on any post and it will
            show up here — only you can see this list.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} viewerId={meId} />
          ))}
        </div>
      )}
    </div>
  );
}
