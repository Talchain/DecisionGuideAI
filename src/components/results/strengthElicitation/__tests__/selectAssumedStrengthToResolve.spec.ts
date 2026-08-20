/**
 * The join: which ASSUMED strength is worth resolving next.
 *
 * Every assertion binds to its object by IDENTITY (`edgeId`), never by a value
 * predicate another edge could satisfy — the defect where a spec found a factor
 * `by value` and a different object satisfied it while the real producer was
 * deleted under a green suite.
 */
import { describe, it, expect } from 'vitest'
import {
  selectAssumedStrengthToResolve,
  type ElicitationCanvasEdge,
} from '../selectAssumedStrengthToResolve'
import { THRESHOLDS } from '../../../../lib/mappers/constants'
import { DEFAULT_EDGE_DATA, USER_EDGE_DEFAULTS } from '../../../../canvas/domain/edges'
// COMMITTED CAPTURES, not fixtures this spec authored. A hand-written array
// encodes the author's model of ISL; these are what ISL actually emitted.
import nonDescendingCapture from '../../../../v5/__tests__/fixtures/v5-analysis-result.bundle-45c9b625.json'
import descendingCapture from '../../../../v5/__tests__/fixtures/live-analysis-turn-walkA-2026-08-04.json'

const labels = new Map<string, string>([
  ['n_demand', 'Customer demand'],
  ['n_price', 'Pricing power'],
  ['n_rev', 'Revenue growth'],
  ['n_cost', 'Unit cost'],
])

/** An edge whose strength NOBODY set — the drafted default, no source stamp. */
const assumedEdge = (id: string, source: string, target: string): ElicitationCanvasEdge => ({
  id,
  source,
  target,
  data: { ...DEFAULT_EDGE_DATA },
})

/** The SAME numeric weight, but stamped — a value somebody chose. */
const setEdge = (
  id: string,
  source: string,
  target: string,
  weightSource: 'user' | 'cee' | 'template' = 'user',
): ElicitationCanvasEdge => ({
  id,
  source,
  target,
  data: { ...DEFAULT_EDGE_DATA, weightSource },
})

const ABOVE = THRESHOLDS.FRAGILE_EDGE_FILTER + 0.2
const ALSO_ABOVE = THRESHOLDS.FRAGILE_EDGE_FILTER + 0.1

const fragileRow = (
  from: string,
  to: string,
  switch_probability: number,
  extra: Record<string, unknown> = {},
) => ({ from_id: from, to_id: to, switch_probability, ...extra })

describe('selectAssumedStrengthToResolve — the assumed × decision-relevant join', () => {
  it('names the eligible edge with the HIGHEST measured switch probability', () => {
    const d = selectAssumedStrengthToResolve({
      fragileEdges: [
        fragileRow('n_demand', 'n_rev', ALSO_ABOVE),
        fragileRow('n_price', 'n_cost', ABOVE, { alternative_winner_label: 'Consolidate' }),
      ],
      edges: [assumedEdge('e_demand_rev', 'n_demand', 'n_rev'), assumedEdge('e_price_cost', 'n_price', 'n_cost')],
      nodeLabels: labels,
    })
    expect(d.selected?.edgeId).toBe('e_price_cost')
    expect(d.refusalReason).toBeNull()
    expect(d.selected?.fromLabel).toBe('Pricing power')
    expect(d.selected?.toLabel).toBe('Unit cost')
    expect(d.selected?.alternativeWinnerLabel).toBe('Consolidate')
    expect(d.assumedFragileCount).toBe(2)
  })

  it('SKIPS a higher-ranked edge whose strength somebody SET, and names the next assumed one', () => {
    // The discriminating case: rank 1 is the MORE fragile edge, but it is not an
    // assumption — it is a number the user chose. Re-eliciting it would be
    // telling a team its own confirmed judgement is still unresolved.
    const d = selectAssumedStrengthToResolve({
      fragileEdges: [
        fragileRow('n_demand', 'n_rev', ABOVE),
        fragileRow('n_price', 'n_cost', ALSO_ABOVE),
      ],
      edges: [setEdge('e_demand_rev', 'n_demand', 'n_rev'), assumedEdge('e_price_cost', 'n_price', 'n_cost')],
      nodeLabels: labels,
    })
    expect(d.selected?.edgeId).toBe('e_price_cost')
    expect(d.assumedFragileCount).toBe(1)
  })

  it.each(['user', 'cee', 'template'] as const)(
    'treats weightSource=%s as SET, never as an assumption to re-elicit',
    (src) => {
      const d = selectAssumedStrengthToResolve({
        fragileEdges: [fragileRow('n_demand', 'n_rev', ABOVE)],
        edges: [setEdge('e_demand_rev', 'n_demand', 'n_rev', src)],
        nodeLabels: labels,
      })
      expect(d.selected).toBeNull()
      expect(d.refusalReason).toBe('all_strengths_set')
    },
  )

  it('counts USER_EDGE_DEFAULTS (weight 0.3, unstamped) as ASSUMED — provenance, not value', () => {
    // The retired heuristic `every(w => w === 0.5)` called 0.3 "a real value".
    // The marker answers it exactly: no stamp means nobody set it.
    expect(USER_EDGE_DEFAULTS.weight).toBe(0.3)
    const d = selectAssumedStrengthToResolve({
      fragileEdges: [fragileRow('n_demand', 'n_rev', ABOVE)],
      edges: [{ id: 'e_demand_rev', source: 'n_demand', target: 'n_rev', data: { ...USER_EDGE_DEFAULTS } }],
      nodeLabels: labels,
    })
    expect(d.selected?.edgeId).toBe('e_demand_rev')
  })

  it('creation origin cannot resolve a field: origin=user stays assumed until weightSource=user', () => {
    const rows = [fragileRow('n_demand', 'n_rev', ABOVE)]
    const userCreated: ElicitationCanvasEdge = {
      id: 'e_demand_rev',
      source: 'n_demand',
      target: 'n_rev',
      data: { ...USER_EDGE_DEFAULTS, origin: 'user' },
    }

    const defaultStrength = selectAssumedStrengthToResolve({
      fragileEdges: rows,
      edges: [userCreated],
      nodeLabels: labels,
    })
    expect(defaultStrength.selected?.edgeId).toBe('e_demand_rev')

    const userSetStrength = selectAssumedStrengthToResolve({
      fragileEdges: rows,
      edges: [{ ...userCreated, data: { ...userCreated.data, weightSource: 'user' } }],
      nodeLabels: labels,
    })
    expect(userSetStrength.selected).toBeNull()
    expect(userSetStrength.refusalReason).toBe('all_strengths_set')
  })

  it('counts a user who CHOSE 0.5 as SET — the same number, the opposite verdict', () => {
    expect(DEFAULT_EDGE_DATA.weight).toBe(0.5)
    const d = selectAssumedStrengthToResolve({
      fragileEdges: [fragileRow('n_demand', 'n_rev', ABOVE)],
      edges: [{ id: 'e_demand_rev', source: 'n_demand', target: 'n_rev', data: { weight: 0.5, weightSource: 'user' } }],
      nodeLabels: labels,
    })
    expect(d.selected).toBeNull()
    expect(d.refusalReason).toBe('all_strengths_set')
  })

  it('AI-inferred 0.5 is unresolved; a USER-SET 0.5 on the same AI-created edge is resolved', () => {
    const ceeDraft: ElicitationCanvasEdge = {
      id: 'e_demand_rev',
      source: 'n_demand',
      target: 'n_rev',
      data: {
        weight: 0.5,
        weightSource: 'cee',
        provenanceDisplay: 'ai_inferred',
        origin: 'ai',
      },
    }
    const rows = [fragileRow('n_demand', 'n_rev', ABOVE)]

    const ai = selectAssumedStrengthToResolve({
      fragileEdges: rows,
      edges: [ceeDraft],
      nodeLabels: labels,
    })
    expect(ai.selected?.edgeId).toBe('e_demand_rev')
    expect(ai.selected?.strengthProvenance).toBe('ai_inferred')

    // The editor writes the field-specific user stamp and correctly leaves the
    // edge's AI creation provenance intact. Same number, opposite eligibility.
    const user = selectAssumedStrengthToResolve({
      fragileEdges: rows,
      edges: [{ ...ceeDraft, data: { ...ceeDraft.data, weightSource: 'user' } }],
      nodeLabels: labels,
    })
    expect(user.selected).toBeNull()
    expect(user.refusalReason).toBe('all_strengths_set')
  })

  it.each([
    ['provenanceDisplay=ai_inferred', { provenanceDisplay: 'ai_inferred' }],
    ['origin=ai', { origin: 'ai' }],
  ])('%s independently keeps a CEE numeric strength unresolved', (_label, provenance) => {
    const d = selectAssumedStrengthToResolve({
      fragileEdges: [fragileRow('n_demand', 'n_rev', ABOVE)],
      edges: [{
        id: 'e_demand_rev',
        source: 'n_demand',
        target: 'n_rev',
        data: { weight: 0.5, weightSource: 'cee', ...provenance },
      }],
      nodeLabels: labels,
    })
    expect(d.selected?.edgeId).toBe('e_demand_rev')
    expect(d.selected?.strengthProvenance).toBe('ai_inferred')
  })

  it('classifies an unstamped default as missing, never as an AI estimate', () => {
    const d = selectAssumedStrengthToResolve({
      fragileEdges: [fragileRow('n_demand', 'n_rev', ABOVE)],
      edges: [assumedEdge('e_demand_rev', 'n_demand', 'n_rev')],
      nodeLabels: labels,
    })
    expect(d.selected?.strengthProvenance).toBe('missing')
  })

  it('does not let AI edge-creation provenance launder an unstamped default into an estimate', () => {
    const d = selectAssumedStrengthToResolve({
      fragileEdges: [fragileRow('n_demand', 'n_rev', ABOVE)],
      edges: [{
        ...assumedEdge('e_demand_rev', 'n_demand', 'n_rev'),
        data: { ...DEFAULT_EDGE_DATA, origin: 'ai', provenanceDisplay: 'ai_inferred' },
      }],
      nodeLabels: labels,
    })
    expect(d.selected?.strengthProvenance).toBe('missing')
  })

  it.each([
    THRESHOLDS.FRAGILE_EDGE_FILTER,
    THRESHOLDS.FRAGILE_EDGE_FILTER - 0.01,
  ])('keeps a candidate silent at or below the visibility floor (%s)', (switchProbability) => {
    const d = selectAssumedStrengthToResolve({
      fragileEdges: [fragileRow('n_demand', 'n_rev', switchProbability)],
      edges: [assumedEdge('e_demand_rev', 'n_demand', 'n_rev')],
      nodeLabels: labels,
    })
    expect(d.selected).toBeNull()
    expect(d.assumedFragileCount).toBe(0)
    expect(d.refusalReason).toBe('no_fragile_edges')
  })

  it('NEVER falls back to marginal_switch_probability for the surfaced number', () => {
    // The producer declares these as DIFFERENT Monte Carlos. A row carrying only
    // the marginal quantity has no measured switch probability to show, so it is
    // not surfaced — it is not resurrected under flip-risk wording.
    const d = selectAssumedStrengthToResolve({
      fragileEdges: [{ from_id: 'n_demand', to_id: 'n_rev', marginal_switch_probability: ABOVE }],
      edges: [assumedEdge('e_demand_rev', 'n_demand', 'n_rev')],
      nodeLabels: labels,
    })
    expect(d.selected).toBeNull()
  })

  it('matches by edge_id in preference to the from/to pair', () => {
    const d = selectAssumedStrengthToResolve({
      fragileEdges: [fragileRow('n_demand', 'n_rev', ABOVE, { edge_id: 'e_explicit' })],
      edges: [
        assumedEdge('e_explicit', 'n_demand', 'n_rev'),
        assumedEdge('e_pair_only', 'n_demand', 'n_rev'),
      ],
      nodeLabels: labels,
    })
    expect(d.selected?.edgeId).toBe('e_explicit')
  })

  it('carries the MEASURED switch probability, not a re-derived or defaulted one', () => {
    const d = selectAssumedStrengthToResolve({
      fragileEdges: [fragileRow('n_demand', 'n_rev', 0.42)],
      edges: [assumedEdge('e_demand_rev', 'n_demand', 'n_rev')],
      nodeLabels: labels,
    })
    expect(d.selected?.switchProbability).toBe(0.42)
  })

  it('omits alternativeWinnerLabel rather than inventing one', () => {
    const d = selectAssumedStrengthToResolve({
      fragileEdges: [fragileRow('n_demand', 'n_rev', ABOVE)],
      edges: [assumedEdge('e_demand_rev', 'n_demand', 'n_rev')],
      nodeLabels: labels,
    })
    expect(d.selected?.alternativeWinnerLabel).toBeNull()
  })

  describe('absence is a VERDICT — each refusal names a different fact', () => {
    it.each([
      ['absent', undefined],
      ['null', null],
      ['empty', []],
      ['not an array', { rows: [] }],
    ])('no_robustness_data when fragile_edges is %s', (_n, rows) => {
      const d = selectAssumedStrengthToResolve({ fragileEdges: rows, edges: [], nodeLabels: labels })
      expect(d.refusalReason).toBe('no_robustness_data')
    })

    it('no_edge_identity when a row matches no canvas edge', () => {
      const d = selectAssumedStrengthToResolve({
        fragileEdges: [fragileRow('n_ghost', 'n_rev', ABOVE)],
        edges: [assumedEdge('e_demand_rev', 'n_demand', 'n_rev')],
        nodeLabels: labels,
      })
      expect(d.refusalReason).toBe('no_edge_identity')
    })

    it('no_edge_identity when the matched edge has no nameable label', () => {
      const d = selectAssumedStrengthToResolve({
        fragileEdges: [fragileRow('n_unlabelled', 'n_rev', ABOVE)],
        edges: [assumedEdge('e_x', 'n_unlabelled', 'n_rev')],
        nodeLabels: labels,
      })
      expect(d.refusalReason).toBe('no_edge_identity')
      expect(d.selected).toBeNull()
    })

    it('all_strengths_set is distinguishable from no_fragile_edges', () => {
      const allSet = selectAssumedStrengthToResolve({
        fragileEdges: [fragileRow('n_demand', 'n_rev', ABOVE)],
        edges: [setEdge('e_demand_rev', 'n_demand', 'n_rev')],
        nodeLabels: labels,
      })
      const nothingFragile = selectAssumedStrengthToResolve({
        fragileEdges: [fragileRow('n_demand', 'n_rev', 0.01)],
        edges: [assumedEdge('e_demand_rev', 'n_demand', 'n_rev')],
        nodeLabels: labels,
      })
      expect(allSet.refusalReason).toBe('all_strengths_set')
      expect(nothingFragile.refusalReason).toBe('no_fragile_edges')
      expect(allSet.refusalReason).not.toBe(nothingFragile.refusalReason)
    })

    it('every refusal carries a null selection, and every selection a null refusal', () => {
      const cases = [
        { fragileEdges: undefined, edges: [], nodeLabels: labels },
        { fragileEdges: [fragileRow('n_demand', 'n_rev', ABOVE)], edges: [assumedEdge('e1', 'n_demand', 'n_rev')], nodeLabels: labels },
        { fragileEdges: [fragileRow('n_demand', 'n_rev', ABOVE)], edges: [setEdge('e1', 'n_demand', 'n_rev')], nodeLabels: labels },
      ]
      for (const c of cases) {
        const d = selectAssumedStrengthToResolve(c)
        expect(d.selected === null).toBe(d.refusalReason !== null)
      }
    })
  })

  it('F3 — counts DISTINCT EDGES, not rows: a duplicated row cannot inflate "and N others"', () => {
    // One canvas edge named twice by the producer is ONE assumption. Counting
    // rows would say "1 other relationship" when there is none, and the
    // sentence would read perfectly well while being false.
    const d = selectAssumedStrengthToResolve({
      fragileEdges: [
        fragileRow('n_demand', 'n_rev', ABOVE),
        fragileRow('n_demand', 'n_rev', ABOVE, { edge_id: 'e_demand_rev' }),
      ],
      edges: [assumedEdge('e_demand_rev', 'n_demand', 'n_rev')],
      nodeLabels: labels,
    })
    expect(d.selected?.edgeId).toBe('e_demand_rev')
    expect(d.assumedFragileCount).toBe(1)
  })

  it('F4 — an unsorted producer payload cannot make array position outrank the measured score', () => {
    // This is the load-bearing contrast refuted by committed captures. It REDs
    // under the old first-row implementation and under a min-score mutant.
    const rows = [
      fragileRow('n_demand', 'n_rev', 0.22),
      fragileRow('n_price', 'n_cost', 0.548),
    ]

    const d = selectAssumedStrengthToResolve({
      fragileEdges: rows,
      edges: [assumedEdge('e_demand_rev', 'n_demand', 'n_rev'), assumedEdge('e_price_cost', 'n_price', 'n_cost')],
      nodeLabels: labels,
    })
    expect(d.selected?.edgeId).toBe('e_price_cost')
    expect(d.selected?.switchProbability).toBe(0.548)
    expect(d.selected?.edgeId).not.toBe('e_demand_rev')
  })

  it('breaks an equal-score tie by stable edge identity without claiming one score is larger', () => {
    const d = selectAssumedStrengthToResolve({
      fragileEdges: [
        fragileRow('n_price', 'n_cost', ABOVE),
        fragileRow('n_demand', 'n_rev', ABOVE),
      ],
      edges: [
        assumedEdge('z-price-cost', 'n_price', 'n_cost'),
        assumedEdge('a-demand-rev', 'n_demand', 'n_rev'),
      ],
      nodeLabels: labels,
    })
    expect(d.selected?.edgeId).toBe('a-demand-rev')
    expect(d.selected?.switchProbability).toBe(ABOVE)
  })

  it('a duplicated edge row cannot lend its score to its twin — each row is scored on its OWN number', () => {
    // The header claims this ("prevents a duplicated edge row earlier in the
    // payload from lending its number to a later row") and, until this test,
    // nothing held it: a mutant that passed ALL rows to the score helper
    // SURVIVED the whole suite. Unreachable on observed data — zero duplicated
    // edge identities across all 29 distinct committed arrays — which is
    // exactly why it is pinned rather than trusted: a producer change would
    // make it reachable silently.
    const d = selectAssumedStrengthToResolve({
      fragileEdges: [
        fragileRow('n_demand', 'n_rev', 0.20),
        fragileRow('n_demand', 'n_rev', 0.55),
      ],
      edges: [assumedEdge('e_demand_rev', 'n_demand', 'n_rev')],
      nodeLabels: labels,
    })
    // Bound by identity, and by the number that belongs to the winning ROW.
    expect(d.selected?.edgeId).toBe('e_demand_rev')
    expect(d.selected?.switchProbability).toBe(0.55)
    // One canvas edge is ONE assumption, however many rows name it.
    expect(d.assumedFragileCount).toBe(1)
  })

  it('tolerates malformed rows without dropping the whole decision', () => {
    const d = selectAssumedStrengthToResolve({
      fragileEdges: [null, 'nonsense', 42, fragileRow('n_demand', 'n_rev', ABOVE)],
      edges: [assumedEdge('e_demand_rev', 'n_demand', 'n_rev')],
      nodeLabels: labels,
    })
    expect(d.selected?.edgeId).toBe('e_demand_rev')
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY, 1.01])(
    'does not let an invalid probability (%s) poison the maximum',
    (invalid) => {
      const d = selectAssumedStrengthToResolve({
        fragileEdges: [
          fragileRow('n_demand', 'n_rev', invalid),
          fragileRow('n_price', 'n_cost', 0.548),
        ],
        edges: [
          assumedEdge('e_demand_rev', 'n_demand', 'n_rev'),
          assumedEdge('e_price_cost', 'n_price', 'n_cost'),
        ],
        nodeLabels: labels,
      })
      expect(d.selected?.edgeId).toBe('e_price_cost')
      expect(d.selected?.switchProbability).toBe(0.548)
    },
  )
})

/**
 * ── THE PRODUCER'S OWN PAYLOADS ────────────────────────────────────────────
 *
 * Both arrays below are COMMITTED CAPTURES of real ISL output. The canvas
 * edges and node labels are DERIVED FROM THE ROWS THEMSELVES (`edge_id`,
 * `from_id`/`to_id`, `from_label`/`to_label`), so nothing in this section is a
 * shape this spec invented — the point of the defect was that a self-authored
 * fixture had certified an ordering the producer never promised.
 *
 * Each test PINS ITS OWN PRECONDITION before asserting the outcome. Without
 * that, a later fixture edit could remove the property under test and both
 * tests would keep passing while proving nothing.
 */
interface CaptureRow {
  readonly edge_id: string
  readonly from_id: string
  readonly to_id: string
  readonly from_label: string
  readonly to_label: string
  readonly switch_probability: number
}

/** Every captured row becomes an UNRESOLVED canvas edge keyed by the producer's own id. */
const capturedEdges = (rows: readonly CaptureRow[]): ElicitationCanvasEdge[] =>
  rows.map((r) => ({
    id: r.edge_id,
    source: r.from_id,
    target: r.to_id,
    data: { ...DEFAULT_EDGE_DATA },
  }))

const capturedLabels = (rows: readonly CaptureRow[]): Map<string, string> => {
  const m = new Map<string, string>()
  for (const r of rows) {
    m.set(r.from_id, r.from_label)
    m.set(r.to_id, r.to_label)
  }
  return m
}

/** Rows the visibility floor admits — the only population the surface can name. */
const aboveFloor = (rows: readonly CaptureRow[]): CaptureRow[] =>
  rows.filter((r) => r.switch_probability > THRESHOLDS.FRAGILE_EDGE_FILTER)

const NON_DESCENDING_ROWS = (nonDescendingCapture as unknown as {
  block: { enrichment: { robustness: { fragile_edges: CaptureRow[] } } }
}).block.enrichment.robustness.fragile_edges

const DESCENDING_ROWS = (descendingCapture as unknown as {
  blocks: { enrichment: { robustness: { fragile_edges: CaptureRow[] } } }[]
}).blocks[0].enrichment.robustness.fragile_edges

describe('selectAssumedStrengthToResolve — against COMMITTED ISL captures', () => {
  it('CAPTURE (max NOT at index 0): names the highest-scoring edge by IDENTITY, not the first row', () => {
    const rows = aboveFloor(NON_DESCENDING_ROWS)

    // PRECONDITION — this capture must actually exhibit the defect, or the
    // assertion below proves nothing. Bound by identity, not by position.
    expect(rows.length).toBeGreaterThan(1)
    const maxRow = rows.reduce((a, b) => (b.switch_probability > a.switch_probability ? b : a))
    expect(maxRow.edge_id).toBe('fac_marketing_expertise->out_campaign_effectiveness')
    expect(rows[0].edge_id).toBe('fac_ad_spend->risk_budget_overrun')
    expect(rows[0].edge_id).not.toBe(maxRow.edge_id) // the defect, present in this payload

    const d = selectAssumedStrengthToResolve({
      fragileEdges: NON_DESCENDING_ROWS,
      edges: capturedEdges(NON_DESCENDING_ROWS),
      nodeLabels: capturedLabels(NON_DESCENDING_ROWS),
    })

    // RED under the `fragile_edges[0]` rule, which names the 0.164 row.
    expect(d.selected?.edgeId).toBe('fac_marketing_expertise->out_campaign_effectiveness')
    expect(d.selected?.edgeId).not.toBe('fac_ad_spend->risk_budget_overrun')
    expect(d.selected?.switchProbability).toBe(maxRow.switch_probability)
    expect(d.selected?.fromLabel).toBe('Marketing Strategy Quality')
    expect(d.selected?.toLabel).toBe('Campaign Conversion Effectiveness')
    expect(d.refusalReason).toBeNull()
  })

  it('CAPTURE (already descending): selects exactly the edge the producer-order rule selected — a strict improvement, not a swap', () => {
    const rows = aboveFloor(DESCENDING_ROWS)

    // PRECONDITION — this capture must be the OPPOSITE case: already ordered,
    // so first row and maximum row are the same edge. If a fixture edit broke
    // that, this test would silently stop testing the no-regression direction.
    expect(rows.length).toBeGreaterThan(1)
    const maxRow = rows.reduce((a, b) => (b.switch_probability > a.switch_probability ? b : a))
    expect(rows[0].edge_id).toBe(maxRow.edge_id)
    expect(rows[0].edge_id).toBe('fac_selfserve->out_product_led_growth')

    const d = selectAssumedStrengthToResolve({
      fragileEdges: DESCENDING_ROWS,
      edges: capturedEdges(DESCENDING_ROWS),
      nodeLabels: capturedLabels(DESCENDING_ROWS),
    })

    // GREEN both before and after the fix. The old rule took `[0]`; the new
    // rule takes the maximum; on this payload they are the same edge.
    expect(d.selected?.edgeId).toBe('fac_selfserve->out_product_led_growth')
    expect(d.selected?.switchProbability).toBe(rows[0].switch_probability)
    expect(d.refusalReason).toBeNull()
  })
})
