import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { PostComposer } from "@/components/posts/PostComposer";

export const metadata = { title: "New Post — Snívať" };
export const dynamic = "force-dynamic";

export default async function NewPostPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin?callbackUrl=/new");

  return (
    <div className="mx-auto max-w-2xl px-5 py-16">
      <p className="eyebrow mb-4">Compose</p>
      <h1 className="display-2 mb-2 text-ink">Create a post</h1>
      <p className="mb-10 text-ink-muted">
        Share something with the community, offer your services, request help, or
        post a job opening.
      </p>
      <div className="card p-8">
        <PostComposer />
      </div>
    </div>
  );
}
