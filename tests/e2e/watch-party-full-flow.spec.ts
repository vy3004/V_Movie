import { test, expect } from '@playwright/test';

test.describe('Watch Party Master Flow', () => {

  test('Host tạo phòng, Guest xin vào và được duyệt qua aria-label', async ({ browser }) => {
    // 1. Setup Context
    const hostContext = await browser.newContext({ storageState: 'tests/e2e/auth/host.json' });
    const guestContext = await browser.newContext({ storageState: 'tests/e2e/auth/guest.json' });

    const hostPage = await hostContext.newPage();
    const guestPage = await guestContext.newPage();

    // --- BƯỚC 1: HOST TẠO PHÒNG ---
    await hostPage.goto('http://localhost:3000/xem-chung');
    await hostPage.getByRole('button', { name: 'Tạo phòng' }).click();
    
    const searchInput = hostPage.getByRole('textbox', { name: 'Nhập tên phim để tìm kiếm...' });
    await searchInput.fill('conan');
    await hostPage.locator('div').filter({ hasText: /^Thám Tử Lừng Danh ConanDetective Conan • 2005$/ }).first().click();
    
    await hostPage.getByRole('button', { name: 'Private' }).click();
    await hostPage.getByRole('button', { name: '🍿 Mở phòng ngay' }).click();

    // Lấy URL phòng
    await hostPage.waitForURL(/\/xem-chung\/.+/, { timeout: 15000 });
    const roomUrl = hostPage.url();

    // --- BƯỚC 2: GUEST XIN VÀO PHÒNG ---
    await guestPage.goto(roomUrl);
    const knockBtn = guestPage.getByRole('button', { name: /Gõ cửa xin vào/i });
    await expect(knockBtn).toBeVisible();
    await knockBtn.click();
    await expect(guestPage.getByText(/Đang đợi phê duyệt/i)).toBeVisible();

    // --- BƯỚC 3: HOST DUYỆT GUEST BẰNG ARIA-LABEL ---
    // Sử dụng getByLabel để click chính xác Tab Member, không lo click nhầm thanh tìm kiếm
    const memberTab = hostPage.getByLabel('Thành viên');
    await memberTab.click();

    // Đợi danh sách yêu cầu hiện lên
    await expect(hostPage.getByText('Yêu cầu tham gia')).toBeVisible();

    // Bấm nút "Đồng ý" (nút có aria-label="Đồng ý")
    const approveBtn = hostPage.getByLabel('Đồng ý').first();
    await expect(approveBtn).toBeVisible();
    await approveBtn.click();

    // --- BƯỚC 4: KIỂM TRA KẾT QUẢ ---
    // Guest phải vào được phòng và thấy Player
    await expect(guestPage.locator('.video-js')).toBeVisible({ timeout: 15000 });
    
    // Host thấy số lượng thành viên là 2
    await expect(hostPage.getByText('Thành viên (2)')).toBeVisible();
  });
});