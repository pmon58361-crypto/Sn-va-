export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { Inter, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { BottomNav } from "@/components/layout/BottomNav";
import { Sidebar } from "@/components/layout/Sidebar";

export const metadata: Metadata = {
  title: "Snívať — Dream. Grow. Connect.",
  description:
    "A community where people grow together. Build in public, share progress, find your people. Not a job board. Not LinkedIn.",
};

const noFlashScript = `(function(){try{var t=localStorage.getItem('theme');var light=t==='light'||(!t&&!window.matchMedia('(prefers-color-scheme: dark)').matches);if(light){document.documentElement.classList.add('light')}}catch(e){}})();`;

// Self-hosted via next/font — zero layout shift, no external requests.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const instrument = Instrument_Serif({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${instrument.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: noFlashScript }} />
      </head>
      <body className="min-h-screen">
        <ThemeProvider>
          {/* DNA canvas background removed: 60fps full-screen redraw kept
              the CPU busy on every page for a texture nobody reads. */}
          {/* Mobile top bar (below lg breakpoint) */}
          <div className="lg:hidden">
            <Navbar />
          </div>
          {/* Desktop three-column shell */}
          <div className="mx-auto flex max-w-[1400px]">
            <Sidebar />
            {/* min-w-0: without it the flex item's automatic minimum size
                lets the landing marquee (w-max) blow main out to ~4400px,
                pushing hero content off-screen. */}
            <main className="relative min-h-screen min-w-0 flex-1 pb-20 lg:pb-0">{children}</main>
          </div>
          <Footer />
          <BottomNav />
        </ThemeProvider>
      </body>
    </html>
  );
}

