"use client";

// Compact out-link chip for a note's attached track. No playback hosting —
// the chip deep-links to Spotify / YouTube / Apple Music. Display name is
// derived from the URL only (no network fetches on the feed path).

function musicLabel(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (host === "youtu.be" || host.endsWith("youtube.com")) return "YouTube";
    if (host.endsWith("spotify.com")) return "Spotify";
    if (host.endsWith("music.apple.com")) return "Apple Music";
    return host;
  } catch {
    return "Link";
  }
}

export function MusicChip({ url, compact }: { url: string; compact?: boolean }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      onClick={(e) => e.stopPropagation()}
      className={`inline-flex items-center gap-1 rounded-full bg-white/20 px-2 font-medium text-white transition hover:bg-white/30 ${
        compact ? "py-0 text-[9px]" : "mt-1.5 py-0.5 text-[11px]"
      }`}
      aria-label={`Listen on ${musicLabel(url)}`}
    >
      <svg viewBox="0 0 24 24" className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} fill="currentColor" aria-hidden>
        <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" />
      </svg>
      {musicLabel(url)}
    </a>
  );
}
