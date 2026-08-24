import { expect, type Browser, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { loadEnvConfig } from "@next/env";
import path from "node:path";

loadEnvConfig(process.cwd());

export const prisma = new PrismaClient();
export const RUN_ID = `e2e-${Date.now()}-${process.pid}`;
export const E2E_PREFIX = `E2E ${RUN_ID}`;
export const BASE_URL = "http://localhost:3000";
export const DEMO_EMAIL = "demo@snivat.local";
export const DEMO2_EMAIL = "demo2@snivat.local";

/**
 * The shared hosted dev database occasionally refuses fresh connections for
 * a few seconds (hosted free-tier behaviour). The app server wraps its own
 * client in retries; the test-side client needs the same resilience.
 */
export async function withDbRetry<T>(operation: () => Promise<T>, attempts = 4): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await operation();
    } catch (err) {
      lastError = err;
      if (attempt < attempts) await new Promise((r) => setTimeout(r, attempt * 2000));
    }
  }
  throw lastError;
}

export const authStatePath = (account: "demo" | "demo2") =>
  path.join(process.cwd(), ".playwright", `${account}.json`);

export function accessCodeFor(account: "demo" | "demo2") {
  const code = account === "demo" ? process.env.DEMO_CODE : process.env.DEMO_CODE_2;
  if (!code) throw new Error(`Missing ${account === "demo" ? "DEMO_CODE" : "DEMO_CODE_2"} in .env`);
  return code;
}

export async function signInWithAccessCode(page: Page, account: "demo" | "demo2") {
  await page.goto(`${BASE_URL}/auth/signin`);
  await page.getByPlaceholder("access code").fill(accessCodeFor(account));
  await page.getByRole("button", { name: /Enter with access code/ }).click();
  await expect(page).toHaveURL(/\/community/, { timeout: 15_000 });
}

export async function signedInPage(browser: Browser, account: "demo" | "demo2") {
  const context = await browser.newContext({ baseURL: BASE_URL, storageState: authStatePath(account) });
  const page = await context.newPage();
  return { context, page };
}

export async function demoUsers() {
  const [demo, demo2] = await withDbRetry(() =>
    Promise.all([
      prisma.user.findUniqueOrThrow({ where: { email: DEMO_EMAIL } }),
      prisma.user.findUniqueOrThrow({ where: { email: DEMO2_EMAIL } }),
    ])
  );
  return { demo, demo2 };
}

/** The regular sign-in screen deliberately exposes access-code only. */
export async function signInWithPassword(page: Page, email: string, password: string) {
  const csrf = await page.request.get(`${BASE_URL}/api/auth/csrf`);
  expect(csrf.ok()).toBeTruthy();
  const { csrfToken } = (await csrf.json()) as { csrfToken: string };
  // Stop at the raw 302: success and failure differ only in the Location
  // target, and following redirects would land on HTML that hides the cause.
  const response = await page.request.post(`${BASE_URL}/api/auth/callback/credentials`, {
    form: {
      csrfToken,
      email,
      password,
      callbackUrl: `${BASE_URL}/settings`,
    },
    maxRedirects: 0,
  });
  const location = response.headers().location ?? "";
  expect(
    response.status(),
    `credentials callback returned HTTP ${response.status()} (location: ${location})`
  ).toBe(302);
  expect(
    location,
    "credentials sign-in was rejected"
  ).not.toContain("error=");
  await page.goto(`${BASE_URL}/settings`);
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
}

export async function createThrowawayAccount() {
  const email = `e2e-throwaway-${RUN_ID}@snivat.local`;
  const password = `pw-${RUN_ID}`;
  const hash = await bcrypt.hash(password, 10);
  const user = await withDbRetry(() =>
    prisma.user.create({
      data: {
        email,
        name: "E2E Throwaway",
        provider: "credentials",
        accounts: {
          create: {
            type: "credentials",
            provider: "credentials",
            providerAccountId: email,
            refresh_token: hash,
          },
        },
        settings: { create: {} },
      },
    })
  );
  return { user, email, password };
}

export async function cleanupE2EData() {
  await withDbRetry(async () => {
    // Broad "E2E e2e-" sweep: killed/aborted runs never reach their own
    // afterEach, so prefix-scoped cleanup would leak their fixtures forever.
    await prisma.message.deleteMany({ where: { content: { startsWith: "E2E e2e-" } } });
    await prisma.post.deleteMany({ where: { title: { startsWith: "E2E e2e-" } } });
    await prisma.ad.deleteMany({ where: { advertiser: { startsWith: "E2E e2e-" } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: "e2e-throwaway-" } } });
  });
}
