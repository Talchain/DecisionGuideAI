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
  it('names the FIRST assumed edge in PRODUCER ORDER, bound by edge id', () => {
    const d = selectAssumedStrengthToResolve({
      fragileEdges: [
        fragileRow('n_demand', 'n_rev', ABOVE, { alternative_winner_label: 'Consolidate' }),
        fragileRow('n_price', 'n_cost', ALSO_ABOVE),
      ],
      edges: [assumedEdge('e_demand_rev', 'n_demand', 'n_rev'), assumedEdge('e_price_cost', 'n_price', 'n_cost')],
      nodeLabels: labels,
    })
    expect(d.selected?.edgeId).toBe('e_demand_rev')
    expect(d.refusalReason).toBeNull()
    expect(d.selected?.fromLabel).toBe('Customer demand')
    expect(d.selected?.toLabel).toBe('Revenue growth')
    expect(d.selected?.alternativeWinnerLabel).toBe('Consolidate')
    expect(d.assumedFragileCount).toBe(2)
  })

  it('SKIPS a higher-ranked edge whose strength somebody SET, and names the next assumed one', () => {
    // The discriminating case: rank 1 is the MORE fragile edge, but it is not an
    // assumption — it is a number the user chose. Re-eliciting it would be
    // telling a team its own decision is a placeholder.
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

  it('excludes a row AT or BELOW the visibility floor', () => {
    const d = selectAssumedStrengthToResolve({
      fragileEdges: [fragileRow('n_demand', 'n_rev', THRESHOLDS.FRAGILE_EDGE_FILTER)],
      edges: [assumedEdge('e_demand_rev', 'n_demand', 'n_rev')],
      nodeLabels: labels,
    })
    expect(d.selected).toBeNull()
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

  it('F4 — the FIRST-ROW rule is only correct because the producer sorts DESCENDING', () => {
    // The selector consumes wire order and never re-ranks. That is right ONLY
    // while ISL emits `fragile_edges` sorted by `switch_probability`
    // descending — verified across every committed live capture. This pins the
    // PRECONDITION in-test, so if the producer ever stopped sorting, this REDs
    // here (a named, explained failure) instead of the product quietly naming
    // the wrong relationship as the one that matters most.
    const rows = [
      fragileRow('n_demand', 'n_rev', 0.45),
      fragileRow('n_price', 'n_cost', 0.20),
    ]
    const probs = rows.map(r => r.switch_probability)
    expect(
      probs.every((p, i) => i === 0 || probs[i - 1] >= p),
      'this fixture must be in producer (descending) order, or the assertion below proves nothing',
    ).toBe(true)

    const d = selectAssumedStrengthToResolve({
      rows: undefined,
      fragileEdges: rows,
      edges: [assumedEdge('e_demand_rev', 'n_demand', 'n_rev'), assumedEdge('e_price_cost', 'n_price', 'n_cost')],
      nodeLabels: labels,
    } as Parameters<typeof selectAssumedStrengthToResolve>[0])
    // First in wire order === highest switch probability, so "first" and
    // "most decision-relevant" coincide. Both facts asserted, not just one.
    expect(d.selected?.edgeId).toBe('e_demand_rev')
    expect(d.selected?.switchProbability).toBe(Math.max(...probs))
  })

  it('tolerates malformed rows without dropping the whole decision', () => {
    const d = selectAssumedStrengthToResolve({
      fragileEdges: [null, 'nonsense', 42, fragileRow('n_demand', 'n_rev', ABOVE)],
      edges: [assumedEdge('e_demand_rev', 'n_demand', 'n_rev')],
      nodeLabels: labels,
    })
    expect(d.selected?.edgeId).toBe('e_demand_rev')
  })
})
