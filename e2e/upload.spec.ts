import { test, expect } from "@playwright/test";
import { v2 as cloudinary } from "cloudinary";
import { E2E_PREFIX, cleanupE2EData, prisma, signedInPage } from "./helpers";

test.afterEach(async () => cleanupE2EData());

/** Extract the Cloudinary public id from a delivery URL. */
function publicIdFromUrl(url: string): string | null {
  const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)\.[a-zA-Z0-9]+$/);
  return match ? match[1] : null;
}

test("a post can carry an uploaded photo end to end", async ({ browser }) => {
  test.setTimeout(150_000);
  const title = `${E2E_PREFIX} photo post`;
  const { context, page } = await signedInPage(browser, "demo");
  let uploadedPublicId: string | null = null;
  try {
    await page.goto("/new");
    await page.getByPlaceholder("Give it a title…").fill(title);
    await page.getByPlaceholder("Describe what you're posting about…").fill(`${E2E_PREFIX} posted with a photo attached.`);
    // 1x1 transparent PNG — the smallest valid image the uploader accepts.
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
      "base64"
    );
    await page.locator('input[type="file"]').setInputFiles({
      name: "e2e-pixel.png",
      mimeType: "image/png",
      buffer: png,
    });
    await expect(page.getByText("1/")).toBeVisible();

    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page).toHaveURL(/\/community\//);

    // The delivered image must come from the CDN path, not a local blob.
    let created: { images: { url: string }[] } | null = null;
    await expect
      .poll(async () => {
        created = await prisma.post.findFirst({ where: { title }, include: { images: true } });
        return created;
      })
      .not.toBeNull();
    expect(created!.images.length).toBeGreaterThanOrEqual(1);
    uploadedPublicId = publicIdFromUrl(created!.images[0]!.url);
    expect(uploadedPublicId, "image url should be a cloudinary asset").toBeTruthy();

    // The detail page renders the uploaded image (public id is unique).
    await expect(page.locator(`img[src*='${uploadedPublicId}']`)).toBeVisible();
  } finally {
    await context.close();
    // Remove the fixture's cloud asset so the media library stays clean.
    if (uploadedPublicId) {
      cloudinary.config(true);
      await cloudinary.uploader.destroy(uploadedPublicId).catch(() => {});
    }
  }
});
