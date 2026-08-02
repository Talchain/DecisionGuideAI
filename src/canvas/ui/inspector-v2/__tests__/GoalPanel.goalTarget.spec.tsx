/**
 * GoalPanel — the success-target sentence (ROADMAP 2.315(c), CEE #798 pair).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THE DEFECT: ONE SENTENCE, TWO WRITERS, TWO GATING DISCIPLINES
 * ─────────────────────────────────────────────────────────────────────────
 * The NUMBER in "Success means reaching ≥ …" comes from the store scalar
 * `goalThreshold`, written by `setCeeAnalysisReady` under a gate that refused
 * to overwrite ANY non-null value. The UNIT comes from
 * `node.data.goal_threshold_unit`, written by
 * `backfillGoalThresholdOntoGoalNode`, which is UNGATED.
 *
 * So a session that had already stored a BARE NORMALISED 0.8 kept that 0.8
 * while the unit was refreshed to '£' from a later, raw-bearing payload — and
 * the panel rendered "≥ 0.8 £". The canvas GoalNode was never affected
 * because it reads the number AND the unit from the same node.data, which is
 * precisely why the walk saw two different strings for one goal.
 *
 * Reachability is not hypothetical: `applyAnalysisReadyPatch`
 * (mirrorAnalysisReady) fires on every accepted graph_patch and calls exactly
 * these two writers, and `READINESS_CLEAR_FIELDS` clears none of the
 * threshold fields. This suite drives that REAL pair — not a hand-built store
 * state — so the sequence under test is the one the product performs.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * RED-first at pristine cb957c8c (signatures in the PR body)
 * ─────────────────────────────────────────────────────────────────────────
 *   1. the raw-supersedes-normalised case rendered "≥ 0.8 £"
 *   2. the good path rendered "≥ 800000 £" (bare number, unit as a suffix)
 *   3. the placeholder unit rendered "≥ 0.8 count"
 *
 * ─────────────────────────────────────────────────────────────────────────
 * SCOPE LIMIT (CLAUDE.md trap 3)
 * ─────────────────────────────────────────────────────────────────────────
 * jsdom pins the STRING the panel renders. It cannot prove the sentence is
 * visible, laid out, or above the fold. No claim here is a layout claim.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render } from '@testing-library/react'
import { GoalPanel } from '../panels/GoalPanel'
import { useCanvasStore } from '../../../store'
import { useAuth } from '../../../../contexts/AuthContext'
import { applyAnalysisReadyPatch } from '../../../conversation/utils/mirrorAnalysisReady'
import { formatGoalTarget } from '../../../../components/results/utils/formatGoalTarget'
import type { CEEAnalysisReady } from '../../../../adapters/cee/types'

vi.mock('../../../../contexts/AuthContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../contexts/AuthContext')>()
  return { ...actual, useAuth: vi.fn() }
})

const REAL_AUTH = { authenticated: true, user: { id: 'u-123', email: 'real@user.io' } }

const GOAL_NODE = {
  id: 'goal1',
  type: 'goal',
  position: { x: 0, y: 0 },
  data: { label: 'Grow annual revenue' },
}

/** A well-formed analysis_ready for the goal node above. */
function analysisReady(extra: Record<string, unknown>): CEEAnalysisReady {
  return {
    goal_node_id: 'goal1',
    options: [{ id: 'opt_a', label: 'Option A', status: 'ready', interventions: {} }],
    ...extra,
  } as CEEAnalysisReady
}

function seedCanvas() {
  useCanvasStore.getState().reset()
  useCanvasStore.setState({ nodes: [GOAL_NODE], edges: [], goalThreshold: null } as never)
}

function renderPanel() {
  return render(
    <GoalPanel nodeId="goal1" techMode={false} onClose={() => {}} onNavigate={() => {}} />,
  )
}

function panelText() {
  return renderPanel().container.textContent ?? ''
}

describe('GoalPanel — success target: the number and its unit must come from one payload', () => {
  beforeEach(() => {
    seedCanvas()
    vi.mocked(useAuth).mockReset()
    vi.mocked(useAuth).mockReturnValue(REAL_AUTH as unknown as ReturnType<typeof useAuth>)
  })

  it('control: the two writers really are what this suite drives (anti-vacuity)', () => {
    // Trap 13 — prove the sequence PRODUCES the split state before asserting
    // anything about how it renders. If either writer stops firing, this
    // control fails and every assertion below is known to be testing nothing.
    useCanvasStore.getState().setCeeAnalysisReady(analysisReady({ goal_threshold: 0.8 }))
    expect(useCanvasStore.getState().goalThreshold).toBe(0.8)
    expect(useCanvasStore.getState().goalThresholdRepresentation).toBe('normalised')

    applyAnalysisReadyPatch(
      {
        ceeAnalysisReady: analysisReady({
          goal_threshold: 0.8,
          goal_threshold_raw: 800000,
          goal_threshold_unit: '£',
          goal_threshold_cap: 1000000,
        }),
      },
      { patchId: 'p1', scenarioId: null },
    )
    // The UNIT writer is ungated — it lands regardless.
    const goal = useCanvasStore.getState().nodes.find(n => n.id === 'goal1')
    expect((goal?.data as Record<string, unknown>)?.goal_threshold_unit).toBe('£')
  })

  it('RED-first: a raw-bearing payload SUPERSEDES a stored bare-normalised target', () => {
    // The exact reachable sequence: a first turn stored a bare normalised 0.8;
    // a later accepted graph_patch carries the attested raw trio. Pristine
    // rendered "≥ 0.8 £" — a number on one scale wearing the other scale's unit.
    useCanvasStore.getState().setCeeAnalysisReady(analysisReady({ goal_threshold: 0.8 }))
    applyAnalysisReadyPatch(
      {
        ceeAnalysisReady: analysisReady({
          goal_threshold: 0.8,
          goal_threshold_raw: 800000,
          goal_threshold_unit: '£',
          goal_threshold_cap: 1000000,
        }),
      },
      { patchId: 'p1', scenarioId: null },
    )

    expect(useCanvasStore.getState().goalThreshold).toBe(800000)
    expect(useCanvasStore.getState().goalThresholdRepresentation).toBe('raw')

    const text = panelText()
    expect(text).toContain('Success means reaching ≥ £800,000')
    // The self-refuting pair must be gone, not merely joined by a better one.
    expect(text).not.toContain('0.8 £')
    expect(text).not.toContain('≥ 0.8')
  })

  it('RED-first: a raw target renders through the goal-target authority, not bare + suffix', () => {
    // Even on the good path the panel interpolated the number bare with the
    // unit as a trailing suffix: "≥ 800000 £".
    applyAnalysisReadyPatch(
      {
        ceeAnalysisReady: analysisReady({
          goal_threshold: 0.8,
          goal_threshold_raw: 800000,
          goal_threshold_unit: '£',
          goal_threshold_cap: 1000000,
        }),
      },
      { patchId: 'p1', scenarioId: null },
    )

    const text = panelText()
    expect(text).toContain('£800,000')
    expect(text).not.toContain('800000 £')
    // Structural: the panel defers to the ONE goal-target formatter rather
    // than hand-rolling a second rendering. The literal above pins what that
    // formatter must produce, so this cannot pass by both being wrong.
    expect(text).toContain(formatGoalTarget(800000, '£'))
  })

  it('RED-first: the "count" placeholder unit is SUPPRESSED, as the canvas card already does', () => {
    // `count` is the digit-string brief form's placeholder. It is a real unit
    // on no scale, and GoalNode (`u === 'count'`) and NodeInspector
    // (`unitStr !== 'count'`) both already drop it. Inspector v2 was the only
    // surface printing it.
    applyAnalysisReadyPatch(
      {
        ceeAnalysisReady: analysisReady({
          goal_threshold: 0.8,
          goal_threshold_raw: 800000,
          goal_threshold_unit: 'count',
          goal_threshold_cap: 1000000,
        }),
      },
      { patchId: 'p1', scenarioId: null },
    )

    const text = panelText()
    expect(text).toContain('Success means reaching ≥ 800,000')
    expect(text).not.toContain('count')
  })

  it('a target that is only ever NORMALISED renders WITHOUT a raw unit', () => {
    // Defence in depth for the split-brain: when CEE sends no raw at all, the
    // stored number is a 0-1 fraction and the node's unit describes the raw
    // scale. Pairing them is the very sentence this PR exists to kill, so the
    // panel refuses to decorate a normalised magnitude with a raw unit.
    useCanvasStore.getState().setCeeAnalysisReady(analysisReady({ goal_threshold: 0.8 }))
    applyAnalysisReadyPatch(
      { ceeAnalysisReady: analysisReady({ goal_threshold: 0.8, goal_threshold_unit: '£' }) },
      { patchId: 'p1', scenarioId: null },
    )

    expect(useCanvasStore.getState().goalThresholdRepresentation).toBe('normalised')
    const text = panelText()
    expect(text).toContain('Success means reaching ≥ 0.8')
    expect(text).not.toContain('0.8 £')
    expect(text).not.toContain('£0.8')
  })

  it('a user-committed target is never clobbered by a CEE raw payload', () => {
    // The widened gate keys on representation 'normalised', and the ONLY
    // writer of that tag is the CEE bare-sync itself. Every user/editor commit
    // goes through setGoalThresholdAndUpdateNode, which hard-codes 'raw'.
    useCanvasStore.getState().setGoalThresholdAndUpdateNode('goal1', 15, { unit: '£' })
    expect(useCanvasStore.getState().goalThresholdRepresentation).toBe('raw')

    applyAnalysisReadyPatch(
      {
        ceeAnalysisReady: analysisReady({
          goal_threshold: 0.8,
          goal_threshold_raw: 800000,
          goal_threshold_unit: '£',
          goal_threshold_cap: 1000000,
        }),
      },
      { patchId: 'p1', scenarioId: null },
    )

    expect(useCanvasStore.getState().goalThreshold).toBe(15)
    expect(panelText()).toContain('£15')
  })
})
