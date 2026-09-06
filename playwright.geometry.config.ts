import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright config for the GEOMETRY MEASUREMENT harness.
 *
 * ⭐ THE PORT IS PER-LANE, AND THE RUN ASSERTS WHOSE TREE IT IS MEASURING.
 *
 * This config used to hardcode 5189. On 1 Sep 2026 several runs measured ANOTHER
 * LANE'S CHECKOUT while reporting about their own — green, exit 0, with well-formed
 * measurement JSON. `e2e/support/servingTree.ts` carries the full mechanism; the
 * short version is that `strictPort` + `reuseExistingServer: false` IS loud when the
 * port is already listening, and is silent when a sibling lane binds it inside our
 * own boot window: our vite dies, and Playwright's wait-for-the-port is satisfied by
 * the sibling's server.
 *
 * ⚠ SO `GEOMETRY_PORT` IS THE LESSER HALF OF THIS FIX. A per-lane port narrows the
 * window; it cannot close it, because two lanes can always be handed the same value
 * — and picking a different fixed number just recreates the same defect one port
 * along. The half that actually closes it is the identity assertion in `globalSetup`,
 * which asks the server which checkout it is serving and REFUSES TO MEASURE if the
 * answer is not this one.
 *
 *     # solo run: nothing to set, the default still works
 *     pnpm exec playwright test -c playwright.geometry.config.ts
 *
 *     # concurrent lanes: give each one its own
 *     GEOMETRY_PORT=5289 pnpm exec playwright test -c playwright.geometry.config.ts
 *
 * ⚠⚠ `lsof -ti tcp:<port>` IS THE WRONG QUESTION AND IT SENDS YOU CHASING A PHANTOM.
 * It matches every socket on that port — including the browser's CLIENT connections
 * — so after a run it lists live PIDs that are not the server and reads as "the port
 * will not free". Worse, the usual next move is `lsof -ti tcp:<port> | xargs kill -9`,
 * which then kills whatever happened to be CONNECTED to the port. Ask for the
 * listener only:
 *
 *     lsof -nP -iTCP:5189 -sTCP:LISTEN
 *
 * ⚠ TWO DIAGNOSES THAT ARE WRONG, recorded because they were both tried first and
 * both cost time: it is NOT Vite's on-disk cache, and it is NOT a stale server of
 * your own. Do not "fix" either. The question is only ever which checkout is on the
 * other end of the port, and `globalSetup` now answers it every run.
 *
 * The dev server's required proxy env is set explicitly: `vite.config.ts` THROWS at
 * config load unless `ENGINE_SERVICE_URL`, `CEE_SERVICE_URL` and `ISL_SERVICE_URL`
 * are present (`requireProxyEnv`, no fallback for those three). They point at the
 * discard port so the harness is hermetic. The Supabase pair is set because without
 * it whole spec files vanish at COLLECT while the run still prints a healthy total
 * (CLAUDE.md trap 2b).
 */

const UNREACHABLE = 'http://127.0.0.1:9'

const DEFAULT_PORT = 5189
const RAW_PORT = process.env.GEOMETRY_PORT

/**
 * Fail at CONFIG LOAD on a nonsense value rather than booting a server nobody can
 * reach and letting it present as a timeout twenty minutes later. Same posture as
 * `vite.config.ts`'s `requireProxyEnv`.
 */
function resolvePort(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === '') return DEFAULT_PORT
  const port = Number(raw)
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error(
      `[geometry] GEOMETRY_PORT="${raw}" is not a usable port.\n` +
        `  Expected an integer in 1024-65535, or leave it unset for ${DEFAULT_PORT}.`,
    )
  }
  return port
}

const PORT = resolvePort(RAW_PORT)

export default defineConfig({
  testDir: 'e2e/geometry',
  // ⭐ The identity assertion. In globalSetup, not in a spec, so `--grep` cannot
  // exclude the check that proves the run measured THIS checkout.
  globalSetup: './e2e/geometry/globalSetup.ts',
  testMatch: '**/*.measure.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  timeout: 180_000,
  expect: { timeout: 30_000 },
  outputDir: 'test-results/geometry',
  use: { baseURL: `http://localhost:${PORT}`, headless: true, trace: 'off', video: 'off', screenshot: 'off', deviceScaleFactor: 1 },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], deviceScaleFactor: 1 } }],
  webServer: {
    command: `pnpm exec vite --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: false,
    timeout: 240_000,
    env: {
      ENGINE_SERVICE_URL: UNREACHABLE, CEE_SERVICE_URL: UNREACHABLE, ISL_SERVICE_URL: UNREACHABLE,
      PLOT_API_URL: UNREACHABLE, ASSIST_BFF_URL: UNREACHABLE,
      VITE_SUPABASE_URL: 'http://localhost:54321', VITE_SUPABASE_ANON_KEY: 'test_anon_key',
      VITE_FEATURE_SSE: '0', TZ: 'UTC',
    },
  },
})
