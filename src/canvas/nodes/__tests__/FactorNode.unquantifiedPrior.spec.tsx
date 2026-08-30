/**
 * A FACTOR NOBODY HAS ESTIMATED MUST SAY SO ON THE NODE.
 *
 * ── THE REGRESSION THIS EXISTS TO PREVENT ───────────────────────────────────
 *
 * CEE PR #1223 stops substituting a placeholder `0.5` for a factor the brief
 * gave no number for. That is strictly more honest — but it silences the UI.
 *
 * `FactorNode`'s pre-analysis coaching line reads "Olumi's placeholder — no
 * evidence yet." and it FIRES today, gated on `isInferred`, which is
 * `observedState?.extractionType === 'inferred'`. All five `extractionType`
 * reads in that file go through `observedState?.`, with no node-level fallback.
 * After #1223 there is no placeholder value to describe, so a factor that is
 * MORE honestly unknown than before would say LESS about itself.
 *
 * ⚠⚠ AND IN THE OTHER SHAPE IT WOULD SAY SOMETHING FALSE. CEE's sweep deletes
 * `data.value` but explicitly PRESERVES `extractionType`
 * (`deterministic-sweep.ts`: `extractionType: existingType ?? 'inferred'`,
 * read at PR head `aa330ffe`, 30 Aug 2026). Whether the V3 transform then emits
 * an `observed_state` carrying that `extractionType` and no `value`, or omits
 * `observed_state` entirely, is a CEE-side fact this lane could NOT settle.
 * So BOTH shapes are pinned here:
 *   · no `observedState` at all  → the old line goes DARK  (silence)
 *   · `observedState: { extractionType: 'inferred' }` with no value
 *                                → the old line FIRES and is now FALSE
 *                                  (it asserts a placeholder that no longer
 *                                   exists)
 * The fix is written against the SPEC — *"a factor carrying an ignorance prior
 * has no estimate; say that, and do not describe a placeholder"* — so it is
 * correct in both worlds rather than tuned to whichever one arrives.
 *
 * ── WHY NOT SIMPLY WIDEN `isInferred` ───────────────────────────────────────
 *
 * Two populations, two different true statements (CLAUDE.md trap 21):
 *   · a placeholder number exists and has no evidence behind it;
 *   · no number exists at all.
 * One predicate covering both would make the product say "placeholder" over a
 * node that carries none. They are ordered instead, most specific first, in a
 * single derived value so two sentences can never render at once.
 *
 * ── MOUNT PATH ──────────────────────────────────────────────────────────────
 *
 * Bound to `FactorNode`'s pre-analysis layer-2 block, the same surface the
 * existing `FactorNode.briefAttribution.spec.tsx` pins, and reached through the
 * same harness. The line is NOT behind `isGraphBadgesEnabled()` — that flag
 * gates `showEvidenceGapBadge` and `constraintTooltip` only — so it is
 * asserted here with badges mocked OFF, which is the stricter posture.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { FactorNode } from '../FactorNode'
import { PRIOR_IS_UNQUANTIFIED_FIELD } from '../../domain/nodes'

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

vi.mock('../shared/NodePopover', () => ({
  NodePopover: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="node-popover">{children}</div>
  ),
}))

import { useCanvasStore } from '../../store'
import { useNodeDisplayMetadata } from '../../hooks/useNodeDisplayMetadata'

/** The honest sentence for "no number exists at all". */
const NO_ESTIMATE_LINE = /No estimate yet/i
/** The pre-existing sentence for "a placeholder number exists". */
const PLACEHOLDER_LINE = /placeholder/i

/**
 * The prior CEE's `buildUnquantifiedPrior()` emits, read at PR #1223 head
 * `aa330ffe62bc9ccac766f6628ad261064f976b26` (30 Aug 2026). Built through the
 * shared constant so a spelling change cannot pass here.
 */
const IGNORANCE_PRIOR = {
  distribution: 'uniform',
  range_min: 0,
  range_max: 1,
  [PRIOR_IS_UNQUANTIFIED_FIELD]: true,
}

/** Its twin: byte-identical bar the flag. A genuine external prior. */
const GENUINE_UNIFORM_0_1 = { distribution: 'uniform', range_min: 0, range_max: 1 }

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
 * factor-1 carries the strongest edge, so it ranks #1 and is high-priority —
 * the gate this coaching line sits behind. `weightSource` is REQUIRED on every
 * edge: the pre-analysis ranking is provenance-gated, and without it no factor
 * is high-priority at all.
 */
function topology() {
  return {
    hoveredOptionId: null,
    nodes: [
      { id: 'factor-1', type: 'factor', data: { type: 'factor', label: 'Support headcount' } },
      { id: 'factor-2', type: 'factor', data: { type: 'factor', label: 'F2' } },
      { id: 'factor-3', type: 'factor', data: { type: 'factor', label: 'F3' } },
      { id: 'factor-4', type: 'factor', data: { type: 'factor', label: 'F4' } },
      { id: 'outcome-1', type: 'outcome', data: { type: 'outcome', label: 'Revenue' } },
    ],
    edges: [
      { id: 'e1', source: 'factor-1', target: 'outcome-1', data: { weight: 1, direction: 'positive', weightSource: 'cee' } },
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

function renderFactor(data: Record<string, unknown>) {
  return render(
    <ReactFlowProvider>
      <FactorNode
        {...baseFactorProps}
        data={{ type: 'factor', label: 'Support headcount', category: 'controllable', ...data }}
      />
    </ReactFlowProvider>
  )
}

describe('FactorNode — a factor with no estimate says so', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useCanvasStore).mockImplementation((selector: any) => selector(topology()))
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

  it('⭐ #1223 SHAPE A (no observedState at all) — names the unknown instead of going silent', () => {
    const { container } = renderFactor({ prior: IGNORANCE_PRIOR })
    expect(container.textContent).toMatch(NO_ESTIMATE_LINE)
  })

  it('⭐ #1223 SHAPE B (extractionType preserved, no value) — names the unknown and does NOT claim a placeholder', () => {
    // CEE preserves `extractionType: 'inferred'` while deleting the value, so
    // `isInferred` can still be true with no number behind it. The old sentence
    // would fire here and assert a placeholder that does not exist.
    const { container } = renderFactor({
      prior: IGNORANCE_PRIOR,
      observedState: { extractionType: 'inferred', source: 'cee_inference' },
    })
    expect(container.textContent).toMatch(NO_ESTIMATE_LINE)
    expect(container.textContent).not.toMatch(PLACEHOLDER_LINE)
  })

  it('⭐ THE TWIN — a GENUINE uniform(0,1) prior does NOT claim "no estimate"', () => {
    // PRECONDITION PINNED IN-TEST (trap 13b): the two priors are identical
    // apart from the flag, so a green result is the predicate's doing and not
    // the fixture's.
    const { [PRIOR_IS_UNQUANTIFIED_FIELD]: _flag, ...unflagged } = IGNORANCE_PRIOR
    expect(unflagged).toEqual(GENUINE_UNIFORM_0_1)

    const { container } = renderFactor({
      prior: GENUINE_UNIFORM_0_1,
      observedState: { value: 0.6, extractionType: 'explicit', source: 'user_override' },
    })
    expect(container.textContent).not.toMatch(NO_ESTIMATE_LINE)
  })

  it('does NOT overwrite a value the USER supplied, even under an ignorance prior', () => {
    // The worse of the two harms: telling a person the number they supplied is
    // not there. Bound by the `source` stamp, never by the magnitude.
    const { container } = renderFactor({
      prior: IGNORANCE_PRIOR,
      observedState: { value: 0.42, extractionType: 'inferred', source: 'user_override' },
    })
    expect(container.textContent).not.toMatch(NO_ESTIMATE_LINE)
    expect(container.textContent).not.toMatch(PLACEHOLDER_LINE)
  })

  it('POSITIVE CONTROL — the placeholder sentence still fires for a CEE-substituted value', () => {
    // Proves this suite renders a surface on which the sentences ARE visible,
    // so the absence assertions above are not passing vacuously. This is the
    // pre-#1223 shape and it must not move.
    const { container } = renderFactor({
      observedState: { value: 0.5, extractionType: 'inferred', source: 'cee_inference', unit: 'scale' },
    })
    expect(container.textContent).toMatch(PLACEHOLDER_LINE)
    expect(container.textContent).not.toMatch(NO_ESTIMATE_LINE)
  })

  it('exactly ONE of the two sentences renders, never both', () => {
    const { container } = renderFactor({
      prior: IGNORANCE_PRIOR,
      observedState: { extractionType: 'inferred', source: 'cee_inference' },
    })
    const text = container.textContent ?? ''
    const said = [NO_ESTIMATE_LINE, PLACEHOLDER_LINE].filter(re => re.test(text))
    expect(said).toHaveLength(1)
  })
})
