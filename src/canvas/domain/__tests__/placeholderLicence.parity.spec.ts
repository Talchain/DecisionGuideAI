import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { isStrengthPlaceholder, readWireStrengthIsPlaceholder } from '../strengthPlaceholder'
import { linkEndsOf } from '../heldUserLink'
import { edgeValueSource } from '../edgeValueProvenance'
import { isStrengthDefinitional } from '../strengthDefinitional'
import { isStrengthAccepted } from '../strengthAccepted'
import { isStrengthStated } from '../strengthStated'
import { edgeSizePhrase } from '../../edges/edgeSizePhrase'
import { mapDraftEdgeToCanvas } from '../../utils/applyDraftResult'
import { resolveEdgeValuesProvenance } from '../../ui/inspector-v2/coachingConfig'

// CEE branch dl/placeholder-licence pins the same bytes.
const FIXTURE_SHA256 = '67fd0050970378c46acd843f7b00424b954d547fabbd8a17b5ee9e3ba08f2ec9'
const bytes = readFileSync(resolve(process.cwd(), 'src/canvas/domain/__tests__/fixtures/placeholder-licence-parity.json'))
type WireEdge = Record<string, unknown> & {
  from: string
  to: string
  strength?: { mean?: number | null; std?: number | null }
  provenance?: Record<string, unknown>
}
type WireGraph = { nodes: Record<string, unknown>[]; edges: WireEdge[] }
const rows = JSON.parse(String(bytes)) as Array<{ name: string; edge: WireEdge; placeholder: boolean }>
const readFixture = (file: string) => JSON.parse(readFileSync(resolve(process.cwd(), file), 'utf8'))
const b9 = readFixture('src/components/results/analysis-hero/__tests__/fixtures/s6/b9-df15c8c.s6-cee.turn.json').draft_graph as WireGraph
const mrr = readFixture('e2e/geometry/fixtures/mrr-17d1cd3a.fixture.json').draft as WireGraph

// Bind served witnesses by from/to identity, never by their position in the response.
function wire(graph: WireGraph, from: string, to: string): WireEdge {
  const matches = graph.edges.filter(e => e.from === from && e.to === to)
  expect(matches, `${from} → ${to} is unique in the served fixture`).toHaveLength(1)
  return matches[0]
}
function ingest(edge: WireEdge, i = 0, nodes: WireGraph['nodes'] = []) {
  return mapDraftEdgeToCanvas(edge, i, linkEndsOf(nodes)(edge)).data as Record<string, unknown>
}

// Exact sources object built by inspector-v2/panels/EdgePanel.tsx.
function inspectorSources(data: Record<string, unknown>) {
  const sizePhrase = edgeSizePhrase(data)
  return {
    strength: edgeValueSource(data, 'weight'),
    existence: edgeValueSource(data, 'beliefExists'),
    strengthPlaceholder: isStrengthPlaceholder(data),
    strengthDefinitional: isStrengthDefinitional(data),
    strengthAccepted: isStrengthAccepted(data),
    strengthStated: isStrengthStated(data),
    strengthExampleFigure: sizePhrase?.exampleFigure === true,
    usersFigure: sizePhrase?.usersFigure === true ? sizePhrase : null,
  }
}

// CEE staging, guest 5e2c6de9, 7 Oct 19:03Z: the '+' Risk door.
const riskDoor: WireEdge = {
  from: 'risk_starter_uptake_arrives_too_late',
  to: 'starter_plan_mrr',
  strength: { std: 0.125, mean: -0.5 },
  defaulted: true,
  provenance: { source: 'cee_hypothesis' },
}
const projectedTargets = [
  'loyalty_app_monthly_gross_profit',
  'clifton_monthly_operating_profit',
  'wholesale_monthly_gross_profit',
]

describe('placeholder licence parity (shared with CEE)', () => {
  it('placeholder licence parity fixture digest', () => {
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(FIXTURE_SHA256)
  })
  for (const [i, row] of rows.entries()) {
    it(`WIRE: ${row.name}`, () => {
      expect(readWireStrengthIsPlaceholder(row.edge)).toBe(row.placeholder)
    })
    it(`CANVAS ingestion: ${row.name}`, () => {
      expect(isStrengthPlaceholder(ingest(row.edge, i))).toBe(row.placeholder)
    })
  }

  // Codex buddy r1 #4: CEE reads only the nested `strength`, so a flat `strength_mean` never completes the door constant.
  it.each([0.5, -0.5])('PARITY: a flat strength_mean/strength_std door constant is NOT a placeholder (%s)', mean => {
    expect(readWireStrengthIsPlaceholder({ from: 'x', to: 'y', strength_mean: mean, strength_std: 0.125, defaulted: true })).toBe(false)
  })
  it('PARITY: a nested pair missing a member is not completed by the flat field', () => {
    const flat = { from: 'x', to: 'y', strength_mean: 0.5, strength_std: 0.125, defaulted: true }
    expect(readWireStrengthIsPlaceholder({ ...flat, strength: { mean: null, std: null } })).toBe(false)
    expect(readWireStrengthIsPlaceholder({ ...flat, strength: { mean: 0.5 } })).toBe(false)
    // CONTROL: the nested door constant itself is a placeholder.
    expect(readWireStrengthIsPlaceholder({ ...flat, strength: { mean: 0.5, std: 0.125 } })).toBe(true)
  })
})

describe('served placeholder licence witnesses', () => {
  it('b9-df15c8c has exactly the three projected risk identities', () => {
    expect(b9.edges.filter(e => e.provenance?.mean_projected === true).map(e => `${e.from}->${e.to}`).sort())
      .toEqual(projectedTargets.map(to => `commercial_uptake_shortfall->${to}`).sort())
  })
  it.each(projectedTargets)('b9-df15c8c: commercial_uptake_shortfall → %s', to => {
    const edge = wire(b9, 'commercial_uptake_shortfall', to)
    expect(edge.strength).toEqual({ mean: -0.5, std: 0.125 })
    expect(edge.provenance?.mean_projected).toBe(true)
    expect(edge.provenance?.magnitude).toBeUndefined()
    expect(isStrengthPlaceholder(ingest(edge, 0, b9.nodes))).toBe(true)
  })
  const estimates = b9.edges.filter(e => e.provenance?.magnitude === 'olumi_estimate')
  it('b9-df15c8c contains estimate controls', () => {
    expect(estimates.length).toBeGreaterThan(0)
  })
  for (const { from, to } of estimates) {
    it(`CONTROL b9-df15c8c olumi_estimate: ${from} → ${to}`, () => {
      expect(isStrengthPlaceholder(ingest(wire(b9, from, to), 0, b9.nodes))).toBe(false)
    })
  }
  it('mrr-17d1cd3a: pro_plan_price → price_sensitivity is the sole untagged door default', () => {
    const edge = wire(mrr, 'pro_plan_price', 'price_sensitivity')
    expect(mrr.edges.filter(e => e.defaulted === true && e.strength?.mean === 0.5
      && e.strength?.std === 0.125 && e.provenance?.magnitude == null
      && e.provenance?.natural_effect == null).map(e => `${e.from}->${e.to}`))
      .toEqual(['pro_plan_price->price_sensitivity'])
    expect(isStrengthPlaceholder(ingest(edge, 0, mrr.nodes))).toBe(true)
  })
  it('CONTROL mrr-17d1cd3a: pro_plan_price → monthly_new_pro_subscribers remains an estimate', () => {
    const edge = wire(mrr, 'pro_plan_price', 'monthly_new_pro_subscribers')
    expect(edge.provenance?.magnitude).toBe('olumi_estimate')
    expect(isStrengthPlaceholder(ingest(edge, 0, mrr.nodes))).toBe(false)
  })
  it('5e2c6de9: risk_starter_uptake_arrives_too_late → starter_plan_mrr is a placeholder', () => {
    expect(readWireStrengthIsPlaceholder(riskDoor)).toBe(true)
    expect(isStrengthPlaceholder(ingest(riskDoor))).toBe(true)
  })
})

describe('inspector words (Science 393023 LICENCE (d), 7 Oct)', () => {
  it.each([
    ['b9-df15c8c projected risk', () => ingest(wire(b9, 'commercial_uptake_shortfall', 'loyalty_app_monthly_gross_profit'), 0, b9.nodes)],
    ['5e2c6de9 Risk door', () => ingest(riskDoor)],
  ] as const)('%s uses the existing placeholder sentence', (_name, getData) => {
    const sources = inspectorSources(getData())
    expect(sources.strengthPlaceholder).toBe(true)
    const sentence = resolveEdgeValuesProvenance(sources)
    // Existing STRENGTH_PLACEHOLDER_COPY, followed by the existing existence sentence.
    const existence = sources.existence === 'cee'
      ? 'Olumi estimated how likely this connection is to exist.'
      : 'Nobody has said how likely this connection is to exist yet.'
    expect(sentence).toBe(`Strength not judged yet. Olumi put in a placeholder so the model can run — it is not an estimate. Set it if you know it. ${existence}`)
    // Existence has its own valid estimate disclosure; LICENCE (d) governs the strength sentence.
    expect(sentence.slice(0, -(existence.length + 1))).not.toMatch(/Olumi estimated|Olumi.s estimate/)
  })
  it('CONTROL: olumi_estimate retains the existing estimate sentence', () => {
    const data = ingest(wire(mrr, 'pro_plan_price', 'monthly_new_pro_subscribers'), 0, mrr.nodes)
    expect(isStrengthPlaceholder(data)).toBe(false)
    expect(resolveEdgeValuesProvenance(inspectorSources(data)))
      .toBe('Olumi estimated this strength from your description. Olumi estimated how likely this connection is to exist.')
  })
})
