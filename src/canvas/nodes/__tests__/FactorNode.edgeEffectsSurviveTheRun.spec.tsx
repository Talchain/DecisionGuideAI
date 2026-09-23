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
 *
 * ── ⭐ LOCKED CANVAS DESIGN (23 Sep 2026) — A DELIBERATE RE-RULING ───────────
 * MT-19 + spec §3 (Normal order has no relationship row): the pills are OFF the
 * resting face in BOTH phases. "Key relationship(s)" are Detailed information,
 * and on the board the CONNECTORS themselves carry direction (colour/sign). In
 * Detailed the pills say what they are (visible verb, neutral arrow, "Link
 * strength") and stay PRE-analysis only, because post-analysis Detailed already
 * names these targets in its "Influences:" list (see `FactorNode.tsx`, the
 * `isDetailed && !needsInput && !isPostAnalysis` gate).
 *
 * So each case is re-pointed to where the effect now lives:
 *   · the named target: Detailed — the pill pre-run, the "Influences:" row
 *     post-run — and never the Standard face;
 *   · the direction words: the Detailed pill, pre-run, still a DISCRIMINATING
 *     pair on sign; post-run the card states no direction (the connector does).
 * The face's absence is asserted beside each presence (rule 2 of the update).
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
    viewMode: 'standard' as 'standard' | 'expert',
  }
}

function renderAt(
  resultsStatus: 'idle' | 'complete',
  weight = 0.5,
  viewMode: 'standard' | 'expert' = 'standard',
) {
  vi.mocked(useCanvasStore).mockImplementation((selector) =>
    selector({ ...topology(resultsStatus, weight), viewMode } as never),
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

  it('PRE-ANALYSIS — the effect on its target is named in Detailed, and NOT on the resting face', () => {
    // Locked Canvas design (23 Sep 2026), MT-19 + spec §3: no relationship row
    // on the Standard face…
    const standard = renderAt('idle')
    expect(standard.queryByTestId('edge-pill-verb-e1')).toBeNull()
    expect(standard.queryByTestId('edge-pill-strength-estimate-e1')).toBeNull()
    standard.unmount()

    // …Detailed names it. PRECONDITION for the post-analysis case below: if this
    // arm did not render, "still named after the run" would pass on a card that
    // never named the target in either phase.
    const detailed = renderAt('idle', 0.5, 'expert')
    const verb = detailed.getByTestId('edge-pill-verb-e1')
    // The pill that carries the verb names THIS target, verbatim.
    expect(verb.parentElement!.textContent).toContain(TARGET_LABEL)
  })

  it('POST-ANALYSIS — the SAME target is still named, in Detailed\'s "Influences:" list', () => {
    // ⭐ The original defect was the target leaving the card once a result
    // arrived. Locked Canvas design (23 Sep 2026): it lives in Detailed now —
    // post-run as an "Influences:" row (the pill is pre-run only there).
    const detailed = renderAt('complete', 0.5, 'expert')
    expect(detailed.container.textContent, 'Detailed lost its "Influences:" list').toContain('Influences:')
    expect(
      detailed.container.textContent,
      'the factor stopped naming what it affects once a result arrived',
    ).toContain(TARGET_LABEL)
    // Named ONCE — the post-run pill does not duplicate the Influences row.
    expect(detailed.queryByTestId('edge-pill-verb-e1')).toBeNull()
    detailed.unmount()

    // And the Standard face carries no pill after the run either.
    const standard = renderAt('complete')
    expect(standard.queryByTestId('edge-pill-verb-e1')).toBeNull()
    expect(standard.queryByTestId('edge-pill-strength-estimate-e1')).toBeNull()
  })

  /**
   * ⛔ THE ASSERTION THIS FILE WAS MISSING, and it was found by a reviewer, not
   * by me. Every case above binds to `TARGET_LABEL` — the name of the connected
   * node. `EdgePills` renders that name AND the polarity, and the label alone
   * survives the deletion of both direction spans. So this spec could have
   * stayed green while the pill stopped saying whether the factor RAISES or
   * LOWERS its target.
   *
   * A single-polarity assertion would not be enough either: asserting "Raises"
   * on a positive edge passes for a component that hardcodes the word. The
   * DISCRIMINATING PAIR is what binds it — the same render path must produce
   * the OPPOSITE word on the opposite sign, and must not produce both.
   *
   * Locked Canvas design (23 Sep 2026): the pill — and so the words — live in
   * Detailed, pre-analysis (MT-19). The verb is VISIBLE text now
   * (`edge-pill-verb-<id>`), no longer sr-only. Post-analysis the card states no
   * direction word in either view: the connector carries it on the board.
   */
  it('the Detailed pill says WHICH WAY, and discriminates on sign; post-run the card states no direction word', () => {
    const positive = renderAt('idle', 0.5, 'expert')
    expect(positive.getByTestId('edge-pill-verb-e1').textContent).toBe('Raises')
    expect(positive.container.textContent).toContain('Raises')
    expect(positive.container.textContent).not.toContain('Lowers')
    positive.unmount()

    const negative = renderAt('idle', -0.5, 'expert')
    expect(negative.getByTestId('edge-pill-verb-e1').textContent).toBe('Lowers')
    expect(negative.container.textContent).toContain('Lowers')
    expect(negative.container.textContent).not.toContain('Raises')
    negative.unmount()

    for (const view of ['standard', 'expert'] as const) {
      const post = renderAt('complete', 0.5, view)
      expect(post.container.textContent, `${view}: a direction word survived the run`).not.toContain('Raises')
      expect(post.container.textContent, `${view}: a direction word survived the run`).not.toContain('Lowers')
      post.unmount()
    }
  })

  it('CONTRAST — the pill is bound to a REAL edge, not rendered unconditionally', () => {
    // ⭐ Without this, both cases above pass on a change that renders the target
    // label from somewhere else entirely — the node list, say — and the pills
    // could be gone while the assertions stay green.
    // Locked Canvas design (23 Sep 2026): asserted in Detailed, in BOTH phases —
    // the views where the target is now named — so the contrast is taken where
    // the positive cases above look.
    for (const status of ['idle', 'complete'] as const) {
      vi.mocked(useCanvasStore).mockImplementation((selector) => {
        const t = topology(status)
        return selector({ ...t, edges: [], viewMode: 'expert' } as never)
      })
      const { container, unmount } = render(
        <ReactFlowProvider>
          <FactorNode
            {...baseFactorProps}
            data={{ type: 'factor', label: 'Pro Plan Monthly Price', category: 'controllable', observedState: { value: 0.59, extractionType: 'explicit', source: 'user_override', unit: 'scale' } }}
          />
        </ReactFlowProvider>,
      )
      expect(container.textContent, `${status}: the card did not mount`).toContain('Pro Plan Monthly Price')
      expect(container.textContent, status).not.toContain(TARGET_LABEL)
      unmount()
    }
  })
})
