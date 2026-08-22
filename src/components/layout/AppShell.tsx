"use client";

import { usePathname } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Sidebar } from "@/components/layout/Sidebar";

// Immersive routes (/ and /auth/*) render children full-bleed with no
// app chrome and no width cap. Everything else gets the standard
// sidebar/nav/footer shell.
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const bare = pathname === "/" || pathname.startsWith("/auth");

  if (bare) {
    return <main className="min-h-screen">{children}</main>;
  }

  return (
    <>
      {/* Mobile top bar (below lg breakpoint) */}
      <div className="lg:hidden">
        <Navbar />
      </div>
      <div className="mx-auto flex max-w-[1400px]">
        <Sidebar />
        <main className="relative min-h-screen flex-1">{children}</main>
      </div>
      <Footer />
    </>
  );
}
