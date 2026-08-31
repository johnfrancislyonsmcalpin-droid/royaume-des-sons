import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'http://localhost:4173/royaume-des-sons/',
    viewport: { width: 1024, height: 768 },
    hasTouch: true,
  },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173',
    url: 'http://localhost:4173/royaume-des-sons/',
    reuseExistingServer: true,
    timeout: 180000,
  },
})