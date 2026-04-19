// tests/unit/api-playlist.test.ts
import { describe, it, expect, vi } from "vitest";
import { POST } from "@/app/api/watch-party/playlist/route";

const mockSupabaseChain = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  single: vi.fn(),
  maybeSingle: vi.fn(),
  insert: vi.fn().mockReturnThis(),
};

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServer: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }),
    },
    from: vi.fn(() => mockSupabaseChain),
  })),
}));

describe("API POST /api/watch-party/playlist", () => {
  it("🔴 Chặn thành viên chưa được duyệt (Pending) thêm phim", async () => {
    // DB trả về user đang ở trạng thái pending
    mockSupabaseChain.single.mockResolvedValueOnce({
      data: null,
      error: { message: "Not found" }, // Giả lập query single trả về lỗi/null
    });

    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ roomId: "r1", movieSlug: "conan" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
  });
});
