import { NextRequest, NextResponse } from "next/server";

// Self-healing for Auth.js "Configuration" errors: these are almost always
// caused by stale auth cookies after config/version changes. Redirect the
// user back to sign-in while expiring every authjs cookie, so the next
// attempt starts clean — no manual DevTools surgery required.
export function middleware(req: NextRequest) {
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
  matcher: ["/api/auth/error"],
};
