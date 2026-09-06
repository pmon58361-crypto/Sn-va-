import { prisma } from "@/lib/prisma";

// Server-side web-push fan-out. Best-effort by design: sending never throws
// to callers (a dead push endpoint must not fail a DM send). Honors the
// recipient's Settings.notifyMessages master switch. Missing VAPID keys =
// inert (logs once, sends nothing) so deploys without env still boot.

let warned = false;

type PushRow = { endpoint: string; p256dh: string; auth: string };

async function getWebPush() {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) {
    if (!warned) {
      warned = true;
      console.warn("[push] VAPID keys missing — push inert");
    }
    return null;
  }
  const webpush = (await import("web-push")).default;
  webpush.setVapidDetails("mailto:push@snivat.vercel.app", pub, priv);
  return webpush;
}

async function pruneDead(rows: PushRow[], results: PromiseSettledResult<unknown>[]) {
  const dead = rows
    .filter((_, i) => {
      const r = results[i];
      return (
        r.status === "rejected" &&
        typeof (r.reason as { statusCode?: number })?.statusCode === "number" &&
        ((r.reason as { statusCode: number }).statusCode === 404 ||
          (r.reason as { statusCode: number }).statusCode === 410)
      );
    })
    .map((r) => r.endpoint);
  if (dead.length) {
    await prisma.pushSubscription
      .deleteMany({ where: { endpoint: { in: dead } } })
      .catch(() => {});
  }
}

export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; url: string }
): Promise<void> {
  try {
    const [settings, subs] = await Promise.all([
      prisma.settings.findUnique({
        where: { userId },
        select: { notifyMessages: true },
      }),
      prisma.pushSubscription.findMany({ where: { userId } }),
    ]);
    // No settings row = never opted in; explicit opt-out respected.
    if (!settings || settings.notifyMessages === false) return;
    if (subs.length === 0) return;

    const webpush = await getWebPush();
    if (!webpush) return;

    const body = JSON.stringify(payload);
    const results = await Promise.allSettled(
      subs.map((s) =>
        webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body
        )
      )
    );
    await pruneDead(subs, results);
  } catch {
    // push must never break the triggering action
  }
}
