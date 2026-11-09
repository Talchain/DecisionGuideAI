import { defineConfig, devices } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, existsSync, copyFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * V11 journey suite: POC-ACCEPTANCE Parts 1 and 2 (output/POC-ACCEPTANCE-20261109.md) and the 1232 audit, on V11's own build served by
 * a LOCAL olumi-core whose AI is scripted (scripts/olumi-core/test-harness/scripted-core.ts.txt). Zero provider calls, no keys.
 *
 *   pnpm exec playwright test -c playwright.v11.config.ts          with CORE_DIR=<checkout of olumi-core>, after `scripts/olumi-core/run.sh build`
 *   V11J_STORES=<dir>   optional: COPIES of the judged hiring store (hiring/olumi.db) and the J1/Reveal gate store (gate/combined.db, with
 *                       gate/maya-bookshop.token and gate/maya-strategy.token, a member's link token each) audit those boards too.
 *
 * Like the core suite (playwright.core.config.ts): retries 0, one worker, and a step that cannot run FAILS. globalTeardown counts the
 * steps that ran against the expected list, so `--grep` cannot shrink a run into a pass.
 * Each run gets a fresh data folder (computed here, once, in the runner: workers inherit the variable), so no earlier scenario is reopened.
 */
const CORE_DIR = process.env.CORE_DIR
if (!CORE_DIR || !existsSync(join(CORE_DIR, 'src/server/app.ts'))) throw new Error('CORE_DIR must name a checkout of olumi-core')
if (!existsSync('dist/index.html')) throw new Error('no dist: run `scripts/olumi-core/run.sh build` first')
process.env.V11J_DATA ??= mkdtempSync('/private/tmp/v11-journey-')
const DATA = process.env.V11J_DATA
const PORT = Number(process.env.V11J_PORT ?? 3966)
const STORES = process.env.V11J_STORES ?? null
const ADMIN = 'v11-journey-admin-key-0123456789abcdef'
process.env.V11J_ADMIN = ADMIN

/** A scripted core on its own data folder; a store is COPIED in with sqlite's backup (never the original). */
const core = (name: string, port: number, store: string | null) => {
  const dir = join(DATA, name)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
    if (store) {
      execFileSync('sqlite3', [store, `.backup '${join(dir, 'core.db')}'`])
      for (const f of readdirSync(join(store, '..'))) if (f.endsWith('.token')) copyFileSync(join(store, '..', f), join(dir, f))
    }
  }
  return {
    command: `scripts/olumi-core/run.sh core`,
    env: { CORE_DIR, DATA: dir, CORE_PORT: String(port), OLUMI_ADMIN_KEY: ADMIN, OPENAI_API_KEY: '', ANTHROPIC_API_KEY: '', OLUMI_CALL_CAP: '0' },
    url: `http://127.0.0.1:${port}/`,
    reuseExistingServer: false,
    timeout: 120_000,
  }
}
const servers = [core('journey', PORT, null)]
if (STORES) servers.push(core('hiring', PORT + 1, join(STORES, 'hiring/olumi.db')), core('gate', PORT + 2, join(STORES, 'gate/combined.db')))

export default defineConfig({
  testDir: 'e2e/v11',
  testMatch: '**/*.v11.spec.ts',
  globalTeardown: './e2e/v11/globalTeardown.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: [['list']],
  timeout: 300_000,
  expect: { timeout: 30_000 },
  outputDir: join(DATA, 'results'),
  webServer: servers,
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    headless: true,
    trace: 'off',
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
    screenshot: 'only-on-failure',
    viewport: { width: 1232, height: 704 },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1232, height: 704 }, deviceScaleFactor: 1 } }],
})
