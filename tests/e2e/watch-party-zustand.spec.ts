import { test, expect, Page } from "@playwright/test";

// Helper function to create watch party room
async function createWatchPartyRoom(
  page: Page,
  movieName: string = "One Piece",
): Promise<string> {
  // Go to watch party lobby
  await page.goto("http://localhost:3000/xem-chung");

  // Wait for lobby to load
  await page.waitForSelector("text=Tạo phòng mới");

  // Click "Tạo phòng mới" button
  await page.click('button:has-text("Tạo phòng mới")');

  // Wait for create room modal
  await page.waitForSelector("text=Tạo phòng xem chung");

  // Search for movie
  await page.fill('input[placeholder*="Nhập tên phim"]', movieName);
  await page.waitForTimeout(1000); // Wait for search results

  // Select first movie from dropdown
  await page.click(".bg-zinc-800 .hover\\:bg-zinc-700:first-child");

  // Room title should be auto-filled
  await page.waitForTimeout(500);

  // Submit form
  await page.click('button:has-text("Mở phòng ngay")');

  // Wait for redirect to room page
  await page.waitForURL(/\/xem-chung\/[A-Z0-9]{6}/);

  // Extract room code from URL
  const url = page.url();
  const match = url.match(/\/xem-chung\/([A-Z0-9]{6})/);
  const roomCode = match ? match[1] : null;

  expect(roomCode).toBeTruthy();
  return roomCode!;
}

// Helper function to join room by code
async function joinRoomByCode(page: Page, roomCode: string) {
  await page.goto(`http://localhost:3000/xem-chung/${roomCode}`);
  await page.waitForSelector("text=Chat");
}

test.describe("Watch Party - Zustand Integration (Host)", () => {
  // Use host authentication
  test.use({ storageState: "tests/e2e/auth/host.json" });

  test("should display lobby page with room list", async ({ page }) => {
    await page.goto("http://localhost:3000/xem-chung");

    // Verify lobby elements
    await expect(page.locator("text=PHÒNG")).toBeVisible();
    await expect(page.locator("text=TRỐNG")).toBeVisible();
    await expect(
      page.locator('button:has-text("Tạo phòng mới")'),
    ).toBeVisible();
  });

  test("should create watch party room successfully", async ({ page }) => {
    const roomCode = await createWatchPartyRoom(page);

    // Verify room UI elements
    await expect(page.locator(`text=${roomCode}`)).toBeVisible();

    // Verify tabs are visible
    await expect(page.locator('button:has-text("Chat")')).toBeVisible();
    await expect(page.locator('button:has-text("Playlist")')).toBeVisible();
    await expect(page.locator('button:has-text("Thành viên")')).toBeVisible();
    await expect(page.locator('button:has-text("Cài đặt")')).toBeVisible(); // Host should see Settings
  });

  test("should add movies to playlist", async ({ page }) => {
    await createWatchPartyRoom(page);

    // Switch to Playlist tab
    await page.click('button:has-text("Playlist")');

    // Click "Thêm phim" button
    await page.click('button:has-text("Thêm phim")');

    // Wait for movie search modal
    await page.waitForSelector('input[placeholder*="Tìm kiếm"]');

    // Search for a movie
    await page.fill('input[placeholder*="Tìm kiếm"]', "Naruto");
    await page.waitForTimeout(1000); // Wait for search results

    // Add first movie from search results
    await page.click('.search-result button:has-text("Thêm"):first');

    // Verify movie appears in playlist
    await expect(page.locator(".playlist-item")).toHaveCount(1);

    // Add another movie
    await page.click('button:has-text("Thêm phim")');
    await page.fill('input[placeholder*="Tìm kiếm"]', "Conan");
    await page.waitForTimeout(1000);
    await page.click('.search-result button:has-text("Thêm"):first');

    // Verify 2 movies in playlist
    await expect(page.locator(".playlist-item")).toHaveCount(2);
  });

  test("should prevent adding duplicate movies", async ({ page }) => {
    await createWatchPartyRoom(page, "One Piece");

    await page.click('button:has-text("Playlist")');
    await page.click('button:has-text("Thêm phim")');

    // Try to add the currently playing movie
    await page.fill('input[placeholder*="Tìm kiếm"]', "One Piece");
    await page.waitForTimeout(1000);
    await page.click('.search-result button:has-text("Thêm"):first');

    // Verify error toast appears
    await expect(page.locator("text=đang được chiếu")).toBeVisible();

    // Verify no movie added to playlist
    await expect(page.locator(".playlist-item")).toHaveCount(0);
  });

  test("should delete movie from playlist", async ({ page }) => {
    await createWatchPartyRoom(page);

    await page.click('button:has-text("Playlist")');

    // Add a movie
    await page.click('button:has-text("Thêm phim")');
    await page.fill('input[placeholder*="Tìm kiếm"]', "Naruto");
    await page.waitForTimeout(1000);
    await page.click('.search-result button:has-text("Thêm"):first');

    // Verify movie added
    await expect(page.locator(".playlist-item")).toHaveCount(1);

    // Delete the movie
    await page.click('.playlist-item button[aria-label*="Xóa"]');

    // Verify movie removed
    await expect(page.locator(".playlist-item")).toHaveCount(0);
  });

  test("should handle chat messages", async ({ page }) => {
    await createWatchPartyRoom(page);

    // Chat tab should be default
    await page.click('button:has-text("Chat")');

    // Type a message
    const testMessage = "Hello from E2E test!";
    await page.fill('textarea[placeholder*="Nhập tin nhắn"]', testMessage);
    await page.press('textarea[placeholder*="Nhập tin nhắn"]', "Enter");

    // Verify message appears
    await expect(
      page.locator(`.message:has-text("${testMessage}")`),
    ).toBeVisible();
  });

  test("should join room from lobby", async ({ page }) => {
    // First create a room
    const roomCode = await createWatchPartyRoom(page);

    // Go back to lobby
    await page.goto("http://localhost:3000/xem-chung");

    // Find and click the room card
    await page.click(`.room-card:has-text("${roomCode}")`);

    // Should be in the room
    await expect(page.locator(`text=${roomCode}`)).toBeVisible();
  });

  test("should handle video playback controls", async ({ page }) => {
    await createWatchPartyRoom(page);

    // Wait for video player to load
    await page.waitForSelector("video", { timeout: 10000 });

    // Play video
    const playButton = page.locator(
      'button[aria-label*="Play"], .vjs-play-control',
    );
    if (await playButton.isVisible()) {
      await playButton.click();
    }

    // Wait a bit
    await page.waitForTimeout(2000);

    // Pause video
    const pauseButton = page.locator(
      'button[aria-label*="Pause"], .vjs-play-control',
    );
    if (await pauseButton.isVisible()) {
      await pauseButton.click();
    }

    // Verify video is paused
    const isPaused = await page.evaluate(() => {
      const video = document.querySelector("video");
      return video?.paused;
    });

    expect(isPaused).toBe(true);
  });

  test("should persist state after page reload", async ({ page }) => {
    await createWatchPartyRoom(page);

    // Add a movie to playlist
    await page.click('button:has-text("Playlist")');
    await page.click('button:has-text("Thêm phim")');
    await page.fill('input[placeholder*="Tìm kiếm"]', "Naruto");
    await page.waitForTimeout(1000);
    await page.click('.search-result button:has-text("Thêm"):first');

    // Wait for movie to be added
    await expect(page.locator(".playlist-item")).toHaveCount(1);

    // Reload page
    await page.reload();

    // Wait for page to load
    await page.waitForSelector('button:has-text("Playlist")');

    // Switch to Playlist tab
    await page.click('button:has-text("Playlist")');

    // Verify movie is still there
    await expect(page.locator(".playlist-item")).toHaveCount(1);
  });

  test("should handle network errors gracefully", async ({ page }) => {
    await createWatchPartyRoom(page);

    // Simulate network offline
    await page.context().setOffline(true);

    // Try to add a movie
    await page.click('button:has-text("Playlist")');
    await page.click('button:has-text("Thêm phim")');
    await page.fill('input[placeholder*="Tìm kiếm"]', "Naruto");
    await page.waitForTimeout(1000);
    await page.click('.search-result button:has-text("Thêm"):first');

    // Verify error toast appears
    await expect(page.locator("text=Lỗi kết nối")).toBeVisible({
      timeout: 5000,
    });

    // Restore network
    await page.context().setOffline(false);
  });
});

test.describe("Watch Party - Multi-user Tests", () => {
  test("should show Settings tab only to host", async ({ browser }) => {
    // Create host context
    const hostContext = await browser.newContext({
      storageState: "tests/e2e/auth/host.json",
    });
    const hostPage = await hostContext.newPage();

    const roomCode = await createWatchPartyRoom(hostPage);

    // Verify host sees Settings tab
    await expect(hostPage.locator('button:has-text("Cài đặt")')).toBeVisible();

    // Create guest context
    const guestContext = await browser.newContext({
      storageState: "tests/e2e/auth/guest.json",
    });
    const guestPage = await guestContext.newPage();

    await joinRoomByCode(guestPage, roomCode);

    // Verify guest does NOT see Settings tab
    await expect(
      guestPage.locator('button:has-text("Cài đặt")'),
    ).not.toBeVisible();

    // Verify guest sees other tabs
    await expect(guestPage.locator('button:has-text("Chat")')).toBeVisible();
    await expect(
      guestPage.locator('button:has-text("Playlist")'),
    ).toBeVisible();
    await expect(
      guestPage.locator('button:has-text("Thành viên")'),
    ).toBeVisible();

    await hostContext.close();
    await guestContext.close();
  });

  test("should sync playlist changes in realtime", async ({ browser }) => {
    // Create host context
    const hostContext = await browser.newContext({
      storageState: "tests/e2e/auth/host.json",
    });
    const hostPage = await hostContext.newPage();

    const roomCode = await createWatchPartyRoom(hostPage);

    // Create guest context
    const guestContext = await browser.newContext({
      storageState: "tests/e2e/auth/guest.json",
    });
    const guestPage = await guestContext.newPage();

    await joinRoomByCode(guestPage, roomCode);

    // Both switch to Playlist tab
    await hostPage.click('button:has-text("Playlist")');
    await guestPage.click('button:has-text("Playlist")');

    // Host adds a movie
    await hostPage.click('button:has-text("Thêm phim")');
    await hostPage.fill('input[placeholder*="Tìm kiếm"]', "Naruto");
    await hostPage.waitForTimeout(1000);
    await hostPage.click('.search-result button:has-text("Thêm"):first');

    // Wait for realtime sync
    await hostPage.waitForTimeout(1500);

    // Verify guest sees the movie
    await expect(guestPage.locator(".playlist-item")).toHaveCount(1);

    // Host deletes the movie
    await hostPage.click('.playlist-item button[aria-label*="Xóa"]');

    // Wait for realtime sync
    await hostPage.waitForTimeout(1500);

    // Verify guest sees it removed
    await expect(guestPage.locator(".playlist-item")).toHaveCount(0);

    await hostContext.close();
    await guestContext.close();
  });
});
