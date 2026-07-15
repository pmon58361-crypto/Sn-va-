"use client";

import { useState, useActionState } from "react";
import { useRouter } from "next/navigation";
import { ImageUploader, type UploadedImage } from "@/components/posts/ImageUploader";
import { savePost, type PostInput } from "@/app/actions";
import {
  POST_CATEGORIES,
  CATEGORY_META,
  type PostCategory,
} from "@/lib/types";

const CATEGORY_FIELDS: Record<PostCategory, { showJobFields: boolean }> = {
  COMMUNITY: { showJobFields: false },
  JOB_OFFER: { showJobFields: true },
  JOB_REQUEST: { showJobFields: true },
  JOB_LISTING: { showJobFields: true },
};

export function PostComposer({
  initial,
  postId,
  lockedCategory,
}: {
  initial?: Partial<PostInput>;
  postId?: string;
  lockedCategory?: PostCategory;
}) {
  const router = useRouter();
  const [category, setCategory] = useState<PostCategory>(
    lockedCategory || (initial?.category as PostCategory) || "COMMUNITY"
  );
  const [title, setTitle] = useState(initial?.title || "");
  const [content, setContent] = useState(initial?.content || "");
  const [tags, setTags] = useState(initial?.tags || "");
  const [budget, setBudget] = useState(initial?.budget || "");
  const [location, setLocation] = useState(initial?.location || "");
  const [type, setType] = useState(initial?.type || "");
  const [images, setImages] = useState<UploadedImage[]>(
    (initial?.imageUrls || []).map((url) => ({ url, name: "existing" }))
  );

  // useActionState for the submit handler.
  // NOTE: savePost calls redirect() on success, which throws a special
  // NEXT_REDIRECT error internally. We must NOT catch that — let it propagate
  // so Next.js can perform the navigation.
  const [state, formAction, pending] = useActionState(
    async (_prev: unknown, formData: FormData) => {
      try {
        await savePost({
          id: postId,
          category,
          title,
          content,
          tags,
          budget,
          location,
          type,
          imageUrls: images.map((i) => i.url),
        });
        return null;
      } catch (e) {
        // Re-throw redirect signals so Next can handle navigation.
        if (e instanceof Error && e.message === "NEXT_REDIRECT") throw e;
        // `redirect()` from next/navigation throws a digest error; detect it.
        const digest = (e as { digest?: string })?.digest;
        if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) {
          throw e;
        }
        return e instanceof Error ? e.message : "Something went wrong";
      }
    },
    null
  );

  const showJobFields = CATEGORY_FIELDS[category].showJobFields;

  return (
    <form action={formAction} className="space-y-5">
      {state && (
        <div className="rounded-lg border border-warm text-warm bg-warm-tint px-4 py-3 text-sm">
          {String(state)}
        </div>
      )}

      {/* Category selector */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-ink-soft">
          Category
        </label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {POST_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              disabled={!!lockedCategory}
              onClick={() => setCategory(c)}
              className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition disabled:opacity-60 ${
                category === c
                  ? "border-accent bg-accent-tint text-accent"
                  : "border-line-strong text-ink-muted hover:border-zinc-400"
              }`}
            >
              {CATEGORY_META[c].label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-ink-faint">
          {category === "COMMUNITY" && "Share an experience or start a discussion."}
          {category === "JOB_OFFER" && "Tell people what work you can do."}
          {category === "JOB_REQUEST" && "Describe work you need done."}
          {category === "JOB_LISTING" && "Post a job opening people can apply to."}
        </p>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-ink-soft">
          Title
        </label>
        <input
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={
            category === "COMMUNITY"
              ? "Share a title for your post…"
              : "e.g. Senior React Developer"
          }
          required
          maxLength={120}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-ink-soft">
          Details
        </label>
        <textarea
          className="input min-h-[140px] resize-y"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Describe what you're posting about…"
          required
          maxLength={5000}
        />
      </div>

      {showJobFields && (
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-soft">
              Budget / Rate
            </label>
            <input
              className="input"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="$50/hr, $5k fixed…"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-soft">
              Type
            </label>
            <input
              className="input"
              value={type}
              onChange={(e) => setType(e.target.value)}
              placeholder="full-time, freelance…"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-soft">
              Location
            </label>
            <input
              className="input"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Remote, NYC…"
            />
          </div>
        </div>
      )}

      <div>
        <label className="mb-1.5 block text-sm font-medium text-ink-soft">
          Tags <span className="text-ink-faint font-normal">(comma separated)</span>
        </label>
        <input
          className="input"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="react, design, remote"
        />
      </div>

      <ImageUploader images={images} onChange={setImages} postId={postId} />

      <div className="flex items-center justify-end gap-3 border-t border-line pt-5">
        <button
          type="button"
          onClick={() => router.back()}
          className="btn-ghost"
        >
          Cancel
        </button>
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Saving…" : postId ? "Save changes" : "Publish post"}
        </button>
      </div>
    </form>
  );
}
