/**
 * ⭐⭐ THE INFLUENCE ROW READS AS A RANKING — ON BOTH VIEWS, OR THE FIX IS A
 * PER-VIEW ACCIDENT.
 *
 * ⛔⛔ THIS SPEC HAS NEVER BEEN EXECUTED. Written under a hard no-install /
 * no-test-run constraint: no vitest, no tsc, no node_modules, nothing driven on
 * staging. Every expectation is derived by reading `FactorNode.tsx`,
 * `NodeMetricRow.tsx` and `influenceScaleCopy.ts` at this branch's tip. CI is
 * the authority. There is no green claim from this lane.
 *
 * ## THE ABSENCE THIS CLOSES, AND WHY THE UNIT SPEC BESIDE IT IS NOT ENOUGH
 *
 * At `2a433f99` the branch changed four files and added no test file. Swept
 * with `rg -a`: `influenceRankReadout` → 3 files, all source, 0 test;
 * `influenceSetSize` → 2 files, all source, 0 test; contrast
 * `influenceBasisNoun` → 10 files including 5 dedicated specs. The contrast
 * fires hard in the same sweep, so the zero is real absence, not a blind probe.
 *
 * `influenceRankReadout.spec.ts` guards the FUNCTION. It cannot see a DELETED
 * CALL SITE — a pure-function spec stays green while the card renders whatever
 * it likes. THIS file is the one that REDs on that, and it is pointed at BOTH
 * call sites deliberately: the same figure is rendered by the Standard-view
 * `NodeMetricRow` and by the Detailed-view `DataBar`, so covering one would
 * leave `Relative influence … 100%` reachable one view away.
 *
 * ## ⚠ THE FIXTURES SUPPLY `influenceSetSize`, AND THAT IS THE POINT
 *
 * The field arrived OPTIONAL, so every pre-existing mock of
 * `useNodeDisplayMetadata` omits it, `influenceRankReadout(rank, undefined)`
 * returns null, and the whole existing suite sits on the fallback branch. That
 * is CLAUDE.md trap 3b — a test bound to a surface the deployed product does
 * not render — arriving through the FIXTURE rather than through a flag. Every
 * mock below states its denominator explicitly, on both arms.
 *
 * ## ⚠ WHAT THIS CANNOT PROVE (jsdom, CLAUDE.md trap 3)
 *
 * Nothing here is a claim about LAYOUT. The `w-7` → `min-w-7` change on the
 * detailed row and the caption-column floor are pixel claims; jsdom cannot see
 * them, this lane ran no visual harness, and no such claim is made.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { FactorNode } from '../FactorNode'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

vi.mock('../../store', () => ({ useCanvasStore: vi.fn() }))
vi.mock('../../hooks/useNodeDisplayMetadata', () => ({ useNodeDisplayMetadata: vi.fn() }))
vi.mock('../../hooks/useScienceIcons', () => ({ useScienceIcons: vi.fn(() => []) }))
vi.mock('../shared/NodePopover', () => ({
  NodePopover: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="factor-node-popover">{children}</div>
  ),
}))
// Spread the real flags module so a newly-added flag never goes silently
// absent and throws at render (CLAUDE.md trap 12 — a `vi.mock` factory
// REPLACES the module). Only the flags this suite pins are overridden.
vi.mock('../../../flags', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../flags')>()),
  isGraphBadgesEnabled: vi.fn(() => false),
  isCrossHighlightEnabled: vi.fn(() => false),
  isGraphLensEnabled: vi.fn(() => false),
}))

import { useCanvasStore } from '../../store'
import { useNodeDisplayMetadata } from '../../hooks/useNodeDisplayMetadata'

const baseProps = {
  id: 'factor-1',
  type: 'factor',
  position: { x: 0, y: 0 },
  selected: false,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  dragging: false,
  zIndex: 0,
  deletable: false,
  selectable: true,
  draggable: true,
}

/**
 * ⭐⭐ THE CURRENCY SLICE IS SEEDED EXPLICITLY, AND AN AFFIRMATIVE VERDICT IS A
 * PRECONDITION OF EVERY RANKED ASSERTION IN THIS FILE.
 *
 * `FactorNode` withholds the whole ranked readout unless
 * `useAnalysisResultsAreCurrent()` is true, and that hook is NOT mocked here —
 * it is imported for real, reads these three fields, and calls the real
 * `classifyFreshnessForDisplay`. Mocking it would leave this file asserting its
 * own idea of freshness (CLAUDE.md trap 13c: a perfect score against a wrong
 * oracle).
 *
 * ⚠ AND IT FAILS CLOSED ON OMISSION, which is exactly why it is stated. An
 * absent slice classifies as `'none'`, the readout withholds, and every ranked
 * expectation below would fail — loudly, rather than by quietly sitting on the
 * fallback branch, which is the defect this whole file exists to close one level
 * up. Stating it keeps the failure loud AND makes the precondition visible.
 */
const FRESH = { analysisFreshness: { freshness: 'fresh' }, analysisFreshnessDirty: false }

const setStore = (
  viewMode: 'standard' | 'expert',
  currency: Record<string, unknown> = FRESH,
) => {
  vi.mocked(useCanvasStore).mockImplementation((selector: any) =>
    selector({
      hoveredOptionId: null,
      nodes: [],
      edges: [],
      ceeAnalysisReady: null,
      results: { status: 'complete', report: null },
      highlightedNodes: new Set(),
      dimmedNodeIds: new Set(),
      goalThreshold: null,
      goalConstraints: [],
      importPendingServerRegistration: false,
      viewMode,
      ...currency,
    })
  )
}

/**
 * ⚠ THE DENOMINATOR IS A REQUIRED ARGUMENT OF THIS HELPER, not an optional
 * override with a default. A helper that defaulted it would rebuild the exact
 * silent-fallback defect this file exists to close, one level down in the test
 * kit — every future case would sit on whichever branch the default chose and
 * nobody would have to notice.
 */
const setMetadata = (rank: number | null, setSize: number | null, influence: number) => {
  vi.mocked(useNodeDisplayMetadata).mockReturnValue({
    sensitivityRank: rank,
    influence,
    influenceProvenance: 'normalised_elasticity',
    influenceImportanceBasis: null,
    influenceSetSize: setSize,
    confidence: null,
    confidenceIsDefaulted: false,
    confidenceIsProvisional: false,
    inSensitivityAnalysis: true,
    achievementProbability: null,
    achievementProbabilityIsModelledBasis: false,
    stabilityPercentage: null,
    winRate: null,
    isResultsMode: true,
    predictedOutcome: null,
    valueOfInformation: null,
    voiRank: null,
  })
}

const renderFactor = () =>
  render(
    <ReactFlowProvider>
      <FactorNode {...baseProps} data={{ label: 'Tech lead presence', type: 'factor', observedState: { value: 0.5 } }} />
    </ReactFlowProvider>
  )

/**
 * ⚠ THE BAR'S OWN NAME IS THE SAME ON BOTH ARMS, and the influence bar is bound
 * by it rather than by `getAllByRole('progressbar')[n]`. The card can mount a
 * second bar (confidence) and, in Standard view, a second copy of this whole
 * block inside the hover popover — an index would silently address whichever
 * happened to come first (CLAUDE.md trap 19).
 */
const INFLUENCE_BAR_NAME =
  'Influence, relative to the strongest factor. The top driver always shows 100%'

/** The exact announced sentence the ranked leader publishes, at 100%. */
const RANKED_NAME_LEADER =
  'Most influential of 5 factors compared in this model, at 100% of the strongest factor. Influence, relative to the strongest factor. The top driver always shows 100%'

beforeEach(() => { vi.clearAllMocks() })

/**
 * ⚠ RE-POINTED 23 Sep 2026 (D1a, locked Experience Design): the Standard-view
 * `NodeMetricRow` (`factor-influence-row`) is REPLACED by the driver line
 * (`factor-driver-line`) — `Driver #N of M` where a rank is published, a bar
 * from the same fraction, and NO percentage at rest. The claims this block
 * exists for are unchanged and asserted by identity: the rank is stated, the
 * set size rides with it, the bare figure is off the face of the card, and the
 * figure survives in the disclosure (NO-HIDING).
 */
describe('Standard view — the driver line states the ranking', () => {
  const RANKED_LINE_NAME_LEADER =
    'Driver #1 of 5. Relative model sensitivity in this analysis, not an absolute causal percentage. At 100% of the strongest factor. Influence, relative to the strongest factor. The top driver always shows 100%'

  it('renders the rank and the set size, and NOT a bare percentage', () => {
    setStore('standard')
    setMetadata(1, 5, 1)
    renderFactor()
    /* ⚠ BOUND BY TEST ID, NOT BY TEXT — the Detailed-view row is also mounted
       inside the (mocked-transparent) hover popover (CLAUDE.md trap 19). */
    const line = screen.getByTestId('factor-driver-line')
    expect(line.textContent).toBe('Driver #1 of 5')
    /* ⛔ THE DELETE-MUTANT ASSERTION: a line that also printed the figure, or
       fell back to the basis noun, REDs here. */
    expect(line.textContent).not.toContain('100%')
    expect(line.textContent).not.toContain('Relative influence')
  })

  it('the line owns its whole accessible name, opening with the visible words', () => {
    setStore('standard')
    setMetadata(1, 5, 1)
    renderFactor()
    const line = screen.getByTestId('factor-driver-line')
    expect(line).toHaveAccessibleName(RANKED_LINE_NAME_LEADER)
    expect(line.getAttribute('aria-label')).not.toContain('Most influential: of 5')
  })

  it('the percentage is DEMOTED, not deleted — it survives in the disclosure', () => {
    setStore('standard')
    setMetadata(1, 5, 1)
    renderFactor()
    const line = screen.getByTestId('factor-driver-line')
    // The NO-HIDING half of the claim.
    expect(line).toHaveAccessibleName(/100% of the strongest factor/)
  })

  it('rank 2 is named too — the leader is not the only case that renders', () => {
    setStore('standard')
    setMetadata(2, 5, 0.62)
    renderFactor()
    const line = screen.getByTestId('factor-driver-line')
    expect(line.textContent).toBe('Driver #2 of 5')
    expect(line.textContent).not.toContain('62%')
  })
})

/**
 * ⭐ THE SECOND CALL SITE. The detailed view renders the SAME display-model
 * number, so it carried the same misread. A spec covering only the Standard row
 * would let `Relative influence … 100%` survive one view switch away — which is
 * how this card came to have four presentations of one idea in the first place.
 */
describe('Detailed view — the DataBar row states the same ranking', () => {
  it('renders the ranked caption, the set size, and the ranked accessible name', () => {
    setStore('expert')
    setMetadata(1, 5, 1)
    renderFactor()
    // `role="group"` with the ranked phrase as its accessible name. Bound by
    // that name, so it cannot match the sibling Confidence group.
    const group = screen.getByRole('group', { name: 'Most influential of 5 factors compared in this model' })
    expect(group.textContent).toContain('Most influential')
    expect(group.textContent).toContain('of 5')
    expect(group.textContent).not.toContain('100%')
    expect(group.textContent).not.toContain('Relative influence')
  })

  it('the bar geometry is UNCHANGED — the words replace the printed figure, not the measurement', () => {
    setStore('expert')
    setMetadata(1, 5, 1)
    renderFactor()
    /* ⭐ THIS IS THE ASSERTION THAT STOPS THE FIX BECOMING A LOSS. Removing the
       fraction along with the printed percentage would flatten every bar to the
       same length and throw away the one channel that still shows HOW FAR ahead
       the leader is. `aria-valuenow` is the fill fraction the DataBar was given,
       so it pins the geometry without making a layout claim jsdom cannot
       support. */
    const bar = screen.getByRole('progressbar', { name: INFLUENCE_BAR_NAME })
    expect(bar.getAttribute('aria-valuenow')).toBe('100')
  })

  it('a mid-set rank keeps its own fraction, so the bar still discriminates', () => {
    setStore('expert')
    setMetadata(2, 5, 0.62)
    renderFactor()
    // NON-VACUITY for the test above: if the bar were flattened, every ranked
    // factor would report the same value and the pair of tests would agree for
    // the wrong reason (CLAUDE.md trap 20 — sameness across inputs that ought
    // to differ is evidence about the probe).
    const bar = screen.getByRole('progressbar', { name: INFLUENCE_BAR_NAME })
    expect(bar.getAttribute('aria-valuenow')).toBe('62')
  })
})

/**
 * ⭐⭐ THE FAIL-CLOSED ARM, ON BOTH VIEWS. This is not a legacy shim: it is what
 * the deployed card renders for every factor ranked below the badged depth,
 * every factor on a tied set, every single-factor model, and EVERY factor on a
 * model whose result the product cannot confirm is about the current graph (see
 * the currency describe at the foot of this file).
 */
/**
 * ⚠ 23 Sep 2026 (D1a): the Standard view's fail-closed arm is now the driver
 * line's BAR ALONE (no rank, no figure at rest); the Detailed view still
 * renders exactly what it rendered before.
 */
describe('no denominator — no rank is named; Standard keeps the bar, Detailed keeps the figure', () => {
  it('Standard view names no rank and keeps the bar, with the figure in the disclosure', () => {
    setStore('standard')
    setMetadata(1, null, 1)
    renderFactor()
    const line = screen.getByTestId('factor-driver-line')
    expect(line.textContent).toBe('')
    expect(line.textContent).not.toContain('Most influential')
    expect(screen.getByTestId('factor-driver-bar')).toBeTruthy()
    expect(line).toHaveAccessibleName(
      'Relative model sensitivity in this analysis, not an absolute causal percentage. At 100% of the strongest factor. Influence, relative to the strongest factor. The top driver always shows 100%',
    )
  })

  it('Detailed view falls back too — the two views cannot disagree', () => {
    setStore('expert')
    setMetadata(1, null, 1)
    renderFactor()
    const group = screen.getByRole('group', { name: 'Relative influence' })
    expect(group.textContent).toContain('Relative influence')
    expect(group.textContent).toContain('100%')
    expect(group.textContent).not.toContain('Most influential')
  })

  it('no rank withholds the claim even when a denominator is present', () => {
    // The tie gate withholding a rank is the commonest live cause. The
    // denominator is still computed and supplied; the claim is still refused.
    setStore('standard')
    setMetadata(null, 5, 1)
    renderFactor()
    const line = screen.getByTestId('factor-driver-line')
    expect(line.textContent).not.toContain('#')
    expect(line.textContent).not.toContain('of 5')
  })

  it('a set of one is a maximum, not a ranking', () => {
    setStore('standard')
    setMetadata(1, 1, 1)
    renderFactor()
    const line = screen.getByTestId('factor-driver-line')
    expect(line.textContent).not.toContain('#')
    expect(line.textContent).not.toContain('of 1')
  })
})

/**
 * ⭐⭐ A RESULT THE PRODUCT CANNOT VOUCH FOR PUBLISHES NO DENOMINATOR.
 *
 * ⛔ THIS DESCRIBE REPLACES A GATE ON `graphEditedSinceLastRun`, AND THE
 * REPLACEMENT IS THE FINDING OF THIS ROUND.
 *
 * `of 5` is a COUNTABLE claim: run over five factors, add three, and the canvas
 * shows eight cards beside a row still claiming `of 5` — the reader refutes the
 * product by counting. The previous gate was the legacy store flag, and it
 * cannot answer the question: `resultsLoadHistorical` (`canvas/store.ts:6026`)
 * and `resultsHydrateFromSupabase` (`:6097`) reset it to `false` in the same
 * `set()` that writes `results.status: 'complete'`, so restoring a historical
 * run re-published the denominator against a graph it was never computed on.
 * It also over-fired the other way — `historyHash` (`:2025`) includes
 * `position`, so a node DRAG dropped the caption.
 *
 * ⚠ AND THE GATE MOVED FROM THE PRODUCER TO HERE, which is the other half. In
 * `useNodeDisplayMetadata` it made the `influenceSetSize` assignment
 * CONDITIONAL and so falsified the invariant that field's optionality rests on.
 * At the render site the producer's implication holds and the licence is asked
 * separately — see `useNodeDisplayMetadata.influenceSetSize.spec.ts`, which
 * pins the restored implication.
 */
/**
 * ⭐⭐ 23 Sep 2026 — SPLIT BY WHAT THE COMPOSED VERDICT KNOWS. Paul accepted Q2,
 * 22 Sep: keep the figure and the rank, labelled 'Last run ·' when the model
 * has changed. So a model KNOWN to have changed since the run keeps its rank,
 * labelled — the countable claim is then a claim about THAT run, which the
 * reader can no longer refute by counting today's cards. A result whose
 * currency CANNOT be confirmed (a restored run) still publishes no rank.
 */
describe('the ranked claim: withheld when currency cannot be confirmed, labelled when the model has changed', () => {
  it('THE DEFECT THIS ROUND CLOSES: a RESTORED run publishes no denominator', () => {
    // The exact slice both restore actions write: an 'unknown' verdict whose
    // reason is `hydrated_without_capture`, with the dirty overlay CLEARED.
    // Under the old gate this state read "the graph has not moved" and the
    // countable claim went out against a graph never seen.
    setStore('standard', {
      analysisFreshness: { freshness: 'unknown', freshnessReason: 'hydrated_without_capture' },
      analysisFreshnessDirty: false,
    })
    setMetadata(1, 5, 1)
    renderFactor()

    const line = screen.getByTestId('factor-driver-line')
    expect(line.textContent).not.toContain('#1')
    expect(line.textContent).not.toContain('of 5')
    // ⚠ AND IT FALLS BACK RATHER THAN GOING BLANK: the fail-closed arm keeps
    // the bar (D1a) — never a third, ranked-but-uncountable variant.
    expect(screen.getByTestId('factor-driver-bar')).toBeTruthy()
  })

  it('a local analysis-affecting edit KEEPS the rank, labelled as the last run\'s', () => {
    // The dirty overlay over a retained CEE 'fresh' — what an ordinary
    // in-canvas add produces via `invalidateAnalysisReady` (`store.ts:2890`).
    // ⚠ WAS "withholds it too" until 23 Sep 2026 (Paul accepted Q2, 22 Sep).
    setStore('standard', {
      analysisFreshness: { freshness: 'fresh' },
      analysisFreshnessDirty: true,
    })
    setMetadata(1, 5, 1)
    renderFactor()

    const line = screen.getByTestId('factor-driver-line')
    expect(line.textContent).toBe('Last run · Driver #1 of 5')
    expect(line.textContent).not.toContain('100%')
  })

  it('CONTROL: the same rank and the same set size on a current result DO publish', () => {
    // Both arms asserted explicitly, so the gate is shown to DISCRIMINATE
    // rather than merely to return null on everything (CLAUDE.md trap 13b — a
    // guard agreeing with itself). Same metadata, one store field different.
    setStore('standard', FRESH)
    setMetadata(1, 5, 1)
    renderFactor()

    const line = screen.getByTestId('factor-driver-line')
    expect(line.textContent).toBe('Driver #1 of 5')
  })

  it('the Detailed view LABELS on the same signal — the two views cannot disagree', () => {
    // One gate, one local, both renders. Without this the fix could be a
    // per-view accident, which is the defect this whole file was written for.
    setStore('expert', {
      analysisFreshness: { freshness: 'stale' },
      analysisFreshnessDirty: false,
    })
    setMetadata(1, 5, 1)
    renderFactor()

    // A CEE-stated 'stale' composes to 'changed'. ⚠ 23 Sep 2026: the rank is
    // now KEPT on 'changed' and labelled as the last run's (Ruling 3; Paul
    // accepted Q2, 22 Sep) — in this view as in the Standard driver line, from
    // the one `influenceRank` local, so the two views still cannot disagree.
    const group = screen.getByRole('group', { name: 'Last run · Most influential of 5 factors compared in this model' })
    expect(group.textContent).toContain('Last run · Most influential')
    expect(group.textContent).toContain('of 5')
    expect(group.textContent).not.toContain('100%')
  })
})
