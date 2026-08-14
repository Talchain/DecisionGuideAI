/**
 * OutputsDock — after a FAILED analysis, no sentence on screen may be false in
 * ANY reachable cell (ROADMAP 2.1127).
 *
 * ⚠ The witnessed defect (staging, 13 Aug 2026). After an analysis fails
 * following an earlier successful one, the dock keeps the previous run's
 * numbers on screen (deliberate — `store.ts :: resultsError` preserves
 * `results.report`, and `hasInlineSummary` renders it through every status) and
 * showed an amber banner reading:
 *
 *   "We received the analysis results but had trouble displaying them.
 *    Please try again. Your core results are still valid."
 *
 * ⚠⚠ THE CELL MATRIX IS THE POINT OF THIS FILE. The first fix removed those two
 * false sentences and introduced a third ("so this run produced no results"),
 * because it reasoned about ONE cell. The reachable cells are the product of
 * TWO independent axes:
 *
 *   axis A — the error code       (which producer minted the failure)
 *   axis B — the report's origin  (whose numbers are on screen, if any)
 *
 * Axis B has FOUR values, and the third is the one that gets missed:
 *   B1 NONE            — genuine first run: no report at all.
 *   B2 EARLIER RUN     — the failure landed before this run stored anything.
 *   B3 THIS RUN        — `useV2Run` calls `resultsComplete` at `:991` and then
 *                        runs ~120 UNGUARDED lines before its success return at
 *                        `:1109`; a synchronous throw in `generateGraphHash`
 *                        (`:1038`), `persistAnalysisSuccess` (`:1039`, whose
 *                        `.catch` only handles rejection), `setRunMeta`
 *                        (`:1056`), `setGate` (`:1073`/`:1079`/`:1090`) or
 *                        `updateRobustnessGateFromV2` (`:1098`) lands in the
 *                        catch at `:1150` → `PROCESSING_ERROR` with THIS run's
 *                        report stored and on screen.
 *   B4 UNKNOWN         — a report with no run-epoch stamps. Provenance cannot
 *                        be proven.
 *   B5 COLD-LOADED     — a scenario opened from Supabase with a saved analysis,
 *                        then re-run, and the re-run fails. The restored report
 *                        IS from an earlier run, and the chip must say so. This
 *                        cell exists because `resultsHydrateFromSupabase`
 *                        installs the report by SPREAD and
 *                        `hydrateAnalysis.ts:138-152` returns no epoch keys, so
 *                        the stamp has to be asserted by the store action
 *                        itself — otherwise the cell silently becomes B4 and a
 *                        TRUE disclosure is suppressed.
 *
 * In B3 "this run produced no results" is false AND "Showing results from
 * previous analysis" is false. In B4 neither can be proven, so nothing may be
 * claimed. Both are pinned below.
 *
 * ⚠ Fixture honesty. Every seed drives the REAL store transitions in the real
 * order, and every error is seeded with the `canRetry` its REAL producer emits
 * — derived at the producers, not invented here:
 *   PROCESSING_ERROR    `useV2Run:1188` → `typedError.retryable`; `ProcessingError`
 *                       hardcodes false (api-errors.ts:159)          → false
 *   MALFORMED_RESPONSE  same line; `MalformedApiResponseError` hardcodes false
 *                       (api-errors.ts:107)                          → false
 *   NETWORK_ERROR       same line; `NetworkError` hardcodes true
 *                       (api-errors.ts:67)                           → true
 *   UNEXPECTED_STATE    `useV2Run:1114` literal                      → true
 *   VALIDATION_BLOCKED  `useV2Run:824` literal                       → false
 *   (envelope path)     `useConversation:3528` passes NO canRetry    → undefined
 * A fixture I wrote myself is not evidence about the wire (CLAUDE.md trap 16).
 *
 * ⚠ Surface binding (CLAUDE.md trap 3b). Bound to the surface the DEPLOYED
 * staging flags mount. `netlify.toml [context.staging.environment]` sets
 * VITE_FEATURE_AI_PANEL_V2="true", VITE_FEATURE_PRE_ANALYSIS_V3="1",
 * VITE_FEATURE_ANALYSIS_HERO_PANEL="1", VITE_FEATURE_COMPARE_TAB="1";
 * [build.environment] sets VITE_ENABLE_ORCHESTRATOR_V2="true"; there is no
 * VITE_FEATURE_JOURNEY_TAB entry, so the Journey tab is off. The controls
 * assert the MOUNT PATH itself (`outputs-dock-body` → `outputs-error-banner`),
 * so this binding fails loud if the deployment stops mounting the banner.
 *
 * ⚠ Scope (CLAUDE.md trap 3): DOM-content assertions only. Nothing here claims
 * anything about layout, visibility or above-the-fold placement.
 */

import '@testing-library/jest-dom/vitest'
import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OutputsDock } from '../OutputsDock'
import { ToastProvider } from '../../ToastContext'
import { ConversationProvider } from '../../conversation/ConversationContext'
import { useCanvasStore } from '../../store'

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: vi.fn(() => vi.fn()) }
})

// importOriginal-spread (CLAUDE.md trap 12): a `vi.mock` factory REPLACES the
// module, so a hand-listed allowlist goes silently short as flags are added.
// Only the flags `netlify.toml` pins for staging are overridden here.
vi.mock('../../../flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../flags')>()
  return {
    ...actual,
    isTelemetryEnabled: () => false,
    isAiPanelV2Enabled: () => true, // VITE_FEATURE_AI_PANEL_V2 = "true"
    isPreAnalysisV3Enabled: () => true, // VITE_FEATURE_PRE_ANALYSIS_V3 = "1"
    isCompareTabEnabled: () => true, // VITE_FEATURE_COMPARE_TAB = "1"
    isOrchestratorV2Enabled: () => true, // VITE_ENABLE_ORCHESTRATOR_V2 = "true"
    isJourneyTabEnabled: () => false, // no VITE_FEATURE_JOURNEY_TAB entry
  }
})

vi.mock('../../hooks/useV2Run', () => ({
  useV2Run: () => ({ runV2Analysis: vi.fn(), cancelRun: vi.fn() }),
  resolveActiveGoalNodeId: () => 'goal-1',
}))

/** A run's stored snapshot, carrying an identity nothing else here can produce. */
const RUN_HASH_A = 'run-a-4242'
const RUN_HASH_B = 'run-b-8181'
const REPORT: any = {
  results: { conservative: 41, likely: 4242, optimistic: 4343, units: 'percent', unitSymbol: '%' },
  run: { bands: { p10: 41, p50: 4242, p90: 4343 } },
}

/**
 * The `canRetry` each producer really emits (see the file header for the
 * derivation). `undefined` is a real value here — the deployed envelope path
 * passes no `canRetry` at all.
 */
const PRODUCER_CAN_RETRY: Record<string, boolean | undefined> = {
  PROCESSING_ERROR: false,
  MALFORMED_RESPONSE: false,
  NETWORK_ERROR: true,
  UNEXPECTED_STATE: true,
  VALIDATION_BLOCKED: false,
}

const NODES = [
  { id: 'goal-1', type: 'goal', data: { label: 'Test Goal' }, position: { x: 0, y: 0 } },
  { id: 'decision-1', type: 'decision', data: { label: 'Test Decision' }, position: { x: 100, y: 100 } },
]
const EDGES = [{ id: 'e1', source: 'decision-1', target: 'goal-1' }]

/** Sentences that must never appear, whatever the cell. */
const RECEIPT_CLAIM = /received the analysis results/i
const VALIDITY_CLAIM = /still valid/i
const NO_OUTPUT_CLAIM = /produced no results|no results were|nothing was returned/i
const PREVIOUS_RUN_CLAIM = /from previous analysis/i

function ensureMatchMedia() {
  if (typeof window.matchMedia !== 'function') {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true,
      }),
    })
  }
}

function resetCanvas({ hasCompletedFirstRun }: { hasCompletedFirstRun: boolean }) {
  ensureMatchMedia()
  try {
    sessionStorage.clear()
  } catch {
    /* jsdom quirk */
  }
  useCanvasStore.setState({
    nodes: NODES,
    edges: EDGES,
    hasCompletedFirstRun,
    results: { status: 'idle', progress: 0, report: null },
  } as any)
}

function fail(code: string, message: string) {
  useCanvasStore.getState().resultsError({
    code,
    message,
    // The producer's real answer, not a convenient one.
    canRetry: PRODUCER_CAN_RETRY[code],
  })
}

/** B1 — genuine first run: no earlier run, `hasCompletedFirstRun` false. */
function seedFirstRunFailure(code: string, message: string) {
  resetCanvas({ hasCompletedFirstRun: false })
  useCanvasStore.getState().resultsStart({ seed: 7 })
  fail(code, message)

  const after = useCanvasStore.getState().results
  expect(after.status).toBe('error')
  expect(after.report).toBeFalsy()
  expect(useCanvasStore.getState().hasCompletedFirstRun).toBe(false)
}

/** B2 — the witnessed cell: run 1 succeeded, run 2 failed before storing anything. */
function seedFailureAfterEarlierSuccess(code: string, message: string) {
  resetCanvas({ hasCompletedFirstRun: false })
  const store = useCanvasStore.getState()
  store.resultsStart({ seed: 7 })
  store.resultsComplete({ report: REPORT, hash: RUN_HASH_A } as any)
  // A NEW run begins, and fails.
  useCanvasStore.getState().resultsStart({ seed: 8 })
  fail(code, message)

  // Preconditions pinned in-test (CLAUDE.md trap 13b): without these the cell
  // could silently become a different one and every assertion below would be
  // about the wrong state.
  const after = useCanvasStore.getState().results
  expect(after.status).toBe('error')
  expect(after.report).toBeTruthy()
  expect(after.hash).toBe(RUN_HASH_A)
  expect(typeof after.reportEpoch).toBe('number')
  expect(typeof after.errorEpoch).toBe('number')
  expect(after.reportEpoch).not.toBe(after.errorEpoch)
}

/**
 * B3 — the cell the first fix got wrong: the SAME run stored its report and
 * THEN threw (useV2Run's unguarded `:991`→`:1109` window). No new run starts,
 * so the report and the error carry the same epoch.
 */
function seedFailureAfterThisRunStoredResults(code: string, message: string) {
  resetCanvas({ hasCompletedFirstRun: false })
  const store = useCanvasStore.getState()
  store.resultsStart({ seed: 7 })
  store.resultsComplete({ report: REPORT, hash: RUN_HASH_B } as any)
  // Same run — the throw happens after resultsComplete, inside the same call.
  fail(code, message)

  const after = useCanvasStore.getState().results
  expect(after.status).toBe('error')
  expect(after.report).toBeTruthy()
  expect(after.hash).toBe(RUN_HASH_B)
  expect(typeof after.reportEpoch).toBe('number')
  expect(after.reportEpoch).toBe(after.errorEpoch)
}

/** B4 — a report with no provenance stamps (hydrated / restored state). */
function seedFailureWithUnprovenReport(code: string, message: string) {
  resetCanvas({ hasCompletedFirstRun: true })
  useCanvasStore.setState({
    results: { status: 'complete', progress: 100, report: REPORT, hash: RUN_HASH_A },
  } as any)
  fail(code, message)

  const after = useCanvasStore.getState().results
  expect(after.status).toBe('error')
  expect(after.report).toBeTruthy()
  expect(after.reportEpoch).toBeUndefined()
}

/**
 * B5 — a COLD scenario load from Supabase, then a failed rerun.
 *
 * The payload's key set is exactly what `hydrateAnalysisFromV2Response` returns
 * (`hydrateAnalysis.ts:138-152`) — status, progress, seed, hash, report,
 * enrichment, error, startedAt, finishedAt — and, decisively, NO epoch keys.
 * That absence is the whole point of this cell, so it is asserted below rather
 * than assumed: if the producer ever starts stamping provenance itself, this
 * fixture stops standing for the cell it claims to cover and says so.
 */
function seedFailureAfterColdScenarioLoad(code: string, message: string) {
  resetCanvas({ hasCompletedFirstRun: false })
  // A genuinely COLD store: nothing has run in this session.
  expect(useCanvasStore.getState().results.reportEpoch).toBeUndefined()
  expect(useCanvasStore.getState().results.runEpoch).toBeUndefined()

  const hydrated = {
    results: {
      status: 'complete' as const,
      progress: 100,
      seed: undefined,
      hash: RUN_HASH_A,
      report: REPORT,
      enrichment: undefined,
      error: undefined,
      startedAt: 1,
      finishedAt: 2,
    },
    runMeta: {},
  }
  // Precondition: the producer's payload carries no provenance of its own.
  expect(Object.keys(hydrated.results)).not.toContain('reportEpoch')
  expect(Object.keys(hydrated.results)).not.toContain('runEpoch')

  useCanvasStore.getState().resultsHydrateFromSupabase(hydrated as never)
  // The user hits Rerun, and it fails.
  useCanvasStore.getState().resultsStart({ seed: 9 })
  fail(code, message)

  const after = useCanvasStore.getState().results
  expect(after.status).toBe('error')
  expect(after.report).toBeTruthy()
  expect(after.hash).toBe(RUN_HASH_A)
  expect(typeof after.errorEpoch).toBe('number')
  // The store had to supply this — the payload did not.
  expect(after.reportEpoch).toBe(0)
  expect(after.reportEpoch).not.toBe(after.errorEpoch)
}

function renderDock() {
  return render(
    <ToastProvider>
      <ConversationProvider>
        <OutputsDock />
      </ConversationProvider>
    </ToastProvider>,
  )
}

function bannerText(): string {
  const banner = screen.getByTestId('outputs-error-banner')
  return banner.textContent ?? ''
}

beforeEach(() => {
  ensureMatchMedia()
})

describe('OutputsDock → B2: failure after an EARLIER run succeeded (2.1127)', () => {
  // ── Control: the mount path, and that the cell's precondition is real ──
  it('control — the banner mounts and the earlier run is still being presented', () => {
    seedFailureAfterEarlierSuccess('PROCESSING_ERROR', 'Cannot read properties of undefined')
    renderDock()

    const body = screen.getByTestId('outputs-dock-body')
    expect(within(body).getByTestId('outputs-error-banner')).toBeInTheDocument()
    const resultsBody = within(body).getByTestId('results-body-stale-wrapper')
    // Bound to THAT snapshot by its own run hash, not to "some results".
    expect(resultsBody).toHaveTextContent(RUN_HASH_A)
  })

  it('claims neither receipt, nor validity, nor an absence of output', () => {
    seedFailureAfterEarlierSuccess('PROCESSING_ERROR', 'Cannot read properties of undefined')
    renderDock()

    const text = bannerText()
    expect(text.length).toBeGreaterThan(0)
    expect(text).not.toMatch(RECEIPT_CLAIM)
    expect(text).not.toMatch(VALIDITY_CLAIM)
    expect(text).not.toMatch(NO_OUTPUT_CLAIM)
  })

  it('attributes the on-screen numbers to the previous run — the one cell where that is true', () => {
    seedFailureAfterEarlierSuccess('PROCESSING_ERROR', 'Cannot read properties of undefined')
    renderDock()

    const stale = screen.getByTestId('stale-results-banner')
    expect(stale).toHaveTextContent('Showing results from previous analysis')
  })
})

describe('OutputsDock → B3: failure AFTER this run stored its own results (2.1127)', () => {
  // This is the cell useV2Run's unguarded post-`resultsComplete` window reaches.
  it('control — the banner mounts and THIS run\'s results are on screen', () => {
    seedFailureAfterThisRunStoredResults('PROCESSING_ERROR', 'setGate threw')
    renderDock()

    const body = screen.getByTestId('outputs-dock-body')
    expect(within(body).getByTestId('outputs-error-banner')).toBeInTheDocument()
    expect(within(body).getByTestId('results-body-stale-wrapper')).toHaveTextContent(RUN_HASH_B)
  })

  it('does not claim this run produced no results — it produced these', () => {
    seedFailureAfterThisRunStoredResults('PROCESSING_ERROR', 'setGate threw')
    renderDock()

    const text = bannerText()
    expect(text.length).toBeGreaterThan(0)
    expect(text).not.toMatch(NO_OUTPUT_CLAIM)
    expect(text).not.toMatch(RECEIPT_CLAIM)
    expect(text).not.toMatch(VALIDITY_CLAIM)
  })

  it('does not call this run\'s own numbers the previous analysis', () => {
    seedFailureAfterThisRunStoredResults('PROCESSING_ERROR', 'setGate threw')
    renderDock()

    // The chip's sentence is false here: these numbers are the failed run's own.
    expect(screen.queryByTestId('stale-results-banner')).not.toBeInTheDocument()
    expect(screen.getByTestId('outputs-dock-body').textContent ?? '').not.toMatch(PREVIOUS_RUN_CLAIM)
  })
})

describe('OutputsDock → B4: a report whose provenance cannot be proven (2.1127)', () => {
  it('control — the banner mounts and a report is on screen', () => {
    seedFailureWithUnprovenReport('PROCESSING_ERROR', 'hydrated then failed')
    renderDock()

    const body = screen.getByTestId('outputs-dock-body')
    expect(within(body).getByTestId('outputs-error-banner')).toBeInTheDocument()
    expect(within(body).getByTestId('results-body-stale-wrapper')).toHaveTextContent(RUN_HASH_A)
  })

  it('makes no provenance claim it cannot prove', () => {
    seedFailureWithUnprovenReport('PROCESSING_ERROR', 'hydrated then failed')
    renderDock()

    // Unknown fails CLOSED: no stamp, no claim. Silence is not a false sentence.
    expect(screen.queryByTestId('stale-results-banner')).not.toBeInTheDocument()
    expect(screen.getByTestId('outputs-dock-body').textContent ?? '').not.toMatch(PREVIOUS_RUN_CLAIM)
  })
})

describe('OutputsDock → B5: a saved scenario opened cold, then a failed rerun (2.1127)', () => {
  // The live path: `useScenario.ts:727-734` hydrates whenever
  // `row.analysis_status === 'ready'`. The restored numbers ARE from an earlier
  // run, so this is a cell where the chip's sentence is TRUE and withholding it
  // would suppress a real disclosure.
  it('control — the banner mounts and the restored run is on screen', () => {
    seedFailureAfterColdScenarioLoad('PROCESSING_ERROR', 'rerun threw')
    renderDock()

    const body = screen.getByTestId('outputs-dock-body')
    expect(within(body).getByTestId('outputs-error-banner')).toBeInTheDocument()
    expect(within(body).getByTestId('results-body-stale-wrapper')).toHaveTextContent(RUN_HASH_A)
  })

  it('attributes the restored numbers to the previous run', () => {
    seedFailureAfterColdScenarioLoad('PROCESSING_ERROR', 'rerun threw')
    renderDock()

    const stale = screen.getByTestId('stale-results-banner')
    expect(stale).toHaveTextContent('Showing results from previous analysis')
  })

  it('and still claims neither receipt nor validity', () => {
    seedFailureAfterColdScenarioLoad('PROCESSING_ERROR', 'rerun threw')
    renderDock()

    const text = bannerText()
    expect(text.length).toBeGreaterThan(0)
    expect(text).not.toMatch(RECEIPT_CLAIM)
    expect(text).not.toMatch(VALIDITY_CLAIM)
    expect(text).not.toMatch(NO_OUTPUT_CLAIM)
  })
})

describe('OutputsDock → B1: a genuine FIRST-run failure (2.1127)', () => {
  // hasCompletedFirstRun === false, so this is the pre-run surface — a
  // different mount path from B2/B3/B4, and the one a new user hits first.
  it('control — the banner mounts on the pre-run surface with no results body', () => {
    seedFirstRunFailure('PROCESSING_ERROR', 'Cannot read properties of undefined')
    renderDock()

    const body = screen.getByTestId('outputs-dock-body')
    expect(within(body).getByTestId('outputs-error-banner')).toBeInTheDocument()
    expect(within(body).queryByTestId('results-body-stale-wrapper')).not.toBeInTheDocument()
  })

  it('claims nothing about results, and no previous run exists to attribute to', () => {
    seedFirstRunFailure('PROCESSING_ERROR', 'Cannot read properties of undefined')
    renderDock()

    const text = bannerText()
    expect(text.length).toBeGreaterThan(0)
    expect(text).not.toMatch(RECEIPT_CLAIM)
    expect(text).not.toMatch(VALIDITY_CLAIM)
    expect(screen.queryByTestId('stale-results-banner')).not.toBeInTheDocument()
  })
})

describe('OutputsDock → axis A: the claims were never error-code-specific (2.1127)', () => {
  // The defect's mechanism was `hasPartialResults: Boolean(report)` — true for
  // ANY failure with a retained report. Codes below are ones producers really
  // emit, each seeded with the `canRetry` its producer really sends.
  it.each([
    ['NETWORK_ERROR', 'Failed to fetch', /Connection issue/i],
    ['UNEXPECTED_STATE', 'Received unexpected response format', /Something went wrong/i],
    ['MALFORMED_RESPONSE', 'Response failed validation', /Something went wrong/i],
  ])('%s after an earlier success asserts neither validity nor receipt', (code, message, presence) => {
    seedFailureAfterEarlierSuccess(code as string, message as string)
    renderDock()

    const text = bannerText()
    // Presence before absence (CLAUDE.md trap 13): this IS that code's banner.
    expect(text).toMatch(presence as RegExp)
    expect(text).not.toMatch(VALIDITY_CLAIM)
    expect(text).not.toMatch(RECEIPT_CLAIM)
  })
})

describe('OutputsDock → the banner speaks only for the run that failed (2.1127)', () => {
  // Whether an earlier run's snapshot is retained is a fact about the results
  // body below, not about this run — so it must not change one character of
  // what this banner says. That is exactly what `hasPartialResults:
  // Boolean(report)` violated.
  it('says exactly the same thing with a retained report as without one', () => {
    seedFailureAfterEarlierSuccess('PROCESSING_ERROR', 'Cannot read properties of undefined')
    const withRetained = renderDock()
    const retainedText = bannerText()
    withRetained.unmount()

    seedFirstRunFailure('PROCESSING_ERROR', 'Cannot read properties of undefined')
    renderDock()
    const freshText = bannerText()

    // Non-empty on both sides before comparing them: two empty strings agree
    // about nothing (CLAUDE.md trap 13 / the zsh empty-extraction lesson).
    expect(retainedText.length).toBeGreaterThan(0)
    expect(freshText.length).toBeGreaterThan(0)
    expect(retainedText).toBe(freshText)
  })

  // Copy and affordance must agree. `PROCESSING_ERROR` and `MALFORMED_RESPONSE`
  // both carry copy that instructs a retry, and both have
  // `ApiError.retryable === false`; feeding that into the banner deleted the
  // button while leaving the instruction.
  it.each(['PROCESSING_ERROR', 'MALFORMED_RESPONSE'])(
    '%s offers the rerun its own copy tells the user to make',
    (code) => {
      seedFailureAfterEarlierSuccess(code, 'boom')
      renderDock()

      const banner = screen.getByTestId('outputs-error-banner')
      // Bound to the affordance by IDENTITY, then to its label — not to the
      // label alone. A label-only assertion cannot see a button that reappears
      // under a different name, which is exactly how a mutant re-opening the
      // re-run for every code survived an earlier version of this file.
      const action = within(banner).getByTestId('error-primary-action')
      expect(action).toBeInTheDocument()
      expect(action).toHaveTextContent(/try again/i)
    },
  )

  it('still withholds the rerun where the user must fix the model first', () => {
    // Discriminating twin: the same surface, a code the user must act on first.
    // Without this, "always offer the re-run" would pass the test above.
    seedFailureAfterEarlierSuccess('VALIDATION_BLOCKED', 'Each option needs intervention values')
    renderDock()

    const banner = screen.getByTestId('outputs-error-banner')
    // ⚠ The affordance, not the word. VALIDATION_BLOCKED's actionText is
    // "Review Model", so `queryByRole({ name: /try again/i })` was absent
    // whether or not the button rendered — a vacuous assertion.
    expect(within(banner).queryByTestId('error-primary-action')).not.toBeInTheDocument()
    expect(banner.textContent ?? '').not.toMatch(/try again/i)
  })
})
