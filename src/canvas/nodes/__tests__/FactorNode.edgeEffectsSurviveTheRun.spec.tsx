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
function topology(resultsStatus: 'idle' | 'complete', weight = 0.5) {
  return {
    nodes: [
      { id: FACTOR_ID, type: 'factor', data: { type: 'factor', label: 'Pro Plan Monthly Price', category: 'controllable' } },
      { id: 'outcome-1', type: 'outcome', data: { type: 'outcome', label: TARGET_LABEL } },
    ],
    edges: [
      // A CEE-authored weight and direction — not `USER_EDGE_DEFAULTS`, which
      // `EdgePills` deliberately refuses to announce.
      {
        id: 'e1',
        source: FACTOR_ID,
        target: 'outcome-1',
        /**
         * ⛔ `weight` IS AN UNSIGNED MAGNITUDE. THE SIGN LIVES IN `direction`.
         *
         * This fixture originally passed the raw (possibly negative) `weight`
         * straight through beside `direction: 'negative'`, and the two CANCELLED:
         * `computeSignedMean` (canvas/domain/edges.ts) reads
         * `sign = direction === 'negative' ? -1 : 1` and returns
         * `sign * magnitude`, so `-1 * -0.5` is `+0.5` and the negative case
         * rendered "Raises". The discriminating pair below looked sound and was
         * measuring one direction twice.
         *
         * A self-authored fixture encodes the author's model of the wire rather
         * than the wire (CLAUDE.md trap 16-inverse). `Math.abs` here keeps the
         * two channels doing what the producer says they do.
         */
        data: {
          weight: Math.abs(weight),
          direction: weight >= 0 ? 'positive' : 'negative',
          weightSource: 'cee',
        },
      },
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

function renderAt(resultsStatus: 'idle' | 'complete', weight = 0.5) {
  vi.mocked(useCanvasStore).mockImplementation((selector) =>
    selector(topology(resultsStatus, weight) as never),
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

  /**
   * ⛔ THE ASSERTION THIS FILE WAS MISSING, and it was found by a reviewer, not
   * by me. Every case above binds to `TARGET_LABEL` — the name of the connected
   * node. `EdgePills` renders that name AND the polarity, and the label alone
   * survives the deletion of both direction spans. So this spec could have
   * stayed green while the pill stopped saying whether the factor RAISES or
   * LOWERS its target — which is the entire reason the pill is the only
   * card-face surface carrying edge direction, and the entire reason gating it
   * post-analysis was worth guarding.
   *
   * A single-polarity assertion would not be enough either: asserting "Raises"
   * on a positive edge passes for a component that hardcodes the word. The
   * DISCRIMINATING PAIR is what binds it — the same render path must produce
   * the OPPOSITE word on the opposite sign, and must not produce both.
   *
   * Direction is announced in an `sr-only` span, so it is in `textContent`
   * while the glyphs beside it are `aria-hidden`. That is deliberate in the
   * component and it is what makes this assertable at all.
   */
  it('POST-ANALYSIS — the pill still says WHICH WAY, and discriminates on sign', () => {
    const positive = renderAt('complete', 0.5)
    // Precondition: we are reading the pill, not a ConnRow list that also
    // carries the target label — the same guard the case above establishes.
    expect(
      positive.container.textContent,
      'ConnRow list present — this assertion cannot discriminate',
    ).not.toContain('Influences:')
    expect(positive.container.textContent).toContain('Raises')
    expect(positive.container.textContent).not.toContain('Lowers')
    positive.unmount()

    const negative = renderAt('complete', -0.5)
    expect(negative.container.textContent).toContain('Lowers')
    expect(negative.container.textContent).not.toContain('Raises')
  })

  it('CONTRAST — the pill is bound to a REAL edge, not rendered unconditionally', () => {
    // ⭐ Without this, both cases above pass on a change that renders the target
    // label from somewhere else entirely — the node list, say — and the pills
    // could be gone while the assertions stay green.
    vi.mocked(useCanvasStore).mockImplementation((selector) => {
      const t = topology('complete')
      return selector({ ...t, edges: [] } as never)
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
