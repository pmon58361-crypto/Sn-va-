"use client";

import { usePathname } from "next/navigation";

// Hides app chrome (sidebar/nav/footer) on immersive routes:
// the landing page and the sign-in flow render full-bleed.
export function BareGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/" || pathname.startsWith("/auth")) return null;
  return <>{children}</>;
}
