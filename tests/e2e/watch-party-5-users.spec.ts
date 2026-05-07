import { test, expect, Page, BrowserContext } from "@playwright/test";

// Định nghĩa đường dẫn file auth state (Cần gen sẵn trong auth.setup.ts)
const USERS = {
  HOST: "tests/e2e/auth/host.json",
  GUEST1: "tests/e2e/auth/guest1.json",
  GUEST2: "tests/e2e/auth/guest2.json",
  GUEST3: "tests/e2e/auth/guest3.json",
  GUEST4: "tests/e2e/auth/guest4.json",
};

// Hàm tiện ích lấy thời gian video
async function getVideoTime(page: Page) {
  return await page.evaluate(() => {
    const video = document.querySelector("video");
    return video ? video.currentTime : 0;
  });
}

test.describe("Đại Chiến Watch Party - 5 Users (Full Flow)", () => {
  test.setTimeout(120000); // 2 phút vì luồng này rất dài

  test("Host tạo phòng, Duyệt 4 Guests, Test Sync, Phân Quyền & Host Succession", async ({
    browser,
  }) => {
    // 1. KHỞI TẠO 5 TRÌNH DUYỆT ĐỘC LẬP
    const hostContext = await browser.newContext({
      storageState: USERS.HOST,
      permissions: ["microphone", "camera"],
    });
    const g1Context = await browser.newContext({ storageState: USERS.GUEST1 });
    const g2Context = await browser.newContext({ storageState: USERS.GUEST2 });
    const g3Context = await browser.newContext({ storageState: USERS.GUEST3 });
    const g4Context = await browser.newContext({ storageState: USERS.GUEST4 });

    const hostPage = await hostContext.newPage();
    const g1Page = await g1Context.newPage();
    const g2Page = await g2Context.newPage();
    const g3Page = await g3Context.newPage();
    const g4Page = await g4Context.newPage();

    // ==========================================
    // PHASE 1: HOST TẠO PHÒNG PRIVATE
    // ==========================================
    await hostPage.goto("/xem-chung");
    await hostPage.getByRole("button", { name: "Tạo phòng mới" }).click();

    const createModal = hostPage.getByRole("dialog");
    await createModal.waitFor({ state: "visible" });

    await createModal.locator('input[placeholder*="Tìm kiếm"]').fill("Conan");
    // Chờ kết quả search từ API OPhim (hoặc Redis)
    await hostPage.waitForResponse(
      (res) => res.url().includes("/api/movies/list") && res.status() === 200,
    );
    // Chọn phim đầu tiên
    await createModal.locator(".flex.items-center.gap-3.p-3").first().click();
    // Đặt Private
    await createModal.getByRole("button", { name: "Private" }).click();
    // Đặt tên phòng
    await createModal
      .locator('input[name="title"]')
      .fill("Phòng Chiếu 5 Anh Em");
    await createModal.getByRole("button", { name: "Mở phòng ngay" }).click();

    // Chờ vào phòng và lấy Room Code
    await hostPage.waitForURL(/\/xem-chung\/[A-Z0-9]{6}/);
    const roomUrl = hostPage.url();
    console.log("🔗 Room URL:", roomUrl);

    // ==========================================
    // PHASE 2: 4 GUESTS GÕ CỬA VÀ HOST DUYỆT BẰNG TAB THÀNH VIÊN
    // ==========================================
    await Promise.all([
      g1Page.goto(roomUrl),
      g2Page.goto(roomUrl),
      g3Page.goto(roomUrl),
      g4Page.goto(roomUrl),
    ]);

    // Các Guest phải thấy nút "Gõ cửa xin vào" vì là phòng Private
    for (const page of [g1Page, g2Page, g3Page, g4Page]) {
      await expect(
        page.getByRole("button", { name: "Gõ cửa xin vào" }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Gõ cửa xin vào" }).click();
      await expect(page.getByText("Đang đợi phê duyệt...")).toBeVisible();
    }

    // Host mở Tab "Thành viên"
    await hostPage
      .getByRole("button")
      .filter({ has: hostPage.locator("svg") })
      .nth(2)
      .click(); // Click tab Thành viên

    // Đợi 4 yêu cầu xuất hiện
    await expect(hostPage.getByText("Yêu cầu (4)")).toBeVisible({
      timeout: 10000,
    });

    // Host duyệt cả 4 người (Click nút Check xanh lục 4 lần)
    for (let i = 0; i < 4; i++) {
      await hostPage.locator("button.bg-emerald-600").first().click();
      await hostPage.waitForTimeout(500); // Chờ supabase xử lý
    }

    // Xác minh cả 4 Guest đã vào được phòng (Nhìn thấy Video)
    await Promise.all([
      expect(g1Page.locator("video")).toBeVisible({ timeout: 15000 }),
      expect(g2Page.locator("video")).toBeVisible({ timeout: 15000 }),
      expect(g3Page.locator("video")).toBeVisible({ timeout: 15000 }),
      expect(g4Page.locator("video")).toBeVisible({ timeout: 15000 }),
    ]);

    // ==========================================
    // PHASE 3: VIDEO SYNC & PHÂN QUYỀN
    // ==========================================
    // Host tua video đến giây thứ 60
    await hostPage.evaluate(() => {
      const video = document.querySelector("video");
      if (video) video.currentTime = 60;
    });

    // Chờ tín hiệu broadcast đi
    await hostPage.waitForTimeout(2000);

    // Guest 1 cố tình Pause -> Không thành công vì ko có quyền
    await g1Page.evaluate(() => {
      const video = document.querySelector("video");
      if (video) video.pause();
    });
    // Video của Host vẫn phải đang chạy (thời gian tiếp tục tăng > 60)
    const hostTime = await getVideoTime(hostPage);
    expect(hostTime).toBeGreaterThan(60);

    // Host cấp quyền "Điều khiển Video" và "Quản trị viên" cho Guest 1
    // Mở menu 3 chấm của Guest 1
    await hostPage
      .locator(".group.flex.items-center.gap-3")
      .nth(1)
      .locator("button")
      .last()
      .click();
    await hostPage.getByText("Hệ thống").click();
    await hostPage.getByText("Quản trị viên").click();
    await hostPage.waitForTimeout(500);
    await hostPage.getByText("Điều khiển Video").click();

    // Guest 1 thực hiện Pause (Bây giờ thì hợp lệ)
    await g1Page.evaluate(() => {
      const video = document.querySelector("video");
      if (video) video.pause();
    });
    await g1Page.waitForTimeout(1000);

    // Kiểm tra máy Host đã bị Pause theo Guest 1
    const isHostPaused = await hostPage.evaluate(() => {
      return document.querySelector("video")?.paused;
    });
    expect(isHostPaused).toBe(true);

    // ==========================================
    // PHASE 4: CHAT RATE LIMIT & MUTE CHAT
    // ==========================================
    // Host mở Tab Chat
    await hostPage.locator("button").first().click();
    await g2Page.locator("button").first().click();

    // Guest 2 spam chat 6 lần trong 1 giây
    const chatInput = g2Page.locator('input[placeholder*="chat"]');
    for (let i = 0; i < 6; i++) {
      await chatInput.fill(`Spam tin nhắn ${i}`);
      await chatInput.press("Enter");
    }

    // Tin nhắn thứ 6 phải văng Toast báo lỗi Rate Limit
    await expect(g2Page.getByText("chờ một chút")).toBeVisible();

    // Host bực mình -> Mute chat Guest 2
    await hostPage
      .getByRole("button")
      .filter({ has: hostPage.locator("svg") })
      .nth(2)
      .click(); // Tab Member
    await hostPage
      .locator(".group.flex.items-center.gap-3")
      .nth(2)
      .locator("button")
      .last()
      .click(); // Menu G2
    await hostPage.getByText("Kiểm soát").click();
    await hostPage.getByText("Cấm chat").click();

    // Guest 2 không thể chat được nữa (Input bị disable)
    await expect(chatInput).toBeDisabled({ timeout: 5000 });

    // ==========================================
    // PHASE 5: HOST SUCCESSION (CHUYỂN GIAO QUYỀN LỰC)
    // ==========================================
    // Host đóng tab (Mô phỏng rớt mạng / thoát đột ngột)
    await hostContext.close();

    // Theo hook `useHostSuccession`, hệ thống sẽ đếm 30s Grace Period (Trong test mình giảm xuống hoặc skip)
    // Tuy nhiên, vì Host thoát đột ngột nên ta chờ 35s
    console.log("⏳ Đợi 35s để hệ thống bầu Host mới (Host Succession)...");
    await g1Page.waitForTimeout(35000);

    // Guest 1 (đã được cấp quyền Mod) sẽ nhận được Toast làm Host mới
    await expect(
      g1Page.getByText("được chỉ định làm Chủ phòng mới"),
    ).toBeVisible();

    // ==========================================
    // PHASE 6: TÂN HOST (GUEST 1) KẾT THÚC PHÒNG
    // ==========================================
    // Guest 1 mở Tab Settings (Chỉ Host mới thấy tab này)
    await g1Page
      .locator("button")
      .filter({ has: g1Page.locator("svg") })
      .nth(4)
      .click();

    // Bấm Kết thúc
    await g1Page
      .getByRole("button", { name: "Kết thúc phòng xem chung" })
      .click();
    await g1Page.getByRole("button", { name: "Kết thúc" }).click();

    // Xác nhận tất cả mọi người bị đá ra sảnh
    await Promise.all([
      expect(g2Page).toHaveURL(/\/xem-chung/),
      expect(g3Page).toHaveURL(/\/xem-chung/),
      expect(g4Page).toHaveURL(/\/xem-chung/),
    ]);

    // Đảm bảo thông báo hiển thị cho khách
    await expect(g2Page.getByText("Phiên xem chung đã kết thúc")).toBeVisible();
  });
});
