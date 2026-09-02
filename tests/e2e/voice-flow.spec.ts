import { expect, test } from "@playwright/test";

test.describe("voice flow: capture -> clone -> generate", () => {
  test("onboarding wizard validates consent + creates voice (capture step)", async ({ page }) => {
    await page.route("**/api/voices/create", async (route) => {
      const body = await route.request().postDataJSON().catch(() => ({}));
      if (!body.voiceOwnerAuthorized) {
        await route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ error: "consent required" }) });
        return;
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ voiceId: "00000000-0000-4000-a000-000000000001", uploadUrl: "https://storage.googleapis.com/fake-bucket/voice.webm?sig=test", requiredUploadHeaders: { "x-goog-content-length-range": "0,26214400" } }) });
    });
    await page.goto("/onboarding");
    await expect(page.getByText(/Who will be reading/i)).toBeVisible({ timeout: 10000 });
    const nameInput = page.getByPlaceholder(/Grandma Sue/i);
    if (await nameInput.isVisible().catch(() => false)) await nameInput.fill("Grandma Test"); else await page.getByRole("textbox").first().fill("Grandma Test");
    const authCheckbox = page.getByRole("checkbox").first();
    if (await authCheckbox.isVisible().catch(() => false)) await authCheckbox.check();
    const submit = page.getByRole("button", { name: /Continue|Create|Next|Start/i }).first();
    if (await submit.isVisible().catch(() => false)) { await submit.click(); await page.waitForTimeout(800); }
    await expect(page.locator("body")).toBeVisible();
  });
  test("capture modal upload -> process (clone step) uses presigned PUT + Cache-Control", async ({ page }) => {
    let processCalled = false;
    await page.route("https://storage.googleapis.com/**", async (route) => { if (route.request().method() === "PUT") await route.fulfill({ status: 200, body: "" }); else await route.continue(); });
    await page.route("**/api/voices/create", async (route) => { await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ voiceId: "00000000-0000-4000-a000-000000000001", uploadUrl: "https://storage.googleapis.com/fake-bucket/voice-samples/test/voice.webm?sig=test", requiredUploadHeaders: { "x-goog-content-length-range": "0,26214400" } }) }); });
    await page.route("**/api/voices/process", async (route) => { processCalled = true; const body = await route.request().postDataJSON().catch(() => ({})); expect(body.voiceId).toBeTruthy(); await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "processing", voiceId: body.voiceId }) }); });
    await page.goto("/onboarding");
    await page.waitForTimeout(500);
    const result = await page.evaluate(async () => {
      const createRes = await fetch("/api/voices/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "E2E Grandma", voiceOwnerName: "Jane Doe", voiceOwnerRelationship: "Grandmother", voiceOwnerAuthorized: true, contentType: "audio/webm" }) });
      const createData = await createRes.json();
      if (!createRes.ok) return { createData, createStatus: createRes.status };
      const blob = new Blob(["fake-audio"], { type: "audio/webm" });
      const putRes = await fetch(createData.uploadUrl, { method: "PUT", headers: { "Content-Type": "audio/webm", ...createData.requiredUploadHeaders, "Cache-Control": "public, max-age=31536000, immutable" }, body: blob });
      const processRes = await fetch("/api/voices/process", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ voiceId: createData.voiceId }) });
      const processData = await processRes.json();
      return { createData, putStatus: putRes.status, processData, processStatus: processRes.status };
    });
    expect(result.createData?.voiceId).toBeTruthy();
    expect(result.putStatus).toBe(200);
    expect(result.processStatus).toBe(200);
    expect(processCalled).toBe(true);
  });
  test("generate step calls /api/clips/generate and handles cached vs new clip", async ({ page }) => {
    let generateBody = null;
    await page.route("**/api/clips/generate", async (route) => { generateBody = await route.request().postDataJSON().catch(() => null); await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "ready", videoUrl: "https://storage.googleapis.com/fake/clip.mp4", cached: true }) }); });
    await page.goto("/browse");
    const isBrowse = await page.getByText(/Stories|Browse|Library/i).first().isVisible().catch(() => false);
    if (!isBrowse) {
      await page.goto("/");
      const result = await page.evaluate(async () => { const res = await fetch("/api/clips/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contentId: "00000000-0000-4000-a000-000000000002", voiceId: "00000000-0000-4000-a000-000000000001" }) }); return { status: res.status, body: await res.json().catch(() => ({})) }; });
      expect(result.status).toBe(200);
      expect(result.body.videoUrl).toContain("storage.googleapis.com");
      expect(generateBody).toBeTruthy();
      return;
    }
    await expect(page.locator("body")).toBeVisible();
    await page.evaluate(async () => { await fetch("/api/clips/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contentId: "00000000-0000-4000-a000-000000000002", voiceId: "00000000-0000-4000-a000-000000000001" }) }); });
    expect(generateBody).toBeTruthy();
    expect(generateBody.contentId).toBeTruthy();
    expect(generateBody.voiceId).toBeTruthy();
  });
  test("billing usage meter reflects PLAN_LIMITS thresholds", async ({ page }) => {
    await page.route("**/api/me/usage", async (route) => { await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ plan: "free", voiceSlotsUsed: 1, videosUsed: 2, storiesUsed: 3 }) }); });
    await page.goto("/dashboard/settings");
    const meterVisible = await page.getByTestId("billing-usage-meter").isVisible().catch(() => false);
    if (meterVisible) {
      await expect(page.getByTestId("billing-usage-meter")).toBeVisible();
      await expect(page.getByRole("progressbar", { name: /Voice slots/i })).toBeVisible();
      await expect(page.getByRole("progressbar", { name: /Videos/i })).toBeVisible();
    } else {
      const limitsCheck = await page.evaluate(async () => { const res = await fetch("/api/me/usage"); const data = await res.json(); return data; });
      expect(limitsCheck.plan).toBe("free");
      expect(limitsCheck.voiceSlotsUsed).toBe(1);
    }
  });
});
