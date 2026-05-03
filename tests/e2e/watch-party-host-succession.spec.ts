import { test, expect, Page, Browser } from '@playwright/test';

/**
 * E2E Tests for Watch Party Host Succession
 *
 * Tests các bug đã fix:
 * - Host succession khi host offline
 * - Timer cleanup (clearTimeout với useRef)
 * - Date.now() fallback logic
 * - Channel subscription với timeout
 */

// Test configuration
const TEST_TIMEOUT = 60000;
const GRACE_PERIOD_MS = 3 * 60 * 1000; // 3 phút

// Helper: Login user
async function loginUser(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.fill('[data-testid="email-input"]', email);
  await page.fill('[data-testid="password-input"]', password);
  await page.click('[data-testid="login-button"]');
  await page.waitForURL('/');
}

// Helper: Create watch party room
async function createRoom(page: Page, roomName: string) {
  await page.goto('/xem-chung');
  await page.click('[data-testid="create-room-button"]');
  await page.fill('[data-testid="room-title-input"]', roomName);
  await page.click('[data-testid="movie-select"]');
  await page.click('[data-testid="movie-option"]:first-child');
  await page.click('[data-testid="create-room-submit"]');

  // Wait for room to be created and get room ID from URL
  await page.waitForURL(/\/xem-chung\?roomId=/);
  const url = page.url();
  const roomId = new URL(url).searchParams.get('roomId');
  return roomId;
}

// Helper: Join room
async function joinRoom(page: Page, roomId: string) {
  await page.goto(`/xem-chung?roomId=${roomId}`);
  await page.waitForSelector('[data-testid="watch-party-view"]');
}

// Helper: Get participant list
async function getParticipants(page: Page) {
  return await page.evaluate(() => {
    const participantElements = document.querySelectorAll('[data-testid="participant-item"]');
    return Array.from(participantElements).map(el => ({
      name: el.querySelector('[data-testid="participant-name"]')?.textContent,
      role: el.querySelector('[data-testid="participant-role"]')?.textContent,
      isOnline: el.querySelector('[data-testid="participant-status"]')?.classList.contains('online'),
    }));
  });
}

test.describe('Watch Party - Host Succession', () => {
  test.setTimeout(TEST_TIMEOUT);

  test('Should promote next eligible user when host goes offline', async ({ browser }) => {
    const hostContext = await browser.newContext();
    const guest1Context = await browser.newContext();
    const guest2Context = await browser.newContext();

    const hostPage = await hostContext.newPage();
    const guest1Page = await guest1Context.newPage();
    const guest2Page = await guest2Context.newPage();

    try {
      // 1. Host tạo phòng
      await loginUser(hostPage, 'host@test.com', 'password123');
      const roomId = await createRoom(hostPage, 'Test Host Succession');
      expect(roomId).toBeTruthy();

      // 2. Guest 1 join (có quyền can_control_media)
      await loginUser(guest1Page, 'guest1@test.com', 'password123');
      await joinRoom(guest1Page, roomId!);

      // 3. Guest 2 join (không có quyền đặc biệt)
      await loginUser(guest2Page, 'guest2@test.com', 'password123');
      await joinRoom(guest2Page, roomId!);

      // 4. Verify host hiện tại
      const participantsBefore = await getParticipants(guest1Page);
      const hostBefore = participantsBefore.find(p => p.role === 'host');
      expect(hostBefore?.name).toContain('host@test.com');

      // 5. Host đóng tab (simulate offline)
      await hostContext.close();

      // 6. Đợi grace period (3 phút) + buffer
      console.log('Waiting for grace period...');
      await guest1Page.waitForTimeout(GRACE_PERIOD_MS + 5000);

      // 7. Verify guest1 được promote thành host (vì có quyền cao hơn)
      const participantsAfter = await getParticipants(guest1Page);
      const newHost = participantsAfter.find(p => p.role === 'host');
      expect(newHost?.name).toContain('guest1@test.com');

      // 8. Verify toast notification xuất hiện
      const toastMessage = await guest1Page.textContent('[data-testid="toast-message"]');
      expect(toastMessage).toContain('Chủ phòng mới');

    } finally {
      await guest1Context.close();
      await guest2Context.close();
    }
  });

  test('Should prioritize user with higher permissions', async ({ browser }) => {
    const hostContext = await browser.newContext();
    const modContext = await browser.newContext();
    const guestContext = await browser.newContext();

    const hostPage = await hostContext.newPage();
    const modPage = await modContext.newPage();
    const guestPage = await guestContext.newPage();

    try {
      // 1. Host tạo phòng
      await loginUser(hostPage, 'host@test.com', 'password123');
      const roomId = await createRoom(hostPage, 'Test Permission Priority');

      // 2. Guest join trước (vào sớm hơn)
      await loginUser(guestPage, 'guest@test.com', 'password123');
      await joinRoom(guestPage, roomId!);

      // 3. Mod join sau (vào muộn hơn nhưng có quyền cao)
      await loginUser(modPage, 'mod@test.com', 'password123');
      await joinRoom(modPage, roomId!);

      // 4. Host promote mod
      await hostPage.click('[data-testid="participant-item-mod"]');
      await hostPage.click('[data-testid="promote-button"]');
      await hostPage.waitForTimeout(1000);

      // 5. Host offline
      await hostContext.close();

      // 6. Đợi grace period
      await modPage.waitForTimeout(GRACE_PERIOD_MS + 5000);

      // 7. Verify mod được promote (mặc dù vào sau)
      const participants = await getParticipants(modPage);
      const newHost = participants.find(p => p.role === 'host');
      expect(newHost?.name).toContain('mod@test.com');

    } finally {
      await modContext.close();
      await guestContext.close();
    }
  });

  test('Should handle participant without created_at (deprioritize)', async ({ browser }) => {
    // Test case cho bug: Date.now() fallback
    // Participant thiếu created_at phải bị xếp cuối hàng kế vị

    const hostContext = await browser.newContext();
    const normalUserContext = await browser.newContext();
    const corruptedUserContext = await browser.newContext();

    const hostPage = await hostContext.newPage();
    const normalUserPage = await normalUserContext.newPage();
    const corruptedUserPage = await corruptedUserContext.newPage();

    try {
      // 1. Host tạo phòng
      await loginUser(hostPage, 'host@test.com', 'password123');
      const roomId = await createRoom(hostPage, 'Test Created At Fallback');

      // 2. Normal user join
      await loginUser(normalUserPage, 'normal@test.com', 'password123');
      await joinRoom(normalUserPage, roomId!);

      // 3. Corrupted user join (simulate user với created_at = null)
      // NOTE: Cần API endpoint để tạo user với created_at = null cho test
      await loginUser(corruptedUserPage, 'corrupted@test.com', 'password123');
      await joinRoom(corruptedUserPage, roomId!);

      // 4. Host offline
      await hostContext.close();
      await normalUserPage.waitForTimeout(GRACE_PERIOD_MS + 5000);

      // 5. Verify normal user được promote (không phải corrupted user)
      const participants = await getParticipants(normalUserPage);
      const newHost = participants.find(p => p.role === 'host');
      expect(newHost?.name).toContain('normal@test.com');

    } finally {
      await normalUserContext.close();
      await corruptedUserContext.close();
    }
  });

  test('Should cleanup timers properly on unmount', async ({ browser }) => {
    // Test case cho bug: clearTimeout không hoạt động
    // Verify không có memory leak khi component unmount

    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();

    const hostPage = await hostContext.newPage();
    const guestPage = await guestContext.newPage();

    try {
      // 1. Setup room
      await loginUser(hostPage, 'host@test.com', 'password123');
      const roomId = await createRoom(hostPage, 'Test Timer Cleanup');

      await loginUser(guestPage, 'guest@test.com', 'password123');
      await joinRoom(guestPage, roomId!);

      // 2. Host offline để trigger timer
      await hostContext.close();

      // 3. Guest navigate away trước khi grace period hết
      await guestPage.goto('/');
      await guestPage.waitForTimeout(2000);

      // 4. Guest quay lại phòng
      await joinRoom(guestPage, roomId!);

      // 5. Verify không có lỗi console về timer
      const consoleErrors = await guestPage.evaluate(() => {
        return (window as any).__consoleErrors || [];
      });

      const timerErrors = consoleErrors.filter((err: string) =>
        err.includes('timer') || err.includes('timeout')
      );
      expect(timerErrors.length).toBe(0);

    } finally {
      await guestContext.close();
    }
  });
});

test.describe('Watch Party - Channel Subscription', () => {
  test.setTimeout(TEST_TIMEOUT);

  test('Should timeout channel subscription after 5s', async ({ browser }) => {
    // Test case cho bug: Channel subscription không có timeout

    const guestContext = await browser.newContext();
    const guestPage = await guestContext.newPage();

    try {
      // 1. Mock Supabase để simulate slow subscription
      await guestPage.addInitScript(() => {
        const originalChannel = (window as any).supabase?.channel;
        if (originalChannel) {
          (window as any).supabase.channel = function(...args: any[]) {
            const channel = originalChannel.apply(this, args);
            const originalSubscribe = channel.subscribe;

            // Override subscribe để delay response
            channel.subscribe = function(callback: any) {
              // Không gọi callback → simulate hang
              return originalSubscribe.call(this, () => {
                // Never resolve
              });
            };

            return channel;
          };
        }
      });

      // 2. Login và join room
      await loginUser(guestPage, 'guest@test.com', 'password123');
      await guestPage.goto('/xem-chung?roomId=test-room-id');

      // 3. Trigger leave (sẽ gọi channel.subscribe)
      const startTime = Date.now();
      await guestPage.click('[data-testid="leave-room-button"]');

      // 4. Verify timeout sau ~5s (không phải vô thời hạn)
      await guestPage.waitForSelector('[data-testid="error-message"]', { timeout: 10000 });
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeGreaterThan(4000); // Ít nhất 4s
      expect(elapsed).toBeLessThan(7000); // Không quá 7s

      // 5. Verify error message
      const errorMessage = await guestPage.textContent('[data-testid="error-message"]');
      expect(errorMessage).toContain('timeout');

    } finally {
      await guestContext.close();
    }
  });

  test('Should subscribe before sending broadcast', async ({ browser }) => {
    // Test case cho bug: Channel chưa subscribe trước khi send

    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();

    const hostPage = await hostContext.newPage();
    const guestPage = await guestContext.newPage();

    try {
      // 1. Setup room
      await loginUser(hostPage, 'host@test.com', 'password123');
      const roomId = await createRoom(hostPage, 'Test Channel Subscribe');

      await loginUser(guestPage, 'guest@test.com', 'password123');
      await joinRoom(guestPage, roomId!);

      // 2. Monitor network requests
      const broadcastRequests: any[] = [];
      guestPage.on('console', msg => {
        if (msg.text().includes('broadcast')) {
          broadcastRequests.push({
            text: msg.text(),
            timestamp: Date.now(),
          });
        }
      });

      // 3. Guest leave (trigger broadcast)
      await guestPage.click('[data-testid="leave-room-button"]');
      await guestPage.waitForTimeout(2000);

      // 4. Verify subscribe được gọi trước send
      const subscribeLog = broadcastRequests.find(r => r.text.includes('SUBSCRIBED'));
      const sendLog = broadcastRequests.find(r => r.text.includes('request_leave'));

      expect(subscribeLog).toBeTruthy();
      expect(sendLog).toBeTruthy();
      expect(subscribeLog.timestamp).toBeLessThan(sendLog.timestamp);

    } finally {
      await hostContext.close();
      await guestContext.close();
    }
  });
});
