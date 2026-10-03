/**
 * ⭐ ONE PROJECTION, LOCKED (DL ruling 5871843133, 28 Sep 2026).
 *
 * The `/graph-readiness` body and the registration graph are built from the
 * same node-field projection (`projectNodeFieldsForWire`). Readiness used to
 * keep its own allow-list, which never sent `prior`: CEE's readiness then read
 * every prior-only external factor as "no current level" (MISSING_FACTOR_LEVEL)
 * while the engine samples that prior, so none of the 5 starters could Run.
 * Served, before → after this change (POST /bff/cee/graph-readiness, 0 LLM):
 * MISSING_FACTOR_LEVEL 2/2/3/4/3 → may_run true on all five.
 *
 * The lock: on the real starter boards, every node field registration sends is
 * either sent by readiness too, or dropped by a NAMED rule
 * (`READINESS_EXCLUDED_NODE_FIELDS`, or one of the four validated transforms).
 */
import { beforeEach, describe, expect, it } from 'vitest'
import type { Node } from '@xyflow/react'
import { buildReadinessPayload, READINESS_EXCLUDED_NODE_FIELDS } from '../readinessStore'
import { buildRegistrationGraph } from '../../registration/buildRegistrationGraph'
import { applyDraftResult } from '../../utils/applyDraftResult'
import { useCanvasStore } from '../../store'
import vendorSelection from '../../starters/data/vendor-selection.draft.json'
import marketEntry from '../../starters/data/market-entry.draft.json'
import buildVsBuy from '../../starters/data/build-vs-buy.draft.json'
import headcountAllocation from '../../starters/data/headcount-allocation.draft.json'
import pricingModel from '../../starters/data/pricing-model.draft.json'

const STARTERS: Array<[string, unknown]> = [
  ['pricing-model', pricingModel],
  ['vendor-selection', vendorSelection],
  ['build-vs-buy', buildVsBuy],
  ['market-entry', marketEntry],
  ['headcount-allocation', headcountAllocation],
]

type WireNode = Record<string, unknown> & { id: string; kind?: string }

function loadStarter(draft: unknown) {
  applyDraftResult(JSON.parse(JSON.stringify(draft)) as never, { skipAutosave: true })
  const s = useCanvasStore.getState() as unknown as { nodes: Node[]; edges: never[] }
  const reg = buildRegistrationGraph(s.nodes, s.edges)
  if (!reg.ok) throw new Error(`registration refused: ${reg.reason}`)
  const body = JSON.parse(buildReadinessPayload({ ...(s as object), currentScenarioId: null } as never)) as {
    graph: { nodes: WireNode[] }
  }
  return {
    registration: new Map((reg.graph.nodes as WireNode[]).map((n) => [n.id, n])),
    readiness: new Map(body.graph.nodes.map((n) => [n.id, n])),
  }
}

/** A drop is legitimate only when a named rule says so for THIS node. */
function droppedByNamedRule(field: string, reg: WireNode): boolean {
  if (READINESS_EXCLUDED_NODE_FIELDS.has(field)) return true
  if (field === 'data') return true // replaced by `{ value }` (NodeData is validated)
  if (field === 'category') return reg.kind !== 'factor' // an invalid enum is also dropped; starters carry valid ones
  if (field === 'observed_state') {
    const v = (reg.observed_state as { value?: unknown } | undefined)?.value
    return reg.kind !== 'factor' || typeof v !== 'number'
  }
  if (field === 'interventions') return reg.kind !== 'option'
  return false
}

beforeEach(() => {
  useCanvasStore.setState({ nodes: [], edges: [] } as never)
})

describe('the readiness body is the registration projection, differing only by name', () => {
  it.each(STARTERS)('%s: every prior-only external factor carries its prior to readiness (the starters root)', (_id, draft) => {
    const { registration, readiness } = loadStarter(draft)
    const withPrior = [...registration.values()].filter((n) => n.prior !== undefined)
    expect(withPrior.length, 'precondition: this starter has prior-only external factors').toBeGreaterThan(0)
    for (const n of withPrior) {
      expect(readiness.get(n.id)?.prior, `${n.id} prior`).toEqual(n.prior)
    }
  })

  it.each(STARTERS)('%s: LOCK — no node field registration sends is dropped by readiness without a named rule', (_id, draft) => {
    const { registration, readiness } = loadStarter(draft)
    const unnamed: string[] = []
    for (const [id, reg] of registration) {
      const rd = readiness.get(id)
      expect(rd, `${id} reaches readiness`).toBeDefined()
      for (const field of Object.keys(reg)) {
        if (!(field in (rd as object)) && !droppedByNamedRule(field, reg)) unnamed.push(`${id}.${field}`)
      }
    }
    expect(unnamed).toEqual([])
  })

  it('a NEW node field reaches readiness by default — only a named rule can hold one back', () => {
    const nodes = [
      { id: 'f1', type: 'factor', position: { x: 0, y: 0 }, data: { kind: 'factor', label: 'F', category: 'external', prior: { distribution: 'uniform', range_min: 0.2, range_max: 0.6 }, a_field_added_later: 'x' } },
    ]
    const body = JSON.parse(buildReadinessPayload({ nodes, edges: [], ceeAnalysisReady: null, currentBriefText: null, currentScenarioId: null } as never))
    const f1 = body.graph.nodes[0]
    expect(f1.prior).toEqual({ distribution: 'uniform', range_min: 0.2, range_max: 0.6 })
    expect(f1.a_field_added_later).toBe('x')
    // CONTRAST: a named exclusion is still held back, and the validated transforms still apply.
    const withExcluded = JSON.parse(buildReadinessPayload({ nodes: [{ ...nodes[0], data: { ...nodes[0].data, body: 'b'.repeat(300), category: 'not-a-category' } }], edges: [], ceeAnalysisReady: null, currentBriefText: null, currentScenarioId: null } as never)).graph.nodes[0]
    expect(withExcluded.body).toBeUndefined()
    expect(withExcluded.category).toBeUndefined()
  })
})
