/**
 * RT-12: partial updates must not keep an example author after provenance
 * retires it, or accept a canvas-internal admission supplied by a payload.
 * Every case starts with the actual seven Science example links through the
 * real draft mapper and exercises the public patch update boundary.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Node } from '@xyflow/react'
import example from './fixtures/d1.patched.rt12.json'
import served from './fixtures/servedLinkSizing.20261005.json'
import { mapDraftEdgeToCanvas, mapDraftNodeToCanvas } from '../../utils/applyDraftResult'
import { applyAutoApplyPatch } from '../../conversation/utils/applyPatch'
import { withoutLinkSizingLabels } from '../linkSizingLabels'
import { edgeSizePhrase } from '../../edges/edgeSizePhrase'

type CanvasEdge = { id: string; source: string; target: string; data: Record<string, unknown> }
const state = vi.hoisted(() => ({ nodes: [] as Node[], edges: [] as CanvasEdge[] }))
vi.mock('../../store', () => ({
  useCanvasStore: Object.assign(vi.fn(), {
    getState: () => ({
      ...state, outcomeNodeId: null, ceeAnalysisReady: null, currentScenarioId: null,
      setOutcomeNode: vi.fn(), setPendingLayout: vi.fn(),
    }),
    setState: vi.fn((update: { nodes?: Node[]; edges?: CanvasEdge[] }) => {
      if (update.nodes) state.nodes = update.nodes
      if (update.edges) state.edges = update.edges
    }),
  }),
}))
vi.mock('../../store/scenarios', () => ({ saveAutosave: vi.fn() }))
vi.mock('../../utils/appliedEditPulse', () => ({ pulseAppliedTargets: vi.fn() }))

const LINKS = [
  { id: 'e-12', from: 'sprint_capacity_for_ai_reporting', to: 'ai_reporting_module_availability' },
  { id: 'e-13', from: 'ai_reporting_module_availability', to: 'enterprise_prospect_signing_likelihood' },
  { id: 'e-14', from: 'enterprise_prospect_signing_likelihood', to: 'quarterly_revenue' },
  { id: 'e-15', from: 'sprint_capacity_for_integration_fix', to: 'integration_step_bug_resolution' },
  { id: 'e-16', from: 'integration_step_bug_resolution', to: 'trial_profile_abandonment_rate' },
  { id: 'e-17', from: 'trial_profile_abandonment_rate', to: 'revenue_lost_to_trial_abandonment' },
  { id: 'e-18', from: 'revenue_lost_to_trial_abandonment', to: 'quarterly_revenue' },
] as const

function exampleLink(link: typeof LINKS[number]) {
  const matches = example.edges.filter(e => e.from === link.from && e.to === link.to)
  expect(matches, `${link.id} fixture binding`).toHaveLength(1)
  const wire = matches[0]
  const edge = mapDraftEdgeToCanvas(wire, example.edges.indexOf(wire)) as CanvasEdge
  expect(edge.id).toBe(link.id)
  return { wire, edge }
}
function update(edge: CanvasEdge, data: Record<string, unknown>): CanvasEdge {
  state.edges = [edge]
  const result = applyAutoApplyPatch({
    block_type: 'graph_patch', auto_apply: true,
    operations: [{ op: 'update_edge', target_id: edge.id, data }],
  } as never)
  expect(result.modifiedIds).toContain(edge.id)
  expect(state.edges).toHaveLength(1)
  expect(state.edges[0].id).toBe(edge.id)
  return state.edges[0]
}

beforeEach(() => {
  state.nodes = example.nodes.map(mapDraftNodeToCanvas) as Node[]
  state.edges = []
})

describe('RT-12 — example admission at partial-update boundaries', () => {
  it('strips an untrusted standalone admission and does not let a payload overwrite the stored key', () => {
    expect(withoutLinkSizingLabels({ strengthExampleFigure: 42, label: 'A relationship note' })).toEqual({ label: 'A relationship note' })
    for (const link of LINKS) {
      const { edge } = exampleLink(link)
      const after = update(edge, { strengthExampleFigure: 42 })
      expect(after.data.strengthExampleFigure, link.id).toBe(edge.data.strengthExampleFigure)
      expect(edgeSizePhrase(after.data)?.exampleFigure, link.id).toBe(true)
    }
  })

  it('retires example provenance at the same weight, including old natural-effect example authors', () => {
    for (const link of LINKS) {
      const { edge } = exampleLink(link)
      const after = update(edge, { provenance: served.olumi.provenance })
      expect(after.data.weight, link.id).toBe(edge.data.weight)
      expect(after.data.strengthExampleFigure, link.id).toBeUndefined()
      // The partial boundary still holds the old admitted amount; its author
      // cannot speak once the authoritative provenance has retired the class.
      expect(after.data.naturalEffect, link.id).toEqual(edge.data.naturalEffect)
      expect(edgeSizePhrase(after.data)?.exampleFigure === true, link.id).toBe(false)
      expect(edgeSizePhrase(after.data)?.sentence ?? '', link.id).not.toContain('example figure')
    }
  })

  it('keeps example attribution through a same-weight update that supplies no provenance', () => {
    for (const link of LINKS) {
      const { edge } = exampleLink(link)
      const after = update(edge, { weight: edge.data.weight, label: 'A relationship note' })
      expect(after.data.strengthExampleFigure, link.id).toBe(edge.data.strengthExampleFigure)
      expect(edgeSizePhrase(after.data)?.exampleFigure, link.id).toBe(true)
    }
  })

  it('retires the original relationship’s example admission when an endpoint is rewired', () => {
    for (const link of LINKS) {
      const { edge } = exampleLink(link)
      const target = edge.target === 'quarterly_revenue' ? 'ai_reporting_module_availability' : 'quarterly_revenue'
      const after = update(edge, { to: target })
      expect(after.target, link.id).toBe(target)
      expect(after.data.strengthExampleFigure, link.id).toBeUndefined()
      expect(edgeSizePhrase(after.data)?.exampleFigure === true, link.id).toBe(false)
      expect(edgeSizePhrase(after.data)?.sentence ?? '', link.id).not.toContain('example figure')
    }
  })

  it('admits actual example provenance on an older unlabeled copy with the same signed strength', () => {
    for (const link of LINKS) {
      const { edge, wire } = exampleLink(link)
      const older = { ...edge, data: { ...edge.data } }
      delete older.data.strengthExampleFigure
      delete older.data.naturalEffect
      expect(edgeSizePhrase(older.data)).toBeNull()
      const after = update(older, { provenance: wire.provenance })
      expect(after.data.strengthExampleFigure, link.id).toBe(wire.strength.mean)
      expect(edgeSizePhrase(after.data)?.exampleFigure, link.id).toBe(true)
      expect(edgeSizePhrase(after.data)?.usersFigure, link.id).toBe(false)
    }
  })
})
