import { NextRequest, NextResponse } from "next/server";
import { REF_COOKIE, REF_MAX_AGE, sanitizeRef } from "@/lib/referral";

// Self-healing for Auth.js "Configuration" errors: these are almost always
// caused by stale auth cookies after config/version changes. Redirect the
// user back to sign-in while expiring every authjs cookie, so the next
// attempt starts clean — no manual DevTools surgery required.
export function middleware(req: NextRequest) {
  // First-touch attribution capture: a ?ref= on a matched page stamps the
  // cookie ONLY when none exists yet (never overwrite — first touch wins).
  // Runs before page redirects (notably / → /auth/signin, which drops the
  // query), so the source survives the front-door redirect.
  if (req.nextUrl.pathname !== "/api/auth/error") {
    const ref = sanitizeRef(req.nextUrl.searchParams.get("ref"));
    if (ref && !req.cookies.get(REF_COOKIE)) {
      const res = NextResponse.next();
      res.cookies.set(REF_COOKIE, ref, {
        maxAge: REF_MAX_AGE,
        sameSite: "lax",
        path: "/",
      });
      return res;
    }
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.pathname = "/auth/signin";
  url.search = "?error=configuration";

  const res = NextResponse.redirect(url);
  for (const name of [...req.cookies.getAll().map((c) => c.name)]) {
    if (name.startsWith("authjs.") || name.startsWith("next-auth.")) {
      res.cookies.set(name, "", { maxAge: 0, path: "/" });
    }
  }
  return res;
}

export const config = {
  // Attribution capture stays cheap by staying narrow: the front door (/),
  // the signup page, and the legacy auth-error path. No global matcher —
  // every other request skips middleware entirely.
  matcher: ["/", "/auth/signin", "/api/auth/error"],
};
