// Group discovery categories — CLIENT-SAFE, zero imports.
// Never import @/lib/groups (prisma) from a client component; import from
// here instead so PrismaClient never lands in a browser chunk (it crashes
// hydration with "unable to run in this browser environment").

// Discovery tabs (Discord Home/Gaming/Music… language). Fixed list keeps
// chips clean; groups without one stay uncategorized and still list.
export const GROUP_CATEGORIES = [
  "craft",
  "city",
  "music",
  "gaming",
  "tech",
  "books",
  "fitness",
  "food",
  "film",
  "study",
] as const;

export type GroupCategory = (typeof GROUP_CATEGORIES)[number];

export function normalizeCategory(raw: unknown): string | null {
  const v = String(raw || "").trim().toLowerCase();
  return (GROUP_CATEGORIES as readonly string[]).includes(v) ? v : null;
}
