/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from "vitest";
import { WatchPartyService } from "@/services/watch-party.service";
import {
  RoomNotFoundError,
  RoomClosedError,
  RoomFullError,
  NotHostError,
  BadRequestError,
  ForbiddenError,
  NoPermissionError,
} from "@/lib/errors/watch-party-errors";

// Mock dependencies
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServer: vi.fn(),
}));

vi.mock("@/lib/redis", () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    incr: vi.fn(),
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("@/services/watch-party-config.service", () => ({
  WatchPartyConfigService: {
    invalidateLobbyCache: vi.fn(),
  },
}));

describe("WatchPartyService", () => {
  describe("Room Management", () => {
    describe("createRoom", () => {
      it("should create a room successfully", async () => {
        const mockSupabase = {
          from: vi.fn().mockReturnThis(),
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: "room-123",
              room_code: "ABC123",
              host_id: "user-1",
              current_movie_slug: "one-piece",
              current_episode_slug: "tap-1",
            },
            error: null,
          }),
        };

        const { createSupabaseServer } = await import("@/lib/supabase/server");
        vi.mocked(createSupabaseServer).mockResolvedValue(mockSupabase as any);

        const result = await WatchPartyService.createRoom({
          hostId: "user-1",
          movieSlug: "one-piece",
          movieImage: "image.jpg",
          episodeSlug: "tap-1",
        });

        expect(result).toBeDefined();
        expect(result.room_code).toBe("ABC123");
      });

      it("should retry on room code collision", async () => {
        const roomInsertMock = vi.fn();
        const participantInsertMock = vi.fn();

        const mockSupabase = {
          from: vi.fn((table: string) => {
            if (table === "watch_party_rooms") {
              return {
                insert: roomInsertMock.mockReturnThis(),
                select: vi.fn().mockReturnThis(),
                single: vi.fn(),
              };
            } else if (table === "watch_party_participants") {
              return {
                insert: participantInsertMock.mockResolvedValue({
                  error: null,
                }),
              };
            }
            return mockSupabase;
          }),
        };

        // First attempt: collision
        roomInsertMock.mockReturnValueOnce({
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { code: "23505" },
          }),
        });

        // Second attempt: success
        roomInsertMock.mockReturnValueOnce({
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: "room-123",
              room_code: "XYZ789",
              host_id: "user-1",
              current_movie_slug: "one-piece",
              current_episode_slug: "tap-1",
            },
            error: null,
          }),
        });

        const { createSupabaseServer } = await import("@/lib/supabase/server");
        vi.mocked(createSupabaseServer).mockResolvedValue(mockSupabase as any);

        const result = await WatchPartyService.createRoom({
          hostId: "user-1",
          movieSlug: "one-piece",
          movieImage: "image.jpg",
          episodeSlug: "tap-1",
        });

        expect(result).toBeDefined();
        expect(roomInsertMock).toHaveBeenCalledTimes(2);
      });

      it("should throw error after 3 retries", async () => {
        const mockSupabase = {
          from: vi.fn().mockReturnThis(),
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { code: "23505" },
          }),
        };

        const { createSupabaseServer } = await import("@/lib/supabase/server");
        vi.mocked(createSupabaseServer).mockResolvedValue(mockSupabase as any);

        await expect(
          WatchPartyService.createRoom({
            hostId: "user-1",
            movieSlug: "one-piece",
            movieImage: "image.jpg",
            episodeSlug: "tap-1",
          }),
        ).rejects.toThrow(BadRequestError);
      });
    });

    describe("getRoom", () => {
      it("should return room from cache if available", async () => {
        const { redis } = await import("@/lib/redis");
        const cachedRoom = {
          id: "room-123",
          room_code: "ABC123",
        };

        vi.mocked(redis.get).mockResolvedValueOnce(cachedRoom);
        vi.mocked(redis.get).mockResolvedValueOnce({
          status: "pause",
          time: 10,
          updated_at: Date.now(),
        });

        const result = await WatchPartyService.getRoom("room-123");

        expect(result.room).toEqual(cachedRoom);
        expect(redis.get).toHaveBeenCalledWith("wp:room:room-123:info");
      });

      it("should fetch from database if cache miss", async () => {
        const { redis } = await import("@/lib/redis");
        const { createSupabaseServer } = await import("@/lib/supabase/server");

        vi.mocked(redis.get).mockResolvedValue(null);

        const mockSupabase = {
          from: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: "room-123",
              room_code: "ABC123",
            },
            error: null,
          }),
        };

        vi.mocked(createSupabaseServer).mockResolvedValue(mockSupabase as any);

        const result = await WatchPartyService.getRoom("room-123");

        expect(result.room).toBeDefined();
        expect(redis.set).toHaveBeenCalled();
      });

      it("should throw error if room not found", async () => {
        const { redis } = await import("@/lib/redis");
        const { createSupabaseServer } = await import("@/lib/supabase/server");

        vi.mocked(redis.get).mockResolvedValue(null);

        const mockSupabase = {
          from: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: "Not found" },
          }),
        };

        vi.mocked(createSupabaseServer).mockResolvedValue(mockSupabase as any);

        await expect(WatchPartyService.getRoom("invalid-id")).rejects.toThrow(
          RoomNotFoundError,
        );
      });
    });

    describe("closeRoom", () => {
      it("should close room and cleanup Redis", async () => {
        const { redis } = await import("@/lib/redis");
        const { createSupabaseServer } = await import("@/lib/supabase/server");

        const mockSupabase = {
          from: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          delete: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { role: "host" },
            error: null,
          }),
        };

        vi.mocked(createSupabaseServer).mockResolvedValue(mockSupabase as any);

        await WatchPartyService.closeRoom("room-123", "user-1");

        expect(redis.del).toHaveBeenCalledWith("wp:room:room-123:state");
        expect(redis.del).toHaveBeenCalledWith("wp:room:room-123:info");
        expect(redis.del).toHaveBeenCalledWith("wp:room:room-123:lock");
      });

      it("should throw error if non-host tries to close", async () => {
        const { createSupabaseServer } = await import("@/lib/supabase/server");

        const mockSupabase = {
          from: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { role: "participant" },
            error: null,
          }),
        };

        vi.mocked(createSupabaseServer).mockResolvedValue(mockSupabase as any);

        await expect(
          WatchPartyService.closeRoom("room-123", "user-2"),
        ).rejects.toThrow(NotHostError);
      });
    });
  });

  describe("Participant Management", () => {
    describe("joinRoom", () => {
      it("should allow joining public room", async () => {
        const { createSupabaseServer } = await import("@/lib/supabase/server");

        const selectMock = vi.fn();
        const mockSupabase = {
          from: vi.fn().mockReturnThis(),
          insert: vi.fn().mockReturnThis(),
          delete: vi.fn().mockReturnThis(),
          select: selectMock,
          eq: vi.fn().mockReturnThis(),
        };

        selectMock.mockReturnValueOnce({
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              is_private: false,
              max_participants: 20,
              is_active: true,
            },
            error: null,
          }),
        });

        const hostRoomEq = vi.fn().mockReturnThis();
        selectMock.mockReturnValueOnce({ eq: hostRoomEq });
        hostRoomEq.mockReturnValueOnce({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { user_id: "user-1" },
              error: null,
            }),
          }),
        });

        selectMock.mockReturnValueOnce({
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { code: "PGRST116" },
          }),
        });

        const countRoomEq = vi.fn().mockReturnThis();
        selectMock.mockReturnValueOnce({ eq: countRoomEq });
        countRoomEq.mockReturnValueOnce({
          eq: vi.fn().mockResolvedValue({ count: 1 }),
        });

        const finalCountRoomEq = vi.fn().mockReturnThis();
        selectMock.mockReturnValueOnce({ eq: finalCountRoomEq });
        finalCountRoomEq.mockReturnValueOnce({
          eq: vi.fn().mockResolvedValue({ count: 2 }),
        });

        vi.mocked(createSupabaseServer).mockResolvedValue(mockSupabase as any);

        const result = await WatchPartyService.joinRoom("123e4567-e89b-12d3-a456-426614174000", "user-2");

        expect(result.success).toBe(true);
        expect(result.status).toBe("approved");
      });

      it("should set pending status for private room", async () => {
        const { createSupabaseServer } = await import("@/lib/supabase/server");

        const selectMock = vi.fn();
        const mockSupabase = {
          from: vi.fn().mockReturnThis(),
          insert: vi.fn().mockReturnThis(),
          select: selectMock,
          eq: vi.fn().mockReturnThis(),
        };

        // First call: get room info
        selectMock.mockReturnValueOnce({
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              is_private: true,
              max_participants: 20,
              is_active: true,
            },
            error: null,
          }),
        });

        // Second call: check current host
        const hostRoomEq = vi.fn().mockReturnThis();
        selectMock.mockReturnValueOnce({
          eq: hostRoomEq,
        });
        hostRoomEq.mockReturnValueOnce({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { user_id: "user-1" },
              error: null,
            }),
          }),
        });

        // Third call: check existing participant
        selectMock.mockReturnValueOnce({
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { code: "PGRST116" },
          }),
        });

        // Fourth call: count participants
        const countRoomEq = vi.fn().mockReturnThis();
        selectMock.mockReturnValueOnce({
          eq: countRoomEq,
        });
        countRoomEq.mockReturnValueOnce({
          eq: vi.fn().mockResolvedValue({ count: 1 }),
        });

        vi.mocked(createSupabaseServer).mockResolvedValue(mockSupabase as any);

        const result = await WatchPartyService.joinRoom("123e4567-e89b-12d3-a456-426614174000", "user-2");

        expect(result.status).toBe("pending");
      });

      it("should throw error if room is full", async () => {
        const { createSupabaseServer } = await import("@/lib/supabase/server");

        const selectMock = vi.fn();
        const mockSupabase = {
          from: vi.fn().mockReturnThis(),
          insert: vi.fn().mockReturnThis(),
          select: selectMock,
          eq: vi.fn().mockReturnThis(),
        };

        // First call: get room info
        selectMock.mockReturnValueOnce({
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              is_private: false,
              max_participants: 2,
              is_active: true,
            },
            error: null,
          }),
        });

        // Second call: check current host
        const hostRoomEq = vi.fn().mockReturnThis();
        selectMock.mockReturnValueOnce({
          eq: hostRoomEq,
        });
        hostRoomEq.mockReturnValueOnce({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { user_id: "user-1" },
              error: null,
            }),
          }),
        });

        // Third call: check existing participant
        selectMock.mockReturnValueOnce({
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { code: "PGRST116" },
          }),
        });

        // Fourth call: count participants (room is full)
        const countRoomEq = vi.fn().mockReturnThis();
        selectMock.mockReturnValueOnce({
          eq: countRoomEq,
        });
        countRoomEq.mockReturnValueOnce({
          eq: vi.fn().mockResolvedValue({ count: 2 }),
        });

        vi.mocked(createSupabaseServer).mockResolvedValue(mockSupabase as any);

        await expect(
          WatchPartyService.joinRoom("123e4567-e89b-12d3-a456-426614174000", "user-3"),
        ).rejects.toThrow(RoomFullError);
      });

      it("should throw error if user is blocked", async () => {
        const { createSupabaseServer } = await import("@/lib/supabase/server");

        const selectMock = vi.fn();
        const mockSupabase = {
          from: vi.fn().mockReturnThis(),
          select: selectMock,
          eq: vi.fn().mockReturnThis(),
        };

        selectMock.mockReturnValueOnce({
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              is_private: false,
              max_participants: 20,
              is_active: true,
            },
            error: null,
          }),
        });

        const hostRoomEq = vi.fn().mockReturnThis();
        selectMock.mockReturnValueOnce({
          eq: hostRoomEq,
        });
        hostRoomEq.mockReturnValueOnce({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { user_id: "user-1" },
              error: null,
            }),
          }),
        });

        selectMock.mockReturnValueOnce({
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { status: "blocked" },
            error: null,
          }),
        });

        vi.mocked(createSupabaseServer).mockResolvedValue(mockSupabase as any);

        await expect(
          WatchPartyService.joinRoom("123e4567-e89b-12d3-a456-426614174000", "user-2"),
        ).rejects.toThrow(ForbiddenError);
      });
    });
  });

  describe("Video Sync", () => {
    describe("syncVideoState", () => {
      it("should sync video state to Redis", async () => {
        const { redis } = await import("@/lib/redis");
        const { createSupabaseServer } = await import("@/lib/supabase/server");

        const mockSupabase = {
          from: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              role: "host",
              permissions: { can_control_media: true },
            },
            error: null,
          }),
        };

        vi.mocked(createSupabaseServer).mockResolvedValue(mockSupabase as any);
        vi.mocked(redis.get).mockResolvedValue({
          status: "pause",
          time: 0,
          updated_at: Date.now(),
        });

        await WatchPartyService.syncVideoState({
          roomId: "room-123",
          userId: "user-1",
          status: "play",
          time: 10,
        });

        expect(redis.set).toHaveBeenCalledWith(
          "wp:room:room-123:state",
          expect.objectContaining({
            status: "play",
            time: 10,
          }),
          { ex: 86400 },
        );
      });

      it("should allocate canonical versions with Redis atomic counter", async () => {
        const { redis } = await import("@/lib/redis");
        const { createSupabaseServer } = await import("@/lib/supabase/server");

        const mockSupabase = {
          from: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              role: "host",
              permissions: { can_control_media: true },
              room: { settings: { allow_guest_control: false } },
              profiles: { full_name: "Host" },
            },
            error: null,
          }),
        };

        vi.mocked(createSupabaseServer).mockResolvedValue(mockSupabase as any);
        vi.mocked(redis!.get).mockResolvedValue({
          status: "pause",
          time: 0,
          episode_slug: "tap-1",
          active_controller_id: "user-0",
          version: 7,
          updated_at: Date.now(),
        });
        vi.mocked(redis!.incr).mockResolvedValue(8);

        const result = await WatchPartyService.syncVideoState({
          roomId: "room-123",
          userId: "user-1",
          status: "play",
          time: 10,
        });

        expect(redis!.incr).toHaveBeenCalledWith("wp:room:room-123:state:version");
        expect(result.state.version).toBe(8);
        expect(redis!.set).toHaveBeenCalledWith(
          "wp:room:room-123:state",
          expect.objectContaining({ version: 8, active_controller_id: "user-1" }),
          { ex: 86400 },
        );
      });

      it("should throw error if user lacks permission", async () => {
        const { createSupabaseServer } = await import("@/lib/supabase/server");

        const mockSupabase = {
          from: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              role: "participant",
              permissions: { can_control_media: false },
              room: { settings: { allow_guest_control: false } },
            },
            error: null,
          }),
        };

        vi.mocked(createSupabaseServer).mockResolvedValue(mockSupabase as any);

        await expect(
          WatchPartyService.syncVideoState({
            roomId: "room-123",
            userId: "user-2",
            status: "play",
            time: 10,
          }),
        ).rejects.toThrow(NoPermissionError);
      });
    });
  });
});
