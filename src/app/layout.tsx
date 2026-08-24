export const dynamic = "force-dynamic";

import type { Metadata, Viewport } from "next";
import { Inter, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { PresenceBeat } from "@/components/presence/PresenceBeat";
import { Navbar } from "@/components/layout/Navbar";
import { BottomNav } from "@/components/layout/BottomNav";
import { Sidebar } from "@/components/layout/Sidebar";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://snivat.vercel.app";

const SITE_DESCRIPTION =
  "A community where people grow together. Build in public, share progress, find your people. Not a job board. Not LinkedIn.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Snívať — Dream. Grow. Connect.",
    template: "%s · Snívať",
  },
  description: SITE_DESCRIPTION,
  applicationName: "Snívať",
  openGraph: {
    type: "website",
    siteName: "Snívať",
    title: "Snívať — Dream. Grow. Connect.",
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Snívať — Dream. Grow. Connect.",
    description: SITE_DESCRIPTION,
    images: ["/og-image.png"],
  },
  icons: {
    icon: [
      { url: "/icon.png", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "Snívať",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#121212",
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
          {/* Keyboard users can jump straight past the nav shells. */}
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
          >
            Skip to content
          </a>
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
            <main
              id="main"
              className="relative min-h-screen min-w-0 flex-1 pb-20 lg:pb-0"
            >
              {children}
            </main>
          </div>
          <BottomNav />
          <InstallPrompt />
          <ServiceWorkerRegister />
          <PresenceBeat />
        </ThemeProvider>
      </body>
    </html>
  );
}

