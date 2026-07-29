/**
 * ROADMAP 2.121 slice 1 — a Model-tab edit must be a REAL TURN, and must not
 * leave the two halves of a number disagreeing.
 *
 * THE DEFECT THIS PINS (audit: `docs-designs/MODEL-TAB-REDESIGN-2026-07-29.md`
 * §1.3). Every edit affordance on the Model tab wrote straight to the Zustand
 * store through a hand-rolled `updateNode` / `updateEdge` call:
 *
 *   1. NO VALUE EVER REACHED CEE. The only thing the wire saw was the generic
 *      debounced batch ping (`useGraphEditEvents` → `direct_graph_edit`), which
 *      carries one representative `target_id` + an operation and NO VALUES. This
 *      is the identical defect UI #513 / ROADMAP 1.346 closed for the inspector
 *      ("an inspector value edit used to terminate in the client store and emit
 *      nothing — live-probed: CEE's graph_hash byte-identical across a 10x
 *      edit"). The inspector got the fix; the Model tab never did, so the killed
 *      class was still live through a different door.
 *
 *   2. THE RAW/VALUE SPLIT-BRAIN. `handleRawValueSave` wrote
 *      `observedState.raw_value` WITHOUT recomputing `observedState.value` — the
 *      model-scale number the engine consumes. The card showed the new number;
 *      the analysis input kept the old one. A tester who "fixes" a number and
 *      re-runs gets an analysis that ignored the fix.
 *
 *   3. THE GOAL TARGET NEVER MOVED THE NUMBER THE RUN PATH FORWARDS.
 *      `GoalSection.handleThresholdSave` wrote `goal_threshold_raw` +
 *      `threshold_source: 'user'` and left both `success_threshold` and the
 *      global `goalThreshold` scalar untouched — while every OTHER success-target
 *      editor in the product (HeroSection, GoalThresholdEditor, PreAnalysisPanel,
 *      OutputsDock) commits through `setGoalThresholdAndUpdateNode`. Worse, the
 *      section's own display prefers `success_threshold` whenever
 *      `threshold_source === 'user'`, so stamping the source while leaving the
 *      number made a STALE value outrank the one the user just typed.
 *
 * WHY THESE ASSERTIONS AND NOT OTHERS. Each `it` below is either an assertion
 * that was RED against the raw handlers (the transport, the split-brain, the
 * goal scalar) or a control that stops the fix being satisfied by something
 * cheaper and wrong (the same-value negative control; the direction-preservation
 * control on edge weight, which a naive `setStrength(n)` would silently flip
 * positive). Nothing here hard-codes a scale: the model-scale expectation is
 * computed from the fixture's OWN cap through the canonical
 * `normaliseRawFactorValue`, so a fixture with a different scale still passes
 * for the right reason.
 *
 * The store is REAL here (not a `vi.mock`): the sanctioned mutation setters read
 * the element back out of `useCanvasStore.getState()`, so a mocked store would
 * prove the component calls a function and nothing about what lands.
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, vi } from 'vitest'
import { render, cleanup, fireEvent, screen } from '@testing-library/react'
import type { Node, Edge } from '@xyflow/react'

const sendSystemEvent = vi.fn()

// Trap 12 (the hand-maintained mirror): spread the real module rather than
// hand-listing its exports — a `vi.mock` factory REPLACES the module.
vi.mock('../../../conversation/ConversationContext', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    useOptionalConversationContext: () => ({ sendSystemEvent }),
  }
})

import { FactorsSection } from '../FactorsSection'
import { GoalSection } from '../GoalSection'
import { OptionsSection } from '../OptionsSection'
import { RelationshipsSection } from '../RelationshipsSection'
import { useCanvasStore } from '../../../store'
import { normaliseRawFactorValue } from '../../../utils/observedStateHelpers'

const FACTOR_ID = 'fac_monthly_eng_cost'
const CAP = 30000
const COMMITTED_RAW = 30000
const NEW_RAW = 20000

const NORM_FACTOR_ID = 'fac_market_receptivity'
const GOAL_ID = 'goal_arr'
const OPTION_ID = 'opt_premium'
const EDGE_ID = 'e_cost_to_goal'

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

/** A capped factor: `value` is MODEL scale (raw/cap), `raw_value` is user units. */
function cappedFactorNode(): Node {
  return {
    id: FACTOR_ID,
    type: 'factor',
    position: { x: 0, y: 0 },
    data: {
      label: 'Monthly Engineering Cost',
      kind: 'factor',
      category: 'observable',
      observedState: {
        value: COMMITTED_RAW / CAP,
        raw_value: COMMITTED_RAW,
        cap: CAP,
        unit: '£',
        baseline: 0.5,
        source: 'cee_inference',
      },
    },
  } as unknown as Node
}

/** An uncapped factor with no raw_value: the input shows the model-scale number. */
function normalisedFactorNode(): Node {
  return {
    id: NORM_FACTOR_ID,
    type: 'factor',
    position: { x: 0, y: 0 },
    data: {
      label: 'Market receptivity',
      kind: 'factor',
      category: 'observable',
      observedState: { value: 0.4, source: 'cee_inference' },
    },
  } as unknown as Node
}

function goalNode(): Node {
  return {
    id: GOAL_ID,
    type: 'goal',
    position: { x: 0, y: 0 },
    data: {
      label: 'Hit ARR target',
      kind: 'goal',
      goal_threshold_raw: 500000,
      goal_threshold_unit: '£',
      // The stale CEE number the section's own display prefers once
      // `threshold_source` flips to 'user'.
      success_threshold: 500000,
      threshold_source: 'cee_inference',
    },
  } as unknown as Node
}

function optionNode(): Node {
  return {
    id: OPTION_ID,
    type: 'option',
    position: { x: 0, y: 0 },
    data: {
      label: 'Premium-first',
      kind: 'option',
      interventions: { [FACTOR_ID]: 0.6 },
    },
  } as unknown as Node
}

/** A NEGATIVE edge — the control for the setStrength sign trap. */
function negativeEdge(): Edge {
  return {
    id: EDGE_ID,
    source: FACTOR_ID,
    target: GOAL_ID,
    data: {
      weight: 0.4,
      direction: 'negative',
      weightSource: 'cee',
      beliefExists: 0.8,
      beliefExistsSource: 'cee',
    },
  } as unknown as Edge
}

function seed() {
  useCanvasStore.setState(
    {
      nodes: [cappedFactorNode(), normalisedFactorNode(), goalNode(), optionNode()],
      edges: [negativeEdge()],
      goalThreshold: null,
      goalThresholdRepresentation: null,
      results: { status: 'idle', report: null },
    } as never,
    false,
  )
}

function nodeData(id: string): Record<string, unknown> {
  const n = useCanvasStore.getState().nodes.find(x => x.id === id)
  return (n?.data ?? {}) as Record<string, unknown>
}

function observed(id: string): Record<string, unknown> {
  return (nodeData(id).observedState ?? {}) as Record<string, unknown>
}

function edgeData(id: string): Record<string, unknown> {
  const e = useCanvasStore.getState().edges.find(x => x.id === id)
  return (e?.data ?? {}) as Record<string, unknown>
}

/** Commit through an InlineEdit: click the display chip, type, blur. */
function commitInline(testId: string, next: string) {
  fireEvent.click(screen.getByTestId(`${testId}-display`))
  const input = screen.getByTestId(testId)
  fireEvent.change(input, { target: { value: next } })
  fireEvent.blur(input)
}

describe('Model-tab edits are real turns (ROADMAP 2.121 slice 1)', () => {
  beforeEach(() => {
    sendSystemEvent.mockClear()
    seed()
  })
  afterEach(() => cleanup())

  // ── 1. THE TRANSPORT ────────────────────────────────────────────────────

  it('a factor value commit EMITS a factor_value_edit turn (raw-value input)', () => {
    render(<FactorsSection factorNodes={[cappedFactorNode()]} />)
    commitInline(`factor-${FACTOR_ID}-raw-value`, String(NEW_RAW))

    // RED before the fix: the handler called updateNode and emitted nothing.
    expect(sendSystemEvent).toHaveBeenCalledTimes(1)
    expect(sendSystemEvent.mock.calls[0][0].type).toBe('factor_value_edit')
  })

  it('the emitted turn is ID-ADDRESSED and carries the scale contract', () => {
    render(<FactorsSection factorNodes={[cappedFactorNode()]} />)
    commitInline(`factor-${FACTOR_ID}-raw-value`, String(NEW_RAW))

    const payload = sendSystemEvent.mock.calls[0][0].payload
    expect(payload.target_id).toBe(FACTOR_ID)
    expect(payload.target_id).not.toBe('Monthly Engineering Cost')
    expect(payload.field).toBe('value')
    // raw_value is the USER-UNIT magnitude exactly as typed; value is MODEL
    // scale, derived from THIS fixture's own cap — never a hard-coded bound.
    expect(payload.raw_value).toBe(NEW_RAW)
    expect(payload.unit).toBe('£')
    expect(payload.value).toBe(normaliseRawFactorValue(NEW_RAW, CAP))
    expect(payload.value).not.toBe(NEW_RAW)
  })

  it('a normalised-value commit emits a turn with no fabricated user-unit magnitude', () => {
    render(<FactorsSection factorNodes={[normalisedFactorNode()]} />)
    commitInline(`factor-${NORM_FACTOR_ID}-value`, '0.7')

    expect(sendSystemEvent).toHaveBeenCalledTimes(1)
    const payload = sendSystemEvent.mock.calls[0][0].payload
    expect(payload.target_id).toBe(NORM_FACTOR_ID)
    expect(payload.value).toBe(0.7)
    // Absence is meaningful in the contract: the client did not state a
    // magnitude, so the server derives one. Never a zero-ish default.
    expect(payload.raw_value).toBeUndefined()
  })

  it('NEGATIVE CONTROL: re-committing the SAME value emits nothing', () => {
    render(<FactorsSection factorNodes={[cappedFactorNode()]} />)
    commitInline(`factor-${FACTOR_ID}-raw-value`, String(COMMITTED_RAW))

    expect(sendSystemEvent).not.toHaveBeenCalled()
  })

  // ── 2. THE SPLIT-BRAIN ──────────────────────────────────────────────────

  it('a raw-value commit updates BOTH halves of the number, atomically', () => {
    render(<FactorsSection factorNodes={[cappedFactorNode()]} />)
    commitInline(`factor-${FACTOR_ID}-raw-value`, String(NEW_RAW))

    const obs = observed(FACTOR_ID)
    // RED before the fix: raw_value moved to 20000 while value stayed at
    // 30000/30000 = 1 — the card said one thing, the engine input another.
    expect(obs.raw_value).toBe(NEW_RAW)
    expect(obs.value).toBe(normaliseRawFactorValue(NEW_RAW, CAP))
  })

  it('a value commit still stamps the value as user-sourced', () => {
    render(<FactorsSection factorNodes={[cappedFactorNode()]} />)
    commitInline(`factor-${FACTOR_ID}-raw-value`, String(NEW_RAW))

    // The provenance pill and the "N to verify" count both key off this.
    expect(observed(FACTOR_ID).source).toBe('user')
  })

  it('ONE store write per committed edit (one undo step, one invalidation)', () => {
    const spy = vi.spyOn(useCanvasStore.getState(), 'updateNode')
    render(<FactorsSection factorNodes={[cappedFactorNode()]} />)
    commitInline(`factor-${FACTOR_ID}-raw-value`, String(NEW_RAW))

    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })

  // ── 3. THE GOAL TARGET ──────────────────────────────────────────────────

  it('a goal-target commit moves the number the run path forwards', () => {
    render(<GoalSection goalNode={goalNode()} />)
    commitInline('goal-threshold', '600000')

    const data = nodeData(GOAL_ID)
    // RED before the fix: threshold_source flipped to 'user' while
    // success_threshold kept the stale 500000 — and the section's own display
    // prefers success_threshold under a 'user' source, so the edit was
    // invisible AND the global scalar never moved.
    expect(data.threshold_source).toBe('user')
    expect(data.success_threshold).toBe(600000)
    expect(useCanvasStore.getState().goalThreshold).toBe(600000)
  })

  // ── 4. OPTIONS ──────────────────────────────────────────────────────────

  it('an intervention-target commit lands on the option through the sanctioned setter', () => {
    render(
      <OptionsSection
        optionNodes={[optionNode()]}
        allNodes={[optionNode(), cappedFactorNode()]}
        isExpanded
      />,
    )
    commitInline(`intervention-${OPTION_ID}-${FACTOR_ID}`, '0.9')

    const interventions = nodeData(OPTION_ID).interventions as Record<string, unknown>
    expect(interventions[FACTOR_ID]).toBe(0.9)
  })

  // ── 5. RELATIONSHIPS ────────────────────────────────────────────────────

  it('an edge weight commit preserves the edge DIRECTION (setStrength sign control)', () => {
    render(
      <RelationshipsSection
        edges={[negativeEdge()]}
        nodes={[cappedFactorNode(), goalNode()]}
        isExpanded
      />,
    )
    fireEvent.click(screen.getByTestId(`edge-${EDGE_ID}-summary`))
    commitInline(`edge-${EDGE_ID}-weight`, '0.9')

    const data = edgeData(EDGE_ID)
    expect(data.weight).toBe(0.9)
    // A naive `setStrength(0.9)` derives direction from the SIGN of its
    // argument and would silently flip this negative edge positive.
    expect(data.direction).toBe('negative')
    expect(data.weightSource).toBe('user')
  })

  it('a likelihood commit writes the belief and stamps its provenance', () => {
    render(
      <RelationshipsSection
        edges={[negativeEdge()]}
        nodes={[cappedFactorNode(), goalNode()]}
        isExpanded
      />,
    )
    fireEvent.click(screen.getByTestId(`edge-${EDGE_ID}-summary`))
    commitInline(`edge-${EDGE_ID}-likelihood`, '55')

    const data = edgeData(EDGE_ID)
    expect(data.beliefExists).toBeCloseTo(0.55, 10)
    expect(data.beliefExistsSource).toBe('user')
  })

  it('a direction toggle writes the direction', () => {
    render(
      <RelationshipsSection
        edges={[negativeEdge()]}
        nodes={[cappedFactorNode(), goalNode()]}
        isExpanded
      />,
    )
    fireEvent.click(screen.getByTestId(`edge-${EDGE_ID}-summary`))
    fireEvent.click(screen.getByTestId(`edge-${EDGE_ID}-dir-positive`))

    expect(edgeData(EDGE_ID).direction).toBe('positive')
  })
})
