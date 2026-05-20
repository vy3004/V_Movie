import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleParticipantAction, togglePermission, useWatchPartyStore } from "@/stores/watch-party";
import { sendSystemMessage } from "@/stores/watch-party/actions/chat.actions";
import type { WatchPartyParticipant, WatchPartyRoom } from "@/types";

const { toast } = vi.hoisted(() => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("sonner", () => ({ toast }));
vi.mock("@/stores/watch-party/actions/chat.actions", () => ({
  sendSystemMessage: vi.fn(),
}));

const room: WatchPartyRoom = {
  id: "room-1",
  room_code: "ABC123",
  host_id: "host-1",
  current_movie_slug: null,
  current_episode_slug: null,
  movie_image: null,
  title: "Test room",
  is_private: false,
  participant_count: 2,
  max_participants: 10,
  is_active: true,
  settings: {
    wait_for_all: false,
    guest_can_chat: true,
    allow_guest_control: false,
  },
  created_at: "2026-05-16T00:00:00.000Z",
  updated_at: "2026-05-16T00:00:00.000Z",
};

const makeParticipant = (
  id: string,
  userId: string,
  overrides: Partial<WatchPartyParticipant> = {},
): WatchPartyParticipant => ({
  id,
  room_id: room.id,
  user_id: userId,
  role: "guest",
  status: "pending",
  permissions: {
    can_manage_users: false,
    can_control_media: false,
  },
  is_muted: false,
  is_voice_muted: false,
  created_at: "2026-05-16T00:00:00.000Z",
  ...overrides,
});

const setupStore = (participants: WatchPartyParticipant[]) => {
  useWatchPartyStore.setState({
    room,
    user: { id: "host-1" } as any,
    participants,
    dataChannel: null,
    dataChannelStatus: "closed",
  });
};

const setupJoinedDataChannel = (send = vi.fn().mockResolvedValue(undefined)) => {
  useWatchPartyStore.setState({
    dataChannel: { state: "joined", send } as any,
    dataChannelStatus: "joined",
  });
  return send;
};

describe("watch party participant actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(sendSystemMessage).mockResolvedValue(undefined as any);
    useWatchPartyStore.setState({ room: null, user: null, participants: [] });
    global.fetch = vi.fn();
  });

  it("handleParticipantAction rolls back failed kick to exact participant snapshot and shows parsed API error", async () => {
    const previousParticipants = [
      makeParticipant("p1", "guest-1", { status: "approved" }),
      makeParticipant("p2", "guest-2", { status: "approved" }),
    ];
    setupStore(previousParticipants);
    setupJoinedDataChannel();
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Không thể trục xuất Chủ phòng" }),
    } as Response);

    await expect(
      handleParticipantAction("guest-1", "kick", "Guest 1"),
    ).rejects.toThrow("Không thể trục xuất Chủ phòng");

    expect(useWatchPartyStore.getState().participants).toBe(previousParticipants);
    expect(toast.error).toHaveBeenCalledWith("Không thể trục xuất Chủ phòng");
  });

  it("keeps successful kick when system message fails", async () => {
    const previousParticipants = [
      makeParticipant("p1", "guest-1", { status: "approved" }),
      makeParticipant("p2", "guest-2", { status: "approved" }),
    ];
    setupStore(previousParticipants);
    setupJoinedDataChannel();
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true } as Response);
    vi.mocked(sendSystemMessage).mockRejectedValueOnce(new Error("message failed"));

    await handleParticipantAction("guest-1", "kick", "Guest 1");

    expect(useWatchPartyStore.getState().participants).toEqual([
      previousParticipants[1],
    ]);
    expect(toast.success).toHaveBeenCalledWith("Đã trục xuất");
  });

  it("handleParticipantAction sends server command when data channel is closed", async () => {
    const previousParticipants = [
      makeParticipant("p1", "guest-1", { status: "approved" }),
      makeParticipant("p2", "guest-2", { status: "approved" }),
    ];
    setupStore(previousParticipants);
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, removedUserId: "guest-1" }),
    } as Response);

    await handleParticipantAction("guest-1", "kick", "Guest 1");

    expect(fetch).toHaveBeenCalledWith(
      "/api/watch-party/participant",
      expect.objectContaining({ method: "POST" }),
    );
    expect(useWatchPartyStore.getState().participants).toEqual([
      previousParticipants[1],
    ]);
    expect(toast.error).not.toHaveBeenCalledWith("Kênh realtime chưa sẵn sàng");
  });

  it("handleParticipantAction does not use browser broadcast after successful kick", async () => {
    const previousParticipants = [
      makeParticipant("p1", "guest-1", { status: "approved" }),
      makeParticipant("p2", "guest-2", { status: "approved" }),
    ];
    const send = setupJoinedDataChannel();
    setupStore(previousParticipants);
    useWatchPartyStore.setState({
      dataChannel: { state: "joined", send } as any,
      dataChannelStatus: "joined",
    });
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, removedUserId: "guest-1" }),
    } as Response);
    vi.mocked(sendSystemMessage).mockResolvedValueOnce(undefined as any);

    await handleParticipantAction("guest-1", "kick", "Guest 1");

    expect(useWatchPartyStore.getState().participants).toEqual([
      previousParticipants[1],
    ]);
    expect(send).not.toHaveBeenCalled();
  });

  it("togglePermission rolls back to exact participant snapshot and shows parsed API error", async () => {
    const previousParticipants = [
      makeParticipant("p1", "guest-1", {
        status: "approved",
        permissions: { can_manage_users: false, can_control_media: true },
      }),
      makeParticipant("p2", "guest-2", { status: "approved" }),
    ];
    setupStore(previousParticipants);
    setupJoinedDataChannel();
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Bạn không có quyền quản lý thành viên" }),
    } as Response);

    await togglePermission("guest-1", "can_manage_users");

    expect(useWatchPartyStore.getState().participants).toBe(previousParticipants);
    expect(toast.error).toHaveBeenCalledWith("Bạn không có quyền quản lý thành viên");
  });

  it("togglePermission sends server command when data channel is closed", async () => {
    const participant = makeParticipant("p1", "guest-1", {
      status: "approved",
      permissions: { can_manage_users: false, can_control_media: false },
    });
    const confirmedParticipant = makeParticipant("p1", "guest-1", {
      status: "approved",
      permissions: { can_manage_users: false, can_control_media: true },
      realtime_revision: 2,
    });
    const send = vi.fn().mockResolvedValue(undefined);
    setupStore([participant]);
    useWatchPartyStore.setState({
      dataChannel: { state: "closed", send } as any,
      dataChannelStatus: "closed",
    });
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ participant: confirmedParticipant }),
    } as Response);

    await togglePermission("guest-1", "can_control_media");

    expect(fetch).toHaveBeenCalledWith(
      "/api/watch-party/participant/permissions",
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(useWatchPartyStore.getState().participants[0]).toMatchObject(
      confirmedParticipant,
    );
    expect(send).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalledWith("Kênh realtime chưa sẵn sàng");
  });

  it("togglePermission applies server-confirmed participant without browser broadcast after API success", async () => {
    const participant = makeParticipant("p1", "guest-1", {
      status: "approved",
      permissions: { can_manage_users: false, can_control_media: false },
    });
    const confirmedParticipant = makeParticipant("p1", "guest-1", {
      status: "approved",
      permissions: { can_manage_users: false, can_control_media: true },
      profiles: { full_name: "Guest Confirmed", avatar_url: "avatar.png" },
    } as Partial<WatchPartyParticipant>);
    const send = vi.fn().mockResolvedValue(undefined);
    setupStore([participant]);
    useWatchPartyStore.setState({
      dataChannel: { state: "joined", send } as any,
      dataChannelStatus: "joined",
    });
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ participant: confirmedParticipant }),
    } as Response);

    await togglePermission("guest-1", "can_control_media");

    expect(useWatchPartyStore.getState().participants[0]).toMatchObject(
      confirmedParticipant,
    );
    expect(send).not.toHaveBeenCalled();
  });

  it("togglePermission keeps server-confirmed participant when browser channel is closed", async () => {
    const participant = makeParticipant("p1", "guest-1", {
      status: "approved",
      permissions: { can_manage_users: false, can_control_media: false },
    });
    const confirmedParticipant = makeParticipant("p1", "guest-1", {
      status: "approved",
      permissions: { can_manage_users: false, can_control_media: true },
    });
    const send = vi.fn().mockRejectedValueOnce(new Error("channel closed"));
    setupStore([participant]);
    useWatchPartyStore.setState({
      dataChannel: { state: "joined", send } as any,
      dataChannelStatus: "joined",
    });
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ participant: confirmedParticipant }),
    } as Response);

    await togglePermission("guest-1", "can_control_media");

    expect(useWatchPartyStore.getState().participants[0]).toMatchObject(
      confirmedParticipant,
    );
    expect(send).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalledWith("channel closed");
    expect(toast.success).toHaveBeenCalledWith("Đã cập nhật quyền");
  });

  it("keeps recent permission revoke when stale participant snapshot arrives", async () => {
    const participant = makeParticipant("p1", "guest-1", {
      status: "approved",
      permissions: { can_manage_users: true, can_control_media: true },
    });
    const revokedParticipant = makeParticipant("p1", "guest-1", {
      status: "approved",
      permissions: { can_manage_users: true, can_control_media: false },
      realtime_revision: 2,
    });
    const staleParticipant = makeParticipant("p1", "guest-1", {
      status: "approved",
      permissions: { can_manage_users: true, can_control_media: true },
      realtime_revision: 1,
    });
    setupStore([participant]);
    setupJoinedDataChannel();
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ participant: revokedParticipant }),
    } as Response);

    await togglePermission("guest-1", "can_control_media");
    useWatchPartyStore.getState().addParticipant(staleParticipant);

    expect(useWatchPartyStore.getState().participants[0].permissions.can_control_media).toBe(false);
  });
});
