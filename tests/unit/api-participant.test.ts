// tests/unit/api-participant.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
// Import trực tiếp từ thư mục app thay vì lib
import { POST } from "@/app/api/watch-party/participant/route";

// ==========================================
// 1. SETUP MOCKS (GIẢ LẬP SUPABASE & NEXT.JS)
// ==========================================

// Giả lập NextResponse của Next.js (vì chạy trên Node.js không có sẵn biến này)
vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: any, init?: { status: number }) => ({
      status: init?.status || 200,
      json: async () => body,
    }),
  },
}));

// Giả lập chuỗi hàm query của Supabase (Ví dụ: supabase.from().select().eq().single())
const mockSupabaseChain = {
  select: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn(),
};

// Giả lập hàm lấy thông tin User (Auth)
const mockGetUser = vi.fn();

// Ghi đè file tạo client Supabase ở phía Server
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServer: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: vi.fn(() => mockSupabaseChain),
  })),
}));

// Hàm tiện ích: Giúp tạo nhanh một Request ảo để đẩy vào API
const createMockRequest = (body: any) => {
  return new Request("http://localhost/api/watch-party/participant", {
    method: "POST",
    body: JSON.stringify(body),
  });
};

// ==========================================
// 2. KỊCH BẢN TEST API
// ==========================================

describe("API POST /api/watch-party/participant (Quản lý Thành viên)", () => {
  beforeEach(() => {
    vi.clearAllMocks(); // Xoá lịch sử gọi hàm của test trước
    // Mặc định cho tất cả bài test: Người gọi API đã đăng nhập thành công
    mockGetUser.mockResolvedValue({ data: { user: { id: "caller-id" } } });
  });

  it("🔴 1. Trả về 403 nếu người gọi KHÔNG CÓ QUYỀN quản lý", async () => {
    // Kịch bản: DB trả về người gọi chỉ là 'guest', can_manage_users = false
    mockSupabaseChain.single.mockResolvedValueOnce({
      data: { role: "guest", permissions: { can_manage_users: false } },
    });

    // Hành động: Cố gắng duyệt một người khác
    const req = createMockRequest({
      roomId: "room-1",
      targetUserId: "target-1",
      action: "approve",
    });
    const res = await POST(req);
    const body = await res.json();

    // Kiểm tra: Bị chặn với mã 403
    expect(res.status).toBe(403);
    expect(body.error).toBe("Bạn không có quyền quản lý thành viên");
  });

  it("🔴 2. Ngăn chặn Lỗ hổng Lật đổ (Mutiny Bug): KHÔNG THỂ thao tác lên Chủ phòng", async () => {
    // Gọi DB lần 1: Check Caller -> Trả về Guest ĐƯỢC CẤP QUYỀN quản lý
    mockSupabaseChain.single.mockResolvedValueOnce({
      data: { role: "guest", permissions: { can_manage_users: true } },
    });
    // Gọi DB lần 2: Check Target -> Trả về Target chính là HOST (Chủ phòng)
    mockSupabaseChain.single.mockResolvedValueOnce({
      data: { role: "host" },
    });

    // Hành động: Kẻ lật đổ cố gắng KICK Chủ phòng
    const req = createMockRequest({
      roomId: "room-1",
      targetUserId: "host-id",
      action: "kick",
    });
    const res = await POST(req);
    const body = await res.json();

    // Kiểm tra: Bị chặn với mã 403 và lời nhắc
    expect(res.status).toBe(403);
    expect(body.error).toBe("Không thể thao tác lên Chủ phòng");
    // Tuyệt đối không được gọi lệnh update DB để kick
    expect(mockSupabaseChain.update).not.toHaveBeenCalled();
  });

  it('🟢 3. Đổi status thành "blocked" khi thực hiện hành động KICK', async () => {
    // Gọi DB lần 1: Caller là Host
    mockSupabaseChain.single.mockResolvedValueOnce({ data: { role: "host" } });
    // Gọi DB lần 2: Target là Guest
    mockSupabaseChain.single.mockResolvedValueOnce({ data: { role: "guest" } });

    // ĐÃ XÓA DÒNG MOCK CỦA UPDATE ĐỂ KHÔNG BỊ GÃY CHUỖI .eq()

    // Hành động: Host KICK Guest
    const req = createMockRequest({
      roomId: "room-1",
      targetUserId: "bad-guest",
      action: "kick",
    });
    const res = await POST(req);
    const body = await res.json();

    // Kiểm tra: API báo thành công
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);

    // Kiểm tra then chốt: Đảm bảo DB được update với status 'blocked'
    expect(mockSupabaseChain.update).toHaveBeenCalledWith({
      status: "blocked",
    });
  });

  it("🟢 4. Dùng lệnh DELETE khi thực hiện hành động REJECT", async () => {
    // Gọi DB lần 1: Caller là Host
    mockSupabaseChain.single.mockResolvedValueOnce({ data: { role: "host" } });
    // Gọi DB lần 2: Target là Guest
    mockSupabaseChain.single.mockResolvedValueOnce({ data: { role: "guest" } });

    // ĐÃ XÓA DÒNG MOCK CỦA DELETE ĐỂ KHÔNG BỊ GÃY CHUỖI .eq()

    // Hành động: Host REJECT người đang gõ cửa
    const req = createMockRequest({
      roomId: "room-1",
      targetUserId: "pending-guest",
      action: "reject",
    });
    const res = await POST(req);

    // Kiểm tra: API phải gọi hàm .delete() của Supabase
    expect(res.status).toBe(200);
    expect(mockSupabaseChain.delete).toHaveBeenCalled();
  });
});
