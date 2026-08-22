"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

// Unread-notification count dot. Refetches on route change and polls
// occasionally so the badge stays fresh without websockets.
export function NotificationsBadge({ className = "" }: { className?: string }) {
  const [count, setCount] = useState(0);
  const pathname = usePathname();

  useEffect(() => {
    let alive = true;
    fetch("/api/notifications/unread")
      .then((r) => r.json())
      .then((d: { count?: number }) => {
        if (alive && typeof d.count === "number") setCount(d.count);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [pathname]);

  useEffect(() => {
    const iv = setInterval(() => {
      fetch("/api/notifications/unread")
        .then((r) => r.json())
        .then((d: { count?: number }) => {
          if (typeof d.count === "number") setCount(d.count);
        })
        .catch(() => {});
    }, 45_000);
    return () => clearInterval(iv);
  }, []);

  if (count <= 0) return null;
  return (
    <span
      className={`inline-flex min-w-[18px] items-center justify-center rounded-full bg-warm px-1 text-[11px] font-bold leading-[18px] text-white ${className}`}
      aria-label={`${count} unread notifications`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
