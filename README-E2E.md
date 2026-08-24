# E2E tests

The Playwright suite exercises the running application as a user. It never
starts, builds, or deploys Next.js: its only target is `http://localhost:3000`.

## Prerequisites

- Node.js and the repository dependencies installed with `npm ci`.
- Prisma Client generated with `npx prisma generate`.
- Chromium installed once with `npx playwright install chromium`.
- A healthy local app already listening on port 3000, with `.env` containing
  `DEMO_CODE` and `DEMO_CODE_2`.

Run the server using the repository's normal local start procedure, then run:

```powershell
npm run test:e2e        # full suite
npm run check           # tsc --noEmit + e2e suite + production HTTP smoke
```

## How it is wired

- The global setup signs both demo accounts in through the access-code page
  and saves their isolated browser storage under `.playwright/` (ignored by
  Git). Specs reuse those storage states, keeping separate sessions for
  cross-account flows (DMs).
- Mutating cases tag their data with an `E2E <run id>` prefix and delete it in
  teardown. The settings tests create and remove their own throwaway
  credentials account; they never deactivate a demo account.
- `settings.spec.ts` signs the throwaway in by posting to the Auth.js
  credentials callback with `maxRedirects: 0` and asserting the Location
  header — success and failure differ only there.
- One retry per test absorbs single transient blips from the shared hosted
  dev database; every retry stays visible in the report and traces.
- Test-side Prisma calls go through `withDbRetry` for the same reason (the
  app server has its own retry wrapper).
- Cleanup sweeps the broad `E2E e2e-` fixture prefix, not just the current
  run id: killed or aborted runs never reach their own teardown, and a
  run-id-scoped sweep would leak their fixtures forever.
- DM action buttons live in absolutely-positioned hover bars that overlap
  neighbouring rows, so pointer hit-testing retries forever there. The DM
  spec sends real bubbling click events to the newest matching button via
  `page.evaluate` instead. Live delivery to an open conversation is also
  eventually-consistent, so the spec reloads like a user when a fresh
  message has not rendered yet.

## Last full run

2026-08-25 ~01:00 local, against local main `baa46d3`:
10 passed, 2 skipped (documented `test.fixme`), 0 failed, ~4.6 min.

## Known exclusions (pending application fixes)

- `people.spec.ts > "an admin can view a private profile"` — blocked until
  commit `04748a4` (admin private-profile override) merges to main.
- `settings.spec.ts > "deactivation is reversed on the next credentials
  sign-in"` — reactivation paths in `src/auth.ts` clear
  `User.deactivatedAt` without invalidating the 45s session cache, so a fast
  sign-back-in reads a stale cache entry that strips the session identity.
  Re-enable once those sites call `invalidateSessionCache`.

Both are `test.fixme` with the reason documented inline.

## Server lifecycle notes

- If you start the server from a transient shell, the node process can be
  reaped when that shell's process tree exits. Launching `start.ps1` through
  WMI (`Invoke-CimMethod Win32_Process Create`) parents it to the OS instead
  and survives shell exits.
- The suite assumes port 3000 is serving before it runs; it does not manage
  the server itself.
