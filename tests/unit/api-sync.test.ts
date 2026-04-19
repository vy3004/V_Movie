// tests/unit/api-sync.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/watch-party/sync/route";

// 1. FIX LỖI HOISTING BẰNG vi.hoisted()
// Tất cả các biến dùng bên trong vi.mock() phải được bọc trong vi.hoisted()
const { mockRedis, mockSupabaseChain, mockGetUser } = vi.hoisted(() => {
  return {
    mockRedis: {
      get: vi.fn(),
      set: vi.fn(),
    },
    mockSupabaseChain: {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
      update: vi.fn().mockReturnThis(),
    },
    mockGetUser: vi.fn(),
  };
});

// 2. Setup Mock Redis
vi.mock("@/lib/redis", () => ({ redis: mockRedis }));

// 3. Setup Mock Supabase
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServer: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: vi.fn(() => mockSupabaseChain),
  })),
}));

describe("API POST /api/watch-party/sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Khởi tạo mặc định: user đã đăng nhập
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  });

  it("🔴 1. Chặn Guest không có quyền điều khiển video", async () => {
    // Giả lập DB: Guest không có quyền control, và phòng không mở allow_guest_control
    mockSupabaseChain.single.mockResolvedValueOnce({
      data: {
        role: "guest",
        permissions: { can_control_video: false },
        room: { settings: { allow_guest_control: false } },
      },
    });

    const req = new Request("http://localhost/api/watch-party/sync", {
      method: "POST",
      body: JSON.stringify({ roomId: "r1", status: "play", time: 100 }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("🟢 2. Logic Merge State: Giữ nguyên episode_slug cũ nếu payload chỉ gửi time", async () => {
    // Caller là Host
    mockSupabaseChain.single.mockResolvedValueOnce({
      data: { role: "host", room: { settings: {} } },
    });

    // Giả lập Redis đang có dữ liệu cũ (đang xem tập 1)
    mockRedis.get.mockResolvedValueOnce({
      status: "play",
      episode_slug: "tap-1",
      time: 50,
    });

    // API nhận payload mới (Guest gọi heartbeat báo cáo thời gian lên giây 100, status bị undefined)
    const req = new Request("http://localhost/api/watch-party/sync", {
      method: "POST",
      body: JSON.stringify({ roomId: "r1", time: 100 }),
    });

    await POST(req);

    // Kiểm tra Redis set: Phải gộp được episode_slug và status cũ vào
    const lastCall = mockRedis.set.mock.calls[0];
    const savedData = lastCall[1]; // Payload được lưu vào Redis

    expect(savedData.time).toBe(100);
    expect(savedData.episode_slug).toBe("tap-1"); // Không bị mất episode cũ
    expect(savedData.status).toBe("play"); // Không bị mất trạng thái cũ
  });
});
