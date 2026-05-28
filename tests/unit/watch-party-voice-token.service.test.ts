/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VoiceTokenService } from "@/services/voice-token.service";

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServer: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const addGrant = vi.fn();
const toJwt = vi.fn().mockResolvedValue("voice-token");

vi.mock("livekit-server-sdk", () => ({
  AccessToken: vi.fn().mockImplementation(function () {
    return {
      addGrant,
      toJwt,
    };
  }),
}));

describe("VoiceTokenService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.LIVEKIT_API_KEY = "key";
    process.env.LIVEKIT_API_SECRET = "secret";
    toJwt.mockResolvedValue("voice-token");
  });

  it("generates token for approved participant in active room", async () => {
    const { createSupabaseServer } = await import("@/lib/supabase/server");

    const mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi
        .fn()
        .mockResolvedValueOnce({ data: { id: "room-1" }, error: null })
        .mockResolvedValueOnce({
          data: {
            is_voice_muted: false,
            profiles: { full_name: "Host" },
          },
          error: null,
        }),
    };

    vi.mocked(createSupabaseServer).mockResolvedValue(mockSupabase as any);

    await expect(
      VoiceTokenService.generateToken({ roomCode: "ABC123", userId: "user-1" }),
    ).resolves.toEqual({ token: "voice-token" });

    expect(mockSupabase.eq).toHaveBeenCalledWith("is_active", true);
    expect(mockSupabase.eq).toHaveBeenCalledWith("status", "approved");
    expect(addGrant).toHaveBeenCalledWith({
      roomJoin: true,
      room: "ABC123",
      canPublish: true,
      canPublishData: false,
      canSubscribe: true,
    });
  });

  it("rejects pending participant before generating token", async () => {
    const { createSupabaseServer } = await import("@/lib/supabase/server");

    const mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi
        .fn()
        .mockResolvedValueOnce({ data: { id: "room-1" }, error: null })
        .mockResolvedValueOnce({ data: null, error: null }),
    };

    vi.mocked(createSupabaseServer).mockResolvedValue(mockSupabase as any);

    await expect(
      VoiceTokenService.generateToken({ roomCode: "ABC123", userId: "user-2" }),
    ).rejects.toThrow("Bạn không phải là thành viên của phòng này");
    expect(toJwt).not.toHaveBeenCalled();
  });
});
