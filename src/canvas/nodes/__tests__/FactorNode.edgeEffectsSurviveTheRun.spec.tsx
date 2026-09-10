/**
 * A factor's EFFECTS do not vanish when the result arrives.
 *
 * ⚠⚠ WHAT WAS WRONG: `EdgePills` — the rows reading "raises Monthly Recurring
 * Revenue 50%", i.e. DIRECTION + STRENGTH + the named target — were gated
 * `!isPostAnalysis`. The moment an analysis completed, the standard-view card
 * stopped saying what the factor DOES. Layer 2 swaps to influence/confidence
 * bars, and its `ConnRow` list is post-analysis, capped at 3, and reached only
 * in the detailed view — so direction left the card face entirely.
 *
 * ⭐ THE TWO ARE NOT SUBSTITUTES. A pill says what this factor does TO a named
 * target; an influence bar says how much it MATTERS. Trading one for the other
 * at exactly the moment the user has most reason to read the model as a causal
 * story is the same phase-swap defect as the option cards, one node kind over.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { FactorNode } from '../FactorNode'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

vi.mock('../../layoutStore', () => ({
  useLayoutStore: vi.fn((selector: (s: { layoutNodeWidth: number | null }) => unknown) =>
    selector({ layoutNodeWidth: null })
  ),
}))

// Spread the real flags module so a newly-added flag never goes silently absent
// and throws at render (CLAUDE.md trap 12 — a `vi.mock` factory REPLACES the
// module). Only the flags this suite deliberately pins are overridden.
vi.mock('../../../flags', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../flags')>()),
  isGraphBadgesEnabled: vi.fn(() => false),
  isCrossHighlightEnabled: vi.fn(() => false),
  isGraphLensEnabled: vi.fn(() => false),
}))

vi.mock('../../hooks/useScienceIcons', () => ({ useScienceIcons: vi.fn(() => []) }))
vi.mock('../../store', () => ({ useCanvasStore: vi.fn() }))
vi.mock('../../hooks/useNodeDisplayMetadata', () => ({ useNodeDisplayMetadata: vi.fn() }))

// Make NodePopover transparent so its content is readable without the hover delay.
vi.mock('../shared/NodePopover', () => ({
  NodePopover: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="node-popover">{children}</div>
  ),
}))

import { useCanvasStore } from '../../store'
import { useNodeDisplayMetadata } from '../../hooks/useNodeDisplayMetadata'

/** The sentence under repair. Asserted as ABSENT for every non-brief provenance. */
const BRIEF_CLAIM = /from your brief/i
/** The honest replacement — asserted present only where there is genuinely no evidence. */
const PLACEHOLDER_LINE = /placeholder/i
/** The pre-existing user-owned sentence. Reused, never re-authored. */
const USER_OWNED_LINE = /You provided this value/i

// `deletable`/`selectable`/`draggable` are REQUIRED by `NodeProps` and are the
// reason the neighbouring render-matrix suite carries TS2739 in the typecheck
// baseline. Supplied here so this file contributes ZERO baseline errors — a new
// file with errors blocks the gate outright, and inheriting a known-broken
// fixture shape would have meant asking for a baseline bump instead of writing
// three fields.
const baseFactorProps = {
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
 * factor-1 is the rendered node and carries the strongest edge, so it ranks #1
 * and is high-priority — the gate this coaching line sits behind. `weightSource`
 * is REQUIRED on every edge: the pre-analysis ranking is provenance-gated, and
 * without it there is no ranking and no factor is high-priority at all.
 */
const FACTOR_ID = 'factor-1'
const TARGET_LABEL = 'Monthly Recurring Revenue'

/** `status: 'complete'` is what `FactorNode` reads as post-analysis. */
function topology(resultsStatus: 'idle' | 'complete') {
  return {
    nodes: [
      { id: FACTOR_ID, type: 'factor', data: { type: 'factor', label: 'Pro Plan Monthly Price', category: 'controllable' } },
      { id: 'outcome-1', type: 'outcome', data: { type: 'outcome', label: TARGET_LABEL } },
    ],
    edges: [
      // A CEE-authored weight and direction — not `USER_EDGE_DEFAULTS`, which
      // `EdgePills` deliberately refuses to announce.
      { id: 'e1', source: FACTOR_ID, target: 'outcome-1', data: { weight: 0.5, direction: 'positive', weightSource: 'cee' } },
    ],
    ceeAnalysisReady: null,
    results: { status: resultsStatus, report: null },
    highlightedNodes: new Set(),
    dimmedNodeIds: new Set(),
    lens: { _dimmedNodeIds: new Set(), _hiddenNodeIds: new Set(), active: 'full' },
    goalThreshold: null,
    goalConstraints: [],
    setHoveredOption: vi.fn(),
    runMeta: { ceeReview: null },
    viewMode: 'standard' as const,
  }
}

function renderAt(resultsStatus: 'idle' | 'complete') {
  vi.mocked(useCanvasStore).mockImplementation((selector: never) =>
    (selector as unknown as (s: unknown) => unknown)(topology(resultsStatus)),
  )
  return render(
    <ReactFlowProvider>
      <FactorNode
        {...baseFactorProps}
        data={{
          type: 'factor',
          label: 'Pro Plan Monthly Price',
          category: 'controllable',
          observedState: { value: 0.59, extractionType: 'explicit', source: 'user_override', unit: 'scale' },
        }}
      />
    </ReactFlowProvider>,
  )
}

describe('a factor keeps saying what it DOES after the run', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: null,
      isResultsMode: false,
      influenceProvenance: null,
    } as never)
  })

  it('PRE-ANALYSIS — the effect on its target is named on the card face', () => {
    // PRECONDITION: if this arm does not render, the post-analysis assertion
    // below would pass on a card that never showed the pill in either phase.
    const { container } = renderAt('idle')
    expect(container.textContent).toContain(TARGET_LABEL)
  })

  it('POST-ANALYSIS — the SAME effect is still named', () => {
    // ⭐ The defect. Before the fix this element was absent from the DOM once
    // `results.status === 'complete'`.
    const { container } = renderAt('complete')
    // ⚠ PRECONDITION, PINNED IN-TEST — this is what the first version of this
    // case lacked, and it was VACUOUS as a result. Post-analysis the expert
    // view's "Influences:" ConnRow list ALSO names the target, so asserting the
    // label alone cannot tell EdgePills from ConnRow: the case passed with the
    // phase gate restored. Standard view renders no ConnRow list, so the label
    // can only come from the pill.
    expect(container.textContent, 'ConnRow list present — the assertion cannot discriminate').not.toContain('Influences:')
    expect(
      container.textContent,
      'the factor stopped naming what it affects once a result arrived',
    ).toContain(TARGET_LABEL)
  })

  it('CONTRAST — the pill is bound to a REAL edge, not rendered unconditionally', () => {
    // ⭐ Without this, both cases above pass on a change that renders the target
    // label from somewhere else entirely — the node list, say — and the pills
    // could be gone while the assertions stay green.
    vi.mocked(useCanvasStore).mockImplementation((selector: never) => {
      const t = topology('complete')
      return (selector as unknown as (s: unknown) => unknown)({ ...t, edges: [] })
    })
    const { container } = render(
      <ReactFlowProvider>
        <FactorNode
          {...baseFactorProps}
          data={{ type: 'factor', label: 'Pro Plan Monthly Price', category: 'controllable', observedState: { value: 0.59, extractionType: 'explicit', source: 'user_override', unit: 'scale' } }}
        />
      </ReactFlowProvider>,
    )
    expect(container.textContent).not.toContain(TARGET_LABEL)
  })
})
