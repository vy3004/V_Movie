import "@testing-library/jest-dom";
import { vi } from "vitest";

// Mock Supabase vì không gọi DB thật khi chạy Unit Test
vi.mock("@/lib/supabase/client", () => ({
  createSupabaseClient: () => ({
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    })),
  }),
}));

// Giả lập NextResponse của Next.js Server
vi.mock("next/server", () => {
  return {
    NextResponse: {
      json: (body: any, init?: { status: number }) => {
        return {
          status: init?.status || 200,
          json: async () => body,
        };
      },
    },
  };
});
