import { ImageResponse } from "next/og";

// Shared OG card renderer for post detail routes. Two variants:
// before/after posts get the split RAW/FINAL card (the megaphone
// amplifier); everything else gets image + brand overlay. Failures at
// every step degrade to the branded fallback — scrapers must never see
// a 500 or a leaked hidden post.

export const OG_SIZE = { width: 1200, height: 630 };

const BG = "#14101c";
const ACCENT = "#e8a33d";
const INK = "#f5f1e8";
const MUTED = "#b9b2a5";

async function imageDataUri(url: string): Promise<string | null> {
  try {
    if (!/^https?:\/\//i.test(url)) return null;
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    // Scraper-speed guard: refuse absurd payloads.
    if (buf.length > 6 * 1024 * 1024) return null;
    const type = res.headers.get("content-type") || "image/jpeg";
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

function Badge({ label }: { label: string }) {
  return (
    <div
      style={{
        background: "rgba(0,0,0,0.65)",
        color: "#fff",
        fontSize: 28,
        fontWeight: 800,
        letterSpacing: 2,
        padding: "10px 22px",
        borderRadius: 999,
      }}
    >
      {label}
    </div>
  );
}

function BrandBar({ tagline }: { tagline: string }) {
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "28px 48px",
        background: "rgba(10,8,14,0.72)",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", color: INK }}>
        <span style={{ fontSize: 44, fontWeight: 900 }}>Sní</span>
        <span style={{ fontSize: 44, fontWeight: 900, color: ACCENT }}>vať</span>
      </div>
      <div style={{ fontSize: 26, color: MUTED }}>{tagline}</div>
    </div>
  );
}

export type OgPost = {
  title: string | null;
  content: string | null;
  kind: string | null;
  hidden: boolean | null;
  images: { url: string }[];
};

export async function renderPostOg(post: OgPost | null): Promise<ImageResponse> {
  const title = (post?.title || "Shared on Snívať").slice(0, 90);
  const tagline = "Before/after craft, shared in public";

  // Hidden / missing: branded fallback, zero content leaked.
  if (!post || post.hidden) {
    return new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            width: "100%",
            height: "100%",
            background: BG,
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline" }}>
            <span style={{ fontSize: 96, fontWeight: 900, color: INK }}>Sní</span>
            <span style={{ fontSize: 96, fontWeight: 900, color: ACCENT }}>vať</span>
          </div>
          <div style={{ fontSize: 32, color: MUTED, marginTop: 12 }}>
            Share what you&apos;re building
          </div>
        </div>
      ),
      OG_SIZE
    );
  }

  const isBA = post.kind === "before_after" && post.images.length >= 2;

  if (isBA) {
    const [before, after] = await Promise.all([
      imageDataUri(post.images[0].url),
      imageDataUri(post.images[1].url),
    ]);
    if (before && after) {
      return new ImageResponse(
        (
          <div style={{ display: "flex", width: "100%", height: "100%", background: BG }}>
            <div style={{ position: "relative", width: 600, height: 630 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={before} width={600} height={630} style={{ objectFit: "cover" }} />
              <div style={{ position: "absolute", top: 28, left: 28 }}>
                <Badge label="RAW" />
              </div>
            </div>
            <div style={{ position: "relative", width: 600, height: 630 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={after} width={600} height={630} style={{ objectFit: "cover" }} />
              <div style={{ position: "absolute", top: 28, right: 28 }}>
                <Badge label="FINAL" />
              </div>
            </div>
            <BrandBar tagline={tagline} />
          </div>
        ),
        OG_SIZE
      );
    }
    // Image fetch failed — fall through to the standard card.
  }

  const single = post.images[0]?.url
    ? await imageDataUri(post.images[0].url)
    : null;
  return new ImageResponse(
    (
      <div style={{ position: "relative", width: "100%", height: "100%", background: BG }}>
        {single ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={single} width={1200} height={630} style={{ objectFit: "cover" }} />
        ) : (
          <div
            style={{
              display: "flex",
              width: "100%",
              height: "100%",
              padding: "90px 80px 170px 80px",
              color: INK,
              fontSize: 64,
              fontWeight: 800,
              lineHeight: 1.2,
            }}
          >
            {title}
          </div>
        )}
        {single && (
          <div
            style={{
              position: "absolute",
              left: 48,
              right: 48,
              top: 56,
              color: "#fff",
              fontSize: 56,
              fontWeight: 800,
              lineHeight: 1.2,
              textShadow: "0 2px 18px rgba(0,0,0,0.8)",
            }}
          >
            {title}
          </div>
        )}
        <BrandBar tagline={tagline} />
      </div>
    ),
    OG_SIZE
  );
}
