/**
 * OutputsDock — a FAILED analysis must not present the PREVIOUS run's numbers
 * as received and valid (ROADMAP 2.1127).
 *
 * ⚠ The witnessed defect (staging, 13 Aug 2026). After an analysis fails
 * FOLLOWING an earlier successful one, the dock keeps the previous run's
 * numbers on screen (deliberate — `store.ts :: resultsError` preserves
 * `results.report`, and `OutputsDock`'s `hasInlineSummary` renders it through
 * every status) and shows an amber banner reading:
 *
 *   "We received the analysis results but had trouble displaying them.
 *    Please try again. Your core results are still valid."
 *
 * Both sentences are false:
 *   1. RECEIPT — `PROCESSING_ERROR` is produced by `useV2Run`'s residual
 *      `ProcessingError.wrap(err)` bucket (the catch-all for a throw that is
 *      neither a typed API error nor a network error). Nothing about that path
 *      establishes that analysis results arrived.
 *   2. VALIDITY — the suffix came from `getUserFriendlyError`'s
 *      `hasPartialResults` limb, which the dock fed with `Boolean(report)`.
 *      `report` at `status === 'error'` is ALWAYS the RETAINED PREVIOUS run's
 *      snapshot: every `resultsError` call site in `useV2Run` leaves the report
 *      untouched, and the one genuinely partial path
 *      (`analysis_status === 'partial'`) settles through `resultsComplete`, not
 *      through the error path. So "partial results" was never true here, and
 *      nothing assessed the retained numbers' validity in any case.
 *
 * ⚠ The mechanism is GENERAL, not error-specific: the validity suffix fired for
 * EVERY error code whenever a previous report was retained. The second
 * describe below pins that with a different code (NETWORK_ERROR) so a fix that
 * only special-cased PROCESSING_ERROR cannot pass.
 *
 * ⚠ Surface binding (CLAUDE.md trap 3b). Bound to the surface the DEPLOYED
 * staging flags mount. `netlify.toml [context.staging.environment]` sets
 * VITE_FEATURE_AI_PANEL_V2="true", VITE_FEATURE_PRE_ANALYSIS_V3="1",
 * VITE_FEATURE_ANALYSIS_HERO_PANEL="1", VITE_FEATURE_COMPARE_TAB="1" and
 * [build.environment] sets VITE_ENABLE_ORCHESTRATOR_V2="true"; there is no
 * VITE_FEATURE_JOURNEY_TAB entry, so the Journey tab is off. The mock below
 * matches that posture and the control asserts the MOUNT PATH itself
 * (`outputs-dock-body` → `outputs-error-banner`), so this binding fails loud if
 * the deployment ever stops mounting the banner under test.
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

/**
 * The PREVIOUS run's snapshot, carrying an identity no other object in this
 * fixture can produce, so the "the previous run is still being presented"
 * assertion binds to THIS snapshot rather than to whatever happens to render
 * (CLAUDE.md trap 19).
 *
 * ⚠ Scope of the control, stated honestly. The deployed witness saw the
 * previous run's NUMBERS. Reproducing the numeric hero at component level needs
 * the full enrichment chain `useResultsSectionData` consumes (per-option
 * outcomes, goal probabilities); this minimal report drives the same results
 * body but its numeric surfaces render "unknown". The control therefore binds
 * to the retained snapshot's IDENTITY (its run hash, rendered in the results
 * body's Analysis details) plus the mounted results body itself — which is the
 * property the copy under test lies about: a failed run presenting the previous
 * run's output as this run's.
 */
const PREVIOUS_RUN_HASH = 'prev-4242'
const PREVIOUS_RUN_REPORT: any = {
  results: { conservative: 41, likely: 4242, optimistic: 4343, units: 'percent', unitSymbol: '%' },
  run: { bands: { p10: 41, p50: 4242, p90: 4343 } },
}

const NODES = [
  { id: 'goal-1', type: 'goal', data: { label: 'Test Goal' }, position: { x: 0, y: 0 } },
  { id: 'decision-1', type: 'decision', data: { label: 'Test Decision' }, position: { x: 100, y: 100 } },
]
const EDGES = [{ id: 'e1', source: 'decision-1', target: 'goal-1' }]

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

/**
 * Drive the REAL state machine, not a hand-written end state: a successful run
 * settles through `resultsComplete`, then the next run fails through
 * `resultsError`. That is the exact witnessed sequence (failure AFTER success),
 * and it means these tests would notice if the store ever stopped retaining the
 * previous report — which is the precondition the whole file is about.
 */
function seedFailureAfterSuccess(errorCode: string, message: string) {
  ensureMatchMedia()
  try {
    sessionStorage.clear()
  } catch {
    /* jsdom quirk */
  }
  useCanvasStore.setState({
    nodes: NODES,
    edges: EDGES,
    hasCompletedFirstRun: true,
    results: { status: 'idle', progress: 0 },
  } as any)

  const store = useCanvasStore.getState()
  // 1. The earlier SUCCESSFUL run.
  store.resultsComplete({ report: PREVIOUS_RUN_REPORT, hash: PREVIOUS_RUN_HASH } as any)
  // 2. The rerun that FAILS.
  useCanvasStore.getState().resultsError({ code: errorCode, message, canRetry: true })

  // Precondition, pinned in-test (CLAUDE.md trap 13b): this fixture only says
  // anything if the store really is in "failed, with the previous run retained".
  const after = useCanvasStore.getState().results
  expect(after.status).toBe('error')
  expect(after.report).toBeTruthy()
  expect((after.report as any).run.bands.p50).toBe(4242)
}

/** The SAME failure, on a first run — nothing retained to be honest or dishonest about. */
function seedFirstRunFailure(errorCode: string, message: string) {
  ensureMatchMedia()
  try {
    sessionStorage.clear()
  } catch {
    /* jsdom quirk */
  }
  useCanvasStore.setState({
    nodes: NODES,
    edges: EDGES,
    hasCompletedFirstRun: true,
    results: { status: 'idle', progress: 0, report: null },
  } as any)
  useCanvasStore.getState().resultsError({ code: errorCode, message, canRetry: true })

  const after = useCanvasStore.getState().results
  expect(after.status).toBe('error')
  expect(after.report).toBeFalsy()
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

describe('OutputsDock → a failed analysis after a successful one (2.1127)', () => {
  beforeEach(() => {
    ensureMatchMedia()
  })

  // ── Control: the mount path, and that the defect's PRECONDITION is real ──
  //
  // Both halves matter. The mount assertion is trap 3b — it fails loud if the
  // deployed flags stop mounting this banner, instead of the file quietly
  // testing a component nobody renders. The retained-numbers assertion is trap
  // 13 — it proves the previous run's numbers really are on screen in this
  // state, so the "must not claim validity" assertions below cannot pass by
  // testing nothing.
  it('control — the error banner mounts and the PREVIOUS run is still being presented', () => {
    seedFailureAfterSuccess('PROCESSING_ERROR', 'Cannot read properties of undefined')
    renderDock()

    const body = screen.getByTestId('outputs-dock-body')
    // The mount path itself (trap 3b).
    expect(within(body).getByTestId('outputs-error-banner')).toBeInTheDocument()
    // The results body is mounted AT status 'error' — this is what puts the
    // previous run's output under the banner in the first place.
    const resultsBody = within(body).getByTestId('results-body-stale-wrapper')
    // …and it is THAT snapshot, bound by its own run hash, not "some results".
    expect(resultsBody).toHaveTextContent(PREVIOUS_RUN_HASH)
  })

  it('does not claim the analysis results were received', () => {
    seedFailureAfterSuccess('PROCESSING_ERROR', 'Cannot read properties of undefined')
    renderDock()

    const banner = screen.getByTestId('outputs-error-banner')
    // The witnessed sentence. Nothing on the PROCESSING_ERROR path establishes
    // that results arrived — it is the residual wrap of an unclassified throw.
    expect(banner).not.toHaveTextContent(/We received the analysis results/i)
    expect(banner).not.toHaveTextContent(/received the analysis results/i)
  })

  it('does not assert the retained numbers are valid', () => {
    seedFailureAfterSuccess('PROCESSING_ERROR', 'Cannot read properties of undefined')
    renderDock()

    const banner = screen.getByTestId('outputs-error-banner')
    // The witnessed sentence. Nothing assessed the retained run's validity, and
    // the numbers on screen are not this run's results at all.
    expect(banner).not.toHaveTextContent(/core results are still valid/i)
  })

  it('attributes the on-screen numbers to the previous run', () => {
    seedFailureAfterSuccess('PROCESSING_ERROR', 'Cannot read properties of undefined')
    renderDock()

    // Removing a false claim is only half of honest: the numbers stay on
    // screen, so something must say whose they are. This is the dock's existing
    // stale-results banner — pinned here so the attribution cannot silently
    // disappear while the numbers remain.
    const stale = screen.getByTestId('stale-results-banner')
    expect(stale).toHaveTextContent('Showing results from previous analysis')
  })

  // ── The invariant the whole row reduces to ──
  //
  // The error banner speaks for the run that FAILED. Whether an earlier run's
  // snapshot happens to be retained is a fact about the results body below it,
  // not about this run — so it must not change one character of what this
  // banner says or offers. That is precisely what `hasPartialResults:
  // Boolean(report)` violated: the retained snapshot reached in and rewrote the
  // banner's claim.
  it('says exactly the same thing whether or not a previous run is retained', () => {
    seedFailureAfterSuccess('PROCESSING_ERROR', 'Cannot read properties of undefined')
    const afterSuccess = renderDock()
    const withRetained = screen.getByTestId('outputs-error-banner').textContent
    afterSuccess.unmount()

    seedFirstRunFailure('PROCESSING_ERROR', 'Cannot read properties of undefined')
    renderDock()
    const withoutRetained = screen.getByTestId('outputs-error-banner').textContent

    // Non-empty on both sides before comparing them (CLAUDE.md trap 13 / the
    // zsh-empty-extraction lesson): two empty strings agree about nothing.
    expect(withRetained).toBeTruthy()
    expect(withoutRetained).toBeTruthy()
    expect(withRetained).toBe(withoutRetained)
  })
})

describe('OutputsDock → the validity claim was NOT error-code-specific (2.1127)', () => {
  beforeEach(() => {
    ensureMatchMedia()
  })

  // The defect's mechanism was `hasPartialResults: Boolean(report)` — true for
  // ANY failure with a retained report. A fix that only rewrote the
  // PROCESSING_ERROR copy would leave this case lying, so it is pinned with a
  // different code and a different headline.
  it('a NETWORK_ERROR after a successful run does not assert the retained numbers are valid', () => {
    seedFailureAfterSuccess('NETWORK_ERROR', 'Failed to fetch')
    renderDock()

    const banner = screen.getByTestId('outputs-error-banner')
    // Control: this IS the network-error banner, so the absence assertion below
    // is about the right surface (trap 13 — prove a presence before an absence).
    expect(banner).toHaveTextContent(/Connection issue/i)
    expect(banner).not.toHaveTextContent(/core results are still valid/i)
  })

  it('a TIMEOUT after a successful run does not assert the retained numbers are valid', () => {
    seedFailureAfterSuccess('TIMEOUT', 'Request timed out')
    renderDock()

    const banner = screen.getByTestId('outputs-error-banner')
    expect(banner).toHaveTextContent(/took too long/i)
    expect(banner).not.toHaveTextContent(/core results are still valid/i)
  })
})
