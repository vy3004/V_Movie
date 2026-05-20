import { expect, test, type Page } from "@playwright/test";
import fs from "fs";
import path from "path";

const hostState = path.resolve(process.cwd(), "tests/e2e/auth/host.json");
const cleanupGuestState = path.resolve(process.cwd(), "tests/e2e/auth/guest1.json");
const successionGuestState = path.resolve(process.cwd(), "tests/e2e/auth/guest2.json");
const permissionGuestState = path.resolve(process.cwd(), "tests/e2e/auth/guest4.json");

async function gotoRoomIgnoringSameUrlRace(page: Page, code: string) {
  const target = `/xem-chung/${code}`;
  try {
    await page.goto(target);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      !message.includes("is interrupted by another navigation") &&
      !message.includes("net::ERR_ABORTED")
    ) {
      throw error;
    }
  }
  await expect(page).toHaveURL(new RegExp(`/xem-chung/${code}$`), { timeout: 15000 });
}

function getUserIdFromStorageState(filePath: string) {
  const storage = JSON.parse(fs.readFileSync(filePath, "utf8")) as {
    cookies: { name: string; value: string }[];
  };
  const token = storage.cookies
    .filter((cookie) => cookie.name.includes("auth-token"))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((cookie) => cookie.value.replace(/^base64-/, ""))
    .join("");
  const session = JSON.parse(Buffer.from(token, "base64").toString("utf8")) as {
    user?: { id?: string };
  };

  return session.user?.id;
}

async function createPrivateRoom(page: Page) {
  const result = await page.evaluate(async () => {
    const res = await fetch("/api/watch-party", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `E2E Members Realtime ${Date.now()}`,
        isPrivate: true,
        maxParticipants: 6,
        movieSlug: "one-piece-phan-2",
        movieImage: "https://example.com/poster.jpg",
        episodeSlug: "tap-1",
        settings: {
          wait_for_all: false,
          guest_can_chat: true,
          allow_guest_control: false,
        },
      }),
    });
    if (!res.ok) throw new Error(await res.text());
    return (await res.json()).room as { id: string; room_code: string };
  });

  return result;
}

async function joinRoomByApi(page: Page, roomId: string) {
  await page.goto("/xem-chung");
  const result = await page.evaluate(async (id) => {
    const res = await fetch("/api/watch-party/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId: id }),
    });
    return { ok: res.ok, body: await res.json() };
  }, roomId);

  expect(result.ok).toBe(true);
  return result.body as { status?: string };
}

async function approveParticipantByApi(page: Page, roomId: string, targetUserId: string) {
  const result = await page.evaluate(
    async ({ roomId, targetUserId }) => {
      const res = await fetch("/api/watch-party/participant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, targetUserId, action: "approve" }),
      });
      return { ok: res.ok, body: await res.json().catch(() => null) };
    },
    { roomId, targetUserId },
  );

  expect(result.ok).toBe(true);
  return result.body;
}

async function openMembersTab(page: Page) {
  const membersTab = page.getByTestId("watch-party-tab-members");
  try {
    await expect(membersTab).toBeVisible({ timeout: 20000 });
  } catch (error) {
    fs.writeFileSync(
      path.resolve(process.cwd(), "pw-members-open-tab-report.json"),
      JSON.stringify(
        {
          url: page.url(),
          title: await page.title().catch(() => null),
          bodyText: await page.locator("body").innerText({ timeout: 1000 }).catch(() => null),
          debugState: await page.evaluate(() =>
            (window as unknown as { __WATCH_PARTY_DEBUG__?: () => unknown }).__WATCH_PARTY_DEBUG__?.(),
          ).catch(() => null),
        },
        null,
        2,
      ),
    );
    throw error;
  }
  await membersTab.click();
  await expect(page.getByText("Thành viên", { exact: true })).toBeVisible({
    timeout: 15000,
  });
}

test.describe("watch party members realtime", () => {
  test.describe.configure({ mode: "serial" });

  test("presence status changes to away and offline cleanup removes route-leaved guest", async ({ browser }) => {
    test.setTimeout(120000);

    const hostContext = await browser.newContext({ storageState: hostState });
    const guestContext = await browser.newContext({ storageState: cleanupGuestState });
    const hostPage = await hostContext.newPage();
    const guestPage = await guestContext.newPage();

    try {
      await hostPage.goto("/xem-chung");
      const room = await createPrivateRoom(hostPage);
      await hostPage.goto(`/xem-chung/${room.room_code}`);
      await openMembersTab(hostPage);

      await joinRoomByApi(guestPage, room.id);
      const guestUserId = getUserIdFromStorageState(cleanupGuestState);
      expect(guestUserId).toBeTruthy();

      await gotoRoomIgnoringSameUrlRace(guestPage, room.room_code);
      await expect(hostPage.locator("text=/Yêu cầu \\(1\\)/")).toBeVisible({
        timeout: 15000,
      });
      const pendingRequestsSection = hostPage
        .locator("div.space-y-2.animate-in")
        .filter({ hasText: /Yêu cầu \(1\)/ })
        .first();
      const approveResponsePromise = hostPage.waitForResponse(
        (response) =>
          response.url().includes("/api/watch-party/participant") &&
          response.request().method() === "POST",
        { timeout: 5000 },
      );
      await pendingRequestsSection.locator("button").first().click();
      const approveResponse = await approveResponsePromise;
      expect(approveResponse.ok()).toBe(true);

      const guestRow = hostPage.locator(
        `[data-testid="watch-party-participant"][data-user-id="${guestUserId}"]`,
      );
      await gotoRoomIgnoringSameUrlRace(guestPage, room.room_code);
      await expect(guestPage.getByTestId("watch-party-tab-members")).toBeVisible({ timeout: 20000 });
      await expect(hostPage.locator("text=/Yêu cầu \\(1\\)/")).toBeHidden({
        timeout: 15000,
      });
      try {
        await expect(guestRow).toBeVisible({ timeout: 15000 });
      } catch (error) {
        fs.writeFileSync(
          path.resolve(process.cwd(), "pw-members-guest-row-report.json"),
          JSON.stringify(
            {
              guestUserId,
              approveBody: await approveResponse.json().catch(() => null),
              hostRows: await hostPage.locator(".group.flex.items-center").allTextContents(),
              hostState: await hostPage.evaluate(() =>
                (window as unknown as { __WATCH_PARTY_DEBUG__?: () => unknown }).__WATCH_PARTY_DEBUG__?.(),
              ),
              guestState: await guestPage.evaluate(() =>
                (window as unknown as { __WATCH_PARTY_DEBUG__?: () => unknown }).__WATCH_PARTY_DEBUG__?.(),
              ),
            },
            null,
            2,
          ),
        );
        throw error;
      }
      await expect
        .poll(
          async () =>
            guestPage.evaluate(
              () =>
                (window as unknown as { __WATCH_PARTY_DEBUG__?: () => { dataChannelStatus?: string } })
                  .__WATCH_PARTY_DEBUG__?.().dataChannelStatus,
            ),
          { timeout: 15000 },
        )
        .toBe("joined");
      try {
        await expect(guestRow.locator('[title="Online"]')).toBeVisible({ timeout: 15000 });
      } catch (error) {
        fs.writeFileSync(
          path.resolve(process.cwd(), "pw-members-online-presence-report.json"),
          JSON.stringify(
            {
              guestUserId,
              hostRows: await hostPage.locator(".group.flex.items-center").allTextContents(),
              guestRowText: await guestRow.allTextContents(),
              guestRowTitles: await guestRow.locator("[title]").evaluateAll((elements) =>
                elements.map((element) => element.getAttribute("title")),
              ),
              hostState: await hostPage.evaluate(() =>
                (window as unknown as { __WATCH_PARTY_DEBUG__?: () => unknown }).__WATCH_PARTY_DEBUG__?.(),
              ),
              guestState: await guestPage.evaluate(() =>
                (window as unknown as { __WATCH_PARTY_DEBUG__?: () => unknown }).__WATCH_PARTY_DEBUG__?.(),
              ),
            },
            null,
            2,
          ),
        );
        throw error;
      }

      await guestPage.evaluate(() => window.dispatchEvent(new Event("blur")));
      await expect(guestRow.locator('[title="Away"]')).toBeVisible({ timeout: 15000 });

      await guestPage.getByRole("link", { name: "Logo" }).click();
      await expect(guestPage).toHaveURL(/\/$/, { timeout: 15000 });
      await expect(guestRow.locator('[title="Offline"]')).toBeVisible({ timeout: 15000 });
      try {
        await expect(guestRow).toBeHidden({ timeout: 45000 });
      } catch (error) {
        fs.writeFileSync(
          path.resolve(process.cwd(), "pw-members-cleanup-report.json"),
          JSON.stringify(
            {
              hostRows: await hostPage.locator(".group.flex.items-center").allTextContents(),
              hostState: await hostPage.evaluate(() =>
                (window as unknown as { __WATCH_PARTY_DEBUG__?: () => unknown }).__WATCH_PARTY_DEBUG__?.(),
              ),
            },
            null,
            2,
          ),
        );
        throw error;
      }
    } finally {
      await hostContext.close();
      await guestContext.close();
    }
  });

  test("route-leaved host promotes approved guest without refresh", async ({ browser }) => {
    test.setTimeout(180000);

    const hostContext = await browser.newContext({ storageState: hostState });
    const guestContext = await browser.newContext({ storageState: successionGuestState });
    const hostPage = await hostContext.newPage();
    const guestPage = await guestContext.newPage();

    try {
      await hostPage.goto("/xem-chung");
      const room = await createPrivateRoom(hostPage);
      await hostPage.goto(`/xem-chung/${room.room_code}`);
      await openMembersTab(hostPage);

      await joinRoomByApi(guestPage, room.id);
      const guestUserId = getUserIdFromStorageState(successionGuestState);
      if (!guestUserId) throw new Error("Missing succession guest user id");

      await gotoRoomIgnoringSameUrlRace(guestPage, room.room_code);
      await expect(hostPage.locator("text=/Yêu cầu \\(1\\)/")).toBeVisible({
        timeout: 15000,
      });

      await approveParticipantByApi(hostPage, room.id, guestUserId);

      await openMembersTab(guestPage);
      await expect(
        guestPage.locator(
          `[data-testid="watch-party-participant"][data-user-id="${guestUserId}"]`,
        ),
      ).toBeVisible({ timeout: 15000 });

      await hostPage.getByRole("link", { name: "Logo" }).click();
      await expect(hostPage).not.toHaveURL(new RegExp(`/xem-chung/${room.room_code}$`), { timeout: 15000 });

      const guestSelfRow = guestPage.locator(
        `[data-testid="watch-party-participant"][data-user-id="${guestUserId}"]`,
      );
      try {
        await expect
          .poll(
            async () => {
              const debugState = await guestPage.evaluate(() =>
                (window as unknown as { __WATCH_PARTY_DEBUG__?: () => unknown }).__WATCH_PARTY_DEBUG__?.(),
              );
              const myParticipant = (
                debugState as { myParticipant?: { role?: string } } | undefined
              )?.myParticipant;

              return myParticipant?.role;
            },
            { timeout: 120000, intervals: [1000] },
          )
          .toBe("host");
        await expect(guestSelfRow.getByText("Host", { exact: true })).toBeVisible({
          timeout: 5000,
        });
      } catch (error) {
        fs.writeFileSync(
          path.resolve(process.cwd(), "pw-members-host-succession-report.json"),
          JSON.stringify(
            {
              hostUrl: hostPage.url(),
              guestUrl: guestPage.url(),
              hostBody: await hostPage.locator("body").innerText({ timeout: 1000 }).catch(() => null),
              guestBody: await guestPage.locator("body").innerText({ timeout: 1000 }).catch(() => null),
              guestRows: await guestPage.locator(".group.flex.items-center").allTextContents(),
              hostState: await hostPage.evaluate(() =>
                (window as unknown as { __WATCH_PARTY_DEBUG__?: () => unknown }).__WATCH_PARTY_DEBUG__?.(),
              ).catch(() => null),
              guestState: await guestPage.evaluate(() =>
                (window as unknown as { __WATCH_PARTY_DEBUG__?: () => unknown }).__WATCH_PARTY_DEBUG__?.(),
              ).catch(() => null),
            },
            null,
            2,
          ),
        );
        throw error;
      }
      await expect(
        guestPage.locator(".group.flex.items-center").filter({ hasText: "Tăng" }).first(),
      ).toBeHidden({ timeout: 15000 });
    } finally {
      await hostContext.close();
      await guestContext.close();
    }
  });

  test("join, approve, permission, and kick update across tabs without refresh", async ({ browser }) => {
    test.setTimeout(120000);

    const hostContext = await browser.newContext({ storageState: hostState });
    const guestContext = await browser.newContext({ storageState: permissionGuestState });
    const hostPage = await hostContext.newPage();
    const guestPage = await guestContext.newPage();

    try {
      console.log("e2e step: create room");
      await hostPage.goto("/xem-chung");
      const room = await createPrivateRoom(hostPage);
      await hostPage.goto(`/xem-chung/${room.room_code}`);
      await openMembersTab(hostPage);

      console.log("e2e step: guest join");
      await joinRoomByApi(guestPage, room.id);
      const guestUserId = getUserIdFromStorageState(permissionGuestState);
      expect(guestUserId).toBeTruthy();

      await gotoRoomIgnoringSameUrlRace(guestPage, room.room_code);
      console.log("e2e step: wait pending request");
      await expect(hostPage.locator("text=/Yêu cầu \\(1\\)/")).toBeVisible({
        timeout: 15000,
      });

      console.log("e2e step: approve guest");
      const pendingRequestsSection = hostPage
        .locator("div.space-y-2.animate-in")
        .filter({ hasText: /Yêu cầu \(1\)/ })
        .first();
      await pendingRequestsSection.locator("button").first().click();

      console.log("e2e step: wait guest approved shell");
      await gotoRoomIgnoringSameUrlRace(guestPage, room.room_code);
      try {
        await expect(guestPage.getByTestId("watch-party-tab-members")).toBeVisible({ timeout: 20000 });
      } catch (error) {
        fs.writeFileSync(
          path.resolve(process.cwd(), "pw-members-report.json"),
          JSON.stringify(
            {
              guestUrl: guestPage.url(),
              guestBody: await guestPage.locator("body").innerText(),
              hostRows: await hostPage.locator(".group.flex.items-center").allTextContents(),
              hostState: await hostPage.evaluate(() =>
                (window as unknown as { __WATCH_PARTY_DEBUG__?: () => unknown }).__WATCH_PARTY_DEBUG__?.(),
              ),
              guestState: await guestPage.evaluate(() =>
                (window as unknown as { __WATCH_PARTY_DEBUG__?: () => unknown }).__WATCH_PARTY_DEBUG__?.(),
              ),
            },
            null,
            2,
          ),
        );
        throw error;
      }
      await expect(hostPage.locator("text=/Yêu cầu \\(1\\)/")).toBeHidden({
        timeout: 15000,
      });

      console.log("e2e step: wait host guest row");
      const guestRow = hostPage.locator(
        `[data-testid="watch-party-participant"][data-user-id="${guestUserId}"]`,
      );
      try {
        await expect(guestRow).toBeVisible({ timeout: 15000 });
      } catch (error) {
        fs.writeFileSync(
          path.resolve(process.cwd(), "pw-members-report.json"),
          JSON.stringify(
            {
              hostRows: await hostPage.locator(".group.flex.items-center").allTextContents(),
              hostState: await hostPage.evaluate(() =>
                (window as unknown as { __WATCH_PARTY_DEBUG__?: () => unknown }).__WATCH_PARTY_DEBUG__?.(),
              ),
              guestState: await guestPage.evaluate(() =>
                (window as unknown as { __WATCH_PARTY_DEBUG__?: () => unknown }).__WATCH_PARTY_DEBUG__?.(),
              ),
            },
            null,
            2,
          ),
        );
        throw error;
      }

      await expect
        .poll(
          async () =>
            guestPage.evaluate(
              () =>
                (window as unknown as {
                  __WATCH_PARTY_DEBUG__?: () => { dataChannelState?: string };
                }).__WATCH_PARTY_DEBUG__?.().dataChannelState,
            ),
          { timeout: 5000 },
        )
        .toBe("joined");
      await expect
        .poll(
          async () =>
            hostPage.evaluate(
              () =>
                (window as unknown as {
                  __WATCH_PARTY_DEBUG__?: () => { dataChannelState?: string };
                }).__WATCH_PARTY_DEBUG__?.().dataChannelState,
            ),
          { timeout: 5000 },
        )
        .toBe("joined");

      console.log("e2e step: open guest menu");
      await guestRow.getByTestId("participant-menu-button").click();
      const manageUsersToggle = hostPage.getByTestId("permission-toggle-can-manage-users");
      await expect(manageUsersToggle).toBeVisible({ timeout: 2000 });
      await expect(manageUsersToggle).toBeEnabled({ timeout: 2000 });
      console.log("e2e step: toggle mod");
      const modResponsePromise = hostPage.waitForResponse(
        (response) =>
          response.url().includes("/api/watch-party/participant/permissions") &&
          response.request().method() === "PATCH",
        { timeout: 5000 },
      );
      await manageUsersToggle.click();
      const modResponse = await modResponsePromise;
      if (!modResponse.ok()) {
        fs.writeFileSync(
          path.resolve(process.cwd(), "pw-members-permissions-report.json"),
          JSON.stringify(
            {
              status: modResponse.status(),
              response: await modResponse.json().catch(() => null),
              hostRows: await hostPage.locator(".group.flex.items-center").allTextContents(),
              hostState: await hostPage.evaluate(() =>
                (window as unknown as { __WATCH_PARTY_DEBUG__?: () => unknown }).__WATCH_PARTY_DEBUG__?.(),
              ),
              guestState: await guestPage.evaluate(() =>
                (window as unknown as { __WATCH_PARTY_DEBUG__?: () => unknown }).__WATCH_PARTY_DEBUG__?.(),
              ),
            },
            null,
            2,
          ),
        );
      }
      expect(modResponse.ok()).toBe(true);
      await expect(hostPage.getByText("Mod", { exact: true })).toBeVisible({
        timeout: 2000,
      });
      await expect
        .poll(
          async () =>
            guestPage.evaluate(
              () =>
                (window as unknown as {
                  __WATCH_PARTY_DEBUG__?: () => {
                    myParticipant?: {
                      permissions?: { can_manage_users?: boolean };
                    };
                  };
                }).__WATCH_PARTY_DEBUG__?.().myParticipant?.permissions
                  ?.can_manage_users,
            ),
          { timeout: 1000 },
        )
        .toBe(true);

      console.log("e2e step: toggle control");
      if (!(await hostPage.getByText("Điều khiển Video", { exact: true }).isVisible())) {
        await guestRow.getByTestId("participant-menu-button").click();
      }
      await expect(hostPage.getByText("Điều khiển Video", { exact: true })).toBeVisible({ timeout: 2000 });
      const controlResponsePromise = hostPage.waitForResponse(
        (response) =>
          response.url().includes("/api/watch-party/participant/permissions") &&
          response.request().method() === "PATCH",
        { timeout: 5000 },
      );
      await hostPage.getByTestId("permission-toggle-can-control-media").click({ timeout: 2000 });
      const controlResponse = await controlResponsePromise;
      expect(controlResponse.ok()).toBe(true);
      const controlAppliedStartedAt = Date.now();
      await expect
        .poll(
          async () =>
            guestPage.evaluate(
              () =>
                (window as unknown as { __WATCH_PARTY_DEBUG__?: () => { canControl?: boolean } })
                  .__WATCH_PARTY_DEBUG__?.().canControl,
            ),
          { timeout: 1000 },
        )
        .toBe(true);
      expect(Date.now() - controlAppliedStartedAt).toBeLessThan(2000);
      await expect(
        guestPage.locator('[data-vjs-player][class*="pointer-events-none"]'),
      ).toHaveCount(0, { timeout: 1000 });

      console.log("e2e step: guest members sees badges");
      await guestPage.locator(".sticky .border-b button").nth(1).click();
      await expect(guestPage.getByText("Mod", { exact: true })).toBeVisible({
        timeout: 1000,
      });
      await expect(guestPage.getByText("Control", { exact: true })).toBeVisible({
        timeout: 1000,
      });

      console.log("e2e step: revoke control");
      if (!(await hostPage.getByText("Điều khiển Video", { exact: true }).isVisible())) {
        await guestRow.getByTestId("participant-menu-button").click();
      }
      const revokeControlResponsePromise = hostPage.waitForResponse(
        (response) =>
          response.url().includes("/api/watch-party/participant/permissions") &&
          response.request().method() === "PATCH",
        { timeout: 5000 },
      );
      await hostPage.getByTestId("permission-toggle-can-control-media").click({ timeout: 2000 });
      const revokeControlResponse = await revokeControlResponsePromise;
      expect(revokeControlResponse.ok()).toBe(true);
      try {
        await expect
        .poll(
          async () =>
            guestPage.evaluate(
              () =>
                (window as unknown as { __WATCH_PARTY_DEBUG__?: () => { canControl?: boolean } })
                  .__WATCH_PARTY_DEBUG__?.().canControl,
            ),
          { timeout: 1000 },
        )
        .toBe(false);
      } catch (error) {
        fs.writeFileSync(
          path.resolve(process.cwd(), "pw-members-permissions-report.json"),
          JSON.stringify(
            {
              hostRows: await hostPage.locator(".group.flex.items-center").allTextContents(),
              hostState: await hostPage.evaluate(() =>
                (window as unknown as { __WATCH_PARTY_DEBUG__?: () => unknown }).__WATCH_PARTY_DEBUG__?.(),
              ),
              guestState: await guestPage.evaluate(() =>
                (window as unknown as { __WATCH_PARTY_DEBUG__?: () => unknown }).__WATCH_PARTY_DEBUG__?.(),
              ),
              revokeResponse: await revokeControlResponse.json().catch(() => null),
            },
            null,
            2,
          ),
        );
        throw error;
      }
      await expect(
        guestPage.locator('[data-vjs-player][class*="pointer-events-none"]'),
      ).toHaveCount(1, { timeout: 1000 });

      console.log("e2e step: restore control");
      if (!(await hostPage.getByText("Điều khiển Video", { exact: true }).isVisible())) {
        await guestRow.getByTestId("participant-menu-button").click();
      }
      const restoreControlResponsePromise = hostPage.waitForResponse(
        (response) =>
          response.url().includes("/api/watch-party/participant/permissions") &&
          response.request().method() === "PATCH",
        { timeout: 5000 },
      );
      await hostPage.getByTestId("permission-toggle-can-control-media").click({ timeout: 2000 });
      const restoreControlResponse = await restoreControlResponsePromise;
      expect(restoreControlResponse.ok()).toBe(true);
      await expect
        .poll(
          async () =>
            guestPage.evaluate(
              () =>
                (window as unknown as { __WATCH_PARTY_DEBUG__?: () => { canControl?: boolean } })
                  .__WATCH_PARTY_DEBUG__?.().canControl,
            ),
          { timeout: 2000 },
        )
        .toBe(true);

      console.log("e2e step: toggle chat mute");
      await hostPage.getByText("Kiểm soát", { exact: true }).click();
      await expect(hostPage.getByText("Cấm chat", { exact: true })).toBeVisible({ timeout: 1000 });
      const muteResponsePromise = hostPage.waitForResponse(
        (response) =>
          response.url().includes("/api/watch-party/participant/permissions") &&
          response.request().method() === "PATCH",
        { timeout: 5000 },
      );
      await hostPage.getByTestId("permission-toggle-is-muted").click();
      const muteResponse = await muteResponsePromise;
      expect(muteResponse.ok()).toBe(true);
      await expect
        .poll(
          async () =>
            guestPage.evaluate(
              () =>
                (window as unknown as { __WATCH_PARTY_DEBUG__?: () => { myParticipant?: { is_muted?: boolean } } })
                  .__WATCH_PARTY_DEBUG__?.().myParticipant?.is_muted,
            ),
          { timeout: 1000 },
        )
        .toBe(true);
      await guestPage.locator(".sticky .border-b button").first().click();
      await expect(guestPage.getByPlaceholder("Bị cấm chat...")).toBeVisible({
        timeout: 1000,
      });
      await expect(guestRow).toBeVisible({ timeout: 20000 });

      console.log("e2e step: kick guest");
      const kickMenuItem = hostPage.getByText("Trục xuất khỏi phòng", { exact: true });
      if (!(await kickMenuItem.isVisible())) {
        await guestRow.getByTestId("participant-menu-button").click();
      }
      await expect(kickMenuItem).toBeVisible({ timeout: 2000 });
      await kickMenuItem.click();
      await expect(hostPage.getByText("Trục xuất thành viên", { exact: true })).toBeVisible();
      await hostPage.getByRole("button", { name: "Trục xuất" }).click();

      await expect(guestPage).toHaveURL(/\/xem-chung\?kicked=1$/, { timeout: 5000 });
      await expect(
        guestPage.getByText("Bạn đã bị trục xuất khỏi phòng", { exact: true }),
      ).toBeVisible({ timeout: 2000 });
      await expect(guestRow).toBeHidden({ timeout: 2000 });
    } finally {
      await hostContext.close();
      await guestContext.close();
    }
  });

  test("kick redirects guest immediately and allows rejoin", async ({ browser }) => {
    test.setTimeout(90000);

    const hostContext = await browser.newContext({
      storageState: hostState,
      viewport: { width: 1440, height: 1000 },
    });
    const guestContext = await browser.newContext({
      storageState: permissionGuestState,
      viewport: { width: 1440, height: 1000 },
    });
    const hostPage = await hostContext.newPage();
    const guestPage = await guestContext.newPage();

    try {
      await hostPage.goto("/xem-chung");
      const room = await createPrivateRoom(hostPage);
      await hostPage.goto(`/xem-chung/${room.room_code}`);
      await openMembersTab(hostPage);

      await joinRoomByApi(guestPage, room.id);
      const guestUserId = getUserIdFromStorageState(permissionGuestState);
      expect(guestUserId).toBeTruthy();
      await approveParticipantByApi(hostPage, room.id, guestUserId!);

      await gotoRoomIgnoringSameUrlRace(guestPage, room.room_code);
      await expect(guestPage.getByTestId("watch-party-tab-members")).toBeVisible({ timeout: 20000 });

      const guestRow = hostPage.locator(
        `[data-testid="watch-party-participant"][data-user-id="${guestUserId}"]`,
      );
      await expect(guestRow).toBeVisible({ timeout: 15000 });
      await guestRow.getByTestId("participant-menu-button").click();
      await hostPage.getByText("Trục xuất khỏi phòng", { exact: true }).click();
      await expect(hostPage.getByText("Trục xuất thành viên", { exact: true })).toBeVisible();
      const kickResponsePromise = hostPage.waitForResponse(
        (response) =>
          response.url().includes("/api/watch-party/participant") &&
          response.request().method() === "POST",
        { timeout: 5000 },
      );
      await hostPage.getByRole("button", { name: "Trục xuất" }).click();
      const kickResponse = await kickResponsePromise;
      expect(kickResponse.ok()).toBe(true);

      await expect(guestPage).toHaveURL(/\/xem-chung\?kicked=1$/, { timeout: 5000 });
      await expect(
        guestPage.getByText("Bạn đã bị trục xuất khỏi phòng", { exact: true }),
      ).toBeVisible({ timeout: 2000 });
      await expect(guestRow).toBeHidden({ timeout: 2000 });

      await joinRoomByApi(guestPage, room.id);
      await expect(hostPage.locator("text=/Yêu cầu \\(1\\)/")).toBeVisible({
        timeout: 15000,
      });
    } finally {
      await hostContext.close();
      await guestContext.close();
    }
  });
});










