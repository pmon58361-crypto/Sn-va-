"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { joinGroup, leaveGroup, deleteGroup, kickMember, updateGroupCover, updateGroupAvatar } from "@/app/groups/actions";

type Props = {
  groupId: string;
  isOwner: boolean;
  isMember: boolean;
};

/** Join / Leave / Delete + member kick controls. Server actions, no client cache. */
export function GroupActions({
  groupId,
  isOwner,
  isMember,
}: Props) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const coverRef = useRef<HTMLInputElement>(null);
  const avatarRef = useRef<HTMLInputElement>(null);

  async function uploadImage(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file || pending) return null;
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) {
      setError("Pick an image under 5MB");
      return null;
    }
    const form = new FormData();
    form.append("files", file);
    const res = await fetch("/api/upload", { method: "POST", body: form });
    const data = (await res.json().catch(() => ({}))) as {
      urls?: string[];
      error?: string;
    };
    if (!res.ok || !data.urls?.[0]) throw new Error(data.error || "Upload failed");
    return data.urls[0];
  }

  async function changeCover(fileList: FileList | null) {
    if (!fileList?.[0] || pending) return;
    setPending("cover");
    setError(null);
    try {
      const url = await uploadImage(fileList);
      if (!url) return;
      const out = await updateGroupCover(groupId, url);
      if (!out.ok) setError(out.error || "Failed");
      else router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setPending(null);
      if (coverRef.current) coverRef.current.value = "";
    }
  }

  async function changeAvatar(fileList: FileList | null) {
    if (!fileList?.[0] || pending) return;
    setPending("avatar");
    setError(null);
    try {
      const url = await uploadImage(fileList);
      if (!url) return;
      const out = await updateGroupAvatar(groupId, url);
      if (!out.ok) setError(out.error || "Failed");
      else router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setPending(null);
      if (avatarRef.current) avatarRef.current.value = "";
    }
  }

  async function run(key: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setPending(key);
    setError(null);
    try {
      const res = await fn();
      if (!res.ok) {
        setError(res.error || "Failed");
        setPending(null);
        return;
      }
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setPending(null);
    }
  }

  if (isOwner) {
    return (
      <div className="flex flex-col gap-2">
        <input
          ref={coverRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => changeCover(e.target.files)}
        />
        <input
          ref={avatarRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => changeAvatar(e.target.files)}
        />
        {/* Banner and icon are independent: square avatar first, wide cover second. */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!!pending}
            onClick={() => avatarRef.current?.click()}
            className="btn-outline flex-1 py-2 text-sm disabled:opacity-50"
          >
            {pending === "avatar" ? "Uploading…" : "Change avatar"}
          </button>
          <button
            type="button"
            disabled={!!pending}
            title="Remove avatar (back to the letter tile)"
            aria-label="Remove avatar"
            onClick={() => run("avatar", () => updateGroupAvatar(groupId, null))}
            className="btn-outline grid h-[38px] w-[38px] shrink-0 place-items-center disabled:opacity-50"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <path d="M4 7h16" strokeLinecap="round" />
              <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" strokeLinecap="round" />
              <path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={pending === "cover"}
            onClick={() => coverRef.current?.click()}
            className="btn-outline flex-1 py-2 text-sm disabled:opacity-50"
          >
            {pending === "cover" ? "Uploading…" : "Change cover"}
          </button>
          <button
            type="button"
            disabled={pending === "cover"}
            title="Remove cover (back to the gradient tile)"
            aria-label="Remove cover"
            onClick={() => run("cover", () => updateGroupCover(groupId, null))}
            className="btn-outline grid h-[38px] w-[38px] shrink-0 place-items-center disabled:opacity-50"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <path d="M4 7h16" strokeLinecap="round" />
              <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" strokeLinecap="round" />
              <path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        <div className="flex items-center gap-2">
          {confirmingDelete ? (
            <>
              <button
                type="button"
                disabled={pending === "del"}
                onClick={() => run("del", () => deleteGroup(groupId))}
                className="rounded-lg border border-warm px-3 py-1.5 text-xs font-semibold text-warm transition hover:bg-warm-tint disabled:opacity-50"
              >
                {pending === "del" ? "Deleting…" : "Yes, delete"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="btn-ghost px-3 py-1.5 text-xs"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="btn-outline w-full py-2 text-sm hover:border-warm hover:text-warm"
            >
              Delete group
            </button>
          )}
        </div>
        {error && <p className="text-xs text-warm">{error}</p>}
      </div>
    );
  }

  if (isMember) {
    return (
      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={pending === "leave"}
          onClick={() => run("leave", () => leaveGroup(groupId))}
          className="btn-outline w-full py-2 text-sm disabled:opacity-50"
        >
          {pending === "leave" ? "Leaving…" : "Leave group"}
        </button>
        {error && <p className="text-xs text-warm">{error}</p>}
      </div>
    );
  }

  // Approval/private outsiders never reach here (the page renders
  // JoinRequestButton instead) — open join is the only remaining path.
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={pending === "join"}
        onClick={() => run("join", () => joinGroup(groupId))}
        className="btn-primary w-full py-2 text-sm disabled:opacity-50"
      >
        {pending === "join" ? "Joining…" : "Join group"}
      </button>
      {error && <p className="text-xs text-warm">{error}</p>}
    </div>
  );
}

/** Owner-only kick control rendered per member row on the group page. */
export function KickButton({ groupId, userId }: { groupId: string; userId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      title="Remove from group"
      aria-label="Remove from group"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await kickMember(groupId, userId).catch(() => {});
        router.refresh();
      }}
      className="shrink-0 rounded-lg border border-line-strong px-2 py-0.5 text-xs text-ink-muted transition hover:border-warm hover:text-warm disabled:opacity-50"
    >
      {pending ? "…" : "✕"}
    </button>
  );
}
