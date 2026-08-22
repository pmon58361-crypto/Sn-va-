import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { PostComposer } from "@/components/posts/PostComposer";
import { POST_CATEGORIES, type PostCategory } from "@/lib/types";

export const metadata = { title: "New Post — Snívať" };
export const dynamic = "force-dynamic";

export default async function NewPostPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin?callbackUrl=/new");

  const { category } = await searchParams;
  const initialCategory = POST_CATEGORIES.includes(category as PostCategory)
    ? (category as PostCategory)
    : undefined;

  return (
    <div className="mx-auto max-w-2xl px-5 py-8 sm:py-10">
      <h1 className="text-2xl font-extrabold tracking-tight text-ink">
        New post
      </h1>
      <p className="mb-6 mt-1 text-sm text-ink-muted">
        Share an experience, offer your skills, or post an opening.
      </p>

      <PostComposer initial={initialCategory ? { category: initialCategory } : undefined} />
    </div>
  );
}
