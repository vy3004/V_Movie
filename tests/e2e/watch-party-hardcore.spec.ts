import { test, expect, Page } from "@playwright/test";

const USERS = {
  HOST: "tests/e2e/auth/host.json",
  GUEST1: "tests/e2e/auth/guest1.json",
  GUEST2: "tests/e2e/auth/guest2.json",
  GUEST3: "tests/e2e/auth/guest3.json",
  GUEST4: "tests/e2e/auth/guest4.json",
};

test.describe("Watch Party - Hardcore E2E (No LiveKit) & Hidden Bugs", () => {
  test.setTimeout(180000); // 3 phút cho luồng cực dài này

  test("Mô phỏng 5 Users: Tạo phòng, Từ chối, Spam, Đảo chính và Playlist", async ({
    browser,
  }) => {
    // Tắt quyền microphone/camera để bỏ qua hoàn toàn LiveKit
    const hostContext = await browser.newContext({
      storageState: USERS.HOST,
      permissions: [],
    });
    const g1Context = await browser.newContext({
      storageState: USERS.GUEST1,
      permissions: [],
    });
    const g2Context = await browser.newContext({
      storageState: USERS.GUEST2,
      permissions: [],
    });
    const g3Context = await browser.newContext({
      storageState: USERS.GUEST3,
      permissions: [],
    });
    const g4Context = await browser.newContext({
      storageState: USERS.GUEST4,
      permissions: [],
    });

    const hostPage = await hostContext.newPage();
    const g1Page = await g1Context.newPage();
    const g2Page = await g2Context.newPage();
    const g3Page = await g3Context.newPage();
    const g4Page = await g4Context.newPage();

    let roomUrl = "";

    await test.step("1. Host tạo phòng Private với giới hạn 4 người", async () => {
      await hostPage.goto("/xem-chung");
      await hostPage.getByRole("button", { name: /Tạo phòng mới/i }).click();

      const modal = hostPage.getByTestId("create-room-modal");
      await expect(modal).toBeVisible({ timeout: 10000 });

      const searchPromise = hostPage.waitForResponse(
        (res) => res.url().includes("/api/movies/list") && res.status() === 200,
      );
      await modal.getByTestId("movie-search-input").fill("Naruto");
      await searchPromise;

      const firstMovieItem = modal.getByTestId("movie-search-result").first();
      await expect(firstMovieItem).toBeVisible({ timeout: 5000 });
      await firstMovieItem.click();

      await modal.getByTestId("btn-private").click();
      await modal.getByTestId("room-title-input").fill("Phòng Test Siêu Khó");
      await modal.getByTestId("room-capacity-slider").fill("4");
      await modal.getByTestId("create-room-submit").click();

      await hostPage.waitForURL(/\/xem-chung\/[A-Z0-9]{6}/, { timeout: 15000 });
      roomUrl = hostPage.url();
      console.log(`🔗 Room URL: ${roomUrl}`);
    });

    await test.step('2. Bốn Guest gõ cửa - Test Bug "Phòng Đầy" và "Reject"', async () => {
      await Promise.all([
        g1Page.goto(roomUrl),
        g2Page.goto(roomUrl),
        g3Page.goto(roomUrl),
        g4Page.goto(roomUrl),
      ]);

      // Tất cả cùng gõ cửa
      for (const page of [g1Page, g2Page, g3Page, g4Page]) {
        await page.getByRole("button", { name: /Gõ cửa xin vào/i }).click();
        await expect(page.getByText("Đang đợi phê duyệt...")).toBeVisible({
          timeout: 10000,
        });
      }

      // Host mở Tab Members
      const tabContainer = hostPage.locator(
        ".bg-zinc-950\\/40.border-b.border-zinc-800",
      );
      await tabContainer.locator("button").nth(1).click();

      await expect(hostPage.getByText("Yêu cầu (4)")).toBeVisible({
        timeout: 10000,
      });

      // Lấy danh sách các thẻ "Đang chờ duyệt"
      const pendingItems = hostPage.locator(".bg-red-500\\/5");

      // Host duyệt Guest 1, 2, 3
      for (let i = 0; i < 3; i++) {
        // Trỏ chính xác vào nút "Check xanh" của thẻ chờ duyệt ĐẦU TIÊN
        await pendingItems.first().locator("button.bg-emerald-600").click();
        await hostPage.waitForTimeout(1000);
      }

      // Lúc này phòng đã có 4 người (Host + 3 Guests) -> Đạt giới hạn max = 4.
      // Xác minh nút duyệt của Guest 4 bị vô hiệu hóa
      await expect(hostPage.getByText("Phòng đầy")).toBeVisible();
      await expect(
        pendingItems.first().locator("button.bg-emerald-600"),
      ).toBeDisabled();

      // Host TỪ CHỐI (Reject) Guest 4 bằng cách bấm nút X đen của thẻ đó
      await pendingItems.first().locator("button.bg-zinc-800").click();

      // Xác minh Guest 4 bị đá ra màn hình Blocked
      await expect(g4Page.getByText("Bạn đã bị chặn")).toBeVisible({
        timeout: 5000,
      });
      await g4Context.close(); // G4 hết vai
    });

    await test.step("3. Test Bug: Spam Chat & Global Mute (Cấm chat toàn phòng)", async () => {
      // Guest 1 và 2 mở tab chat
      const chatTabBtn = g1Page
        .locator(".bg-zinc-950\\/40.border-b.border-zinc-800 > button")
        .nth(0);
      await chatTabBtn.click();
      await g2Page
        .locator(".bg-zinc-950\\/40.border-b.border-zinc-800 > button")
        .nth(0)
        .click();

      const chatInputG1 = g1Page.locator('input[placeholder*="chat"]');

      // G1 Spam chat để dính Rate Limit
      for (let i = 0; i < 6; i++) {
        await chatInputG1.fill(`Spam test ${i}`);
        await chatInputG1.press("Enter");
      }
      await expect(g1Page.getByText("chờ một chút")).toBeVisible();

      // Host mở Tab Settings (Nút thứ 4)
      await hostPage
        .locator(".bg-zinc-950\\/40.border-b.border-zinc-800 > button")
        .nth(3)
        .click();

      // Host tắt tính năng "Khách được phép chat"
      // Chọn thẳng vào Text Label, không bốc bừa thẻ <div role="switch">
      await hostPage
        .locator("label")
        .filter({ hasText: "Khách được phép chat" })
        .click();

      // Xác minh Bug Ẩn: Trạng thái Global Mute đồng bộ Realtime tới mọi khách
      await expect(chatInputG1).toHaveAttribute("disabled", "");
      await expect(chatInputG1).toHaveAttribute(
        "placeholder",
        "Bị cấm chat...",
      );

      const chatInputG2 = g2Page.locator('input[placeholder*="chat"]');
      await expect(chatInputG2).toHaveAttribute("disabled", "");
    });

    await test.step("4. Test Bug: Đảo Chính (Mutiny) - Mod không được kick Host", async () => {
      // Host cấp quyền "Quản trị viên" cho Guest 1
      await hostPage
        .locator(".bg-zinc-950\\/40.border-b.border-zinc-800 > button")
        .nth(1)
        .click(); // Tab Members

      // Tìm dòng của Guest trong danh sách
      const guest1Item = hostPage
        .locator(".group.flex.items-center.gap-3")
        .filter({ hasText: "Guest" })
        .first();
      await guest1Item.locator("button").last().click(); // Mở Menu 3 chấm

      await hostPage.getByText("Hệ thống").click();
      await hostPage.getByText("Quản trị viên").click();
      await hostPage.waitForTimeout(1000);

      // Guest 1 mở tab Members, thử mở menu của Host
      await g1Page
        .locator(".bg-zinc-950\\/40.border-b.border-zinc-800 > button")
        .nth(1)
        .click();
      const hostItem = g1Page
        .locator(".group.flex.items-center.gap-3")
        .filter({ hasText: "Host" })
        .first();

      // Xác minh Bug Ẩn: Mod KHÔNG CÓ MENU để thao tác với Host (chống lật đổ)
      // Thẻ participantItem của host không sinh ra nút <button> nào cho Mod cả
      await expect(hostItem.locator("button")).toHaveCount(0);
    });

    await test.step("5. Test Bug: Thêm phim trùng vào Playlist & Play Now", async () => {
      await hostPage
        .locator(".bg-zinc-950\\/40.border-b.border-zinc-800 > button")
        .nth(2)
        .click(); // Tab Playlist

      // Mở tìm kiếm
      await hostPage
        .getByRole("button", { name: /Thêm phim vào playlist/i })
        .click();
      await hostPage.locator('input[placeholder*="Tìm phim"]').fill("Conan");
      await hostPage.waitForResponse(
        (res) => res.url().includes("/api/movies/list") && res.status() === 200,
      );
      await hostPage.locator(".flex.items-center.gap-3.p-3").first().click();

      // Thử thêm lại phim Conan lần nữa
      await hostPage
        .getByRole("button", { name: /Thêm phim vào playlist/i })
        .click();
      await hostPage.locator('input[placeholder*="Tìm phim"]').fill("Conan");
      await hostPage.waitForResponse(
        (res) => res.url().includes("/api/movies/list") && res.status() === 200,
      );
      await hostPage.locator(".flex.items-center.gap-3.p-3").first().click();

      // Xác minh Bắn lỗi phim đã có trong danh sách
      await expect(
        hostPage.getByText("đã có trong danh sách chờ"),
      ).toBeVisible();

      // Host bấm Play Now phim trong hàng đợi
      await hostPage.getByRole("button", { name: /Phát ngay/i }).click();

      // Xác minh Bug Ẩn: Thông báo System chat phải hiện ra cho Guest
      await expect(g2Page.getByText("đã phát phim")).toBeVisible();
    });

    await test.step("6. Chuyển giao quyền Host thủ công & Đóng phòng", async () => {
      // Host bấm rời phòng (Bắt bằng Title)
      await hostPage.getByTitle("Rời phòng").click();

      // Modal kế nhiệm hiện lên, chọn người đầu tiên
      const successionModal = hostPage.getByRole("dialog");
      await successionModal.waitFor({ state: "visible" });
      await successionModal.locator("button.w-full.text-left").first().click(); // Chọn Tân Host
      await successionModal.getByRole("button", { name: "Xác nhận" }).click();

      // Host văng ra sảnh
      await expect(hostPage).toHaveURL(/\/xem-chung/);
      await hostContext.close(); // Host cũ hết vai

      // Guest 2 nhận quyền làm Host mới. Bấm vào Settings
      await g2Page
        .locator(".bg-zinc-950\\/40.border-b.border-zinc-800 > button")
        .nth(3)
        .click();
      await g2Page
        .getByRole("button", { name: "Kết thúc phòng xem chung" })
        .click();
      await g2Page.getByRole("button", { name: "Kết thúc" }).click();

      // Xác minh: Phòng đóng, MỌI NGƯỜI bị kick về sảnh với thông báo đóng phòng
      await Promise.all([
        expect(g1Page.getByText("Phiên xem chung đã kết thúc")).toBeVisible({
          timeout: 10000,
        }),
        expect(g3Page.getByText("Phiên xem chung đã kết thúc")).toBeVisible({
          timeout: 10000,
        }),
      ]);
    });
  });
});
