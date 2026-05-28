import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/watch-party/presence/route";
import { WatchPartyPresenceService } from "@/services/watch-party-presence.service";

vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

const mockGetUser = vi.fn();
const mockMaybeSingle = vi.fn();
const mockEq = vi.fn(() => ({ eq: mockEq, maybeSingle: mockMaybeSingle }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServer: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}));

vi.mock("@/services/watch-party-presence.service", () => ({
  WatchPartyPresenceService: {
    getActiveLeases: vi.fn(),
    getStaleUserIds: vi.fn(),
    leave: vi.fn(),
    touch: vi.fn(),
  },
}));

describe("watch party presence API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "guest-1" } } });
    mockMaybeSingle.mockResolvedValue({ data: { id: "participant-1" }, error: null });
    vi.mocked(WatchPartyPresenceService.getActiveLeases).mockResolvedValue([]);
    vi.mocked(WatchPartyPresenceService.getStaleUserIds).mockResolvedValue([]);
  });

  it("allows approved participants to read room leases", async () => {
    const res = await GET(new Request("http://localhost/api/watch-party/presence?roomId=room-1"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ activeLeases: [], staleUserIds: [] });
  });

  it("allows approved participants to send heartbeat", async () => {
    const res = await POST(
      new Request("http://localhost/api/watch-party/presence", {
        method: "POST",
        body: JSON.stringify({
          roomId: "room-1",
          sessionId: "tab-1",
          status: "online",
          action: "heartbeat",
        }),
      }),
    );

    expect(res.status).toBe(200);
    expect(WatchPartyPresenceService.touch).toHaveBeenCalledWith({
      roomId: "room-1",
      userId: "guest-1",
      sessionId: "tab-1",
      status: "online",
      source: "data-channel",
    });
  });
});
