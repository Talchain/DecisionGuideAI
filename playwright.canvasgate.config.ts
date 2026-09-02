import { defineConfig } from '@playwright/test'

import geometryConfig from './playwright.geometry.config'
import { GATED_TESTS, GATE_TAG } from './e2e/geometry/canvasGateSet'
import { GATE_OUTPUT_DIR } from './e2e/geometry/canvasGatePaths'

/**
 * THE CANVAS BROWSER GATE — the load-bearing browser-level canvas assertions,
 * and ONLY those.
 *
 * The justification for gating anything at all, the defects this set would have
 * caught, and what is deliberately left out are all in
 * `e2e/geometry/canvasGateSet.ts`. Read that first; this file is only the wiring.
 *
 * ── IT IS A SUBSET OF THE GEOMETRY HARNESS, NOT A FORK ──────────────────────
 *
 * This config SPREADS `playwright.geometry.config.ts` rather than restating it.
 * That is deliberate: the webServer command, the hermetic proxy env, the
 * Supabase pair (without which whole spec files vanish at COLLECT while the run
 * still prints a healthy total — CLAUDE.md trap 2b), the fixed viewport scale
 * and the identity `globalSetup` are all load-bearing, and a copy of them here
 * would be a hand-maintained mirror that drifts the first time the geometry
 * harness is fixed (CLAUDE.md trap 12).
 *
 * ⭐ IN PARTICULAR, THE PORT MECHANISM IS INHERITED, NOT REINVENTED. `GEOMETRY_PORT`
 * and the `globalSetup` identity assertion already exist and already solve the
 * concurrent-lane collision (05ca160b / #1135). A second port variable for this
 * config would be a second mechanism for one problem — which is how two
 * authorities answering the same question end up disagreeing (CLAUDE.md trap 21).
 * Use the one that exists:
 *
 *     pnpm run canvas:gate                       # solo
 *     GEOMETRY_PORT=5289 pnpm run canvas:gate    # concurrent lanes
 *
 * ── WHAT THIS FILE CHANGES, AND WHY EACH ONE ────────────────────────────────
 *
 *   testMatch      derived from the registry, so only files that actually carry
 *                  gated assertions are even loaded
 *   grep           the gate TAG — selection is declared at the test's own site
 *   globalTeardown the completeness guard: the ran-set is asserted BY NAME
 *   reporter       records what ran, for that guard to read
 *   outputDir      its own dir, which Playwright clears at run start, so a
 *                  previous run's manifest can never be read as this run's
 *   retries        0, INHERITED AND RESTATED HERE ON PURPOSE — see below
 *
 * ── ⚠ RETRIES ARE 0 AND MUST STAY 0 ─────────────────────────────────────────
 *
 * This suite's entire job is to be BELIEVABLE when it goes red. A flake hidden
 * by a retry is worse than a visible one: it converts a known-rate,
 * investigable defect into an unknown-rate invisible one, and it teaches the
 * next reader that a red here might just be noise — which is precisely how this
 * repo acquired a browser check nobody looks at. If an arm is unreliable, the
 * answer is to fix the order-dependence or to EXCLUDE IT WITH A STATED REASON
 * in `canvasGateSet.ts`. It is never `retries: 1`.
 */

const GATED_FILES = [...new Set(GATED_TESTS.map((t) => t.file))]

export default defineConfig({
  ...geometryConfig,
  testMatch: GATED_FILES,
  // `grep` matches against the title WITH tags (derived at the bytes:
  // `loadUtils.js` calls `test._grepTitleWithTags()`), so tagging a test is what
  // admits it, and the test title itself stays clean for the by-name registry.
  grep: new RegExp(GATE_TAG.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
  globalTeardown: './e2e/geometry/canvasGateTeardown.ts',
  reporter: [['list'], ['./e2e/geometry/canvasGateReporter.ts']],
  outputDir: GATE_OUTPUT_DIR,
  retries: 0,
  // A merge gate must not sit for three minutes on a hang before saying so.
  // The three gated arms measured 41.2s / 6.2s / 6.9s on darwin; the ceiling is
  // generous against that, and deliberately far below the CI job timeout so a
  // stuck arm presents as a NAMED test timeout rather than as a killed job.
  timeout: 180_000,
})
