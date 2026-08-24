import { chromium, type FullConfig } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import { BASE_URL, authStatePath, signInWithAccessCode } from "./helpers";

export default async function globalSetup(_config: FullConfig) {
  const stateDir = path.join(process.cwd(), ".playwright");
  await fs.mkdir(stateDir, { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const account of ["demo", "demo2"] as const) {
      const context = await browser.newContext({ baseURL: BASE_URL });
      const page = await context.newPage();
      await signInWithAccessCode(page, account);
      await context.storageState({ path: authStatePath(account) });
      await context.close();
    }
  } finally {
    await browser.close();
  }
}
