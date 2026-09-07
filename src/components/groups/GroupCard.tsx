"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { hueGradient } from "@/lib/hue";

export type CardGroup = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  visibility: string;
  category: string | null;
  coverUrl: string | null;
  _count: { members: number; posts: number };
  members: { user: { id: string; name: string | null; image: string | null } }[];
};

/**
 * Discord-discovery card anatomy: tall banner, overlapping icon tile,
 * name + description, online/member footer. Dead covers fall back to the
 * identity-hue banner instead of a white void.
 */
export function GroupCard({
  group,
  online,
  featured,
}: {
  group: CardGroup;
  online: number;
  featured?: boolean;
}) {
  const [dead, setDead] = useState(false);
  const showCover = !!group.coverUrl && !dead;
  const initial = (group.name || "?").trim().charAt(0).toUpperCase();

  return (
    <Link
      href={`/groups/${group.slug}`}
      className="card card-hover group block overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-xl"
    >
      {/* Banner */}
      <div className={`relative w-full overflow-hidden ${featured ? "h-40 sm:h-44" : "h-28"}`}>
        {showCover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={group.coverUrl!}
            alt=""
            loading="lazy"
            onError={() => setDead(true)}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{ background: hueGradient(group.name) }}
          >
            <span
              aria-hidden
              className={`font-black text-white/90 ${featured ? "text-8xl" : "text-6xl"}`}
            >
              {initial}
            </span>
          </div>
        )}
        {featured && (
          <span className="absolute left-4 top-3 rounded-full bg-black/60 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-amber-300">
            Featured
          </span>
        )}
        {group.visibility === "private" && (
          <span className="absolute right-4 top-3 rounded-full bg-black/60 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-white/80">
            Private
          </span>
        )}
      </div>

      {/* Overlapping icon tile — relative + z-10: the banner above is
          positioned, so a static tile would paint UNDER it (the glitch). */}
      <div className="px-4">
        <div className="relative z-10 -mt-6 mb-1.5 flex items-end gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl text-xl font-black text-white ring-4 ring-[var(--bg-surface,#1a1a1c)]"
            style={
              showCover
                ? undefined
                : { background: hueGradient(group.name, { light: 32 }) }
            }
          >
            {showCover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={group.coverUrl!}
                alt=""
                loading="lazy"
                onError={() => setDead(true)}
                className="h-full w-full object-cover"
              />
            ) : (
              initial
            )}
          </span>
        </div>

        <h2 className={`truncate font-bold text-ink ${featured ? "text-lg" : "text-[15px]"}`}>
          {group.name}
        </h2>
        {group.category && (
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-accent">
            {group.category}
          </p>
        )}
        {group.description ? (
          <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-ink-muted">
            {group.description}
          </p>
        ) : (
          <p className="mt-0.5 text-[13px] italic text-ink-faint">
            No description yet.
          </p>
        )}

        <div className="mt-2 flex items-center gap-2 border-t border-line pt-2">
          <MemberStack members={group.members} />
          <p className="truncate font-mono text-xs text-ink-faint">
            {online > 0 && (
              <>
                <span className="text-emerald-500">● {online} online</span>
                {"  "}
              </>
            )}
            <span className="text-ink-muted">
              ● {group._count.members} {group._count.members === 1 ? "member" : "members"}
            </span>
            {"  "}· {group._count.posts} {group._count.posts === 1 ? "post" : "posts"}
          </p>
        </div>
      </div>
      <div className="h-4" />
    </Link>
  );
}

function MemberStack({
  members,
}: {
  members: { user: { id: string; name: string | null; image: string | null } }[];
}) {
  const shown = members.slice(0, 5);
  if (shown.length === 0) return null;
  return (
    <span className="flex shrink-0 -space-x-1.5">
      {shown.map((m) => (
        <span
          key={m.user.id}
          className="rounded-full ring-2 ring-[var(--bg-surface,#1a1a1c)]"
        >
          <Avatar name={m.user.name} image={m.user.image} size={22} />
        </span>
      ))}
    </span>
  );
}
