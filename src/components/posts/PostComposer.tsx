"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ImageUploader, type UploadedImage } from "@/components/posts/ImageUploader";
import { BeforeAfterSlots, type BeforeAfterSlot } from "@/components/posts/BeforeAfterSlots";
import { savePost, type PostInput } from "@/app/actions";
import {
  POST_CATEGORIES,
  CATEGORY_META,
  type PostCategory,
} from "@/lib/types";
import { parseTags } from "@/lib/utils";
import {
  UsersIcon,
  BriefcaseIcon,
  ClipboardIcon,
  OfferIcon,
  RequestIcon,
} from "@/components/ui/Icons";

const CATEGORY_ICON: Record<PostCategory, React.ComponentType<{ className?: string }>> = {
  COMMUNITY: UsersIcon,
  JOB_OFFER: OfferIcon,
  JOB_REQUEST: RequestIcon,
  JOB_LISTING: ClipboardIcon,
};

const CATEGORY_HINT: Record<PostCategory, string> = {
  COMMUNITY: "Share an experience or start a discussion.",
  JOB_OFFER: "Tell people what work you can do.",
  JOB_REQUEST: "Describe work you need done.",
  JOB_LISTING: "Post a job opening people can apply to.",
};

export function PostComposer({
  initial,
  postId,
  lockedCategory,
  groupId,
  challengeId,
  challengeTitle,
}: {
  initial?: Partial<PostInput>;
  postId?: string;
  lockedCategory?: PostCategory;
  /** Post into this group (from /new?group=<id> on a group page). */
  groupId?: string;
  /** Enter this challenge (from /new?challenge=<id> on a challenge page). */
  challengeId?: string;
  challengeTitle?: string;
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
  // Media mode — Text | Photo | Before/After. Edit mode locks to the
  // post's kind (a comparison post stays a comparison post).
  type MediaMode = "text" | "photo" | "before_after";
  const [mode, setMode] = useState<MediaMode>(
    initial?.kind === "before_after"
      ? "before_after"
      : (initial?.imageUrls?.length ? "photo" : "text")
  );
  const [before, setBefore] = useState<BeforeAfterSlot>(
    initial?.kind === "before_after" && initial?.imageUrls?.[0]
      ? { url: initial.imageUrls[0], alt: initial?.imageAlts?.[0] || "" }
      : null
  );
  const [after, setAfter] = useState<BeforeAfterSlot>(
    initial?.kind === "before_after" && initial?.imageUrls?.[1]
      ? { url: initial.imageUrls[1], alt: initial?.imageAlts?.[1] || "" }
      : null
  );

  // Plain async submit — useActionState is React 19-only and this app
  // runs React 18.3.1.
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Optional poll attachment (create-time only, COMMUNITY posts only).
  const [pollOn, setPollOn] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const isGroupPost = !!groupId && !postId;
  const isChallengeEntry = !!challengeId && !postId;

  function pollPayload() {
    if (postId || !pollOn) return undefined;
    const options = pollOptions.map((o) => o.trim()).filter(Boolean);
    if (!pollQuestion.trim() && options.length === 0) return undefined;
    return { question: pollQuestion.trim(), options };
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    // Client-side before/after gate (server re-validates): both slots
    // filled and both alt texts present, or the post doesn't go out.
    let kind: "standard" | "before_after" = "standard";
    let imageUrls: string[] = images.map((i) => i.url);
    let imageAlts: string[] | undefined;
    if (mode === "before_after") {
      if (!before?.url || !after?.url) {
        setError("Add both a Raw and a Result photo");
        return;
      }
      if (!before.alt.trim() || !after.alt.trim()) {
        setError("Describe both images for screen readers");
        return;
      }
      kind = "before_after";
      imageUrls = [before.url, after.url];
      imageAlts = [before.alt.trim(), after.alt.trim()];
    } else if (mode === "text") {
      imageUrls = [];
    }
    setPending(true);
    setError(null);
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
        kind: postId ? undefined : kind,
        imageUrls,
        imageAlts,
        // Create-time only — edits keep the original group.
        groupId: postId ? undefined : groupId,
        // Create-time only — edits stay in (or out of) the challenge.
        challengeId: postId ? undefined : challengeId,
        poll: postId ? undefined : pollPayload(),
      });
      // savePost redirects on success; Next handles the navigation.
    } catch (err) {
      const digest = (err as { digest?: string })?.digest;
      if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) {
        return;
      }
      if (err instanceof Error && err.message === "NEXT_REDIRECT") {
        return;
      }
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  }

  const isJobish = category !== "COMMUNITY";
  const tagChips = parseTags(tags);

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {error && (
        <div className="rounded-xl border border-warm bg-warm-tint px-4 py-3 text-sm text-warm">
          {String(error)}
        </div>
      )}

      {isGroupPost && (
        <div className="rounded-xl border border-line bg-surface px-4 py-3 text-xs font-medium text-ink-muted">
          Posting into this group — it lives on the group page and on your
          profile, never in the main For you feed.
        </div>
      )}

      {isChallengeEntry && (
        <div className="rounded-xl border border-accent bg-accent-tint px-4 py-3 text-xs font-medium text-accent">
          Entering “{challengeTitle || "this challenge"}” — your post will show
          on the challenge leaderboard.
        </div>
      )}

      {/* Category — segmented control */}
      <div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {POST_CATEGORIES.map((c) => {
            const Icon = CATEGORY_ICON[c];
            const active = category === c;
            return (
              <button
                key={c}
                type="button"
                disabled={!!lockedCategory}
                onClick={() => setCategory(c)}
                aria-pressed={active}
                className={`flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-xs font-semibold transition disabled:opacity-60 ${
                  active
                    ? "border-accent bg-accent-tint text-accent"
                    : "border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink"
                }`}
              >
                <Icon className="h-5 w-5" />
                {CATEGORY_META[c].label}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-ink-faint">{CATEGORY_HINT[category]}</p>
      </div>

      {/* Title — headline style */}
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={
          isJobish ? "e.g. Senior React Developer" : "Give it a title…"
        }
        required
        maxLength={120}
        className="w-full bg-transparent text-xl font-bold text-ink outline-none placeholder:text-ink-faint focus:outline-none"
      />

      {/* Details — 16px on phones so iOS never auto-zooms on focus. */}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Describe what you're posting about…"
        required
        maxLength={5000}
        rows={7}
        className="w-full resize-y rounded-xl border border-line bg-surface px-4 py-3 text-base leading-relaxed text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-accent sm:text-[15px]"
      />

      {/* Job-specific fields */}
      {isJobish && (
        <div className="grid gap-3 rounded-xl bg-soft p-4 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-faint">
              Budget / Rate
            </span>
            <input
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="$50/hr"
              className="input py-2 text-base sm:text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-faint">
              Type
            </span>
            <input
              value={type}
              onChange={(e) => setType(e.target.value)}
              placeholder="full-time, freelance"
              className="input py-2 text-base sm:text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-faint">
              Location
            </span>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Remote, NYC"
              className="input py-2 text-base sm:text-sm"
            />
          </label>
        </div>
      )}

      {/* Tags with live chip preview */}
      <div>
        <input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="Tags — react, design, remote"
          maxLength={200}
          className="input py-2 text-base sm:text-sm"
        />
        {tagChips.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {tagChips.slice(0, 8).map((t) => (
              <span
                key={t}
                className="badge border border-line bg-soft text-xs font-medium text-ink-muted"
              >
                #{t}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Media mode — Text | Photo | Before/After. Locks in edit mode. */}
      {!postId && (
        <div>
          <div className="grid grid-cols-3 gap-2" role="group" aria-label="Post type">
            {(
              [
                { id: "text", label: "Text" },
                { id: "photo", label: "Photo" },
                { id: "before_after", label: "Before/After" },
              ] as const
            ).map((m) => {
              const active = mode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMode(m.id)}
                  aria-pressed={active}
                  className={`rounded-xl border px-3 py-2.5 text-xs font-semibold transition touch-manipulation ${
                    active
                      ? "border-accent bg-accent-tint text-accent"
                      : "border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink"
                  }`}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
          {mode === "before_after" && (
            <p className="mt-2 text-xs text-ink-faint">
              Raw footage | final result, one post. Both photos required.
            </p>
          )}
        </div>
      )}

      {mode === "photo" && (
        <ImageUploader images={images} onChange={setImages} postId={postId} />
      )}

      {mode === "before_after" && (
        <BeforeAfterSlots
          before={before}
          after={after}
          onChange={({ before: b, after: a }) => {
            setBefore(b);
            setAfter(a);
          }}
        />
      )}

      {/* Poll builder — COMMUNITY posts, create-time only. */}
      {!postId && category === "COMMUNITY" && (
        <div className="rounded-xl border border-line bg-soft/60 p-3">
          <button
            type="button"
            onClick={() => setPollOn((v) => !v)}
            aria-expanded={pollOn}
            className={`flex items-center gap-2 py-1 text-sm font-medium transition touch-manipulation ${
              pollOn ? "text-accent" : "text-ink-muted hover:text-ink"
            }`}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M5 20V10M12 20V4M19 20v-7" strokeLinecap="round" />
            </svg>
            {pollOn ? "Remove poll" : "Add a poll"}
          </button>

          {pollOn && (
            <div className="mt-3 space-y-2">
              <input
                value={pollQuestion}
                onChange={(e) => setPollQuestion(e.target.value)}
                maxLength={200}
                placeholder="Poll question"
                className="input py-2 text-base sm:text-sm"
              />
              {pollOptions.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={opt}
                    onChange={(e) =>
                      setPollOptions((opts) =>
                        opts.map((o, j) => (j === i ? e.target.value : o))
                      )
                    }
                    maxLength={80}
                    placeholder={`Option ${i + 1}`}
                    className="input py-2 text-base sm:text-sm"
                  />
                  {pollOptions.length > 2 && (
                    <button
                      type="button"
                      onClick={() =>
                        setPollOptions((opts) => opts.filter((_, j) => j !== i))
                      }
                      aria-label={`Remove option ${i + 1}`}
                      className="shrink-0 touch-manipulation rounded-lg p-2 text-xs text-warm transition hover:bg-warm-tint"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              {pollOptions.length < 4 && (
                <button
                  type="button"
                  onClick={() => setPollOptions((opts) => [...opts, ""])}
                  className="py-1 text-xs font-medium text-accent hover:underline"
                >
                  + Add option
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Sticky action bar — lifted above the mobile tab bar. */}
      <div className="sticky bottom-[calc(84px+env(safe-area-inset-bottom))] z-10 flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface/90 px-4 py-3 shadow-lg backdrop-blur lg:bottom-4">
        <span className="text-xs text-ink-faint">
          {title.length}/120 · {content.length}/5000
        </span>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => router.back()} className="btn-ghost px-4 py-2 text-sm sm:py-1.5">
            Cancel
          </button>
          <button type="submit" disabled={pending} className="btn-primary px-5 py-2 text-sm sm:py-1.5">
            {pending ? "Saving…" : postId ? "Save changes" : "Publish"}
          </button>
        </div>
      </div>
    </form>
  );
}
