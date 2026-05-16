import { test, expect, Page } from "@playwright/test";
import { existsSync } from "fs";

async function videoState(page: Page) {
  return page.locator("video").evaluate((video: HTMLVideoElement) => ({
    paused: video.paused,
    currentTime: video.currentTime,
    playbackRate: video.playbackRate,
    readyState: video.readyState,
  }));
}

async function createRoom(page: Page, allowGuestControl = false) {
  const response = await page.request.post("/api/watch-party", {
    data: {
      title: `Sync E2E ${Date.now()}`,
      isPrivate: false,
      maxParticipants: 6,
      movieSlug: process.env.WATCH_PARTY_TEST_MOVIE_SLUG ?? "one-piece",
      movieImage: "https://example.com/poster.jpg",
      episodeSlug: process.env.WATCH_PARTY_TEST_EPISODE_SLUG ?? "tap-1",
      settings: { allow_guest_control: allowGuestControl },
    },
  });

  expect(response.ok()).toBe(true);
  const body = await response.json();
  expect(body.room?.room_code).toBeTruthy();
  return body.room.room_code as string;
}

async function waitForReadyVideo(page: Page) {
  await page.locator("video").waitFor({ timeout: 30000 });
  await expect
    .poll(async () => (await videoState(page)).readyState, { timeout: 15000 })
    .toBeGreaterThanOrEqual(2);
}

async function markPlayerIntent(page: Page) {
  await page.locator(".video-js").first().evaluate((playerEl: Element) => {
    for (const type of ["pointerdown", "pointerup"]) {
      playerEl.dispatchEvent(
        new PointerEvent(type, { bubbles: true, composed: true }),
      );
    }
  });
}

async function waitForSyncPost(page: Page, action: () => Promise<unknown>) {
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/api/watch-party/sync") &&
        response.request().method() === "POST",
      { timeout: 15000 },
    ),
    action(),
  ]);
}

async function triggerPlayerControl(page: Page) {
  await markPlayerIntent(page);
  await waitForSyncPost(page, () =>
    page.locator("video").evaluate((video: HTMLVideoElement) => {
      if (video.paused) return video.play();
      video.pause();
    }),
  );
}

async function clickPlayerControl(page: Page) {
  await waitForSyncPost(page, () =>
    page.locator(".video-js").first().click({ timeout: 7000 }),
  );
}

async function seekPlayer(page: Page, time: number) {
  await markPlayerIntent(page);
  await waitForSyncPost(page, () =>
    page.locator("video").evaluate((video: HTMLVideoElement, seekTime) => {
      video.currentTime = seekTime;
      video.dispatchEvent(new Event("seeking", { bubbles: true }));
      video.dispatchEvent(new Event("seeked", { bubbles: true }));
    }, time),
  );
}

async function dispatchVisible(page: Page) {
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

async function driftVideo(page: Page, time: number, play = true) {
  await page.locator("video").evaluate((video: HTMLVideoElement, args) => {
    video.currentTime = args.time;
    if (args.play) return video.play();
    video.pause();
  }, { time, play });
}

const guestStorage = existsSync("tests/e2e/auth/guest1.json")
  ? "tests/e2e/auth/guest1.json"
  : "tests/e2e/auth/guest.json";

test.describe("Watch Party - Canonical Video Sync", () => {
  test.setTimeout(90_000);

  test("host pause syncs to guest", async ({ browser }) => {
    const hostContext = await browser.newContext({
      storageState: "tests/e2e/auth/host.json",
    });
    const guestContext = await browser.newContext({ storageState: guestStorage });

    const hostPage = await hostContext.newPage();
    const guestPage = await guestContext.newPage();
    const syncRequests: string[] = [];
    hostPage.on("request", (request) => {
      if (request.url().includes("/api/watch-party/sync")) {
        syncRequests.push(`${request.method()} ${request.url()}`);
      }
    });
    hostPage.on("console", (message) => {
      if (message.text().includes("[wp_")) console.log(`[host] ${message.text()}`);
    });
    guestPage.on("console", (message) => {
      if (message.text().includes("[wp_")) console.log(`[guest] ${message.text()}`);
    });

    try {
      const roomCode = process.env.WATCH_PARTY_TEST_ROOM_CODE ?? await createRoom(hostPage);

      await hostPage.goto(`/xem-chung/${roomCode}`);
      await guestPage.goto(`/xem-chung/${roomCode}`);

      await Promise.all([waitForReadyVideo(hostPage), waitForReadyVideo(guestPage)]);

      await triggerPlayerControl(hostPage);
      expect(syncRequests.length).toBeGreaterThan(0);
      await expect
        .poll(async () => (await videoState(hostPage)).paused, { timeout: 7000 })
        .toBe(false);
      await expect
        .poll(async () => (await videoState(guestPage)).paused, { timeout: 10000 })
        .toBe(false);

      await triggerPlayerControl(hostPage);
      await expect
        .poll(async () => (await videoState(hostPage)).paused, { timeout: 7000 })
        .toBe(true);
      await expect
        .poll(async () => (await videoState(guestPage)).paused, { timeout: 10000 })
        .toBe(true);
    } finally {
      await hostContext.close();
      await guestContext.close();
    }
  });

  test("guest controller keeps seeked pause time after focus return", async ({ browser }) => {
    const hostContext = await browser.newContext({
      storageState: "tests/e2e/auth/host.json",
    });
    const guestContext = await browser.newContext({ storageState: guestStorage });

    const hostPage = await hostContext.newPage();
    const guestPage = await guestContext.newPage();

    try {
      const roomCode = await createRoom(hostPage, true);

      await hostPage.goto(`/xem-chung/${roomCode}`);
      await guestPage.goto(`/xem-chung/${roomCode}`);

      await Promise.all([waitForReadyVideo(hostPage), waitForReadyVideo(guestPage)]);

      await triggerPlayerControl(hostPage);
      await expect
        .poll(async () => (await videoState(guestPage)).paused, { timeout: 10000 })
        .toBe(false);

      await seekPlayer(guestPage, 60);
      await triggerPlayerControl(guestPage);
      await expect
        .poll(async () => (await videoState(guestPage)).paused, { timeout: 7000 })
        .toBe(true);
      await expect
        .poll(async () => (await videoState(guestPage)).currentTime, { timeout: 7000 })
        .toBeGreaterThan(55);

      await dispatchVisible(guestPage);

      await expect
        .poll(async () => (await videoState(guestPage)).currentTime, { timeout: 3000 })
        .toBeGreaterThan(55);
    } finally {
      await hostContext.close();
      await guestContext.close();
    }
  });

  test("reload during host pause applies paused canonical state", async ({ browser }) => {
    const hostContext = await browser.newContext({
      storageState: "tests/e2e/auth/host.json",
    });
    const guestContext = await browser.newContext({ storageState: guestStorage });

    const hostPage = await hostContext.newPage();
    const guestPage = await guestContext.newPage();

    try {
      const roomCode = await createRoom(hostPage);

      await hostPage.goto(`/xem-chung/${roomCode}`);
      await guestPage.goto(`/xem-chung/${roomCode}`);
      await Promise.all([waitForReadyVideo(hostPage), waitForReadyVideo(guestPage)]);

      await triggerPlayerControl(hostPage);
      await expect
        .poll(async () => (await videoState(guestPage)).paused, { timeout: 10000 })
        .toBe(false);

      const reloadPromise = guestPage.reload({ waitUntil: "domcontentloaded" });
      await triggerPlayerControl(hostPage);
      await reloadPromise;
      await waitForReadyVideo(guestPage);

      await expect
        .poll(async () => (await videoState(guestPage)).paused, { timeout: 10000 })
        .toBe(true);

      await triggerPlayerControl(hostPage);
      await expect
        .poll(async () => (await videoState(hostPage)).paused, { timeout: 7000 })
        .toBe(false);
      await expect
        .poll(async () => (await videoState(guestPage)).paused, { timeout: 10000 })
        .toBe(false);

      await triggerPlayerControl(hostPage);
      await expect
        .poll(async () => (await videoState(hostPage)).paused, { timeout: 7000 })
        .toBe(true);
      await expect
        .poll(async () => (await videoState(guestPage)).paused, { timeout: 10000 })
        .toBe(true);
    } finally {
      await hostContext.close();
      await guestContext.close();
    }
  });

  test("active controller can play and pause after reload", async ({ browser }) => {
    const hostContext = await browser.newContext({
      storageState: "tests/e2e/auth/host.json",
    });
    const guestContext = await browser.newContext({ storageState: guestStorage });

    const hostPage = await hostContext.newPage();
    const guestPage = await guestContext.newPage();

    try {
      const roomCode = await createRoom(hostPage);

      await hostPage.goto(`/xem-chung/${roomCode}`);
      await guestPage.goto(`/xem-chung/${roomCode}`);
      await Promise.all([waitForReadyVideo(hostPage), waitForReadyVideo(guestPage)]);

      await triggerPlayerControl(hostPage);
      await expect
        .poll(async () => (await videoState(guestPage)).paused, { timeout: 10000 })
        .toBe(false);

      await triggerPlayerControl(hostPage);
      await expect
        .poll(async () => (await videoState(guestPage)).paused, { timeout: 10000 })
        .toBe(true);

      await hostPage.reload({ waitUntil: "domcontentloaded" });
      await waitForReadyVideo(hostPage);
      await expect
        .poll(async () => (await videoState(hostPage)).paused, { timeout: 10000 })
        .toBe(true);

      await clickPlayerControl(hostPage);
      await expect
        .poll(async () => (await videoState(hostPage)).paused, { timeout: 7000 })
        .toBe(false);
      await expect
        .poll(async () => (await videoState(guestPage)).paused, { timeout: 10000 })
        .toBe(false);

      await clickPlayerControl(hostPage);
      await expect
        .poll(async () => (await videoState(hostPage)).paused, { timeout: 7000 })
        .toBe(true);
      await expect
        .poll(async () => (await videoState(guestPage)).paused, { timeout: 10000 })
        .toBe(true);
    } finally {
      await hostContext.close();
      await guestContext.close();
    }
  });

  test("host reload after seek does not roll guest back", async ({ browser }) => {
    const hostContext = await browser.newContext({
      storageState: "tests/e2e/auth/host.json",
    });
    const guestContext = await browser.newContext({ storageState: guestStorage });

    const hostPage = await hostContext.newPage();
    const guestPage = await guestContext.newPage();

    try {
      const roomCode = await createRoom(hostPage);

      await hostPage.goto(`/xem-chung/${roomCode}`);
      await guestPage.goto(`/xem-chung/${roomCode}`);
      await Promise.all([waitForReadyVideo(hostPage), waitForReadyVideo(guestPage)]);

      await triggerPlayerControl(hostPage);
      await seekPlayer(hostPage, 60);
      await expect
        .poll(async () => (await videoState(guestPage)).currentTime, { timeout: 10000 })
        .toBeGreaterThan(55);

      await hostPage.reload({ waitUntil: "domcontentloaded" });
      await waitForReadyVideo(hostPage);

      await expect
        .poll(async () => (await videoState(guestPage)).currentTime, { timeout: 7000 })
        .toBeGreaterThan(55);
    } finally {
      await hostContext.close();
      await guestContext.close();
    }
  });

  test("active controller heartbeat repairs paused guest drift", async ({ browser }) => {
    const hostContext = await browser.newContext({
      storageState: "tests/e2e/auth/host.json",
    });
    const guestContext = await browser.newContext({ storageState: guestStorage });

    const hostPage = await hostContext.newPage();
    const guestPage = await guestContext.newPage();

    try {
      const roomCode = await createRoom(hostPage);

      await hostPage.goto(`/xem-chung/${roomCode}`);
      await guestPage.goto(`/xem-chung/${roomCode}`);
      await Promise.all([waitForReadyVideo(hostPage), waitForReadyVideo(guestPage)]);

      await triggerPlayerControl(hostPage);
      await seekPlayer(hostPage, 60);
      await triggerPlayerControl(hostPage);
      await expect
        .poll(async () => (await videoState(guestPage)).paused, { timeout: 10000 })
        .toBe(true);

      await driftVideo(guestPage, 15, true);

      await expect
        .poll(async () => (await videoState(guestPage)), { timeout: 12000 })
        .toMatchObject({ paused: true });
      await expect
        .poll(async () => (await videoState(guestPage)).currentTime, { timeout: 12000 })
        .toBeGreaterThan(55);
    } finally {
      await hostContext.close();
      await guestContext.close();
    }
  });
});
