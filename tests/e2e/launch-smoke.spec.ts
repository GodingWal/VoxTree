import { expect, test } from "@playwright/test";

test("public homepage is truthful and has clear account actions", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Bedtime can sound like home/i })).toBeVisible();
  await expect(page.getByRole("link", { name: "Create a parent account" })).toHaveAttribute("href", "/signup");
  await expect(page.getByText("Grandma Rose")).toHaveCount(0);
  await expect(page.getByText("83 stories read")).toHaveCount(0);
});

test("protected dashboard redirects signed-out visitors", async ({ page }) => {
  await page.goto("/dashboard/settings");
  await expect(page).toHaveURL(/\/login/);
});

test("advanced generation APIs are unavailable while feature flagged off", async ({ request }) => {
  const [avatar, singing, talkingVideo] = await Promise.all([
    request.post("/api/avatar/generate", { data: {} }),
    request.post("/api/voices/singing/train", { data: {} }),
    request.post("/api/clips/talking-video", { data: {} }),
  ]);
  expect(avatar.status()).toBe(404);
  expect(singing.status()).toBe(404);
  expect(talkingVideo.status()).toBe(404);
});
