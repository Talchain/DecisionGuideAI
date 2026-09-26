/**
 * Starter goal targets — the normalised threshold must be the one CEE's contract
 * defines, or the first model a colleague opens asks the engine a question
 * nobody stated.
 *
 * THE CONTRACT (CEE `src/utils/goal-threshold-cap.ts`, `analysis-ready.ts`
 * schema): `goal_threshold` is NORMALISED, `goal_threshold = raw / cap`, and it
 * lives in [0, 1]. The user's own figure rides separately in
 * `goal_threshold_raw` + `goal_threshold_unit`.
 *
 * WHAT SHIPPED. The `pricing-model` capture (CEE cb54320, 2026-07-28) carried
 * `goal_threshold: 1.1` beside `raw 110 · unit '%' · cap 140` — i.e. raw/100,
 * not raw/cap (0.7857), and outside [0, 1]. Nothing between the canvas and the
 * engine corrects it: the UI registers node data verbatim
 * (`buildRegistrationGraph`), CEE's register route persists it verbatim, and
 * PLoT's degenerate-threshold guard (`run.ts` 2.239-G, `>= 1`) then drops it
 * before ISL, so the run returns NO goal probability and NO reason for its
 * absence. The goal card still read "Target: 110%", so nothing on screen
 * disagreed with the defect.
 *
 * ⚠ BOUND BY IDENTITY, NOT BY A PREDICATE ANOTHER NODE COULD SATISFY. The
 * pricing assertions name the goal node id and label; the coverage pin names the
 * starters that carry a goal target, so the per-starter checks cannot go vacuous
 * by a recapture that drops the fields.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import type { Edge, Node } from '@xyflow/react'
import { STARTERS, loadStarterPayload, applyStarter } from '../loadStarter'
import { useCanvasStore } from '../../store'
import { buildRegistrationGraph } from '../../registration/buildRegistrationGraph'
import { resolveGoalTarget } from '../../domain/goalTarget'

interface GoalFields {
  id: string
  kind: string
  label: string
  goal_threshold?: number
  goal_threshold_raw?: number
  goal_threshold_unit?: string
  goal_threshold_cap?: number
  goal_threshold_cap_provenance?: string
  goal_threshold_frame?: string
}

interface DraftFixture {
  nodes: GoalFields[]
  analysis_ready?: { goal_node_id?: string; goal_threshold?: number }
}

/**
 * The three rules CEE's resolver can name (`GOAL_THRESHOLD_CAP_PROVENANCE`,
 * goal-threshold-cap.ts:46-53 @ CEE 9c16e8c). Test-local on purpose: the UI's
 * pinned `@talchain/schemas` 0.55.0 does not carry the field, so there is no
 * shared constant to import. A value outside this list is a typo, not a rule.
 */
const CEE_CAP_PROVENANCE = ['metric_scale', 'inherited', 'target_derived_headroom'] as const

const TOLERANCE = 1e-9

async function goalOf(id: string): Promise<{ fixture: DraftFixture; goal: GoalFields }> {
  const fixture = (await loadStarterPayload(id)) as DraftFixture
  const goals = fixture.nodes.filter((n) => n.kind === 'goal')
  expect(goals, `${id}: exactly one goal node`).toHaveLength(1)
  return { fixture, goal: goals[0] }
}

describe('starter goal thresholds are the normalised level CEE defines', () => {
  it('the starters carrying a goal target are exactly the known two (the checks below cannot go vacuous)', async () => {
    const carrying: string[] = []
    for (const s of STARTERS) {
      const { goal } = await goalOf(s.id)
      if (typeof goal.goal_threshold === 'number') carrying.push(s.id)
    }
    expect(carrying.sort()).toEqual(['market-entry', 'pricing-model'])
  })

  describe.each(STARTERS.map((s) => [s.id] as const))('%s', (id) => {
    it('goal_threshold lies in [0, 1]', async () => {
      const { goal } = await goalOf(id)
      if (goal.goal_threshold === undefined) return
      expect(Number.isFinite(goal.goal_threshold)).toBe(true)
      expect(goal.goal_threshold).toBeGreaterThanOrEqual(0)
      expect(goal.goal_threshold).toBeLessThanOrEqual(1)
    })

    it('goal_threshold equals raw / cap when all three are present', async () => {
      const { goal } = await goalOf(id)
      const { goal_threshold: t, goal_threshold_raw: raw, goal_threshold_cap: cap } = goal
      if (typeof t !== 'number' || typeof raw !== 'number' || typeof cap !== 'number') return
      expect(Math.abs(t - raw / cap), `${id}: ${t} vs ${raw}/${cap}`).toBeLessThan(TOLERANCE)
    })

    it('the analysis_ready mirror carries the SAME threshold as the goal node', async () => {
      const { fixture, goal } = await goalOf(id)
      const mirror = fixture.analysis_ready?.goal_threshold
      if (mirror === undefined && goal.goal_threshold === undefined) return
      expect(fixture.analysis_ready?.goal_node_id).toBe(goal.id)
      expect(mirror).toBe(goal.goal_threshold)
    })

    it('a cap provenance, when present, describes the cap it sits beside', async () => {
      const { goal } = await goalOf(id)
      const provenance = goal.goal_threshold_cap_provenance
      if (provenance === undefined) return
      expect(CEE_CAP_PROVENANCE).toContain(provenance)
      expect(typeof goal.goal_threshold_cap, 'a provenance never rides without its cap').toBe('number')
      if (provenance === 'target_derived_headroom') {
        expect(Math.abs(goal.goal_threshold_cap! - goal.goal_threshold_raw! * 1.25)).toBeLessThan(TOLERANCE)
      }
      if (provenance === 'metric_scale') {
        expect(goal.goal_threshold_unit).toBe('%')
        expect(goal.goal_threshold_cap).toBe(100)
      }
      // raw / cap is an absolute LEVEL on the metric's own scale — never a change.
      if (goal.goal_threshold_frame !== undefined) expect(goal.goal_threshold_frame).toBe('level')
    })
  })
})

describe('pricing-model — the canonical example’s goal', () => {
  it('keeps the user’s stated target (110 %) and carries a coherent normalised level beside it', async () => {
    const { fixture, goal } = await goalOf('pricing-model')
    expect(goal.id).toBe('goal_pricing_transition')
    expect(goal.label).toBe('Achieve NRR Above 110% While Enabling Bottom-Up Adoption')
    // The figure the user stated is untouched — only the normalisation moves.
    expect(goal.goal_threshold_raw).toBe(110)
    expect(goal.goal_threshold_unit).toBe('%')
    // CEE resolver rule 3: a '%' target above 100 takes a 25% headroom cap.
    expect(goal.goal_threshold_cap).toBe(137.5)
    expect(goal.goal_threshold_cap_provenance).toBe('target_derived_headroom')
    expect(goal.goal_threshold).toBe(110 / 137.5)
    expect(goal.goal_threshold_frame).toBe('level')
    expect(fixture.analysis_ready?.goal_threshold).toBe(110 / 137.5)
  })
})

describe('pricing-model — the bytes the canvas registers with CEE', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    useCanvasStore.setState({ nodes: [] as never, edges: [] as never })
  })

  it('the goal node in the /graph/register body is coherent, and the card still states 110 %', async () => {
    await applyStarter('pricing-model')
    const { nodes, edges } = useCanvasStore.getState()
    // Precondition pinned in-test: a projection over an empty store would pass.
    expect(nodes.length).toBe(STARTERS.find((s) => s.id === 'pricing-model')!.nodeCount)

    const projected = buildRegistrationGraph(nodes as Node[], edges as Edge[])
    expect(projected.ok).toBe(true)
    if (!projected.ok) return
    const wireGoal = projected.graph.nodes.find((n) => n.id === 'goal_pricing_transition') as
      | (GoalFields & Record<string, unknown>)
      | undefined
    expect(wireGoal, 'the goal node reaches the register body').toBeDefined()
    expect(wireGoal!.kind).toBe('goal')

    const t = wireGoal!.goal_threshold!
    expect(t).toBeGreaterThanOrEqual(0)
    expect(t).toBeLessThanOrEqual(1)
    expect(Math.abs(t - wireGoal!.goal_threshold_raw! / wireGoal!.goal_threshold_cap!)).toBeLessThan(TOLERANCE)
    expect(wireGoal!.goal_threshold_cap_provenance).toBe('target_derived_headroom')
    expect(wireGoal!.goal_threshold_frame).toBe('level')

    // What the goal card renders is read from raw + unit, and must not move.
    // ⭐ DESIGN-GAP-v31 #22 (26 Sep, WS4): the starter carries no
    // `threshold_source`, so its origin is 'unrecorded' ("Source not recorded"),
    // never asserted as the brief — the figure itself is unchanged.
    const storeGoal = nodes.find((n) => n.id === 'goal_pricing_transition')!
    expect(resolveGoalTarget(storeGoal.data as never)).toEqual({ raw: 110, unit: '%', source: 'unrecorded' })
  })
})
