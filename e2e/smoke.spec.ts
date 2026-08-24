import fs from "node:fs/promises";
import path from "node:path";
import { test, expect } from "@playwright/test";

test("public PWA endpoints are served", async ({ request }) => {
  const home = await request.get("/");
  expect(home.status()).toBe(200);
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.status()).toBe(200);
  const serviceWorker = await request.get("/sw.js");
  expect(serviceWorker.status()).toBe(200);
  await expect(serviceWorker.text()).resolves.toContain("VERSION");
  const offline = await request.get("/offline.html");
  expect(offline.status()).toBe(200);
});

const PNG_SIGNATURE = "89504e470d0a1a0a";

/** Width/height live in the IHDR chunk: bytes 16-19 and 20-23, big-endian. */
function pngDimensions(bytes: Buffer): { width: number; height: number } {
  expect(bytes.subarray(0, 8).toString("hex")).toBe(PNG_SIGNATURE);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

test("unknown routes render the branded 404 page", async ({ page }) => {
  const response = await page.goto("/definitely-not-a-real-route");
  expect(response?.status()).toBe(404);
  await expect(page.getByText("~/404")).toBeVisible();
  await expect(page.getByRole("link", { name: "Go home" })).toBeVisible();
});

test("brand raster assets serve at their canonical dimensions", async ({ request }) => {
  const assets = ["/logo.png", "/icon-192.png", "/icon-512.png", "/og-image.png"];
  for (const asset of assets) {
    // Expected dimensions come from the file this repo ships, so the test
    // tracks asset updates without being edited and fails if the served
    // build ever drifts from the checked-in brand files.
    const local = await fs.readFile(path.join(process.cwd(), "public", asset));
    const expected = pngDimensions(local);
    const response = await request.get(asset);
    expect(response.status(), `${asset} status`).toBe(200);
    expect(pngDimensions(await response.body()), asset).toEqual(expected);
  }
});

