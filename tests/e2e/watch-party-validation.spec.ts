import { test, expect, Page } from '@playwright/test';

/**
 * E2E Tests for Watch Party Validation & Security
 *
 * Tests các bug đã fix:
 * - Host transfer validation
 * - ThumbUrl sanitization (XSS)
 * - Log injection với roomId
 * - Validation schema consistency
 * - Fetch response.ok check
 * - Auto-rejoin stuck state
 */

const TEST_TIMEOUT = 30000;

// Helper: Login user
async function loginUser(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.fill('[data-testid="email-input"]', email);
  await page.fill('[data-testid="password-input"]', password);
  await page.click('[data-testid="login-button"]');
  await page.waitForURL('/');
}

// Helper: Create room
async function createRoom(page: Page, roomName: string) {
  await page.goto('/xem-chung');
  await page.click('[data-testid="create-room-button"]');
  await page.fill('[data-testid="room-title-input"]', roomName);
  await page.click('[data-testid="movie-select"]');
  await page.click('[data-testid="movie-option"]:first-child');
  await page.click('[data-testid="create-room-submit"]');
  await page.waitForURL(/\/xem-chung\?roomId=/);
  const url = page.url();
  return new URL(url).searchParams.get('roomId');
}

// Helper: Join room
async function joinRoom(page: Page, roomId: string) {
  await page.goto(`/xem-chung?roomId=${roomId}`);
  await page.waitForSelector('[data-testid="watch-party-view"]');
}

test.describe('Watch Party - Host Transfer Validation', () => {
  test.setTimeout(TEST_TIMEOUT);

  test('Should validate new host exists before transfer', async ({ browser }) => {
    const hostContext = await browser.newContext();
    const hostPage = await hostContext.newPage();

    try {
      // 1. Host tạo phòng
      await loginUser(hostPage, 'host@test.com', 'password123');
      const roomId = await createRoom(hostPage, 'Test Host Transfer');

      // 2. Host cố gắng transfer cho user không tồn tại
      await hostPage.click('[data-testid="leave-room-button"]');
      await hostPage.waitForSelector('[data-testid="host-succession-modal"]');

      // 3. Inject invalid userId vào request
      const response = await hostPage.evaluate(async (roomId) => {
        const res = await fetch('/api/watch-party/leave', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomId,
            newHostUserId: '00000000-0000-0000-0000-000000000000', // Invalid UUID
          }),
        });
        return {
          ok: res.ok,
          status: res.status,
          body: await res.json(),
        };
      }, roomId);

      // 4. Verify API trả về lỗi 400
      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('not found');

    } finally {
      await hostContext.close();
    }
  });

  test('Should prevent transfer to non-approved participant', async ({ browser }) => {
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();

    const hostPage = await hostContext.newPage();
    const guestPage = await guestContext.newPage();

    try {
      // 1. Host tạo phòng private
      await loginUser(hostPage, 'host@test.com', 'password123');
      await hostPage.goto('/xem-chung');
      await hostPage.click('[data-testid="create-room-button"]');
      await hostPage.fill('[data-testid="room-title-input"]', 'Private Room');
      await hostPage.check('[data-testid="private-checkbox"]');
      await hostPage.click('[data-testid="movie-select"]');
      await hostPage.click('[data-testid="movie-option"]:first-child');
      await hostPage.click('[data-testid="create-room-submit"]');
      await hostPage.waitForURL(/\/xem-chung\?roomId=/);
      const roomId = new URL(hostPage.url()).searchParams.get('roomId');

      // 2. Guest knock nhưng chưa được approve
      await loginUser(guestPage, 'guest@test.com', 'password123');
      await guestPage.goto(`/xem-chung?roomId=${roomId}`);
      await guestPage.click('[data-testid="knock-button"]');
      await guestPage.waitForTimeout(1000);

      // 3. Get guest userId
      const guestUserId = await guestPage.evaluate(() => {
        return (window as any).__userId;
      });

      // 4. Host cố transfer cho guest chưa approve
      const response = await hostPage.evaluate(async (data) => {
        const res = await fetch('/api/watch-party/leave', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomId: data.roomId,
            newHostUserId: data.guestUserId,
          }),
        });
        return {
          ok: res.ok,
          status: res.status,
          body: await res.json(),
        };
      }, { roomId, guestUserId });

      // 5. Verify bị reject
      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);

    } finally {
      await hostContext.close();
      await guestContext.close();
    }
  });
});

test.describe('Watch Party - XSS Protection', () => {
  test.setTimeout(TEST_TIMEOUT);

  test('Should sanitize thumbUrl to prevent XSS', async ({ browser }) => {
    const hostContext = await browser.newContext();
    const hostPage = await hostContext.newPage();

    try {
      // 1. Host tạo phòng
      await loginUser(hostPage, 'host@test.com', 'password123');
      const roomId = await createRoom(hostPage, 'Test XSS Protection');

      // 2. Cố thêm movie với javascript: protocol trong thumbUrl
      const response = await hostPage.evaluate(async (roomId) => {
        const res = await fetch('/api/watch-party/playlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomId,
            movieSlug: 'test-movie',
            movieName: 'Test Movie',
            episodeSlug: 'ep-1',
            thumbUrl: 'javascript:alert("XSS")', // Malicious URL
          }),
        });
        return {
          ok: res.ok,
          status: res.status,
          body: await res.json(),
        };
      }, roomId);

      // 3. Verify bị reject
      expect(response.ok).toBe(false);
      expect(response.body.error).toContain('không hợp lệ');

    } finally {
      await hostContext.close();
    }
  });

  test('Should only accept http/https thumbUrl', async ({ browser }) => {
    const hostContext = await browser.newContext();
    const hostPage = await hostContext.newPage();

    try {
      await loginUser(hostPage, 'host@test.com', 'password123');
      const roomId = await createRoom(hostPage, 'Test URL Protocol');

      // Test các protocol không hợp lệ
      const invalidUrls = [
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'file:///etc/passwd',
        'ftp://example.com/image.jpg',
      ];

      for (const thumbUrl of invalidUrls) {
        const response = await hostPage.evaluate(async (data) => {
          const res = await fetch('/api/watch-party/playlist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              roomId: data.roomId,
              movieSlug: 'test-movie',
              movieName: 'Test Movie',
              episodeSlug: 'ep-1',
              thumbUrl: data.thumbUrl,
            }),
          });
          return res.ok;
        }, { roomId, thumbUrl });

        expect(response).toBe(false);
      }

      // Test URL hợp lệ
      const validUrl = 'https://example.com/image.jpg';
      const validResponse = await hostPage.evaluate(async (data) => {
        const res = await fetch('/api/watch-party/playlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomId: data.roomId,
            movieSlug: 'test-movie',
            movieName: 'Test Movie',
            episodeSlug: 'ep-1',
            thumbUrl: data.thumbUrl,
          }),
        });
        return res.ok;
      }, { roomId, thumbUrl: validUrl });

      expect(validResponse).toBe(true);

    } finally {
      await hostContext.close();
    }
  });
});

test.describe('Watch Party - Validation Schema Consistency', () => {
  test.setTimeout(TEST_TIMEOUT);

  test('Should enforce min 3 chars for room title on create', async ({ browser }) => {
    const hostContext = await browser.newContext();
    const hostPage = await hostContext.newPage();

    try {
      await loginUser(hostPage, 'host@test.com', 'password123');
      await hostPage.goto('/xem-chung');
      await hostPage.click('[data-testid="create-room-button"]');

      // Cố tạo phòng với title 2 ký tự
      await hostPage.fill('[data-testid="room-title-input"]', 'AB');
      await hostPage.click('[data-testid="movie-select"]');
      await hostPage.click('[data-testid="movie-option"]:first-child');
      await hostPage.click('[data-testid="create-room-submit"]');

      // Verify hiển thị lỗi validation
      const errorMessage = await hostPage.textContent('[data-testid="validation-error"]');
      expect(errorMessage).toContain('3 ký tự');

    } finally {
      await hostContext.close();
    }
  });

  test('Should enforce min 3 chars for room title on update', async ({ browser }) => {
    const hostContext = await browser.newContext();
    const hostPage = await hostContext.newPage();

    try {
      // 1. Tạo phòng với title hợp lệ
      await loginUser(hostPage, 'host@test.com', 'password123');
      const roomId = await createRoom(hostPage, 'Valid Title');

      // 2. Cố update title thành 2 ký tự
      await hostPage.click('[data-testid="settings-button"]');
      await hostPage.fill('[data-testid="room-title-input"]', 'AB');
      await hostPage.click('[data-testid="save-settings-button"]');

      // 3. Verify bị reject
      const errorMessage = await hostPage.textContent('[data-testid="validation-error"]');
      expect(errorMessage).toContain('3 ký tự');

    } finally {
      await hostContext.close();
    }
  });

  test('Should enforce max 20 participants on create and update', async ({ browser }) => {
    const hostContext = await browser.newContext();
    const hostPage = await hostContext.newPage();

    try {
      await loginUser(hostPage, 'host@test.com', 'password123');
      await hostPage.goto('/xem-chung');
      await hostPage.click('[data-testid="create-room-button"]');

      // 1. Cố tạo phòng với 50 người (quá giới hạn)
      await hostPage.fill('[data-testid="room-title-input"]', 'Large Room');
      await hostPage.fill('[data-testid="max-participants-input"]', '50');
      await hostPage.click('[data-testid="movie-select"]');
      await hostPage.click('[data-testid="movie-option"]:first-child');
      await hostPage.click('[data-testid="create-room-submit"]');

      // Verify lỗi validation
      const createError = await hostPage.textContent('[data-testid="validation-error"]');
      expect(createError).toContain('20');

      // 2. Tạo phòng với 10 người (hợp lệ)
      await hostPage.fill('[data-testid="max-participants-input"]', '10');
      await hostPage.click('[data-testid="create-room-submit"]');
      await hostPage.waitForURL(/\/xem-chung\?roomId=/);

      // 3. Cố update lên 50 người
      await hostPage.click('[data-testid="settings-button"]');
      await hostPage.fill('[data-testid="max-participants-input"]', '50');
      await hostPage.click('[data-testid="save-settings-button"]');

      // Verify bị reject
      const updateError = await hostPage.textContent('[data-testid="validation-error"]');
      expect(updateError).toContain('20');

    } finally {
      await hostContext.close();
    }
  });
});

test.describe('Watch Party - Fetch Response Check', () => {
  test.setTimeout(TEST_TIMEOUT);

  test('Should handle 4xx/5xx responses from kick API', async ({ browser }) => {
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();

    const hostPage = await hostContext.newPage();
    const guestPage = await guestContext.newPage();

    try {
      // 1. Setup room
      await loginUser(hostPage, 'host@test.com', 'password123');
      const roomId = await createRoom(hostPage, 'Test Fetch Error');

      await loginUser(guestPage, 'guest@test.com', 'password123');
      await joinRoom(guestPage, roomId!);

      // 2. Monitor console errors
      const consoleErrors: string[] = [];
      hostPage.on('console', msg => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      // 3. Mock API để trả về 500
      await hostPage.route('/api/watch-party/participant', route => {
        route.fulfill({
          status: 500,
          body: JSON.stringify({ error: 'Internal Server Error' }),
        });
      });

      // 4. Guest offline để trigger auto-kick
      await guestContext.close();
      await hostPage.waitForTimeout(16000); // Grace period + buffer

      // 5. Verify console có log lỗi (không silent fail)
      const kickErrors = consoleErrors.filter(err =>
        err.includes('Kick API returned error') || err.includes('500')
      );
      expect(kickErrors.length).toBeGreaterThan(0);

    } finally {
      await hostContext.close();
    }
  });
});

test.describe('Watch Party - Auto-Rejoin', () => {
  test.setTimeout(TEST_TIMEOUT);

  test('Should retry rejoin when API fails', async ({ browser }) => {
    const guestContext = await browser.newContext();
    const guestPage = await guestContext.newPage();

    try {
      await loginUser(guestPage, 'guest@test.com', 'password123');

      // 1. Mock join API để fail lần đầu, success lần 2
      let attemptCount = 0;
      await guestPage.route('/api/watch-party/join', route => {
        attemptCount++;
        if (attemptCount === 1) {
          // Lần 1: fail
          route.fulfill({
            status: 500,
            body: JSON.stringify({ error: 'Server error' }),
          });
        } else {
          // Lần 2: success
          route.continue();
        }
      });

      // 2. Join room (sẽ trigger auto-rejoin logic)
      await guestPage.goto('/xem-chung?roomId=test-room-id');
      await guestPage.waitForTimeout(3000);

      // 3. Verify có ít nhất 2 attempts
      expect(attemptCount).toBeGreaterThanOrEqual(2);

    } finally {
      await guestContext.close();
    }
  });

  test('Should not get stuck when rejoin fails permanently', async ({ browser }) => {
    const guestContext = await browser.newContext();
    const guestPage = await guestContext.newPage();

    try {
      await loginUser(guestPage, 'guest@test.com', 'password123');

      // 1. Mock join API để luôn fail với 403 (permanent error)
      let attemptCount = 0;
      await guestPage.route('/api/watch-party/join', route => {
        attemptCount++;
        route.fulfill({
          status: 403,
          body: JSON.stringify({ error: 'Forbidden' }),
        });
      });

      // 2. Join room
      await guestPage.goto('/xem-chung?roomId=test-room-id');
      await guestPage.waitForTimeout(5000);

      // 3. Verify có retry (không stuck với attemptCount = 1)
      expect(attemptCount).toBeGreaterThan(1);

      // 4. Verify cuối cùng hiển thị error cho user
      const errorMessage = await guestPage.textContent('[data-testid="error-message"]');
      expect(errorMessage).toBeTruthy();

    } finally {
      await guestContext.close();
    }
  });
});
