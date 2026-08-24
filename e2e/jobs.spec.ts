import { test, expect } from "@playwright/test";
import { E2E_PREFIX, cleanupE2EData, demoUsers, prisma, signedInPage } from "./helpers";

test.afterEach(async () => cleanupE2EData());

test("a job listing takes an application and the owner accepts it", async ({ browser }) => {
  test.setTimeout(150_000);
  const title = `${E2E_PREFIX} job listing`;
  const { context: ownerContext, page: owner } = await signedInPage(browser, "demo");
  const { context: applicantContext, page: applicant } = await signedInPage(browser, "demo2");
  try {
    // Owner publishes a JOB_LISTING through the composer's category control.
    await owner.goto("/new");
    await owner.getByRole("button", { name: "Job Listing" }).click();
    await owner.getByPlaceholder("e.g. Senior React Developer").fill(title);
    await owner.getByPlaceholder("Describe what you're posting about…").fill(`${E2E_PREFIX} We are hiring through the applications flow.`);
    await owner.getByPlaceholder("$50/hr").fill(`${E2E_PREFIX} rate`);
    await owner.getByPlaceholder("full-time, freelance").fill(`${E2E_PREFIX} kind`);
    await owner.getByPlaceholder("Remote, NYC").fill(`${E2E_PREFIX} town`);
    await owner.getByRole("button", { name: "Publish" }).click();
    await expect(owner).toHaveURL(/\/applications\//);
    await expect(owner.getByRole("heading", { name: "Applicants (0)" })).toBeVisible();

    // Applicant finds it in the applications feed and applies.
    await applicant.goto("/applications");
    await expect(applicant.getByText(title)).toBeVisible();
    await applicant.getByText(title).first().click();
    await expect(applicant).toHaveURL(/\/applications\//);
    await applicant.getByPlaceholder("Introduce yourself and explain why you're a good fit…").fill(`${E2E_PREFIX} I am the perfect fit.`);
    await applicant.getByRole("button", { name: "Apply now" }).click();
    await expect(applicant.getByText("Application sent.")).toBeVisible();

    // Owner sees the applicant and accepts.
    await owner.reload();
    await expect(owner.getByRole("heading", { name: "Applicants (1)" })).toBeVisible();
    await expect(owner.getByText(`${E2E_PREFIX} I am the perfect fit.`)).toBeVisible();
    await owner.getByRole("button", { name: "Accept" }).click();
    await expect(owner.getByText("Accepted", { exact: true })).toBeVisible();

    // The applicant's view reflects the decision.
    await applicant.reload();
    await expect(applicant.getByText("Your application was accepted.")).toBeVisible();
  } finally {
    await ownerContext.close();
    await applicantContext.close();
  }
});

test("jobs tabs route offers and requests into their own feeds", async ({ browser }) => {
  const { demo } = await demoUsers();
  const offerTitle = `${E2E_PREFIX} work offer`;
  const requestTitle = `${E2E_PREFIX} work request`;
  await prisma.post.createMany({
    data: [
      { authorId: demo.id, category: "JOB_OFFER", title: offerTitle, content: `${E2E_PREFIX} offering fixture`, type: `${E2E_PREFIX} kind`, location: `${E2E_PREFIX} town` },
      { authorId: demo.id, category: "JOB_REQUEST", title: requestTitle, content: `${E2E_PREFIX} request fixture`, type: `${E2E_PREFIX} kind`, location: `${E2E_PREFIX} town` },
    ],
  });
  const { context, page } = await signedInPage(browser, "demo");
  try {
    await page.goto("/jobs");
    await expect(page.getByText(offerTitle)).toBeVisible();
    await expect(page.getByText(requestTitle)).toHaveCount(0);

    await page.goto("/jobs?tab=requests");
    await expect(page.getByText(requestTitle)).toBeVisible();
    await expect(page.getByText(offerTitle)).toHaveCount(0);

    // The kind filter narrows within the active tab.
    await page.goto(`/jobs?type=${encodeURIComponent(`${E2E_PREFIX} kind`)}`);
    await expect(page.getByText(offerTitle)).toBeVisible();
  } finally {
    await context.close();
  }
});
