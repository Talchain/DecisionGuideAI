/**
 * ⭐ THE GOAL TARGET'S MARK ON PAUL'S REAL MRR BOARD (post-run side-by-side,
 * DIFF item 6): `Target: 100,000 GBP MRR · no source`, although the goal node
 * carries `provenance: 'from_brief'` and `observed_state.source:
 * 'brief_extraction'`.
 *
 * ⛔ THE BRIEF STAMP ON THIS NODE IS THE CURRENT LEVEL'S, NOT THE TARGET'S.
 * Read at the producer (CEE `ce4af04a`, local clone, not the served build):
 *   · agent lane, `orchestrator-v5/agent-lane/admit-model.ts` (goal entity):
 *     `observed_state` is `{ value: B, baseline: B, source: 'brief_extraction',
 *     raw_value: <current level>, cap }`, written only when the brief states the
 *     goal's CURRENT level, and gated on `(baseline_provenance ?? provenance)
 *     === 'explicit'` — a provenance of its own, separate from the target's;
 *   · draft path, `cee/transforms/schema-v3.ts` goal limb: the same object,
 *     `source: "brief_extraction"` a code constant on `goal_baseline`;
 *   · CEE's own warrant table (`schemas/value-warrant-guard.ts`): the goal
 *     target's warrant is `threshold_source`, for `success_threshold` only, and
 *     "CEE's own target stays `goal_threshold_raw` with its unit" — unstamped.
 * On this node that stamp describes 75,000 (Paul's "[Currently 75k]"), and the
 * card prints 100,000. Marking the 100,000 `brief` from it would be a UI-asserted
 * origin (DESIGN-GAP-v31 #22 A2, `goalTarget.ts`), and the same record shape is
 * produced for a target Olumi inferred beside a current level the brief stated.
 *
 * ⛔ NOR FROM THE NODE'S `from_brief`. It is the goal RECORD's stamp, and it
 * outlives the figure: measured #63 5811781699, a `from_brief` goal carried
 * `goal_threshold_raw: 0` that its brief never stated; and in the UI the expert
 * "Raw threshold" field (`GoalAdvancedEditor` → `setThreshold`) and
 * `applyV5State`'s add_constraint mirror both rewrite `goal_threshold_raw` and
 * leave `provenance` as it was. A `from_brief` rule would credit those figures
 * to the brief.
 *
 * Paul's brief DOES state £100k ("reaching £100k MRR within 12 months
 * [Currently 75k]", export 90b8f080 `user_text`). So `brief` is true here, but
 * nothing on the node proves it. The gap is the producer's (DESIGN-GAP-STATUS
 * 25 Sep, D3: "CEE never stamps `threshold_source`"), and it is routed there.
 * `threshold_source` is the contracted carrier (@talchain/schemas J2: "the same
 * class as observed_state.source"). Once CEE stamps it, the card classifies it
 * with `classifyValueProvenance`, and the "no source" pins below flip.
 *
 * Bound by IDENTITY on the real export's goal node (`mrr`), mapped through the
 * real draft adapter (`mapDraftNodeToCanvas`), read by its node-scoped test id
 * and `data-value-source`.
 *
 * CLAIM SCOPE: jsdom proves DOM text/attributes only, never layout.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import fixture from '../../../../e2e/geometry/fixtures/mrr-90b8f080.fixture.json'
import { GoalNode } from '../GoalNode'
import { mapDraftNodeToCanvas } from '../../utils/applyDraftResult'
import { resolveGoalTarget, type GoalTargetSource } from '../../domain/goalTarget'
import {
  factorValueSourceMark,
  goalTargetSourceMark,
  VALUE_SOURCE_MARK_LABEL,
  VALUE_SOURCE_MARK_TOKEN,
} from '../shared/valueSourceMark'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})
vi.mock('../shared/openModelValueEditor', () => ({ openModelValueEditor: vi.fn() }))

const makeStoreState = () => ({
  results: { status: 'idle', report: null },
  highlightedNodes: new Set(), dimmedNodeIds: new Set(), lens: { _dimmedNodeIds: new Set() },
  goalThreshold: null, goalConstraints: [], nodes: [], edges: [],
  ceeAnalysisReady: null, viewMode: 'expert',
})
vi.mock('../../store', () => {
  const useCanvasStore = vi.fn((selector: (s: unknown) => unknown) => selector(makeStoreState()))
  ;(useCanvasStore as unknown as { getState: () => unknown }).getState = () => makeStoreState()
  return { useCanvasStore }
})
vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null, influence: null, confidence: null, inSensitivityAnalysis: false,
    achievementProbability: null, stabilityPercentage: null, winRate: null, isResultsMode: false,
    predictedOutcome: null, valueOfInformation: null, voiRank: null,
  })),
}))

type WireNode = { id: string; kind: string } & Record<string, unknown>
const WIRE_GOAL = (fixture.draft.nodes as WireNode[]).find((n) => n.id === 'mrr')!
const MAPPED = mapDraftNodeToCanvas(WIRE_GOAL) as { id: string; data: Record<string, unknown> }

function renderGoal(id: string, data: Record<string, unknown>) {
  return render(
    <ReactFlowProvider>
      <GoalNode id={id} type="goal" data={{ type: 'goal', ...data } as never} selected={false} isConnectable
        positionAbsoluteX={0} positionAbsoluteY={0} dragging={false} zIndex={0} deletable selectable draggable />
    </ReactFlowProvider>,
  )
}

afterEach(() => cleanup())

describe('real MRR board (90b8f080): the goal target mark reads only a stamp on the target', () => {
  it('FIXTURE GUARD: the brief stamp on the goal describes the current level (75,000), not the target (100,000)', () => {
    expect(MAPPED.id).toBe('mrr')
    expect(WIRE_GOAL.kind).toBe('goal')
    expect(WIRE_GOAL.provenance).toBe('from_brief')
    const obs = MAPPED.data.observedState as Record<string, unknown>
    expect(obs.source).toBe('brief_extraction')
    expect(obs.raw_value).toBe(75000)
    expect(MAPPED.data.goal_threshold_raw).toBe(100000)
    expect(MAPPED.data.threshold_source).toBeUndefined()
    expect(MAPPED.data.success_threshold).toBeUndefined()
  })

  it('POSITIVE CONTROL: the classifier sees that brief stamp where it belongs (the value it is on)', () => {
    // The same rule the factor card uses, over the same mapped record, reads
    // `brief`. So a `no source` on the target is not a probe that cannot see it.
    expect(factorValueSourceMark(MAPPED.data)?.kind).toBe('brief')
  })

  it('the card marks the 100,000 target "no source" — never "brief" from the current level\'s stamp', () => {
    const { container } = renderGoal(MAPPED.id, MAPPED.data)
    expect(container.querySelector('[data-testid="goal-node-resting-state"]')?.textContent ?? '').toMatch(/Target:/)
    const m = container.querySelector('[data-testid="goal-target-source-mrr"]')
    expect(m, 'the target line must carry a source mark').not.toBeNull()
    expect(m!.getAttribute('data-value-source')).toBe('unknown')
    expect(m!.querySelector('[role="img"]')!.getAttribute('aria-label')).toBe(VALUE_SOURCE_MARK_TOKEN.unknown)
    expect(m!.querySelector('.sr-only')!.textContent).toBe(VALUE_SOURCE_MARK_LABEL.unknown)
    // One authority: the resolver every surface reads gives the same answer.
    expect(resolveGoalTarget(MAPPED.data as GoalTargetSource)?.source).toBe('unrecorded')
  })

  it('the SAME record shape with an Olumi-inferred target is not marked "brief" either', () => {
    // Agent lane, admit-model.ts: goal `provenance: 'inferred'` (node
    // `ai_inferred`) with `baseline_provenance: 'explicit'` writes exactly this
    // observed_state. A rule keyed on `observed_state.source` cannot tell this
    // target from Paul's, and would credit Olumi's figure to the user's brief.
    const inferredTarget = { ...MAPPED.data, provenance: 'ai_inferred' }
    expect(goalTargetSourceMark(inferredTarget as GoalTargetSource).kind).toBe('unknown')
  })

  it('CONTRAST: a target the user set on this goal reads as theirs', () => {
    const data = { ...MAPPED.data, threshold_source: 'user', success_threshold: 120000 }
    const { container } = renderGoal(MAPPED.id, data)
    const m = container.querySelector('[data-testid="goal-target-source-mrr"]')
    expect(m?.getAttribute('data-value-source')).toBe('you')
    expect(m?.querySelector('.sr-only')?.textContent).toBe(VALUE_SOURCE_MARK_LABEL.you)
    expect(container.querySelector('[data-testid="goal-node-resting-state"]')?.textContent ?? '').toMatch(/120/)
  })
})
