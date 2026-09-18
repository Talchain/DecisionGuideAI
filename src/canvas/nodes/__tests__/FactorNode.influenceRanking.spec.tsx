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

const setStore = (viewMode: 'standard' | 'expert') => {
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
      viewMode,
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

describe('Standard view — the shared metric row states the ranking', () => {
  it('renders the ranked caption and the set size, and NOT a bare percentage', () => {
    setStore('standard')
    setMetadata(1, 5, 1)
    renderFactor()
    /* ⚠ BOUND BY TEST ID, NOT BY TEXT. In Standard view a top-three factor
       mounts `layer2Content` a SECOND time inside the hover popover (mocked
       transparent here), so the detailed DataBar's caption is also in the
       document. A `getByText('Most influential')` would be ambiguous — and
       worse, could pass while pointed at the wrong one of the two mounts
       (CLAUDE.md trap 19: bind by identity, never by a predicate another
       object satisfies). */
    const row = screen.getByTestId('factor-influence-row')
    expect(row.textContent).toContain('Most influential')
    expect(row.textContent).toContain('of 5')
    /* ⛔ THE DELETE-MUTANT ASSERTION. Remove `influenceRankReadout` from this
       call site and the row falls back to `Relative influence` / `100%`, which
       these two REJECT. Without them the pair above could pass on a row that
       also still printed the percentage — i.e. on a change that did nothing. */
    expect(row.textContent).not.toContain('100%')
    expect(row.textContent).not.toContain('Relative influence')
  })

  it('the row owns its whole accessible name — no colon between a phrase and its own tail', () => {
    setStore('standard')
    setMetadata(1, 5, 1)
    renderFactor()
    const row = screen.getByTestId('factor-influence-row')
    expect(row).toHaveAccessibleName(RANKED_NAME_LEADER)
    /* ⚠ THE NEGATIVE CONTROL FOR THE `accessibleName` OVERRIDE ITSELF.
       `NodeMetricRow`'s default composition is `${label}: ${formatted}.
       ${phrase}`, which would announce "Most influential: of 5." — the exact
       mangling the override exists to prevent. Delete the `accessibleName` prop
       and this REDs; the assertion above alone would too, but this names the
       defect so the next reader knows WHAT broke. */
    expect(row.getAttribute('aria-label')).not.toContain('Most influential: of 5')
  })

  it('the percentage is DEMOTED, not deleted — it survives in the disclosure', () => {
    setStore('standard')
    setMetadata(1, 5, 1)
    renderFactor()
    const row = screen.getByTestId('factor-influence-row')
    // The NO-HIDING half of the claim. Taking the figure off the face of the
    // card is the change; taking it away from a reader who wants it would be
    // hiding a finding, which this estate forbids.
    expect(row).toHaveAccessibleName(/100% of the strongest factor/)
  })

  it('rank 2 takes the ordinal — the leader is not the only case that renders', () => {
    setStore('standard')
    setMetadata(2, 5, 0.62)
    renderFactor()
    const row = screen.getByTestId('factor-influence-row')
    expect(row.textContent).toContain('2nd most influential')
    expect(row.textContent).toContain('of 5')
    expect(row.textContent).not.toContain('62%')
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
 * model whose graph has been edited since the last run.
 */
describe('no denominator — both views render exactly what they rendered before', () => {
  it('Standard view falls back to the basis noun and the percentage', () => {
    setStore('standard')
    setMetadata(1, null, 1)
    renderFactor()
    const row = screen.getByTestId('factor-influence-row')
    expect(row.textContent).toContain('Relative influence')
    expect(row.textContent).toContain('100%')
    expect(row.textContent).not.toContain('Most influential')
    expect(row).toHaveAccessibleName(
      'Relative influence: 100%. Influence, relative to the strongest factor. The top driver always shows 100%',
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
    const row = screen.getByTestId('factor-influence-row')
    expect(row.textContent).toContain('Relative influence')
    expect(row.textContent).not.toContain('of 5')
  })

  it('a set of one is a maximum, not a ranking', () => {
    setStore('standard')
    setMetadata(1, 1, 1)
    renderFactor()
    const row = screen.getByTestId('factor-influence-row')
    expect(row.textContent).toContain('Relative influence')
    expect(row.textContent).not.toContain('Most influential')
  })
})
