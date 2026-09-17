/**
 * ⭐⭐⭐ RULE 2: THE NODE'S OWN UNIT COMES BEFORE ANY SCORE — PINNED AT THE ONE
 * RUNG WHERE THE TWO COMPETE FOR A SINGLE LINE.
 *
 * Node design system, rule 2, verbatim:
 *
 * > **The node's own unit comes before any score.** An outcome called Monthly
 * > Recurring Revenue shows £/month. *A normalised figure with no unit is not a
 * > compact presentation of a value, it is a different quantity wearing its
 * > name.*
 *
 * and the anatomy it serves: *"The node's own value in its own unit comes first,
 * and the line beneath says where the number came from. A run adds relative
 * scores BELOW that — never in place of it."*
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⛔⛔ THE DEFECT, AND WHY READING EITHER ARM ALONE COULD NOT SEE IT
 * ─────────────────────────────────────────────────────────────────────────────
 * `RiskNode`'s reduced line was:
 *
 *     if (!bridgeEdgeData) return recordedValue ?? null      ← own magnitude
 *     if (pct != null)     return `Strength ${pct}%`         ← a score about an EDGE
 *     return `Strength ${METRIC_UNSET.inline}`
 *
 * `recordedValue` — the risk's own size, in months or pounds, read from
 * `observedState` — was reachable **only on the arm where no bridge edge
 * exists**. Give the same risk an edge and a normalised 0..1 weight belonging to
 * that EDGE displaced a native quantity belonging to the NODE.
 *
 * ⛔⛔ AND THE UNSET ARM WAS NOT A DISPLACEMENT BUT AN ABSENCE CLAIM OVER A
 * PRESENT VALUE: a risk carrying a recorded `4 months`, on an edge nobody had
 * weighted, rendered **`Strength not set yet`**. The card announced that nothing
 * was recorded while holding the thing that was.
 *
 * *Both facts were true in isolation and the two lived in different arms of one
 * `if`, which is why every reading of either arm agreed with itself.*
 *
 * ⭐ THE PRECEDENCE IS BORROWED, NOT MINTED. `GoalNode` already ships
 * `targetLine ?? …` for the same question. Two rules for one question is how the
 * two height authorities behind this lane's last P0 came to disagree.
 *
 * ⚠ SCOPE, STATED SO IT CANNOT BE OVERSOLD: `display_value` is carried by
 * **4 of 23** risks on the captures, so at most four cards can change, and every
 * one changes from a figure about an edge to a figure about itself.
 *
 * The fixtures below are inherited deliberately from `lodMetric.riskOutcome`,
 * whose own header records that its FIRST set was written from a type definition
 * rather than from the wire and therefore certified the defect it was testing.
 * `strength_mean` (not a bare `weight`) is what makes the strength arm render at
 * all — a fixture built from `weight` alone renders nothing and every assertion
 * here would pass vacuously.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { RiskNode } from '../RiskNode'
import { METRIC_UNSET } from '../shared/metricVocabulary'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

const makeStoreState = (overrides: Record<string, unknown> = {}) => ({
  results: { status: 'idle', report: null },
  highlightedNodes: new Set(),
  dimmedNodeIds: new Set(),
  editedSinceRunNodeIds: new Set(),
  analysisHighlight: { source: null, edgeIds: new Set(), nodeIds: new Set() },
  lens: { _dimmedNodeIds: new Set(), _hiddenNodeIds: new Set(), active: 'full' },
  goalThreshold: null,
  goalConstraints: [],
  hoveredOptionId: null,
  ceeAnalysisReady: null,
  edges: [],
  nodes: [],
  viewMode: 'standard',
  lodRung: 'full',
  ...overrides,
})

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector) => selector(makeStoreState())),
}))

vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null,
    influence: null,
    influenceProvenance: null,
    confidence: null,
    inSensitivityAnalysis: false,
    // ⚠ NULL ON PURPOSE. This is the field the first cut asked an outcome for,
    // and the field a real model does not carry. Supplying it here would
    // rebuild the exact fixture that certified the defect.
    achievementProbability: null,
    achievementProbabilityIsModelledBasis: null,
    stabilityPercentage: null,
    winRate: null,
    isResultsMode: false,
  })),
}))

import { useCanvasStore } from '../../store'

const baseProps = {
  type: 'risk',
  position: { x: 0, y: 0 },
  selected: false,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  dragging: false,
  zIndex: 0,
}

/**
 * The bridge edge, in the shape a PRODUCER actually sends.
 *
 * ⚠ `strength_mean`, NOT a bare `weight` — and getting this wrong was the third
 * fixture I wrote tonight from a type definition instead of from the wire.
 * `resolveEdgeSignedStrengthDisplay` is provenance-gated: a bare `weight` with
 * no source stamp returns `{ show: false }`, deliberately, because
 * `DEFAULT_EDGE_DATA` and `USER_EDGE_DEFAULTS` always define `weight` and an
 * ungated read would print the 0.3 default as a measurement. So a fixture built
 * from `weight` alone renders NO strength at all, and every assertion about the
 * reduced line passes vacuously against a card that shows nothing.
 *
 * Derived rather than assumed: the deployed cards render `est.`, which requires
 * `show === true` AND `weightSource !== 'user'`. The only route to that without
 * an explicit stamp is the documented producer-only fallback — `strength_mean`
 * present implies source `'cee'`. That is what this builds.
 */
const modelWithBridge = (nodeId: string, kind: string, strength: number, userStated?: boolean) => ({
  lodRung: 'line',
  nodes: [
    { id: nodeId, type: kind, data: { type: kind } },
    { id: 'goal-1', data: { type: 'goal' } },
  ],
  edges: [
    {
      id: 'e1',
      source: nodeId,
      target: 'goal-1',
      data: userStated
        ? { weight: strength, direction: 'negative', beliefExists: null, weightSource: 'user' }
        : { strength_mean: strength, direction: 'negative', beliefExists: null },
    },
  ],
})

const lodLine = () => screen.queryByTestId('node-lod-line')?.textContent ?? null

const RECORDED = { observedState: { raw_value: 4, unit: 'months' }, display_value: '4 months' }

describe("rule 2 — a risk's own magnitude outranks a score about one of its edges", () => {
  beforeEach(() => { vi.clearAllMocks() })

  /**
   * ⭐ THE PRECONDITION IS PINNED IN-TEST. Without this the whole file could pass
   * against a card that renders no line at all, which is exactly the vacuity the
   * inherited fixtures' header warns about.
   */
  it('precondition: the strength arm genuinely renders when there is nothing of the risk\'s own', () => {
    vi.mocked(useCanvasStore).mockImplementation(sel =>
      sel(makeStoreState(modelWithBridge('risk-1', 'risk', 0.4)) as any),
    )
    render(
      <ReactFlowProvider>
        <RiskNode {...(baseProps as unknown as NodeProps)} id="risk-1" data={{ label: 'Budget Overrun', type: 'risk' }} />
      </ReactFlowProvider>,
    )
    // A weighted edge, no recorded magnitude: the score is the only thing to say.
    expect(lodLine()).toContain('Strength')
  })

  /**
   * ⭐⭐ THE ARM THAT ACTUALLY DISPLACES A FIGURE — and the first cut of this file
   * did not reach it, which is worth recording because nothing looked wrong.
   *
   * Instrumenting the three fixtures showed what each really rendered:
   *
   *     strength_mean 0.4, no magnitude        → "Strength not set yet"
   *     strength_mean 0.4, magnitude 4 months  → "4 months"
   *     weightSource 'user', 0.4               → "Strength 40%"
   *
   * A producer-only `strength_mean` prints NO percentage — since 3 Sep only a
   * weight a HUMAN has settled prints a bare figure. So a test named "a WEIGHTED
   * edge" built on `strength_mean` was exercising the `pct == null` arm and the
   * genuine displacement — `Strength 40%` giving way to `4 months` — went
   * untested while the file read as if it covered it. *A test that passes on a
   * different object than the one it names.* This arm is the settled one.
   */
  it('a HUMAN-SETTLED strength — a real figure — still yields to the recorded magnitude', () => {
    vi.mocked(useCanvasStore).mockImplementation(sel =>
      sel(makeStoreState(modelWithBridge('risk-2', 'risk', 0.4, true)) as any),
    )
    render(
      <ReactFlowProvider>
        <RiskNode {...(baseProps as unknown as NodeProps)} id="risk-2" data={{ label: 'Delivery Slip', type: 'risk', ...RECORDED }} />
      </ReactFlowProvider>,
    )
    expect(lodLine()).toBe('4 months')
    // The discriminating half: it is not merely PRESENT, the score is ABSENT.
    // Without this the assertion would pass on any line that mentioned months.
    expect(lodLine()).not.toContain('Strength')
    expect(lodLine()).not.toContain('40%')
  })

  it('a producer-only strength (which prints no figure) also yields to it', () => {
    vi.mocked(useCanvasStore).mockImplementation(sel =>
      sel(makeStoreState(modelWithBridge('risk-2b', 'risk', 0.4)) as any),
    )
    render(
      <ReactFlowProvider>
        <RiskNode {...(baseProps as unknown as NodeProps)} id="risk-2b" data={{ label: 'Delivery Slip', type: 'risk', ...RECORDED }} />
      </ReactFlowProvider>,
    )
    expect(lodLine()).toBe('4 months')
    expect(lodLine()).not.toContain('Strength')
  })

  it('an UNWEIGHTED edge does not claim "not set yet" over a value that is set', () => {
    vi.mocked(useCanvasStore).mockImplementation(sel =>
      sel(makeStoreState({
        lodRung: 'line',
        nodes: [{ id: 'risk-3', type: 'risk', data: { type: 'risk' } }, { id: 'goal-1', data: { type: 'goal' } }],
        // An edge with NO strength stamp — the arm that produced the absence claim.
        edges: [{ id: 'e1', source: 'risk-3', target: 'goal-1', data: { direction: 'negative', beliefExists: null } }],
      }) as any),
    )
    render(
      <ReactFlowProvider>
        <RiskNode {...(baseProps as unknown as NodeProps)} id="risk-3" data={{ label: 'Delivery Slip', type: 'risk', ...RECORDED }} />
      </ReactFlowProvider>,
    )
    const line = lodLine()
    if (line !== null) {
      expect(line).not.toContain(METRIC_UNSET.inline)
      expect(line).toBe('4 months')
    }
  })

  /**
   * ⚠ THE OPPOSITE-DIRECTION TWIN (CLAUDE.md trap 22b). A precedence change that
   * closes one silent failure must be re-measured against the behaviour it was
   * NOT meant to touch, or it trades one for another and the suite applauds.
   * A risk with no magnitude of its own must be byte-identical to today.
   */
  it('a risk with nothing of its own still states the strength, unchanged', () => {
    vi.mocked(useCanvasStore).mockImplementation(sel =>
      sel(makeStoreState(modelWithBridge('risk-4', 'risk', 0.4, true)) as any),
    )
    render(
      <ReactFlowProvider>
        <RiskNode {...(baseProps as unknown as NodeProps)} id="risk-4" data={{ label: 'Budget Overrun', type: 'risk' }} />
      </ReactFlowProvider>,
    )
    expect(lodLine()).toContain('Strength')
  })
})
