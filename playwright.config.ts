import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  /* Chạy server local trước khi test */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    // 1. Project Setup: Chạy trước tất cả để lấy session
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    // 2. Project chạy Test Watch Party
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'], // Chỉ chạy sau khi 'setup' đã pass
    },
  ],
});