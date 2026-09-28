/**
 * ⛔ A DELETE THAT TAKES AN OPTION'S CHANGE WITH IT MUST ASK FIRST
 * (canvas audit edit-structure/F6, 27 Sep 2026).
 *
 * Served on build-vs-buy: click "In-House Build Approach", press Delete. No
 * question; `structural_delete` removed the card "along with 4 connections",
 * and the "Build In-House Metering and Invoicing" option's change for that
 * factor (value 1, from the brief) went with it — its hidden-row count dropped
 * from "+2 more" to "+1 more". There is no Undo on the canvas.
 *
 * The owners' rule is kept: ask only when the removal damages something ELSE
 * (`deleteAction`'s "ONE DELETE QUESTION"). What was missing is that an option
 * losing one of its changes IS damage to something else. `assessNodeDeletion`
 * counted lost goal paths, orphaned cards and the last goal/decision, never an
 * option → factor change.
 *
 * Both starters are read from their shipped draft JSON, projected the way the
 * guardrails read a canvas (`type` = kind, `source`/`target` = from/to), so the
 * ids and labels below are the served ones.
 *
 * CONTRAST (EDITABILITY-MATRIX-20260924 row 181, a witnessed PASS): the
 * pricing-model risk card no option targets still deletes at once.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Edge, Node } from '@xyflow/react'

import buildVsBuy from '../../starters/data/build-vs-buy.draft.json'
import pricingModel from '../../starters/data/pricing-model.draft.json'
import {
  assessEdgeDeletion,
  assessNodeDeletion,
  buildDeletionMessage,
  isSignificantImpact,
} from '../graphGuardrails'
import { useCanvasStore } from '../../store'
import { useConfirmDialogStore } from '../../stores/confirmDialogStore'
import { deleteAction } from '../../contextMenu/actions'

interface DraftNode { id: string; kind: string; label: string; interventions?: Record<string, unknown> }
interface DraftEdge { from: string; to: string }
interface Draft { nodes: DraftNode[]; edges: DraftEdge[] }

function project(draft: Draft): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes: draft.nodes.map((n) => ({
      id: n.id,
      type: n.kind,
      position: { x: 0, y: 0 },
      data: { label: n.label, kind: n.kind, ...(n.interventions ? { interventions: n.interventions } : {}) },
    })),
    edges: draft.edges.map((e, i) => ({ id: `e${i}`, source: e.from, target: e.to, data: {} })),
  }
}

const BVB = project(buildVsBuy as unknown as Draft)
const PRICING = project(pricingModel as unknown as Draft)

const BUILD_FACTOR = 'fac_build_indicator'
const BUILD_FACTOR_LABEL = 'In-House Build Approach'
const BUILD_OPTION = 'opt_build'
const BUILD_OPTION_LABEL = 'Build In-House Metering and Invoicing'
const PRICING_RISK = 'risk_pricing_complexity'

const labelOf = (g: { nodes: Node[] }, id: string) =>
  (g.nodes.find((n) => n.id === id)?.data as { label: string }).label

describe('PRECONDITIONS — the served ids and labels, and the shipped change', () => {
  it('build-vs-buy: the option holds a change for the factor, carried by an option → factor link', () => {
    expect(labelOf(BVB, BUILD_FACTOR)).toBe(BUILD_FACTOR_LABEL)
    expect(labelOf(BVB, BUILD_OPTION)).toBe(BUILD_OPTION_LABEL)
    expect(BVB.edges.some((e) => e.source === BUILD_OPTION && e.target === BUILD_FACTOR)).toBe(true)
    const interventions = (BVB.nodes.find((n) => n.id === BUILD_OPTION)!.data as { interventions: Record<string, unknown> }).interventions
    expect(Object.keys(interventions)).toContain(BUILD_FACTOR)
  })

  it('build-vs-buy: before this fix the removal was NOT significant by any older measure', () => {
    // So the question the test asks is exactly the missing one — not a lost goal
    // path or an orphan that would have asked anyway.
    const impact = assessNodeDeletion(BVB.nodes, BVB.edges, BUILD_FACTOR)
    expect(impact.disconnectsOptions).toEqual([])
    expect(impact.orphansNodes).toEqual([])
    expect(impact.removesLastGoal).toBe(false)
    expect(impact.removesLastDecision).toBe(false)
  })

  it('pricing-model: no option links to the risk card', () => {
    expect(PRICING.nodes.some((n) => n.id === PRICING_RISK)).toBe(true)
    expect(PRICING.edges.some((e) => e.target === PRICING_RISK && PRICING.nodes.find((n) => n.id === e.source)?.type === 'option')).toBe(false)
  })
})

describe('assessNodeDeletion names every option that loses a change', () => {
  it('deleting "In-House Build Approach" costs two options their change, and that is significant', () => {
    const impact = assessNodeDeletion(BVB.nodes, BVB.edges, BUILD_FACTOR)
    expect((impact.dropsOptionChanges ?? []).map((c) => c.optionId).sort()).toEqual([BUILD_OPTION, 'opt_status_quo'])
    expect((impact.dropsOptionChanges ?? []).find((c) => c.optionId === BUILD_OPTION)).toEqual({
      optionId: BUILD_OPTION,
      optionLabel: BUILD_OPTION_LABEL,
      targetId: BUILD_FACTOR,
      targetLabel: BUILD_FACTOR_LABEL,
    })
    expect(isSignificantImpact(impact)).toBe(true)
  })

  it('the question says which option loses what, and is not a refusal', () => {
    const impact = assessNodeDeletion(BVB.nodes, BVB.edges, BUILD_FACTOR)
    const { title, message, blocked } = buildDeletionMessage(impact, BUILD_FACTOR_LABEL)
    expect(blocked).toBe(false)
    expect(title).toBe(`Remove "${BUILD_FACTOR_LABEL}"?`)
    expect(message).toContain(`"${BUILD_OPTION_LABEL}"`)
    expect(message).toContain(`change to "${BUILD_FACTOR_LABEL}"`)
  })

  it('an intervention recorded on the option counts even with no link drawn', () => {
    const edges = BVB.edges.filter((e) => !(e.source === BUILD_OPTION && e.target === BUILD_FACTOR))
    const impact = assessNodeDeletion(BVB.nodes, edges, BUILD_FACTOR)
    expect((impact.dropsOptionChanges ?? []).map((c) => c.optionId)).toContain(BUILD_OPTION)
  })

  it('CONTRAST: the pricing-model risk no option targets still reads as not significant', () => {
    const impact = assessNodeDeletion(PRICING.nodes, PRICING.edges, PRICING_RISK)
    expect(impact.dropsOptionChanges).toEqual([])
    expect(isSignificantImpact(impact)).toBe(false)
  })

  it('CONTRAST: deleting an option does not warn that the option loses its own changes', () => {
    const impact = assessNodeDeletion(BVB.nodes, BVB.edges, BUILD_OPTION)
    expect(impact.dropsOptionChanges).toEqual([])
  })
})

describe('assessEdgeDeletion: removing an option → factor link is removing that change', () => {
  it('the option → factor link counts', () => {
    const link = BVB.edges.find((e) => e.source === BUILD_OPTION && e.target === BUILD_FACTOR)!
    const impact = assessEdgeDeletion(BVB.nodes, BVB.edges, link.id)
    // Before the fix: the option still reached the goal another way, so nothing asked.
    expect(impact.disconnectsOptions).toEqual([])
    expect(impact.dropsOptionChanges).toEqual([
      { optionId: BUILD_OPTION, optionLabel: BUILD_OPTION_LABEL, targetId: BUILD_FACTOR, targetLabel: BUILD_FACTOR_LABEL },
    ])
    expect(isSignificantImpact(impact)).toBe(true)
  })

  it('CONTRAST: the Question → option link is not a change', () => {
    const link = BVB.edges.find((e) => e.source === 'dec_billing' && e.target === BUILD_OPTION)!
    expect(assessEdgeDeletion(BVB.nodes, BVB.edges, link.id).dropsOptionChanges).toEqual([])
  })
})

// ── The gesture: deleteAction on the REAL store and the REAL confirm store ─────

async function settle() {
  await import('../../../adapters/plot')
  for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0))
}

function seed(graph: { nodes: Node[]; edges: Edge[] }) {
  useCanvasStore.setState({
    currentScenarioId: null,
    nodes: graph.nodes.map((n) => ({ ...n, data: { ...(n.data as object) } })),
    edges: graph.edges.map((e) => ({ ...e })),
    selection: { nodeIds: new Set<string>(), edgeIds: new Set<string>(), anchorPosition: null },
    lastServerGraphHash: null,
    lastAuthoritativeGraph: null,
    pendingStructuralDeletes: [],
    _externalMutationActive: 0,
  } as never)
}

const nodeIds = () => useCanvasStore.getState().nodes.map((n) => n.id)
const pending = () => useConfirmDialogStore.getState().pending

describe('the delete gesture (menu and keyboard share deleteAction)', () => {
  beforeEach(() => useConfirmDialogStore.setState({ pending: null }))
  afterEach(() => useConfirmDialogStore.setState({ pending: null }))

  it('build-vs-buy: Delete on "In-House Build Approach" asks first, and nothing is removed yet', async () => {
    seed(BVB)
    const toasts: string[] = []
    await deleteAction({ kind: 'node', nodeId: BUILD_FACTOR }, (m) => { toasts.push(m) })
    await settle()
    expect(pending()?.title).toBe(`Remove "${BUILD_FACTOR_LABEL}"?`)
    expect(pending()?.message).toContain(`"${BUILD_OPTION_LABEL}"`)
    expect(nodeIds()).toContain(BUILD_FACTOR)
    expect(toasts).toEqual([])
  })

  it('CONTRAST (EDITABILITY-MATRIX row 181): pricing-model risk card deletes at once, no question', async () => {
    seed(PRICING)
    await deleteAction({ kind: 'node', nodeId: PRICING_RISK }, () => {})
    await settle()
    expect(pending()).toBeNull()
    expect(nodeIds()).not.toContain(PRICING_RISK)
  })

  it('multi-select: the factor plus an unrelated card still asks, naming the option', async () => {
    seed(BVB)
    // `risk_billing_errors` alone is not significant (asserted first), so the
    // question below comes from the factor's option change.
    expect(isSignificantImpact(assessNodeDeletion(BVB.nodes, BVB.edges, 'risk_billing_errors'))).toBe(false)
    await deleteAction({ kind: 'multi', nodeIds: [BUILD_FACTOR, 'risk_billing_errors'], edgeIds: [] }, () => {})
    await settle()
    expect(pending()?.title).toBe('Remove "2 elements"?')
    expect(pending()?.message).toContain(`"${BUILD_OPTION_LABEL}" and "Delay Billing Migration (Status Quo)"`)
    expect(nodeIds()).toContain(BUILD_FACTOR)
  })

  it('multi-select: an option deleted with its own factor is not warned about for itself', async () => {
    seed(BVB)
    const impactOptions = (assessNodeDeletion(BVB.nodes, BVB.edges, BUILD_FACTOR).dropsOptionChanges ?? []).map((c) => c.optionId)
    // Delete the factor together with BOTH options that hold a change for it.
    await deleteAction({ kind: 'multi', nodeIds: [BUILD_FACTOR, ...impactOptions], edgeIds: [] }, () => {})
    await settle()
    // Whatever else it may ask about, it never says an option that is going
    // too will lose a change (both options holding one are in the gesture).
    const message = pending()?.message ?? ''
    expect(message).not.toMatch(/lose (its|their) change/)
  })
})
