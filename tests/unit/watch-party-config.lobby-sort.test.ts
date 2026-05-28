/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";

const orderMock = vi.fn();
const rangeMock = vi.fn();
const queryMock: any = {
  select: vi.fn(() => queryMock),
  eq: vi.fn(() => queryMock),
  gt: vi.fn(() => queryMock),
  or: vi.fn(() => queryMock),
  order: orderMock,
  range: rangeMock,
};

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServer: vi.fn(async () => ({
    from: vi.fn(() => queryMock),
  })),
}));

vi.mock("@/lib/redis", () => ({
  redis: null,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/services/watch-party-presence.service", () => ({
  WATCH_PARTY_PRESENCE_STALE_MS: 30000,
  WatchPartyPresenceService: {
    hasAnyActiveLeaseByRoomIds: vi.fn(async () => ({})),
  },
}));

describe("WatchPartyConfigService.getLobby sort", () => {
  beforeEach(() => {
    orderMock.mockReset();
    rangeMock.mockReset();

    orderMock.mockImplementation(() => queryMock);
    rangeMock.mockResolvedValue({ data: [], error: null });
  });

  it("orders by participant_count then created_at for most_viewers", async () => {
    const { WatchPartyConfigService } = await import(
      "@/services/watch-party-config.service"
    );

    await WatchPartyConfigService.getLobby({
      search: "",
      page: 0,
      limit: 12,
      sort: "most_viewers",
    });

    expect(orderMock).toHaveBeenNthCalledWith(1, "participant_count", {
      ascending: false,
    });
    expect(orderMock).toHaveBeenNthCalledWith(2, "created_at", {
      ascending: false,
    });
  });

  it("orders by max_participants then created_at for most_slots", async () => {
    const { WatchPartyConfigService } = await import(
      "@/services/watch-party-config.service"
    );

    await WatchPartyConfigService.getLobby({
      search: "",
      page: 0,
      limit: 12,
      sort: "most_slots",
    });

    expect(orderMock).toHaveBeenNthCalledWith(1, "max_participants", {
      ascending: false,
    });
    expect(orderMock).toHaveBeenNthCalledWith(2, "created_at", {
      ascending: false,
    });
  });

  it("orders by created_at for newest", async () => {
    const { WatchPartyConfigService } = await import(
      "@/services/watch-party-config.service"
    );

    await WatchPartyConfigService.getLobby({
      search: "",
      page: 0,
      limit: 12,
      sort: "newest",
    });

    expect(orderMock).toHaveBeenCalledWith("created_at", {
      ascending: false,
    });
  });
});
