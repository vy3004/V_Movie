// Thêm Page và Response vào import
import { test as setup, expect, Page, Response } from "@playwright/test";

async function loginViaModal(
  page: Page, // 🌟 Sửa 'any' thành 'Page'
  email: string,
  pass: string,
  storagePath: string,
) {
  await page.goto("http://localhost:3000/");

  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();

  const modal = page.getByRole("dialog");
  await modal.waitFor({ state: "visible" });

  await modal.locator('input[type="email"]').fill(email);
  await modal.locator('input[type="password"]').fill(pass);

  // 🌟 Thêm type : Response cho tham số response
  const responsePromise = page.waitForResponse(
    (response: Response) =>
      response.url().includes("/auth/v1/token") && response.status() === 200,
    { timeout: 15000 },
  );

  await modal.locator('button[type="submit"]').click();

  await responsePromise;
  await modal.waitFor({ state: "hidden" });

  await page.context().storageState({ path: storagePath });
}

setup("Setup Session cho Host", async ({ page }) => {
  await loginViaModal(
    page,
    "tang@gmail.com",
    "111111",
    "tests/e2e/auth/host.json",
  );
});

setup("Setup Session cho Guest 1", async ({ page }) => {
  await loginViaModal(
    page,
    "vit@gmail.com",
    "111111",
    "tests/e2e/auth/guest1.json",
  );
});

setup("Setup Session cho Guest 2", async ({ page }) => {
  await loginViaModal(
    page,
    "loc@gmail.com",
    "111111",
    "tests/e2e/auth/guest2.json",
  );
});

setup("Setup Session cho Guest 3", async ({ page }) => {
  await loginViaModal(
    page,
    "vinh@gmail.com",
    "111111",
    "tests/e2e/auth/guest3.json",
  );
});

setup("Setup Session cho Guest 4", async ({ page }) => {
  await loginViaModal(
    page,
    "quang@gmail.com",
    "111111",
    "tests/e2e/auth/guest4.json",
  );
});

setup("Setup Session cho Guest 5", async ({ page }) => {
  await loginViaModal(
    page,
    "lehuuphuomit@gmail.com",
    "111111",
    "tests/e2e/auth/guest5.json",
  );
});
