import "@testing-library/jest-dom";
import { vi } from "vitest";

// Set NODE_ENV for tests
// process.env.NODE_ENV = "test"; // Commented out - read-only in build

// Mock server-only GLOBALLY để tất cả tests đều bypass
vi.mock("server-only", () => ({}));

// NOTE: Supabase mock moved to individual test files for better control
// Each test file should mock Supabase according to its needs

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
