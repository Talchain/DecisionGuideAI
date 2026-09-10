/**
 * ⭐ THE "NEEDS INPUT" MARKER IS GATED ON THE GAP, NOT ON THE ANALYSIS PHASE.
 *
 * ── THE DEFECT ────────────────────────────────────────────────────────────
 * `BaseNode`'s `isIncomplete` opened with `if (!isPreRunMode) return false`, so
 * a completed run cleared every honest-gap channel at once: the "Needs input"
 * `StatusPill`, the 2px incomplete border, and the `overlay-missing-value`
 * marker. `BaseNode.tsx` had already written the consequence down — the pill
 * "vanishes with nothing set — the product silently retracted its own claim
 * rather than ever being contradicted."
 *
 * An analysis does not RESOLVE an unknown. It proceeds despite one. Hiding the
 * marker the moment results arrive tells the user a gap closed that is still
 * open, and `StatusPill` reuses `title` as `aria-label`, so a screen-reader
 * user loses the same fact.
 *
 * ── WHY THESE FOUR CASES, AND NOT ONE ─────────────────────────────────────
 * Case 1 alone would pass against a mutant that simply made every factor
 * incomplete forever, which would be a louder lie than the one being fixed.
 * The set is chosen so that each plausible wrong implementation fails at least
 * one case, and the two directions are in ONE file so a change that flattened
 * the channel cannot pass by deleting its twin:
 *
 *   · restore `if (!isPreRunMode) return false`  → case 1 REDs
 *   · `isIncomplete` always true                 → cases 2 and 4 RED
 *   · drop the `category === 'external'` exemption → case 4 REDs
 *   · gate inverted (pre-run suppressed)         → case 3 REDs
 *
 * ⚠ EVERY ASSERTION BINDS BY IDENTITY — `needs-input-pill` and
 * `overlay-missing-value` are exact test ids on the element under test, never a
 * class substring or a value predicate a sibling element could also satisfy
 * (CLAUDE.md trap 19).
 *
 * ⛔ SCOPE. This pins `factor` only. `goal` and `option` deliberately KEEP the
 * phase gate and are NOT asserted here, because their predicates are not
 * phase-independent: a run makes the producer synthesise `auto_goal_threshold`,
 * so `isGoalDefined` can read true on a target the user never set, and the
 * option arm turns on `ceeAnalysisReady` licence semantics that this change did
 * not derive. Deferred to a lane that derives them — not judged unnecessary.
 * `decision` is un-gated in the same change (its predicate is structural, an
 * edge count) but is left to its own component spec rather than asserted from
 * a factor harness.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})
vi.mock('../../store', () => ({ useCanvasStore: vi.fn() }))
vi.mock('../../layoutStore', () => ({
  useLayoutStore: vi.fn(((s: (x: { layoutNodeWidth: number | null }) => unknown) =>
    s({ layoutNodeWidth: null })) as unknown as (...a: never[]) => unknown),
}))
vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null,
    influence: null,
    confidence: null,
    inSensitivityAnalysis: false,
    achievementProbability: null,
    stabilityPercentage: null,
  })),
}))

import { useCanvasStore } from '../../store'
import { FactorNode } from '../FactorNode'

const baseProps = {
  selected: false,
  dragging: false,
  zIndex: 0,
  isConnectable: false,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  deletable: true,
  selectable: true,
  draggable: true,
}

const FACTOR_ID = 'fac_hiring'

/**
 * `resultsStatus` is the ONLY thing that differs between the pre-run and
 * post-run cases below. Both arms render the same component with the same node
 * data, so a difference in outcome can only be the phase, which is the property
 * under test.
 */
function renderFactor(data: Record<string, unknown>, resultsStatus: string) {
  vi.mocked(useCanvasStore).mockImplementation((selector) =>
    selector({
      hoveredOptionId: null,
      nodes: [{ id: FACTOR_ID, type: 'factor', data }],
      edges: [],
      ceeAnalysisReady: null,
      results: { status: resultsStatus, report: null },
      highlightedNodes: new Set(),
      dimmedNodeIds: new Set(),
      lens: { _dimmedNodeIds: new Set() },
      goalThreshold: null,
      goalConstraints: [],
      setHoveredOption: vi.fn(),
      viewMode: 'expert',
    } as never),
  )
  return render(
    <ReactFlowProvider>
      <FactorNode {...(baseProps as any)} type="factor" id={FACTOR_ID} data={data as any} />
    </ReactFlowProvider>,
  )
}

const CONTROLLABLE_NO_VALUE = {
  label: 'Hiring rate',
  type: 'factor',
  category: 'controllable',
}

beforeEach(() => {
  vi.clearAllMocks()
  cleanup()
})

describe('the gap outlives the run', () => {
  it('CASE 1 — a controllable factor with no stated value still says "Needs input" AFTER the run completes', () => {
    renderFactor(CONTROLLABLE_NO_VALUE, 'complete')
    expect(screen.getByTestId('needs-input-pill')).toBeTruthy()
    expect(screen.getByTestId('overlay-missing-value')).toBeTruthy()
  })

  it('CASE 3 — and it still says so BEFORE the run, so the fix did not trade one phase for the other', () => {
    renderFactor(CONTROLLABLE_NO_VALUE, 'idle')
    expect(screen.getByTestId('needs-input-pill')).toBeTruthy()
    expect(screen.getByTestId('overlay-missing-value')).toBeTruthy()
  })
})

describe('⛔ THE TWIN — the marker still tracks the GAP, so it cannot just be always-on', () => {
  it('CASE 2 — a factor that HAS its value carries no marker after the run', () => {
    renderFactor(
      { ...CONTROLLABLE_NO_VALUE, observedState: { value: 0.7, source: 'user_override' } },
      'complete',
    )
    expect(screen.queryByTestId('needs-input-pill')).toBeNull()
    expect(screen.queryByTestId('overlay-missing-value')).toBeNull()
  })

  it('CASE 4 — an EXTERNAL factor is still exempt after the run: it is outside the user judgement, not missing it', () => {
    renderFactor({ ...CONTROLLABLE_NO_VALUE, category: 'external' }, 'complete')
    expect(screen.queryByTestId('needs-input-pill')).toBeNull()
    expect(screen.queryByTestId('overlay-missing-value')).toBeNull()
  })
})
