import { test, expect } from '@playwright/test';

// ROOM_ID nên lấy động hoặc dùng ID cố định đang chạy dev
const ROOM_URL = '/xem-chung/8CP8EP'; 

test.describe('Watch Party Sync - Bộ Test 3', () => {

  test('Đồng bộ video giữa Host và Guest sau khi Duyệt', async ({ browser }) => {
    const hostContext = await browser.newContext({ storageState: 'tests/e2e/auth/host.json' });
    const guestContext = await browser.newContext({ storageState: 'tests/e2e/auth/guest.json' });

    const hostPage = await hostContext.newPage();
    const guestPage = await guestContext.newPage();

    // --- BƯỚC 1: CẢ 2 VÀO PHÒNG ---
    await hostPage.goto(ROOM_URL);
    await guestPage.goto(ROOM_URL);

    // --- BƯỚC 2: GUEST GÕ CỬA (BẮT BUỘC) ---
    const knockBtn = guestPage.getByRole('button', { name: /Gõ cửa xin vào/i });
    await expect(knockBtn).toBeVisible({ timeout: 10000 });
    await knockBtn.click();

    // --- BƯỚC 3: HOST DUYỆT GUEST ---
    await hostPage.getByLabel('Thành viên').click();
    const approveBtn = hostPage.getByLabel('Đồng ý').first();
    await approveBtn.click();

    // --- BƯỚC 4: ĐỢI VIDEO XUẤT HIỆN (FIX LỖI TRONG ẢNH) ---
    // Vì VideoJS load chậm, ta dùng locator chính xác hơn và đợi lâu hơn một chút
    const guestVideo = guestPage.locator('video');
    const hostVideo = hostPage.locator('video');
    
    // Đợi Player của cả 2 sẵn sàng
    await expect(hostVideo).toBeAttached({ timeout: 20000 });
    await expect(guestVideo).toBeAttached({ timeout: 20000 });

    // --- BƯỚC 5: TEST ĐỒNG BỘ ---
    // Host Play
    await hostPage.click('.vjs-big-play-button', { force: true });
    
    // Kiểm tra Guest tự Play (Muted Autoplay)
    await expect(async () => {
      const isPaused = await guestVideo.evaluate((v: HTMLVideoElement) => v.paused);
      expect(isPaused).toBe(false);
    }).toPass({ timeout: 10000 });

    // Host Tua (Seek)
    await hostPage.evaluate(() => {
      const v = document.querySelector('video');
      if (v) v.currentTime = 120; // Tua đến phút thứ 2
    });

    // Kiểm tra Guest nhảy theo
    await expect(async () => {
      const guestTime = await guestVideo.evaluate((v: HTMLVideoElement) => v.currentTime);
      expect(Math.abs(guestTime - 120)).toBeLessThan(2);
    }).toPass({ timeout: 10000 });
  });
});