/**
 * A FACTOR VALUE OLUMI INVENTED MUST NOT BE ATTRIBUTED TO THE USER'S BRIEF.
 *
 * ── THE DEFECT, MEASURED ON DEPLOYED STAGING (UI `e38b8e96`, 30 Aug 2026) ───
 *
 * `FactorNode`'s pre-analysis coaching line read, verbatim:
 *
 *     "Olumi estimated this from your brief. High leverage, low evidence."
 *
 * over a value CEE had hardcoded. The four factors on that model each carried
 * `{ value: 0.5, source: 'cee_inference', extractionType: 'inferred' }` — the
 * distinct value set was literally `[0.5]` — and the number has no relation to
 * the brief at all. It is written by `adapters/llm/normalisation.ts` and by
 * `unified-pipeline/stages/repair/deterministic-sweep.ts`, which stamp
 * `value_tier: "fallback_default"` at the moment they invent it.
 *
 * ⭐ THE MECHANISM, AND IT IS AN EXACT INVERSION. The line was gated on
 * `extractionType === 'inferred'` — which is the state CEE CREATES TO MEAN
 * "NOT FROM THE BRIEF". `cee/transforms/schema-v3.ts` demotes
 * `explicit`/`observed` → `inferred` precisely when a brief claim is not
 * earned, and withdraws the claim from `provenance` and from prose
 * `uncertainty_drivers` in the same pass, under the comment *"two carriers of
 * one fact must not be able to disagree"*. This sentence was a further carrier
 * that CEE's withdrawal cannot reach, because it is a UI literal rather than
 * wire data. So the branch whose whole meaning is "not from the brief" carried
 * the from-the-brief sentence, while the honest twin — "You provided this
 * value." — sat three lines below it on `isExplicit`.
 *
 * ⚠ AND THE COMPONENT ALREADY COMPUTED THE TRUTH, 218 LINES ABOVE. The same
 * file's `showEvidenceGapBadge` calls `hasObservedData(props.data)`, whose
 * badge tooltip reads *"No observed data for X"*. Both rendered on the same
 * node, on the same screen, on the same deployed build: a badge saying there is
 * no observed data, and a sentence saying the data came from the user's brief.
 *
 * ── WHY THESE CASES, AND WHY THEY BIND BY PROVENANCE ────────────────────────
 *
 * Every case here binds by the `source` STAMP, never by the magnitude. A
 * genuinely user-stated 0.5 is indistinguishable from CEE's placeholder by
 * value (CLAUDE.md trap 19), and the pre-existing suite pinned this line
 * against `{ value: 0.5, extractionType: 'inferred' }` with NO source — a
 * fixture that cannot tell the two apart, which is how the lie survived.
 *
 * ⭐ THE OPPOSITE-DIRECTION TWIN is the load-bearing case. The two harms here
 * are not symmetric and cannot share one predicate:
 *   · saying "from your brief" over an invented number INVENTS provenance;
 *   · saying "Olumi set a placeholder" over a number the USER supplied DENIES
 *     their authorship — and `observedStateHelpers.ts` records that as the
 *     WORSE harm ("a gap wrongly INVENTED tells them a number they supplied is
 *     not theirs").
 * So `cee_inference` and `user_override` are asserted at the SAME value and the
 * SAME `extractionType`, differing only in the stamp. A fix that widens the
 * placeholder copy across both fails the twin.
 *
 * The authority is `hasObservedData` — already this component's owner of "is
 * there evidence behind this number", already imported, and already the basis
 * of the 29 Aug fix that made the badge honest. Nothing new is named here.
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
function topology(rankedFirst: boolean) {
  return {
    hoveredOptionId: null,
    nodes: [
      { id: 'factor-1', type: 'factor', data: { type: 'factor', label: 'Hiring cost' } },
      { id: 'factor-2', type: 'factor', data: { type: 'factor', label: 'F2' } },
      { id: 'factor-3', type: 'factor', data: { type: 'factor', label: 'F3' } },
      { id: 'factor-4', type: 'factor', data: { type: 'factor', label: 'F4' } },
      { id: 'outcome-1', type: 'outcome', data: { type: 'outcome', label: 'Revenue' } },
    ],
    edges: [
      {
        id: 'e1',
        source: 'factor-1',
        target: 'outcome-1',
        data: { weight: rankedFirst ? 1 : 0.01, direction: 'positive', weightSource: 'cee' },
      },
      { id: 'e2', source: 'factor-2', target: 'outcome-1', data: { weight: 0.9, direction: 'positive', weightSource: 'cee' } },
      { id: 'e3', source: 'factor-3', target: 'outcome-1', data: { weight: 0.8, direction: 'positive', weightSource: 'cee' } },
      { id: 'e4', source: 'factor-4', target: 'outcome-1', data: { weight: 0.7, direction: 'positive', weightSource: 'cee' } },
    ],
    ceeAnalysisReady: null,
    results: { status: 'idle', report: null },
    highlightedNodes: new Set(),
    dimmedNodeIds: new Set(),
    lens: { _dimmedNodeIds: new Set(), _hiddenNodeIds: new Set(), active: 'full' },
    goalThreshold: null,
    goalConstraints: [],
    setHoveredOption: vi.fn(),
    runMeta: { ceeReview: null },
    viewMode: 'expert' as const,
  }
}

function applyStore(rankedFirst = true) {
  vi.mocked(useCanvasStore).mockImplementation((selector: any) => selector(topology(rankedFirst)))
}

function renderFactor(observedState: Record<string, unknown>) {
  return render(
    <ReactFlowProvider>
      <FactorNode
        {...baseFactorProps}
        data={{ type: 'factor', label: 'Hiring cost', category: 'controllable', observedState }}
      />
    </ReactFlowProvider>
  )
}

/** The exact shape CEE's substitution writes, witnessed on deployed staging. */
const SUBSTITUTED = { value: 0.5, extractionType: 'inferred', source: 'cee_inference', unit: 'scale' }
/** Its twin: same value, same extractionType, but a PERSON owns the number. */
const USER_OWNED = { value: 0.5, extractionType: 'inferred', source: 'user_override', unit: 'scale' }

describe('FactorNode — an invented value is never attributed to the brief', () => {
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
    } as any)
  })

  it('does NOT claim the brief for a CEE-substituted value', () => {
    applyStore()
    const { container } = renderFactor(SUBSTITUTED)
    // Bound to the whole rendered subtree, not to one element: the claim must
    // not appear anywhere on the node, in any carrier.
    expect(container.textContent).not.toMatch(BRIEF_CLAIM)
  })

  it('says something TRUE instead of going silent — no-hiding', () => {
    applyStore()
    const { container } = renderFactor(SUBSTITUTED)
    expect(container.textContent).toMatch(PLACEHOLDER_LINE)
  })

  it('OPPOSITE-DIRECTION TWIN: never calls a value the USER supplied a placeholder', () => {
    applyStore()
    const { container } = renderFactor(USER_OWNED)
    expect(container.textContent).not.toMatch(PLACEHOLDER_LINE)
    // …and it still must not claim the brief for it either.
    expect(container.textContent).not.toMatch(BRIEF_CLAIM)
  })

  /**
   * ⚠ THE USER-OWNED SENTENCE IS UNREACHABLE HERE, AND THAT IS A FINDING, NOT A
   * GAP IN THIS SUITE. `FactorNode`'s "You provided this value." arm is gated on
   * `outboundConnections.length > 0`, but `useNodeConnections` returns `[]`
   * unless `results.status === 'complete'` (hooks/useNodeConnections.ts:35) and
   * this whole block renders only when NOT post-analysis. So that arm is
   * STRUCTURALLY DEAD in the product, not merely unmounted by this harness.
   * It is left untouched and reported rather than widened — widening it would
   * ship a branch nothing can reach. What this test pins is the part that IS
   * reachable and that matters: a value the user owns gets no FALSE claim.
   */
  it('OPPOSITE-DIRECTION TWIN: a user-owned value gets no coaching claim at all', () => {
    applyStore()
    const { container } = renderFactor(USER_OWNED)
    expect(container.textContent).not.toMatch(PLACEHOLDER_LINE)
    expect(container.textContent).not.toMatch(BRIEF_CLAIM)
    expect(container.textContent).not.toMatch(USER_OWNED_LINE)
  })

  it('DISCRIMINATION: the two provenances differ at the SAME value and extractionType', () => {
    applyStore()
    const { container: fabricated } = renderFactor(SUBSTITUTED)
    const fabricatedText = fabricated.textContent ?? ''
    // Pin the precondition IN-TEST: if the fixtures stopped reproducing two
    // different classifications, both arms would agree and every assertion above
    // would pass while discriminating nothing.
    applyStore()
    const { container: owned } = renderFactor(USER_OWNED)
    const ownedText = owned.textContent ?? ''
    expect(fabricatedText).not.toEqual(ownedText)
    expect(PLACEHOLDER_LINE.test(fabricatedText)).toBe(true)
    expect(PLACEHOLDER_LINE.test(ownedText)).toBe(false)
  })

  /**
   * THE THIRD POPULATION, pinned so the deliberate silence is not mistaken for
   * an oversight. A factor labelled `inferred` with NO `source` stamp is one we
   * cannot classify: `hasObservedData` keeps the previous answer on an absent
   * stamp (positive evidence only — `observedStateHelpers.ts`), so it is not
   * fabricated; and nothing tells us a person authored it, so "You provided
   * this value" would INVENT authorship. Neither sentence is available, and
   * inventing one is the harm this file exists to remove. It therefore shows
   * NO coaching line — a refusal to claim, not a hidden surface: the node's
   * value, its badge and its connections all still render.
   */
  it('a source-less inferred value claims NEITHER the brief NOR the user', () => {
    applyStore()
    const { container } = renderFactor({ value: 0.5, extractionType: 'inferred', unit: 'scale' })
    expect(container.textContent).not.toMatch(BRIEF_CLAIM)
    expect(container.textContent).not.toMatch(USER_OWNED_LINE)
    expect(container.textContent).not.toMatch(PLACEHOLDER_LINE)
  })

  it('keeps the top-3 gate: a low-priority substituted factor shows no coaching line', () => {
    applyStore(false)
    const { container } = renderFactor(SUBSTITUTED)
    expect(container.textContent).not.toMatch(PLACEHOLDER_LINE)
    expect(container.textContent).not.toMatch(BRIEF_CLAIM)
  })
})
