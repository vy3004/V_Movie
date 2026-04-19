import { test, expect } from '@playwright/test';

// Thay ID phòng thật của bạn ở đây để test chính xác
const ROOM_ID = '555ee96e-fefa-4162-9494-cdb6fb847de0'; 
const ROOM_URL = `/xem-chung/${ROOM_ID}`;

test.describe('Watch Party Access & Member Tab Real-time - Bộ Test 2', () => {

  test('Luồng: Guest gõ cửa -> Host duyệt -> Tab Member cập nhật -> Kick Guest', async ({ browser }) => {
    // 1. Khởi tạo 2 trình duyệt với 2 Session khác nhau
    const hostContext = await browser.newContext({ storageState: 'tests/e2e/auth/host.json' });
    const guestContext = await browser.newContext({ storageState: 'tests/e2e/auth/guest.json' });

    const hostPage = await hostContext.newPage();
    const guestPage = await guestContext.newPage();

    // 2. Guest truy cập phòng - Phải thấy màn hình chờ
    await guestPage.goto(ROOM_URL);
    await expect(guestPage.getByText('Đang đợi phê duyệt...')).toBeVisible({ timeout: 15000 });

    // 3. Host truy cập phòng - Mở Tab Thành viên
    await hostPage.goto(ROOM_URL);
    // Click vào icon Members (Tab thứ 2)
    await hostPage.locator('button').nth(1).click(); 

    // 4. Kiểm tra Host thấy yêu cầu của Guest (Real-time hiển thị)
    const requestItem = hostPage.locator('p:has-text("Yêu cầu tham gia") + div');
    await expect(requestItem).toBeVisible({ timeout: 10000 });
    
    // 5. Host bấm DUYỆT (CheckIcon)
    const approveBtn = requestItem.locator('button').first(); // Nút màu xanh lục
    await approveBtn.click();

    // 6. KIỂM TRA QUAN TRỌNG: 
    // - Bên Guest: Màn hình chờ phải biến mất, Video Player phải hiện ra (Không F5)
    await expect(guestPage.locator('.video-js')).toBeVisible({ timeout: 15000 });
    
    // - Bên Host: Danh sách "Đang xem" phải cập nhật lên 2 người ngay lập tức
    const memberCount = hostPage.locator('text=/Đang xem \(\d+\)/');
    await expect(memberCount).toContainText('Đang xem (2)');

    // 7. Test tính năng KICK (Trục xuất)
    // Host mở menu thao tác của Guest
    await hostPage.locator('.group.relative').last().locator('button').last().click(); 
    const kickBtn = hostPage.getByText('Đuổi khỏi phòng');
    await kickBtn.click();

    // 8. KIỂM TRA: Guest phải bị đá văng về trang sảnh /xem-chung
    await expect(guestPage).toHaveURL('/xem-chung', { timeout: 10000 });
  });
});