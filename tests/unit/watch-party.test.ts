import { describe, it, expect } from "vitest";
import {
  canUserControlVideo,
  shouldSyncTime,
  getActiveEpisodeSlug,
} from "@/lib/watch-party-utils";
import { WatchPartyRoom } from "@/types/watch-party";

describe("Watch Party Unit Test Suite - Bộ Test 1", () => {
  // --- TEST LOGIC PHÂN QUYỀN ---
  describe("canUserControlVideo", () => {
    const mockRoom: WatchPartyRoom = {
      is_active: true,
      settings: { allow_guest_control: false },
    } as any;

    it("nên chặn tất cả nếu phòng không hoạt động (is_active: false)", () => {
      const inactiveRoom = { ...mockRoom, is_active: false };
      const host = { role: "host" } as any;
      expect(canUserControlVideo(inactiveRoom, host)).toBe(false);
    });

    it("nên cho phép Host điều khiển", () => {
      const host = { role: "host" } as any;
      expect(canUserControlVideo(mockRoom, host)).toBe(true);
    });

    it("nên chặn Guest nếu settings tắt quyền guest và guest chưa được cấp quyền riêng", () => {
      const guest = {
        role: "guest",
        permissions: { can_control_video: false },
      } as any;
      expect(canUserControlVideo(mockRoom, guest)).toBe(false);
    });

    it("nên cho phép Guest nếu đã được cấp quyền riêng can_control_video: true", () => {
      const privilegedGuest = {
        role: "guest",
        permissions: { can_control_video: true },
      } as any;
      expect(canUserControlVideo(mockRoom, privilegedGuest)).toBe(true);
    });

    it("nên cho phép Guest nếu room settings allow_guest_control: true", () => {
      const openRoom = { ...mockRoom, settings: { allow_guest_control: true } };
      const normalGuest = {
        role: "guest",
        permissions: { can_control_video: false },
      } as any;
      expect(canUserControlVideo(openRoom, normalGuest)).toBe(true);
    });
  });

  // --- TEST LOGIC ĐỒNG BỘ THỜI GIAN ---
  describe("shouldSyncTime", () => {
    it("không nên sync nếu độ lệch nhỏ (ví dụ 0.5s)", () => {
      expect(shouldSyncTime(100, 100.5)).toBe(false);
    });

    it("nên sync nếu độ lệch lớn hơn ngưỡng (ví dụ 2s > 1.5s)", () => {
      expect(shouldSyncTime(100, 102.1)).toBe(true);
    });

    it("nên sync nếu lệch ngược (Host chậm hơn Guest)", () => {
      expect(shouldSyncTime(90, 100)).toBe(true);
    });
  });

  // --- TEST LOGIC FALLBACK TẬP PHIM ---
  describe("getActiveEpisodeSlug", () => {
    const mockEpisodes = [
      { server_data: [{ slug: "tap-1" }, { slug: "tap-2" }] },
    ];

    it("nên giữ nguyên slug nếu slug đã tồn tại", () => {
      expect(getActiveEpisodeSlug("tap-5", mockEpisodes)).toBe("tap-5");
    });

    it("nên lấy tập 1 nếu slug hiện tại là null", () => {
      expect(getActiveEpisodeSlug(null, mockEpisodes)).toBe("tap-1");
    });

    it("nên trả về null nếu danh sách tập phim trống", () => {
      expect(getActiveEpisodeSlug(null, [])).toBe(null);
    });
  });
});
