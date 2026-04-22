// tests/e2e/watch-party.spec.ts
import { test, expect } from "@playwright/test";
import path from "path";

// 🌟 Thay bằng mã phòng thật đang có trong Database của bạn
const TEST_ROOM_URL = "http://localhost:3000/xem-chung/KRIFZG";

test.describe("Video Sync Test (Pre-existing Room)", () => {
  test("Guest phải đồng bộ Soft Sync với Host trong phòng có sẵn", async ({
    browser,
  }) => {
    const hostContext = await browser.newContext({
      storageState: path.resolve(process.cwd(), "tests/e2e/auth/host.json"),
    });
    const guestContext = await browser.newContext({
      storageState: path.resolve(process.cwd(), "tests/e2e/auth/guest.json"),
    });

    const hostPage = await hostContext.newPage();
    const guestPage = await guestContext.newPage();

    // 1. Cả hai cùng vào thẳng phòng
    await Promise.all([
      hostPage.goto(TEST_ROOM_URL),
      guestPage.goto(TEST_ROOM_URL),
    ]);

    // 2. Đợi Video hiển thị (không bị redirect về login)
    await expect(hostPage.locator("video")).toBeVisible({ timeout: 15000 });
    await expect(guestPage.locator("video")).toBeVisible({ timeout: 15000 });

    // 3. --- TEST SOFT SYNC (GUEST CHẬM 1.5S) ---
    // Host Play
    await hostPage.locator("video").evaluate((v: HTMLVideoElement) => v.play());
    await hostPage.waitForTimeout(2000);

    // Guest bị lag lùi lại 1.5s
    await guestPage.locator("video").evaluate((v: HTMLVideoElement) => {
      v.currentTime -= 1.5;
    });

    // Đợi Player tính toán gap * 0.1
    await guestPage.waitForTimeout(1000);

    // Kiểm tra rate (phải trong khoảng 1.0 < rate <= 1.10)
    const catchUpRate = await guestPage
      .locator("video")
      .evaluate((v: HTMLVideoElement) => v.playbackRate);
    console.log(`Guest đang tăng tốc: ${catchUpRate}x`);
    expect(catchUpRate).toBeGreaterThan(1.0);
    expect(catchUpRate).toBeLessThanOrEqual(1.1);

    // 4. --- TEST HARD SEEK (LỆCH > 3S) ---
    await guestPage.locator("video").evaluate((v: HTMLVideoElement) => {
      v.currentTime -= 5.0;
    });

    await guestPage.waitForTimeout(1500);

    // Guest phải bị "vả" về đúng thời gian của Host (lệch < 1s)
    const hTime = await hostPage
      .locator("video")
      .evaluate((v: HTMLVideoElement) => v.currentTime);
    const gTime = await guestPage
      .locator("video")
      .evaluate((v: HTMLVideoElement) => v.currentTime);
    expect(Math.abs(hTime - gTime)).toBeLessThan(1.0);
  });
});
