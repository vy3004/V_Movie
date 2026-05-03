/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from "vitest";
import { WatchPartyContentService } from "@/services/watch-party-content.service";

// Mock dependencies
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServer: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe("WatchPartyContentService", () => {
  describe("Playlist Management", () => {
    describe("addToPlaylist", () => {
      it("should add item to playlist successfully", async () => {
        const { createSupabaseServer } = await import("@/lib/supabase/server");

        const mockSupabase = {
          from: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          insert: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValueOnce({
            data: {
              role: "host",
              permissions: { can_control_media: true },
            },
            error: null,
          }),
          maybeSingle: vi
            .fn()
            .mockResolvedValueOnce({
              data: null, // No duplicate
              error: null,
            })
            .mockResolvedValueOnce({
              data: { sort_order: 5 }, // Last item
              error: null,
            }),
        };

        vi.mocked(createSupabaseServer).mockResolvedValue(mockSupabase as any);

        const result = await WatchPartyContentService.addToPlaylist({
          roomId: "room-123",
          userId: "user-1",
          movieSlug: "one-piece",
          movieName: "One Piece",
          episodeSlug: "tap-1",
          thumbUrl: "thumb.jpg",
        });

        expect(result).toBeDefined();
        expect(mockSupabase.insert).toHaveBeenCalled();
      });

      it("should throw error on duplicate playlist item", async () => {
        const { createSupabaseServer } = await import("@/lib/supabase/server");

        const mockSupabase = {
          from: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValueOnce({
            data: {
              role: "host",
              permissions: { can_control_media: true },
            },
            error: null,
          }),
          maybeSingle: vi.fn().mockResolvedValueOnce({
            data: { id: "existing-item" }, // Duplicate found
            error: null,
          }),
        };

        vi.mocked(createSupabaseServer).mockResolvedValue(mockSupabase as any);

        await expect(
          WatchPartyContentService.addToPlaylist({
            roomId: "room-123",
            userId: "user-1",
            movieSlug: "one-piece",
            movieName: "One Piece",
            episodeSlug: "tap-1",
            thumbUrl: "thumb.jpg",
          }),
        ).rejects.toThrow("Phim này đã có trong danh sách chờ");
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
            },
            error: null,
          }),
        };

        vi.mocked(createSupabaseServer).mockResolvedValue(mockSupabase as any);

        await expect(
          WatchPartyContentService.addToPlaylist({
            roomId: "room-123",
            userId: "user-2",
            movieSlug: "one-piece",
            movieName: "One Piece",
            episodeSlug: "tap-1",
            thumbUrl: "thumb.jpg",
          }),
        ).rejects.toThrow("Bạn không có quyền thêm phim vào hàng đợi");
      });

      it("should throw error if user not in room", async () => {
        const { createSupabaseServer } = await import("@/lib/supabase/server");

        const mockSupabase = {
          from: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        };

        vi.mocked(createSupabaseServer).mockResolvedValue(mockSupabase as any);

        await expect(
          WatchPartyContentService.addToPlaylist({
            roomId: "room-123",
            userId: "user-3",
            movieSlug: "one-piece",
            movieName: "One Piece",
            episodeSlug: "tap-1",
            thumbUrl: "thumb.jpg",
          }),
        ).rejects.toThrow("Bạn không có trong phòng này");
      });
    });

    describe("removeFromPlaylist", () => {
      it("should remove item from playlist successfully", async () => {
        const { createSupabaseServer } = await import("@/lib/supabase/server");

        const mockSupabase = {
          from: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          delete: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi
            .fn()
            .mockResolvedValueOnce({
              data: { room_id: "room-123" },
              error: null,
            })
            .mockResolvedValueOnce({
              data: {
                role: "host",
                permissions: { can_control_media: true },
              },
              error: null,
            }),
        };

        vi.mocked(createSupabaseServer).mockResolvedValue(mockSupabase as any);

        const result = await WatchPartyContentService.removeFromPlaylist(
          "item-123",
          "user-1",
        );

        expect(result.success).toBe(true);
        expect(mockSupabase.delete).toHaveBeenCalled();
      });

      it("should throw error if user lacks permission", async () => {
        const { createSupabaseServer } = await import("@/lib/supabase/server");

        const mockSupabase = {
          from: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi
            .fn()
            .mockResolvedValueOnce({
              data: { room_id: "room-123" },
              error: null,
            })
            .mockResolvedValueOnce({
              data: {
                role: "participant",
                permissions: { can_control_media: false },
              },
              error: null,
            }),
        };

        vi.mocked(createSupabaseServer).mockResolvedValue(mockSupabase as any);

        await expect(
          WatchPartyContentService.removeFromPlaylist("item-123", "user-2"),
        ).rejects.toThrow("Bạn không có quyền xoá phim khỏi Playlist");
      });
    });

    describe("getPlaylist", () => {
      it("should return playlist items sorted by order", async () => {
        const { createSupabaseServer } = await import("@/lib/supabase/server");

        const mockPlaylist = [
          { id: "1", sort_order: 0, movie_name: "Movie 1" },
          { id: "2", sort_order: 1, movie_name: "Movie 2" },
        ];

        const mockSupabase = {
          from: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: mockPlaylist,
            error: null,
          }),
        };

        vi.mocked(createSupabaseServer).mockResolvedValue(mockSupabase as any);

        const result = await WatchPartyContentService.getPlaylist("room-123");

        expect(result).toEqual(mockPlaylist);
        expect(mockSupabase.order).toHaveBeenCalledWith("sort_order", {
          ascending: true,
        });
      });
    });
  });

  describe("Message Management", () => {
    describe("sendMessage", () => {
      it("should send chat message successfully", async () => {
        const { createSupabaseServer } = await import("@/lib/supabase/server");

        const mockSupabase = {
          from: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          insert: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi
            .fn()
            .mockResolvedValueOnce({
              data: {
                role: "participant",
                is_muted: false,
                permissions: {},
              },
              error: null,
            })
            .mockResolvedValueOnce({
              data: {
                settings: { guest_can_chat: true },
              },
              error: null,
            })
            .mockResolvedValueOnce({
              data: {
                id: "msg-123",
                text: "Hello",
                type: "chat",
              },
              error: null,
            }),
        };

        vi.mocked(createSupabaseServer).mockResolvedValue(mockSupabase as any);

        const result = await WatchPartyContentService.sendMessage({
          id: "msg-123",
          roomId: "room-123",
          userId: "user-1",
          text: "Hello",
          type: "chat",
        });

        expect(result).toBeDefined();
        expect(result.text).toBe("Hello");
      });

      it("should throw error if user is muted", async () => {
        const { createSupabaseServer } = await import("@/lib/supabase/server");

        const mockSupabase = {
          from: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi
            .fn()
            .mockResolvedValueOnce({
              data: {
                role: "participant",
                is_muted: true,
                permissions: {},
              },
              error: null,
            })
            .mockResolvedValueOnce({
              data: {
                settings: { guest_can_chat: true },
              },
              error: null,
            }),
        };

        vi.mocked(createSupabaseServer).mockResolvedValue(mockSupabase as any);

        await expect(
          WatchPartyContentService.sendMessage({
            id: "msg-123",
            roomId: "room-123",
            userId: "user-1",
            text: "Hello",
            type: "chat",
          }),
        ).rejects.toThrow("Bạn bị cấm chat");
      });

      it("should throw error if chat is disabled", async () => {
        const { createSupabaseServer } = await import("@/lib/supabase/server");

        const mockSupabase = {
          from: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi
            .fn()
            .mockResolvedValueOnce({
              data: {
                role: "participant",
                is_muted: false,
                permissions: {},
              },
              error: null,
            })
            .mockResolvedValueOnce({
              data: {
                settings: { guest_can_chat: false },
              },
              error: null,
            }),
        };

        vi.mocked(createSupabaseServer).mockResolvedValue(mockSupabase as any);

        await expect(
          WatchPartyContentService.sendMessage({
            id: "msg-123",
            roomId: "room-123",
            userId: "user-1",
            text: "Hello",
            type: "chat",
          }),
        ).rejects.toThrow("Phòng đã tắt chat");
      });

      it("should throw error if non-moderator sends system message", async () => {
        const { createSupabaseServer } = await import("@/lib/supabase/server");

        const mockSupabase = {
          from: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi
            .fn()
            .mockResolvedValueOnce({
              data: {
                role: "participant",
                is_muted: false,
                permissions: {},
              },
              error: null,
            })
            .mockResolvedValueOnce({
              data: {
                settings: { guest_can_chat: true },
              },
              error: null,
            }),
        };

        vi.mocked(createSupabaseServer).mockResolvedValue(mockSupabase as any);

        await expect(
          WatchPartyContentService.sendMessage({
            id: "msg-123",
            roomId: "room-123",
            userId: "user-1",
            text: "System message",
            type: "system",
          }),
        ).rejects.toThrow("Không có quyền gửi tin hệ thống");
      });
    });

    describe("getMessages", () => {
      it("should return last 50 messages", async () => {
        const { createSupabaseServer } = await import("@/lib/supabase/server");

        const mockMessages = Array.from({ length: 50 }, (_, i) => ({
          id: `msg-${i}`,
          text: `Message ${i}`,
          created_at: new Date().toISOString(),
        }));

        const mockSupabase = {
          from: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({
            data: mockMessages.reverse(),
            error: null,
          }),
          single: vi.fn().mockResolvedValue({
            data: { id: "participant-1" },
            error: null,
          }),
        };

        vi.mocked(createSupabaseServer).mockResolvedValue(mockSupabase as any);

        const result = await WatchPartyContentService.getMessages(
          "room-123",
          "user-1",
        );

        expect(result).toHaveLength(50);
        expect(mockSupabase.limit).toHaveBeenCalledWith(50);
      });

      it("should throw error if user is not participant", async () => {
        const { createSupabaseServer } = await import("@/lib/supabase/server");

        const mockSupabase = {
          from: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        };

        vi.mocked(createSupabaseServer).mockResolvedValue(mockSupabase as any);

        await expect(
          WatchPartyContentService.getMessages("room-123", "user-3"),
        ).rejects.toThrow("Bạn không phải thành viên phòng");
      });
    });
  });
});
