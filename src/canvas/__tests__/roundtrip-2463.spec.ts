/**
 * ROADMAP 2.463 — canvas export/import round-trip (kind/type discriminant mismatch).
 *
 * The defect (verified live on f2beaa3c, walk-582 §T2): every node today's product
 * creates (CEE draft path `mapDraftNodeToCanvas`, patch path `buildNode`, manual
 * `addNode`) carries `data.kind` and NO `data.type`, while `importSnapshot` routes
 * explicit `version: 2` files into strict `V2SnapshotSchema.parse` whose
 * `data: AnyNodeDataSchema` discriminates on `data.type` — so every real export
 * fails import with `invalid_union_discriminator`. A second blocker measured at
 * pristine c7ab0b91 (not in the original defect note): distribution-form priors
 * (`{ distribution, range_min, range_max }` — a first-class live shape written by
 * useInspectorMutations and read by FactorNode/DecisionNode/inspector panels)
 * failed `prior: z.number()`.
 *
 * Fixture provenance: byte-identical copies (sha256-verified) of real deployed-UI
 * exports captured in PHASE0-EVIDENCE-2026-07-28/walk-582-raw/ on 2026-08-04:
 *   - walk582-t2b-export-pristine.json  = t2b-export-pristine.json  (15-node CEE-drafted
 *     graph, unmodified export; sha256 8e852b4a…)
 *   - walk582-t2-export-original.json   = t2-export-original.json   (14-node variant of
 *     the same drafted decision from the sentinel walk; sha256 f68f87b8…)
 *
 * RED-first at pristine c7ab0b91: every importing test here fails (importCanvas /
 * importSnapshot return null on both fixtures; round-trip returns null).
 * Assertions bind by IDENTITY (literal ids / labels / kinds from the fixtures),
 * never by a value predicate another object could satisfy (trap 19).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { exportCanvas, importCanvas } from '../persist'
import { importSnapshot, detectVersion } from '../domain/migrations'

const HERE = dirname(fileURLToPath(import.meta.url))
const readFixture = (name: string) =>
  readFileSync(join(HERE, 'fixtures', name), 'utf8')

const t2bJson = readFixture('walk582-t2b-export-pristine.json')
const t2Json = readFixture('walk582-t2-export-original.json')

type AnyNode = { id: string; type?: string; data: Record<string, any> }
type AnyEdge = { id: string; source: string; target: string; type?: string; data?: Record<string, any> }

const byId = <T extends { id: string }>(xs: T[], id: string): T => {
  const found = xs.filter((x) => x.id === id)
  expect(found, `exactly one element with id ${id}`).toHaveLength(1)
  return found[0]
}

describe('2.463 — real export fixtures import (pristine exports from the deployed product)', () => {
  it('imports the pristine 15-node walk-582 export with ids, labels, kinds intact', () => {
    const result = importCanvas(t2bJson)
    expect(result).not.toBeNull()
    const nodes = result!.nodes as unknown as AnyNode[]
    const edges = result!.edges as unknown as AnyEdge[]

    // Identity: the exact 15 node ids from the export, nothing added, nothing dropped
    expect(nodes.map((n) => n.id).sort()).toEqual([
      'dec_venue', 'fac_alpha', 'fac_beta', 'fac_capacity', 'fac_gamma',
      'fac_weather', 'goal_turnout', 'opt_alpha', 'opt_beta', 'opt_gamma',
      'opt_status_quo', 'out_attendance', 'out_experience', 'risk_logistics',
      'risk_weather_exposure',
    ])
    expect(edges).toHaveLength(26)

    // Labels + kinds survive, bound per-id
    const goal = byId(nodes, 'goal_turnout')
    expect(goal.data.label).toBe('Maximise Attendee Turnout')
    expect(goal.data.kind).toBe('goal')
    expect(goal.data.type).toBe('goal')

    const dec = byId(nodes, 'dec_venue')
    expect(dec.data.label).toBe('Product Launch Venue Selection')
    expect(dec.data.kind).toBe('decision')

    const risk = byId(nodes, 'risk_weather_exposure')
    expect(risk.data.label).toBe('Weather Disruption Risk')
    expect(risk.data.kind).toBe('risk')
  })

  it('preserves factor values: observedState, category, encoding_map, object-form prior', () => {
    const result = importCanvas(t2bJson)
    expect(result).not.toBeNull()
    const nodes = result!.nodes as unknown as AnyNode[]

    const facAlpha = byId(nodes, 'fac_alpha')
    expect(facAlpha.data.label).toBe('Alpha Hall Selected')
    expect(facAlpha.data.category).toBe('controllable')
    expect(facAlpha.data.observedState?.value).toBe(0)
    expect(facAlpha.data.observedState?.source).toBe('cee_inference')
    expect(facAlpha.data.encoding_map).toEqual({ '0': 'Not selected', '1': 'Alpha Hall selected' })
    expect(facAlpha.data.display_value).toBe('Low (0)')

    // Second measured blocker: distribution-form prior must survive import
    const facCapacity = byId(nodes, 'fac_capacity')
    expect(facCapacity.data.label).toBe('Venue Capacity')
    expect(facCapacity.data.prior).toEqual({ distribution: 'uniform', range_min: 0.3, range_max: 1 })
    const facWeather = byId(nodes, 'fac_weather')
    expect(facWeather.data.prior).toEqual({ distribution: 'uniform', range_min: 0, range_max: 1 })
  })

  it('preserves option values: interventions, interventionKeys, is_baseline', () => {
    const result = importCanvas(t2bJson)
    expect(result).not.toBeNull()
    const nodes = result!.nodes as unknown as AnyNode[]

    const statusQuo = byId(nodes, 'opt_status_quo')
    expect(statusQuo.data.label).toBe('Postpone Launch (Status Quo)')
    expect(statusQuo.data.is_baseline).toBe(true)
    expect(statusQuo.data.interventions).toEqual({ fac_alpha: 0, fac_beta: 0, fac_gamma: 0 })
    expect(statusQuo.data.interventionKeys).toEqual(['fac_alpha', 'fac_beta', 'fac_gamma'])

    const optAlpha = byId(nodes, 'opt_alpha')
    expect(optAlpha.data.is_baseline).toBe(false)
    expect(optAlpha.data.interventions).toEqual({ fac_alpha: 1 })
  })

  it('preserves edges: endpoints, renderer type, edge data payload', () => {
    const result = importCanvas(t2bJson)
    expect(result).not.toBeNull()
    const edges = result!.edges as unknown as AnyEdge[]

    const e0 = byId(edges, 'e-0')
    expect(e0.source).toBe('dec_venue')
    expect(e0.target).toBe('opt_alpha')
    // Renderer type: without it the imported edge silently loses StyledEdge
    // (defaultEdgeOptions only applies to newly-added edges, and memoizedEdges
    // does not re-apply it).
    expect(e0.type).toBe('styled')
    expect(e0.data?.kind).toBe('decision-probability')
    expect(e0.data?.weight).toBe(1)
    expect(e0.data?.schemaVersion).toBe(4)
  })

  it('imports the sentinel-walk 14-node export (second real artefact)', () => {
    const result = importCanvas(t2Json)
    expect(result).not.toBeNull()
    const nodes = result!.nodes as unknown as AnyNode[]
    expect(nodes.map((n) => n.id).sort()).toEqual([
      'dec_venue', 'fac_alpha', 'fac_beta', 'fac_capacity', 'fac_gamma',
      'fac_weather', 'goal_turnout', 'opt_alpha', 'opt_beta', 'opt_gamma',
      'opt_status_quo', 'out_turnout', 'risk_logistics', 'risk_no_show',
    ])
    expect(byId(nodes, 'risk_no_show').data.label).toBe('Attendee No-Show Rate')
    expect(byId(nodes, 'out_turnout').data.kind).toBe('outcome')
    expect(result!.edges).toHaveLength(23)
  })
})

describe('2.463 — export → import round-trip on shapes the current product creates', () => {
  // Store-shaped graph exactly as the live creation paths produce it:
  //  - CEE draft path (mapDraftNodeToCanvas / applyPatch buildNode): data.kind, NO data.type
  //  - manual addNode: data = { label } only (no kind, no type; top-level type only)
  const storeNodes: AnyNode[] = [
    {
      id: 'goal_1',
      type: 'goal',
      position: { x: 0, y: 0 },
      data: { label: 'Round-trip goal', kind: 'goal', provenance: 'ai_inferred' },
    } as any,
    {
      id: 'fac_1',
      type: 'factor',
      position: { x: 100, y: 0 },
      data: {
        label: 'Round-trip factor',
        kind: 'factor',
        category: 'controllable',
        observedState: { value: 42, unit: '£', source: 'user' },
        encoding_map: { '0': 'off', '1': 'on' },
      },
    } as any,
    {
      id: 'fac_ext',
      type: 'factor',
      position: { x: 150, y: 50 },
      data: {
        label: 'External factor with distribution prior',
        kind: 'factor',
        category: 'external',
        prior: { distribution: 'uniform', range_min: 0.2, range_max: 0.9 },
      },
    } as any,
    {
      id: 'opt_1',
      type: 'option',
      position: { x: 200, y: 0 },
      data: {
        label: 'Round-trip option',
        kind: 'option',
        is_baseline: false,
        interventions: { fac_1: 1 },
        interventionKeys: ['fac_1'],
      },
    } as any,
    {
      // Manual addNode shape (store.ts): data = { label } ONLY
      id: '7',
      type: 'decision',
      position: { x: 300, y: 0 },
      data: { label: 'Node 7' },
    } as any,
  ]
  const storeEdges: AnyEdge[] = [
    {
      id: 'e_rt_1',
      source: 'goal_1',
      target: 'fac_1',
      type: 'styled',
      data: { weight: 0.7, kind: 'influence-weight', schemaVersion: 4 },
    } as any,
  ]

  it('export(current store shapes) → import succeeds with identity preserved', () => {
    const json = exportCanvas({ nodes: storeNodes as any, edges: storeEdges as any })
    const result = importCanvas(json)
    expect(result).not.toBeNull()
    const nodes = result!.nodes as unknown as AnyNode[]
    const edges = result!.edges as unknown as AnyEdge[]

    expect(nodes.map((n) => n.id).sort()).toEqual(['7', 'fac_1', 'fac_ext', 'goal_1', 'opt_1'])

    const fac = byId(nodes, 'fac_1')
    expect(fac.data.label).toBe('Round-trip factor')
    expect(fac.data.kind).toBe('factor')
    expect(fac.data.observedState).toEqual({ value: 42, unit: '£', source: 'user' })
    expect(fac.data.encoding_map).toEqual({ '0': 'off', '1': 'on' })

    const facExt = byId(nodes, 'fac_ext')
    expect(facExt.data.prior).toEqual({ distribution: 'uniform', range_min: 0.2, range_max: 0.9 })

    const opt = byId(nodes, 'opt_1')
    expect(opt.data.interventions).toEqual({ fac_1: 1 })
    expect(opt.data.interventionKeys).toEqual(['fac_1'])
    expect(opt.data.is_baseline).toBe(false)

    // Manual node: semantic type derived from top-level node.type
    const manual = byId(nodes, '7')
    expect(manual.data.label).toBe('Node 7')
    expect(manual.data.kind).toBe('decision')
    expect(manual.data.type).toBe('decision')
    expect(manual.type).toBe('decision')

    const e = byId(edges, 'e_rt_1')
    expect(e.source).toBe('goal_1')
    expect(e.target).toBe('fac_1')
    expect(e.type).toBe('styled')
    expect(e.data?.weight).toBe(0.7)
  })

  it('export emits self-describing node data (both type and kind) without mutating store state', () => {
    const before = JSON.stringify(storeNodes)
    const json = exportCanvas({ nodes: storeNodes as any, edges: storeEdges as any })
    // exportCanvas must not mutate the live store arrays it is handed
    expect(JSON.stringify(storeNodes)).toBe(before)

    const parsed = JSON.parse(json)
    const goal = (parsed.nodes as AnyNode[]).filter((n) => n.id === 'goal_1')[0]
    expect(goal.data.type).toBe('goal')
    expect(goal.data.kind).toBe('goal')
    const manual = (parsed.nodes as AnyNode[]).filter((n) => n.id === '7')[0]
    expect(manual.data.type).toBe('decision')
    expect(manual.data.kind).toBe('decision')
  })
})

describe('2.463 — backwards + adversarial import shapes', () => {
  it('legacy v2 file with data.type only (old export in the wild) imports and gains kind', () => {
    const legacy = {
      version: 2,
      timestamp: 1700000000000,
      nodes: [
        {
          id: 'legacy_goal',
          type: 'goal',
          position: { x: 0, y: 0 },
          data: { label: 'Legacy goal', type: 'goal' },
        },
      ],
      edges: [],
    }
    const snap = importSnapshot(legacy)
    expect(snap).not.toBeNull()
    const n = byId(snap!.nodes as unknown as AnyNode[], 'legacy_goal')
    expect(n.data.type).toBe('goal')
    // Store parity: live creation paths produce kind-bearing data; import must too
    expect(n.data.kind).toBe('goal')
  })

  it('conflicting kind/type: data.kind wins (matches live-path precedence kind ?? type)', () => {
    const conflicted = {
      version: 2,
      timestamp: 1700000000000,
      nodes: [
        {
          id: 'conf_1',
          type: 'factor',
          position: { x: 0, y: 0 },
          data: { label: 'Conflicted', kind: 'risk', type: 'factor' },
        },
      ],
      edges: [],
    }
    const snap = importSnapshot(conflicted)
    expect(snap).not.toBeNull()
    const n = byId(snap!.nodes as unknown as AnyNode[], 'conf_1')
    expect(n.data.type).toBe('risk')
    expect(n.data.kind).toBe('risk')
  })

  it('closure stays: an unknown kind is NOT normalised and the import is rejected', () => {
    const junk = {
      version: 2,
      timestamp: 1700000000000,
      nodes: [
        {
          id: 'junk_1',
          type: 'banana',
          position: { x: 0, y: 0 },
          data: { label: 'Junk', kind: 'banana' },
        },
      ],
      edges: [],
    }
    expect(importSnapshot(junk)).toBeNull()
    expect(importCanvas(JSON.stringify(junk))).toBeNull()
  })

  it('version-less kind-bearing file detects as v2 (not routed to the destructive v1 migration)', () => {
    // The v1 migration REBUILDS data as {label, type, description} — it would
    // silently destroy kind/observedState/interventions on a modern file that
    // merely lost its version field.
    const versionless = {
      timestamp: 1700000000000,
      nodes: [
        {
          id: 'vl_fac',
          type: 'factor',
          position: { x: 0, y: 0 },
          data: {
            label: 'Versionless factor',
            kind: 'factor',
            observedState: { value: 7, unit: '£' },
          },
        },
      ],
      edges: [],
    }
    expect(detectVersion(versionless)).toBe(2)
    const snap = importSnapshot(versionless as any)
    expect(snap).not.toBeNull()
    const n = byId(snap!.nodes as unknown as AnyNode[], 'vl_fac')
    expect(n.data.observedState).toEqual({ value: 7, unit: '£' })
  })
})
