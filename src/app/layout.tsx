export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { DNABackground } from "@/components/DNABackground";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Sidebar } from "@/components/layout/Sidebar";

export const metadata: Metadata = {
  title: "Snívať — Dream. Grow. Connect.",
  description:
    "A community where people grow together. Build in public, share progress, find your people. Not a job board. Not LinkedIn.",
};

const noFlashScript = `(function(){try{var t=localStorage.getItem('theme');var light=t==='light'||(!t&&!window.matchMedia('(prefers-color-scheme: dark)').matches);if(light){document.documentElement.classList.add('light')}}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: noFlashScript }} />
      </head>
      <body className="min-h-screen">
        <ThemeProvider>
          <DNABackground />
          {/* Mobile top bar (below lg breakpoint) */}
          <div className="lg:hidden">
            <Navbar />
          </div>
          {/* Desktop three-column shell */}
          <div className="mx-auto flex max-w-[1400px]">
            <Sidebar />
            <main className="relative min-h-screen flex-1">{children}</main>
          </div>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}

