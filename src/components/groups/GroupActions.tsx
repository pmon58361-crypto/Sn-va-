"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { joinGroup, leaveGroup, deleteGroup, kickMember } from "@/app/groups/actions";

type Props = {
  groupId: string;
  ownerId: string;
  ownerName?: string | null;
  isOwner: boolean;
  isMember: boolean;
  joinMode: "open" | "approval";
};

/** Join / Leave / Delete + member kick controls. Server actions, no client cache. */
export function GroupActions({
  groupId,
  ownerId,
  ownerName,
  isOwner,
  isMember,
  joinMode,
}: Props) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

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

  if (joinMode === "approval") {
    return (
      <div className="flex flex-col gap-1">
        <a
          href={`/dm/${ownerId}?text=${encodeURIComponent(
            "Hi! Could I join your group?"
          )}`}
          className="btn-outline w-full py-2 text-center text-sm"
        >
          Ask to join
        </a>
        <p className="text-center text-xs text-ink-faint">
          {ownerName ? `DM ${ownerName} for an invite.` : "DM the owner for an invite."}
        </p>
      </div>
    );
  }

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
