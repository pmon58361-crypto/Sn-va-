"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  requestJoin,
  cancelRequest,
  approveRequest,
  declineRequest,
  promoteMember,
  demoteMember,
  transferOwnership,
  updateGroupRules,
  setPostPinned,
} from "@/app/groups/actions";

function useAsync() {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function run(key: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    // Re-entry guard: e2e retry loops re-click while a slow call is still
    // in flight (Neon stalls); piling concurrent server actions exhausts
    // the 5-connection pool and nothing ever resolves.
    if (pending !== null) return;
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
  return { pending, error, run };
}

/** Outsider CTA for approval/private groups — request, or withdraw while pending. */
export function JoinRequestButton({
  groupId,
  hasPending,
}: {
  groupId: string;
  hasPending: boolean;
}) {
  const { pending, error, run } = useAsync();
  const [message, setMessage] = useState("");
  const [asking, setAsking] = useState(false);

  if (hasPending) {
    return (
      <div className="flex flex-col gap-2">
        <p className="rounded-xl border border-line bg-surface px-4 py-2 text-center text-sm text-ink-muted">
          Request sent — the owner will review it.
        </p>
        <button
          type="button"
          disabled={pending === "req"}
          onClick={() => run("req", () => cancelRequest(groupId))}
          className="btn-ghost w-full py-2 text-sm disabled:opacity-50"
        >
          {pending === "req" ? "Withdrawing…" : "Withdraw request"}
        </button>
        {error && <p className="text-center text-xs text-warm">{error}</p>}
      </div>
    );
  }

  if (!asking) {
    return (
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setAsking(true)}
          className="btn-primary w-full py-2 text-sm"
        >
          Request to join
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        maxLength={200}
        placeholder="Say hi to the owner (optional)"
        className="input text-sm"
        aria-label="Message to the owner"
      />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending === "req"}
          onClick={() => run("req", () => requestJoin(groupId, message))}
          className="btn-primary flex-1 py-2 text-sm disabled:opacity-50"
        >
          {pending === "req" ? "Sending…" : "Send request"}
        </button>
        <button
          type="button"
          onClick={() => setAsking(false)}
          className="btn-ghost px-4 py-2 text-sm"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-center text-xs text-warm">{error}</p>}
    </div>
  );
}

export type PendingRequest = {
  userId: string;
  message: string | null;
  createdAt: string;
  user: { id: string; name: string | null; image: string | null };
};

/** Owner/moderator inbox — approve or decline each pending request. */
export function PendingRequests({
  groupId,
  requests,
}: {
  groupId: string;
  requests: PendingRequest[];
}) {
  const { pending, error, run } = useAsync();
  if (requests.length === 0) return null;
  return (
    <section aria-label="Join requests" className="card mt-5 p-4">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-faint">
        Join requests ({requests.length})
      </h2>
      <ul className="space-y-2">
        {requests.map((r) => (
          <li
            key={r.userId}
            className="flex items-center gap-2 rounded-xl border border-line p-2.5"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-ink">
                {r.user.name || "Someone"}
              </span>
              {r.message && (
                <span className="block truncate text-xs text-ink-muted">
                  “{r.message}”
                </span>
              )}
            </span>
            <button
              type="button"
              disabled={pending === r.userId}
              onClick={() => run(r.userId, () => approveRequest(groupId, r.userId))}
              className="btn-primary shrink-0 px-3 py-1.5 text-xs disabled:opacity-50"
            >
              Approve
            </button>
            <button
              type="button"
              disabled={pending === r.userId}
              onClick={() => run(r.userId, () => declineRequest(groupId, r.userId))}
              className="btn-ghost shrink-0 px-3 py-1.5 text-xs disabled:opacity-50"
            >
              Decline
            </button>
          </li>
        ))}
      </ul>
      {error && <p className="mt-2 text-xs text-warm">{error}</p>}
    </section>
  );
}

/** Copy-invite-link button for the group header (members grow the room). */
export function InviteButton({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(
            `${window.location.origin}/groups/${slug}`
          );
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {}
      }}
      className="btn-outline shrink-0 px-4 py-2 text-sm"
      title="Copy an invite link to this group"
    >
      {copied ? "✓ Link copied" : "Invite"}
    </button>
  );
}

/** Pin/unpin toggle for a group post (owner/moderator). Rendered by the
 *  feed card when the group page opts in. */
export function PinButton({
  groupId,
  postId,
  pinned,
}: {
  groupId: string;
  postId: string;
  pinned: boolean;
}) {
  const { pending, error, run } = useAsync();
  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        title={pinned ? "Unpin from highlights" : "Pin to highlights"}
        aria-label={pinned ? "Unpin from highlights" : "Pin to highlights"}
        aria-pressed={pinned}
        disabled={pending !== null}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          run(`pin-${postId}`, () => setPostPinned(groupId, postId, !pinned));
        }}
        className={`grid h-7 w-7 place-items-center rounded-lg transition disabled:opacity-50 ${
          pinned
            ? "text-accent hover:bg-soft"
            : "text-ink-faint hover:bg-soft hover:text-ink"
        }`}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill={pinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M9 4h6l1 7 3 3v2H5v-2l-3-3 1-7z" strokeLinejoin="round" />
          <path d="M12 16v5" strokeLinecap="round" />
        </svg>
      </button>
      {error && <span className="text-xs text-warm">{error}</span>}
    </span>
  );
}

/** House rules card: numbered list for everyone, inline editor for the owner. */
export function RulesCard({
  groupId,
  rules,
  canEdit,
}: {
  groupId: string;
  rules: string | null;
  canEdit: boolean;
}) {
  const { pending, error, run } = useAsync();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(rules ?? "");
  if (!rules && !canEdit) return null;
  return (
    <section aria-label="House rules" className="card p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
          Rules
        </h2>
        {canEdit && !editing && (
          <button
            type="button"
            onClick={() => {
              setDraft(rules ?? "");
              setEditing(true);
            }}
            className="text-xs font-medium text-ink-faint transition hover:text-accent"
          >
            Edit
          </button>
        )}
      </div>
      {editing ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder={"One rule per line.\nBe kind.\nNo spam."}
            className="input resize-y text-sm"
            aria-label="Group rules"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending !== null}
              onClick={async () => {
                await run("rules", () => updateGroupRules(groupId, draft));
                setEditing(false);
              }}
              className="btn-primary flex-1 py-1.5 text-sm disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save rules"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="btn-ghost px-3 py-1.5 text-sm"
            >
              Cancel
            </button>
          </div>
          {error && <p className="text-xs text-warm">{error}</p>}
        </div>
      ) : rules ? (
        <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-snug text-ink-soft">
          {rules.split("\n").map((r) => r.trim()).filter(Boolean).map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ol>
      ) : (
        <button
          type="button"
          onClick={() => {
            setDraft("");
            setEditing(true);
          }}
          className="w-full rounded-xl border-2 border-dashed border-line-strong py-4 text-sm text-ink-secondary transition hover:border-accent hover:text-accent"
        >
          + Add house rules
        </button>
      )}
    </section>
  );
}
/** Per-member mod controls for the roster (owner-only actions surface only
 *  when allowed; the server re-checks everything). */
export function MemberControls({
  groupId,
  userId,
  role,
  isOwner,
  isSelf,
}: {
  groupId: string;
  userId: string;
  role: string;
  isOwner: boolean;
  isSelf: boolean;
}) {
  const { pending, error, run } = useAsync();
  const [confirming, setConfirming] = useState<string | null>(null);

  if (!isOwner && !(role === "moderator" && isSelf)) return null;
  if (isSelf && role === "owner") return null;

  const busy = pending !== null;
  return (
    <span className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
      {isOwner && role === "member" && (
        <button
          type="button"
          title="Promote to moderator"
          aria-label="Promote to moderator"
          disabled={busy}
          onClick={() => run(`p-${userId}`, () => promoteMember(groupId, userId))}
          className="rounded-lg border border-line-strong px-2 py-0.5 text-xs text-ink-muted transition hover:border-accent hover:text-accent disabled:opacity-50"
        >
          {pending === `p-${userId}` ? "…" : "Mod+"}
        </button>
      )}
      {(isOwner || isSelf) && role === "moderator" && (
        <button
          type="button"
          title={isSelf ? "Step down as moderator" : "Demote to member"}
          disabled={busy}
          onClick={() => run(`d-${userId}`, () => demoteMember(groupId, userId))}
          className="rounded-lg border border-line-strong px-2 py-0.5 text-xs text-ink-muted transition hover:border-warm hover:text-warm disabled:opacity-50"
        >
          {pending === `d-${userId}` ? "…" : "Mod−"}
        </button>
      )}
      {isOwner && role !== "owner" &&
        (confirming === userId ? (
          <>
            <button
              type="button"
              title="Confirm ownership transfer"
              disabled={busy}
              onClick={() => run(`t-${userId}`, () => transferOwnership(groupId, userId))}
              className="rounded-lg border border-warm px-2 py-0.5 text-xs font-semibold text-warm transition hover:bg-warm-tint disabled:opacity-50"
            >
              {pending === `t-${userId}` ? "…" : "Confirm crown"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(null)}
              className="rounded-lg px-1.5 py-0.5 text-xs text-ink-faint hover:text-ink"
            >
              ✕
            </button>
          </>
        ) : (
          <button
            type="button"
            title="Transfer ownership to them"
            aria-label="Transfer ownership"
            onClick={() => setConfirming(userId)}
            className="rounded-lg border border-line-strong px-2 py-0.5 text-xs text-ink-muted transition hover:border-accent hover:text-accent"
          >
            ♛
          </button>
        ))}
      {error && <span className="text-xs text-warm">{error}</span>}
    </span>
  );
}
