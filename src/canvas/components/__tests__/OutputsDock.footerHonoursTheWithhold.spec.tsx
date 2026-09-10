/**
 * ⭐⭐ THE FOOTER — the SECOND of three render sites for the producer's ranking
 * explanation, and the reason the panel fix alone did not close the defect.
 *
 * ⚠ MEASURED ON THE DEPLOYED BUILD `73825428`, driving a real guest session.
 * The producer's own authority said the claim was withheld:
 *
 *   producer_leader_permission: { permitted: false,
 *                                 withheld_reason: "leader_claim_withheld" }
 *
 * and the dock's post-run footer still read "…changed WHICH OPTION LEADS on its
 * own", three sections below a panel that correctly said the leader was not
 * assessed. One run, two answers, and the producer told us which is right.
 *
 * ⚠⚠ WHY THIS FILE EXISTS AT ALL, stated plainly because it is a review finding
 * rather than a design note. The change that gated this footer shipped with a
 * spec that drives `buildAnalysisNewViewModel` and never `OutputsDock`, and it
 * modified no existing spec. Every existing test was green against the ungated
 * base, so NOTHING IN THE TREE COULD DISTINGUISH BASE FROM HEAD AT THIS HUNK —
 * reverting it alone left the suite green. `postAnalysisFooter.spec.ts`
 * exercises `derivePostFooterMeta` directly and therefore cannot see the call
 * site where the gate lives; `OutputsDock.runVerdictLicence.spec.tsx` is about
 * dispatch licensing and does not touch the field. A well-tested predicate pins
 * neither of its call sites.
 *
 * ⚠ THE GATE IS THE PERMISSION, NEVER THE WORDS. No case here asserts on the
 * presence of "leads" or any other producer vocabulary: a predicate over
 * producer prose is the class this estate keeps getting wrong (CLAUDE.md trap
 * 22) and breaks the moment CEE rephrases.
 *
 * ⚠ Surface binding (CLAUDE.md trap 3b). These assertions are bound to the
 * post-run `results-analysis-footer` that `OutputsDock` mounts, and the first
 * case asserts the MOUNT itself before asserting anything about its contents.
 *
 * ⚠ Scope (CLAUDE.md trap 3): DOM-content assertions only. Nothing here claims
 * anything about layout, visibility or position on screen.
 */

import '@testing-library/jest-dom/vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OutputsDock } from '../OutputsDock'
import { useCanvasStore } from '../../store'
import { derivePostFooterStatus } from '../utils/postAnalysisFooter'

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: vi.fn(() => vi.fn()) }
})

vi.mock('../../../flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../flags')>()
  return {
    ...actual,
    isTelemetryEnabled: () => false,
    isJourneyTabEnabled: () => false,
    isAiPanelV2Enabled: () => false,
  }
})

vi.mock('../../conversation/useConversation', () => ({
  useConversation: () => ({
    messages: [],
    isThinking: false,
    longRunningHint: null,
    sendMessage: vi.fn(),
    sendSystemEvent: vi.fn(),
    sendChip: vi.fn(),
    retryLast: vi.fn(),
    patchBlockStates: new Map(),
    setPatchBlockState: vi.fn(),
    patchRejections: new Map(),
    setPatchRejection: vi.fn(),
  }),
}))

vi.mock('../pre-analysis', () => ({ PreAnalysisPanel: () => null }))
vi.mock('../../hooks/useGraphReadiness', () => ({
  useGraphReadiness: () => ({ readiness: { state: 'ready' } }),
}))
vi.mock('../../hooks/useStageAwarePlaceholder', () => ({
  useStageAwarePlaceholder: () => 'Describe your decision…',
}))

const OPTION_A = 'opt_segment'
const OPTION_B = 'opt_defer'

/**
 * The producer's own sentence, verbatim from the `73825428` capture. It is a
 * FIXTURE OF WHAT THE PRODUCER SAID, never a string this UI authors, and the
 * assertions below only ever ask whether it reached the screen.
 */
const PRODUCER_REASON =
  'none of the factors we could test changed which option leads on its own, and this result mostly held up under the other changes we tested'

/**
 * ⭐⭐ ONE REPORT, ONE VARIABLE. The two arms below differ by
 * `producer_leader_permission` AND BY NOTHING ELSE — same options, same win
 * probabilities, same near-tie signal, same display verdict, same reason. A
 * difference on screen can therefore only be the gate, and never a shape the
 * fixture invented (CLAUDE.md trap 16-inverse: a fixture you wrote yourself is
 * not evidence about the wire unless it is the shape the wire had).
 *
 * `near_tie.is_tie === false` is what makes the PERMITTED arm actually name a
 * leader: without a producer signal `deriveDecisionVerdict` makes no claim at
 * all, and both arms would withhold for the same uninteresting reason.
 */
const reportWith = (withheld: boolean): Record<string, unknown> => ({
  results: { conservative: 10, likely: 20, optimistic: 30, units: 'percent', unitSymbol: '%' },
  run: { bands: { p10: 10, p50: 20, p90: 30 } },
  option_probabilities: {
    [OPTION_A]: { win_probability: 0.62 },
    [OPTION_B]: { win_probability: 0.38 },
  },
  robustness: {
    recommendation_stability: 0.42,
    near_tie: { is_tie: false, top_option_id: OPTION_A },
    display_verdict: 'moderate',
    display_verdict_reason: PRODUCER_REASON,
  },
  ...(withheld
    ? {
        producer_leader_permission: {
          permitted: false,
          withheld_reason: 'leader_claim_withheld',
        },
      }
    : {}),
})

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
 * ⚠ THE OPTION NODES CARRY THE REPORT'S OWN IDS. `useResultsSectionData` passes
 * `visibleOptionIds` into `deriveDecisionVerdict`, so options the canvas does
 * not have are filtered out and the run reads as unranked — which would satisfy
 * the withheld assertion for the WRONG reason.
 */
function seedPostRun(withheld: boolean) {
  useCanvasStore.setState({
    currentScenarioFraming: null,
    currentScenarioLastResultHash: null,
    hasCompletedFirstRun: true,
    nodes: [
      { id: 'goal-1', type: 'goal', data: { label: 'Goal', kind: 'goal' }, position: { x: 0, y: 0 } },
      { id: OPTION_A, type: 'option', data: { label: 'Segment', kind: 'option' }, position: { x: 50, y: 0 } },
      { id: OPTION_B, type: 'option', data: { label: 'Status quo', kind: 'option' }, position: { x: 90, y: 0 } },
      { id: 'factor-1', type: 'factor', data: { label: 'Factor', kind: 'factor' }, position: { x: 130, y: 0 } },
    ],
    edges: [{ id: 'e1', source: 'factor-1', target: 'goal-1', data: { weight: 0.7, direction: 'positive' } }],
    graphHealth: { status: 'healthy', score: 100, issues: [] },
    results: { status: 'complete', report: reportWith(withheld) },
    analysisFreshness: { freshness: 'fresh', freshnessReason: 'graph_hash_match', computedAt: 1 },
    analysisFreshnessDirty: false,
    v5AnalysisFact: null,
    showDraftChat: false,
  } as never)
}

/** The post-run anchor. Its absence voids every assertion made about it. */
const footer = () => {
  const el = screen.queryByTestId('results-analysis-footer')
  expect(el, 'the post-run footer did not mount — every assertion below would be vacuous').toBeTruthy()
  return el as HTMLElement
}

beforeEach(() => {
  ensureMatchMedia()
  try {
    sessionStorage.clear()
  } catch {
    /* jsdom quirk */
  }
})
afterEach(() => cleanup())

describe('the dock footer may not explain a verdict by a ranking the run withheld', () => {
  /**
   * ⭐ THE CONTROL, AND IT RUNS FIRST ON PURPOSE. It proves the fixture reaches
   * the footer, that the producer's sentence travels the whole hook → dock →
   * `derivePostFooterMeta` → `AnalysisFooter` chain, and that the case below is
   * therefore observing a SUPPRESSION rather than a fixture that never
   * delivered anything. Without it, "the sentence is absent" is satisfied by an
   * empty footer.
   */
  it('CONTROL: on a permitted run the producer sentence reaches the footer VERBATIM', () => {
    seedPostRun(false)
    render(<OutputsDock />)

    expect(footer().textContent).toContain(PRODUCER_REASON)
    // ⚠ SCOPED TO THE ANCHOR. `sticky-footer-meta` is `AnalysisFooter`'s own
    // testid and the dock can mount more than one footer, so an unscoped query
    // would bind this to whichever happened to render first (trap 19).
    expect(within(footer()).getByTestId('sticky-footer-meta').textContent).toContain(
      PRODUCER_REASON,
    )
  })

  /**
   * ⛔ THE DEFECT, at the site the deployed witness was taken.
   *
   * Reverting the dock's gate hunk turns this RED and leaves every other
   * assertion in the tree green, which is the whole reason the case exists.
   */
  it('⛔ withholds it when the producer refused to license the leader claim', () => {
    seedPostRun(true)
    render(<OutputsDock />)

    expect(footer().textContent).not.toContain(PRODUCER_REASON)
  })

  /**
   * ⭐⭐ THE OPPOSITE-DIRECTION TWIN, and it is what makes this a gate rather
   * than a deletion. Suppressing the whole footer, or blanking its status line,
   * would satisfy the case above and be a worse defect: the robustness GRADE is
   * a fact about the run that the leader permission says nothing about, and the
   * user loses their only always-visible readout of it.
   *
   * ⚠ THE LABEL IS DERIVED FROM THE SAME HELPER THE COMPONENT USES, never
   * retyped here — a second spelling of a status string is the mirror this
   * estate pays for (CLAUDE.md trap 12).
   */
  it('⛔ the robustness GRADE survives the withhold, on the same run', () => {
    seedPostRun(true)
    render(<OutputsDock />)

    expect(footer().textContent).toContain(derivePostFooterStatus('moderate').label)
  })
})
