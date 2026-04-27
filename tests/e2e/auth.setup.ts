import { test as setup } from "@playwright/test";

async function loginViaModal(
  page: any,
  email: string,
  pass: string,
  storagePath: string,
) {
  await page.goto("http://localhost:3000/");

  // 1. Mở Modal
  await page.getByRole("button", { name: "Đăng nhập" }).click();

  // 2. Điền Form (Dùng locator linh hoạt hơn)
  await page
    .locator('input[type="email"], input[placeholder*="email"]')
    .fill(email);
  await page.locator('input[type="password"]').fill(pass);

  // 3. Click Đăng nhập (nút submit)
  await page
    .locator('button[type="submit"], button:has-text("Đăng nhập")')
    .click();

  // 🌟 4. CHỐT HẠ: Đợi Token xuất hiện trong LocalStorage (Không đợi button nữa)
  await page.waitForFunction(
    () => {
      return Object.keys(localStorage).some((key) =>
        key.includes("auth-token"),
      );
    },
    { timeout: 15000 },
  );

  // Đợi thêm 1s để chắc chắn Disk IO đã ghi xong file tạm của trình duyệt
  await page.waitForTimeout(1000);

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

setup("Setup Session cho Guest", async ({ page }) => {
  await loginViaModal(
    page,
    "vinh@gmail.com",
    "111111",
    "tests/e2e/auth/guest.json",
  );
});
