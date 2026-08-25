import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getArchivedStories } from "@/lib/stories";
import { cdnUrl } from "@/lib/cdn";
import { timeAgo } from "@/lib/utils";

export const metadata = { title: "Story archive", robots: { index: false } };
export const dynamic = "force-dynamic";

// Your expired stories. Only you can see this page.
export default async function ArchivePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin?callbackUrl=/archive");

  const stories = await getArchivedStories(session.user.id);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Archive</h1>
        <Link
          href={`/profile/${session.user.id}`}
          className="text-sm text-ink-muted hover:text-ink"
        >
          Back to profile
        </Link>
      </div>

      {stories.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface px-6 py-14 text-center">
          <p className="text-lg font-semibold">Nothing archived yet</p>
          <p className="mt-1 text-sm text-ink-muted">
            Stories you share move here after 24 hours — only you can see them.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {stories.map((s) => (
            <figure
              key={s.id}
              className="overflow-hidden rounded-xl border border-line bg-surface"
            >
              {s.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cdnUrl(s.imageUrl, 480)} alt="" className="aspect-[9/16] w-full object-cover" />
              ) : (
                <div
                  className="grid aspect-[9/16] place-items-center p-4 text-center text-sm font-semibold text-white"
                  style={{ background: s.bg || "#262626" }}
                >
                  {s.caption}
                </div>
              )}
              <figcaption className="px-3 py-2 text-xs text-ink-faint">
                {timeAgo(s.createdAt)}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
