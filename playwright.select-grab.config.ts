import { defineConfig, devices } from '@playwright/test'

// A hosted candidate only: never starts a server or installs dependencies.
const baseURL = process.env.SELECT_GRAB_BASE_URL
if (!baseURL) throw new Error('Set SELECT_GRAB_BASE_URL to the candidate preview origin')

export default defineConfig({
  testDir: 'e2e',
  testMatch: 'select-grab.spec.ts',
  workers: 1,
  retries: 0,
  timeout: 45_000,
  reporter: [['list']],
  use: {
    ...devices['Desktop Chrome'],
    viewport: { width: 1280, height: 720 },
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
})
