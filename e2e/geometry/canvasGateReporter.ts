/**
 * RECORDS WHAT ACTUALLY RAN, so `canvasGateTeardown.ts` can assert it BY NAME.
 *
 * ── WHY A REPORTER AND NOT THE TEST BODIES ──────────────────────────────────
 *
 * `e2e/visual/globalTeardown.ts` asserts a manifest that the TESTS write
 * (`captureState` records coverage in a `finally`). That works there because
 * every visual test funnels through one helper. The geometry arms do not, and
 * threading a "record me" call into each body would put the proof-of-execution
 * INSIDE the thing being proved — if the body throws early, it never records,
 * and a test that crashed on line 1 would be indistinguishable from a test that
 * was never collected. The reporter observes from outside and cannot miss.
 *
 * ── WHY NOT DO THE WHOLE CHECK HERE ─────────────────────────────────────────
 *
 * DERIVED AT THE BYTES, not read from docs (`playwright/lib/runner/tasks.js`):
 * `finishTaskRun` calls `reporter.onEnd` AFTER `taskRunner.run` has already run
 * every teardown. So the ordering is
 *
 *     removeOutputDirs -> globalSetup -> onBegin -> tests -> onTestEnd(each)
 *       -> globalTeardown -> onEnd
 *
 * `onTestEnd` therefore lands well before `globalTeardown`, which is exactly
 * what makes this split work; the reverse (a teardown reading a JSON reporter's
 * output) is impossible. The ASSERTION lives in the teardown because that is
 * where this repo already puts it, and because a teardown throw fails the run
 * through a path that is verified at the bytes
 * (`taskRunner.run`: `status === "passed" ? teardownStatus : status`).
 *
 * ── STALENESS ───────────────────────────────────────────────────────────────
 *
 * The manifest is written INSIDE the project `outputDir`, which Playwright
 * deletes in its very first setup task, before `globalSetup` and before
 * `onBegin`. So a previous run's manifest can never be read as this run's
 * evidence — the same reason `e2e/visual` keeps its manifest under
 * `test-results/`.
 */

import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { FullConfig, FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter'

import { GATE_MANIFEST_PATH } from './canvasGatePaths'

/**
 * Written by `onBegin`. Its ABSENCE is a distinct and much worse finding than
 * an empty manifest: it means this reporter was never wired into the config, or
 * the run died before the test phase. The teardown says which.
 */
const BEGIN_MARKER = '__begin__'

/** A test that RAN, whatever its outcome. */
const RAN = 'ran'
/** A test that was collected but NOT executed. Never counts as coverage. */
const NOT_RUN = 'not-run'

export default class CanvasGateReporter implements Reporter {
  onBegin(_config: FullConfig): void {
    mkdirSync(dirname(GATE_MANIFEST_PATH), { recursive: true })
    writeFileSync(GATE_MANIFEST_PATH, `${BEGIN_MARKER}\n`, 'utf8')
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    /*
     * ⭐ A FAILED TEST STILL COUNTS AS RUN — the same reasoning as
     * `captureState`'s `finally` in the visual harness. The teardown answers
     * "did the gated set EXECUTE?", never "did it pass?". Playwright already
     * fails the run on a failing test; conflating the two questions here would
     * make one genuine red present as a completeness error and send the reader
     * hunting a phantom (CLAUDE.md trap 21 — two questions under one name).
     *
     * `skipped` is the case this must NOT absorb. A `test.skip`, a `fixme`, or
     * a filtered-out test is precisely the silent no-op this gate exists to
     * catch, so it is recorded as NOT RUN and the teardown REDs on it.
     */
    const ran = result.status !== 'skipped'
    // `titlePath()` is [ '', project, file, ...describes, title ]; the last two
    // are the describe title and the test title, which is the key the registry
    // declares. Recorded verbatim — never normalised — so a rename REDs.
    const path = test.titlePath()
    const key = path.slice(-2).join(' › ')
    appendFileSync(GATE_MANIFEST_PATH, `${ran ? RAN : NOT_RUN}\t${key}\t${result.status}\n`, 'utf8')
  }

  onEnd(_result: FullResult): void {
    /* Intentionally empty — see the header. The assertion is in the teardown,
     * which has already run by the time this fires. */
  }

  printsToStdio(): boolean {
    return false
  }
}
