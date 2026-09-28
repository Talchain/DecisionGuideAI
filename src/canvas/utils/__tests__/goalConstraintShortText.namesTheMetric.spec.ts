/**
 * ⭐ THE GOAL'S BOUNDARY PILL NAMES THE METRIC — `<metric> <op><value>`
 * (canvas side-by-side vs contract v3.1, item 8, 27 Sep 2026).
 *
 * Contract `.pill.mini`: `Churn <4%`. The pricing-model starter's Goal pill read
 * `net revenue retention floor ≥110%` — the constraint's own lower-case label,
 * with a role word restating the operator (~179px). On Paul's MRR boards it
 * already read `Monthly churn ≤4%` (post-run side-by-side: "like the contract's
 * `Churn <4%`"), because there the label and the factor's title are one string.
 *
 * The subject is now the constrained element's own title when the limit binds
 * to a measure; a limit on the GOAL node keeps its carried label. The full
 * sentence (the pill's accessible name and tooltip) is unchanged.
 *
 * ⚠ REAL BYTES: the constraint rows and node titles are read from the shipped
 * starters and the e2e geometry fixture, not written here.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import pricingStarter from '../../starters/data/pricing-model.draft.json'
import headcountStarter from '../../starters/data/headcount-allocation.draft.json'
import { goalConstraintShortText, goalConstraintText } from '../goalConstraintText'
import type { CEEGoalConstraint } from '../../../adapters/cee/types'

type StarterNode = { id: string; kind?: string; label?: string }
/** The runtime store shape (`data.label`, `type`), as `backfill` lands it. */
const storeNodes = (nodes: StarterNode[]) =>
  nodes.map((n) => ({ id: n.id, type: n.kind, data: { label: n.label, kind: n.kind } }))

const pricing = pricingStarter as unknown as { nodes: StarterNode[]; goal_constraints: CEEGoalConstraint[] }
const headcount = headcountStarter as unknown as { nodes: StarterNode[]; goal_constraints: CEEGoalConstraint[] }
const mrr = JSON.parse(readFileSync(resolve(__dirname, '../../../../e2e/geometry/fixtures/mrr-90b8f080.fixture.json'), 'utf8')) as {
  draft: { nodes: Array<{ id: string; kind?: string; type?: string; label?: string }>; goal_constraints: CEEGoalConstraint[] }
}

describe('goalConstraintShortText — the pill is `<metric> <op><value>`', () => {
  it('pricing-model starter: "Net Revenue Retention ≥110%", not the lower-case label with its role word', () => {
    const row = pricing.goal_constraints.find((c) => c.constraint_id === 'constraint_out_nrr_min')!
    // Provenance pin: the starter still carries the long label on an outcome node.
    expect(row.label).toBe('net revenue retention floor')
    expect(row.node_id).toBe('out_nrr')
    const nodes = storeNodes(pricing.nodes)
    expect(goalConstraintShortText(row, nodes)).toBe('Net Revenue Retention ≥110%')
    expect(goalConstraintShortText(row, nodes)).not.toContain('floor')
    // The full sentence (accessible name, tooltip) keeps the producer's label.
    expect(goalConstraintText(row, nodes)).toBe('net revenue retention floor ≥ 110%')
  })

  it("CONTROL — Paul's MRR board already matched and is unchanged: \"Monthly churn ≤4%\"", () => {
    const row = mrr.draft.goal_constraints[0]
    const nodes = mrr.draft.nodes.map((n) => ({ id: n.id, type: n.kind ?? n.type, data: { label: n.label } }))
    expect(goalConstraintShortText(row, nodes)).toBe('Monthly churn ≤4%')
  })

  it('CONTROL — a limit on the GOAL node keeps its carried label (a goal title is not a metric)', () => {
    const row = headcount.goal_constraints.find((c) => c.constraint_id === 'constraint_goal_arr_max')!
    const nodes = storeNodes(headcount.nodes)
    expect(goalConstraintShortText(row, nodes)).toBe('Delivery deadline ≤2 months · Inferred limit')
    expect(goalConstraintShortText(row, nodes)).not.toContain('Achieve ARR Growth')
  })

  it('CONTROL — with no graph to read (the Analysis tab\'s brief bar) the carried label stands', () => {
    const row = pricing.goal_constraints.find((c) => c.constraint_id === 'constraint_out_nrr_min')!
    expect(goalConstraintShortText(row)).toBe('net revenue retention floor ≥110%')
  })

  it('the origin suffix is never dropped when the subject changes', () => {
    const row = { ...pricing.goal_constraints[0], provenance: 'inferred' } as CEEGoalConstraint
    expect(goalConstraintShortText(row, storeNodes(pricing.nodes))).toBe('Net Revenue Retention ≥110% · Inferred limit')
  })
})
