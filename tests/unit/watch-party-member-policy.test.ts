/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WatchPartyService } from "@/services/watch-party.service";
import { BadRequestError, NoPermissionError } from "@/lib/errors/watch-party-errors";
import { PATCH } from "@/app/api/watch-party/participant/permissions/route";

vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: any, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

vi.mock("@/lib/redis", () => ({ redis: null }));
vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));
vi.mock("@/services/watch-party-config.service", () => ({
  WatchPartyConfigService: { invalidateLobbyCache: vi.fn() },
}));

const mockGetUser = vi.fn();
const fromMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServer: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: fromMock,
  })),
}));

function singleResult(data: any) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
  };
}

function updateResult(updateMock: ReturnType<typeof vi.fn>) {
  const chain = {
    update: updateMock,
    eq: vi.fn(),
    then(resolve: any) {
      return Promise.resolve({ error: null }).then(resolve);
    },
  };
  updateMock.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  return chain;
}

function deleteResult(deleteMock: ReturnType<typeof vi.fn>) {
  const chain = {
    delete: deleteMock,
    eq: vi.fn(),
    then(resolve: any) {
      return Promise.resolve({ error: null }).then(resolve);
    },
  };
  deleteMock.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  return chain;
}

const roomId = "11111111-1111-4111-8111-111111111111";
const callerId = "22222222-2222-4222-8222-222222222222";
const targetUserId = "33333333-3333-4333-8333-333333333333";

function patchRequest(permissionKey: string) {
  return new Request("http://localhost/api/watch-party/participant/permissions", {
    method: "PATCH",
    body: JSON.stringify({
      roomId,
      targetUserId,
      permissionKey,
    }),
  });
}

describe("watch party member policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromMock.mockReset();
    mockGetUser.mockResolvedValue({ data: { user: { id: callerId } } });
  });

  it("blocks pending moderator from approving participant", async () => {
    fromMock
      .mockReturnValueOnce(
        singleResult({
          role: "guest",
          status: "pending",
          permissions: { can_manage_users: true },
        }),
      )
      .mockReturnValueOnce(singleResult({ role: "guest", status: "pending" }));

    await expect(
      WatchPartyService.manageParticipant(
        roomId,
        callerId,
        targetUserId,
        "approve",
      ),
    ).rejects.toThrow(NoPermissionError);
  });

  it("rejects approving already approved participant", async () => {
    fromMock
      .mockReturnValueOnce(
        singleResult({
          role: "host",
          status: "approved",
          permissions: { can_manage_users: true },
        }),
      )
      .mockReturnValueOnce(singleResult({ role: "guest", status: "approved" }));

    await expect(
      WatchPartyService.manageParticipant(
        roomId,
        callerId,
        targetUserId,
        "approve",
      ),
    ).rejects.toThrow(BadRequestError);
  });

  it("rejects reject action against approved guest", async () => {
    const deleteMock = vi.fn();

    fromMock
      .mockReturnValueOnce(
        singleResult({
          role: "guest",
          status: "approved",
          permissions: { can_manage_users: true },
        }),
      )
      .mockReturnValueOnce(singleResult({ role: "guest", status: "approved" }))
      .mockReturnValueOnce(deleteResult(deleteMock));

    await expect(
      WatchPartyService.manageParticipant(
        roomId,
        callerId,
        targetUserId,
        "reject",
      ),
    ).rejects.toThrow(BadRequestError);
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("blocks permission changes for non-approved target", async () => {
    const updateMock = vi.fn();

    fromMock
      .mockReturnValueOnce(
        singleResult({
          role: "host",
          status: "approved",
          permissions: { can_manage_users: true },
        }),
      )
      .mockReturnValueOnce(singleResult({ host_id: callerId }))
      .mockReturnValueOnce(
        singleResult({
          role: "guest",
          status: "pending",
          permissions: { can_manage_users: false, can_control_media: false },
          is_muted: false,
          is_voice_muted: false,
        }),
      )
      .mockReturnValueOnce(updateResult(updateMock));

    const res = await PATCH(patchRequest("can_manage_users"));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Chỉ có thể cập nhật thành viên đã được duyệt");
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("blocks approved moderator from changing system permissions", async () => {
    fromMock
      .mockReturnValueOnce(
        singleResult({
          role: "guest",
          status: "approved",
          permissions: { can_manage_users: true },
        }),
      )
      .mockReturnValueOnce(singleResult({ host_id: "other-user" }));

    const res = await PATCH(patchRequest("can_control_media"));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe("Chỉ Chủ phòng mới có quyền phân quyền hệ thống");
  });

  it("allows approved moderator to mute guest voice", async () => {
    const updateMock = vi.fn();

    fromMock
      .mockReturnValueOnce(
        singleResult({
          role: "guest",
          status: "approved",
          permissions: { can_manage_users: true },
        }),
      )
      .mockReturnValueOnce(singleResult({ host_id: "other-user" }))
      .mockReturnValueOnce(
        singleResult({
          role: "guest",
          status: "approved",
          permissions: {},
          is_muted: false,
          is_voice_muted: false,
        }),
      )
      .mockReturnValueOnce(updateResult(updateMock))
      .mockReturnValueOnce(singleResult({ id: "participant-1" }));

    const res = await PATCH(patchRequest("is_voice_muted"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(updateMock).toHaveBeenCalledWith({ is_voice_muted: true });
  });

  it("allows approved host to change can_manage_users", async () => {
    const updateMock = vi.fn();

    fromMock
      .mockReturnValueOnce(
        singleResult({
          role: "host",
          status: "approved",
          permissions: { can_manage_users: true },
        }),
      )
      .mockReturnValueOnce(singleResult({ host_id: callerId }))
      .mockReturnValueOnce(
        singleResult({
          role: "guest",
          status: "approved",
          permissions: { can_manage_users: false, can_control_media: false },
          is_muted: false,
          is_voice_muted: false,
        }),
      )
      .mockReturnValueOnce(updateResult(updateMock))
      .mockReturnValueOnce(singleResult({ id: "participant-1" }));

    const res = await PATCH(patchRequest("can_manage_users"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(updateMock).toHaveBeenCalledWith({
      permissions: { can_manage_users: true, can_control_media: false },
    });
  });
});
