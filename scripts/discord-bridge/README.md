# Snívať → Discord Bridge

Posts Snívať's **top community post of the last 24h** into a Discord server
via an incoming **webhook** — no bot account, no extra dependencies, no
changes to the Next.js app.

## Setup (5 minutes)

1. **Create the webhook** in your Discord server:
   `Server Settings → Integrations → Webhooks → New Webhook` → pick the
   channel → **Copy Webhook URL**.
2. **Add the env vars** wherever you schedule the script:
   - `DISCORD_WEBHOOK_URL` — the URL from step 1 (**secret**: anyone with it
     can post to your channel)
   - `DATABASE_URL` — the same Neon connection string the app uses
3. **Test once locally** from the repo root:
   ```bash
   node scripts/discord-bridge/bridge.mjs
   ```

## Scheduling (free options)

### Vercel Cron (runs in the app's deployment)
`vercel.json` gains one entry — the route must be HTTP though, so for cron
you'd wrap this script in `/api/cron/discord` or use option B. Simplest
zero-code path is GitHub Actions:

### GitHub Actions (recommended)
`.github/workflows/discord-bridge.yml`:
```yaml
name: discord-bridge
on:
  schedule:
    - cron: "0 18 * * *"   # daily 18:00 UTC (adjust to your audience)
  workflow_dispatch: {}
jobs:
  post:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npx prisma generate
      - run: node scripts/discord-bridge/bridge.mjs
        env:
          DISCORD_WEBHOOK_URL: ${{ secrets.DISCORD_WEBHOOK_URL }}
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
```
Add the two secrets in the repo settings. Done.

## Behavior

| Situation | Result |
|---|---|
| Zero community posts in window | Silent — nothing posted |
| Top post has zero reactions | Silent — never announces emptiness |
| Same top post as last run | Skipped via state file |
| New top post | Compact embed: title, excerpt, author, reaction/comment counts, link to the post on snivat.vercel.app |

State file lives in the OS temp dir by default (`BRIDGE_STATE_PATH`
overrides). On ephemeral CI filesystems it resets each run — dedupe is then
best-effort, which is acceptable because the daily top post rarely changes
mid-day and the embed carries its own date footer.

## Tuning

- `BRIDGE_WINDOW_HOURS` (default 24) — look-back window
- `BRIDGE_STATE_PATH` — where the dedupe marker lives
