import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/watch-party/lobby/route";
import { WatchPartyConfigService } from "@/services/watch-party-config.service";

vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

vi.mock("@/services/watch-party-config.service", () => ({
  WatchPartyConfigService: {
    getLobby: vi.fn(),
  },
}));

describe("watch party lobby API sort", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(WatchPartyConfigService.getLobby).mockResolvedValue({
      rooms: [],
      nextPage: null,
    });
  });

  it("defaults to newest when sort missing", async () => {
    await GET(new Request("http://localhost/api/watch-party/lobby"));

    expect(WatchPartyConfigService.getLobby).toHaveBeenCalledWith(
      expect.objectContaining({ sort: "newest" }),
    );
  });

  it("passes most_viewers sort", async () => {
    await GET(
      new Request("http://localhost/api/watch-party/lobby?sort=most_viewers"),
    );

    expect(WatchPartyConfigService.getLobby).toHaveBeenCalledWith(
      expect.objectContaining({ sort: "most_viewers" }),
    );
  });

  it("passes most_slots sort", async () => {
    await GET(
      new Request("http://localhost/api/watch-party/lobby?sort=most_slots"),
    );

    expect(WatchPartyConfigService.getLobby).toHaveBeenCalledWith(
      expect.objectContaining({ sort: "most_slots" }),
    );
  });

  it("falls back to newest when sort invalid", async () => {
    await GET(new Request("http://localhost/api/watch-party/lobby?sort=invalid"));

    expect(WatchPartyConfigService.getLobby).toHaveBeenCalledWith(
      expect.objectContaining({ sort: "newest" }),
    );
  });
});
