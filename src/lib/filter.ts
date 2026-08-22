// Minimal write-time content block. Philosophy:
//  - Only HARD blocks live here (slurs / explicit illegal requests).
//    Everything else belongs in the report queue — humans judge nuance.
//  - Exact-ish word matching after light normalization (lowercase, common
//    leetspeak, punctuation stripping) so "b*dword" tricks fail without
//    nuking innocent substrings (the Scunthorpe problem).

const BLOCKED = [
  // racial slurs
  "nigger",
  "nigga",
  "faggot",
  "fag",
  "kike",
  "spic",
  "chink",
  "tranny",
  // explicit criminal solicitation
  "child porn",
  "cp trade",
];

/** Normalize: lowercase, de-leet, strip non-letters/spaces. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/0/g, "o")
    .replace(/[1!]/g, "i")
    .replace(/3/g, "e")
    .replace(/[4@]/g, "a")
    .replace(/5|\$/g, "s")
    .replace(/7/g, "t")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Returns the blocked term if `text` contains one, else null.
 * Word-boundary aware for single tokens; substring match for phrases.
 */
export function findBlockedTerm(text: string | null | undefined): string | null {
  if (!text) return null;
  const hay = normalize(text);
  for (const term of BLOCKED) {
    if (term.includes(" ")) {
      if (hay.includes(term)) return term;
    } else {
      const re = new RegExp(`(^|\\s)${term}(s|ing)?($|\\s)`);
      if (re.test(hay)) return term;
    }
  }
  return null;
}

/** Throw-on-write helper used by server actions. */
export function assertClean(text: string | null | undefined, what = "Message"): void {
  const hit = findBlockedTerm(text);
  if (hit) {
    throw new Error(
      `${what} contains language that isn't allowed here. Remove it and try again.`
    );
  }
}
