/**
 * THE CHANGES VIEW — the view-model's acceptance rows (row E; lease DL #75 5920620752).
 *
 * The input is ALWAYS the one reader's output: the schemas' own `maximalRunDelta` (0.68.0, parsed by the contract)
 * through `buildRunDeltaView` — never a hand-shaped row. A mark exists only where a producer row or a producer
 * movement names an id on the current graph.
 *
 *   V1  an option's setting marks the OPTION (its card carries the change), not the factor
 *   V2  an option that entered the comparison is `added`; a goal-unit change marks the goal
 *   V3  a removed input is never drawn; its row has no canvas target unless the element is still drawn
 *   V4  ONE READER: every focus entry is keyed by the reader's own row key, one per row, and nothing else
 *   V5  `moved` = the producer's `signal` only, and never while win shares are withheld (row 9)
 *   V6  coverage `not_recorded` marks no input; no comparison marks nothing
 *   V7  a limit marks the goal only when there is exactly one goal
 *   V8  ids are bound verbatim, never parsed out of the key (an id holding ':' still resolves)
 */
import { describe, expect, it } from 'vitest'
import { RunDeltaSchema, type RunDelta } from '@talchain/schemas/boundary'
import { maximalRunDelta } from '@talchain/schemas/fixtures'
import { buildRunDeltaView } from '../../../components/results/analysisNew/runDeltaView'
import { buildGraphChangesView, type CurrentGraph } from '../graphChangesView'

const parse = (d: unknown): RunDelta => {
  const r = RunDeltaSchema.safeParse(d)
  if (!r.success) throw new Error(`fixture does not parse: ${r.error.message}`)
  return r.data
}
const view = (d: unknown) => buildRunDeltaView(parse(d), () => null, () => null)

const GRAPH: CurrentGraph = {
  nodes: [
    { id: 'fixture_goal', kind: 'goal' },
    { id: 'fixture_option_a', kind: 'option' },
    { id: 'fixture_option_b', kind: 'option' },
    { id: 'fixture_option_c', kind: 'option' },
    { id: 'fixture_factor_1', kind: 'factor' },
    { id: 'fixture_factor_2', kind: 'factor' },
  ],
  edges: [{ id: 'e-f1-goal', source: 'fixture_factor_1', target: 'fixture_goal' }],
}

describe('⭐ the contract\'s own delta, on the current graph', () => {
  const v = buildGraphChangesView(view(maximalRunDelta), GRAPH, false)

  it('V1 an option\'s setting marks the OPTION, not the factor', () => {
    expect(v.nodeMarks.get('fixture_option_a')).toBe('changed')
    expect(v.nodeMarks.has('fixture_factor_1')).toBe(false)
  })
  it('V2 an option that entered the comparison is `added`; the goal unit marks the goal', () => {
    expect(v.nodeMarks.get('fixture_option_c')).toBe('added')
    expect(v.nodeMarks.get('fixture_goal')).toBe('changed')
  })
  it('V3 the removed link is not drawn and has no target (the link is not on the canvas)', () => {
    const rows = view(maximalRunDelta).inputs!.rows
    const link = rows.find(r => r.kind === 'link')!
    expect(link.change).toBe('removed')
    expect(v.focusByRowKey.get(link.key)).toBeNull()
    expect(v.edgeMarks.size).toBe(0)
  })
  it('V4 ONE READER: focus entries are the reader\'s row keys, one per row, nothing else', () => {
    const rows = view(maximalRunDelta).inputs!.rows
    expect([...v.focusByRowKey.keys()]).toEqual(rows.map(r => r.key))
  })
  it('CONTROL: nothing the producer did not name is marked (option B moved only within noise)', () => {
    expect([...v.nodeMarks.keys()].sort()).toEqual(['fixture_goal', 'fixture_option_a', 'fixture_option_c'])
    expect(v.nodeMarks.has('fixture_option_b')).toBe(false)
    expect(v.empty).toBe(false)
  })
})

describe('V5 a result mark is the producer\'s signal, and row 9 still holds', () => {
  const signalB = {
    ...maximalRunDelta,
    win_probabilities: [maximalRunDelta.win_probabilities[0], { ...maximalRunDelta.win_probabilities[1], noise_verdict: 'signal' }],
  }
  it('an option whose share moved beyond noise is `moved`', () => {
    expect(buildGraphChangesView(view(signalB), GRAPH, false).nodeMarks.get('fixture_option_b')).toBe('moved')
  })
  it('an input change outranks a result mark on the same option (option A changed AND moved → `changed`)', () => {
    expect(buildGraphChangesView(view(signalB), GRAPH, false).nodeMarks.get('fixture_option_a')).toBe('changed')
  })
  it('withheld win shares mark no option as moved — the input marks stay', () => {
    const v = buildGraphChangesView(view(signalB), GRAPH, true)
    expect(v.nodeMarks.has('fixture_option_b')).toBe(false)
    expect(v.nodeMarks.get('fixture_option_a')).toBe('changed')
  })
})

describe('V6 coverage and absence', () => {
  it('not_recorded marks no input (no rows travel by contract); a signal movement is still a result', () => {
    const { input_changes: _rows, ...rest } = maximalRunDelta
    const v = buildGraphChangesView(view({ ...rest, input_coverage: 'not_recorded' }), GRAPH, false)
    expect(v.focusByRowKey.size).toBe(0)
    expect(v.nodeMarks.has('fixture_goal')).toBe(false)
    expect(v.nodeMarks.has('fixture_option_c')).toBe(false)
  })
  it('partial marks the rows it has', () => {
    const v = buildGraphChangesView(view({ ...maximalRunDelta, input_coverage: 'partial' }), GRAPH, false)
    expect(v.nodeMarks.get('fixture_option_a')).toBe('changed')
  })
  it('no comparison marks nothing and is empty', () => {
    const v = buildGraphChangesView(null, GRAPH, false)
    expect(v.empty).toBe(true)
    expect(v.focusByRowKey.size).toBe(0)
  })
})

describe('V7 a limit is a pill on the goal', () => {
  const limit = {
    ...maximalRunDelta,
    input_changes: [{ entity_kind: 'constraint', entity_id: 'limit_churn', field: 'target', before: { raw: 0.04 }, after: { raw: 0.05 }, change: 'changed' }],
  }
  it('marks the one goal', () => {
    expect(buildGraphChangesView(view(limit), GRAPH, false).nodeMarks.get('fixture_goal')).toBe('changed')
  })
  it('with two goals it guesses neither — the row has no target', () => {
    const two: CurrentGraph = { ...GRAPH, nodes: [...GRAPH.nodes, { id: 'goal_2', kind: 'goal' }] }
    const v = buildGraphChangesView(view(limit), two, false)
    expect(v.nodeMarks.has('fixture_goal')).toBe(false)
    expect([...v.focusByRowKey.values()]).toEqual([null])
  })
})

describe('V8 ids are bound verbatim, never parsed from the key', () => {
  it('a factor id holding \':\' still resolves to its node', () => {
    const colon = {
      ...maximalRunDelta,
      input_changes: [{ entity_kind: 'factor_value', entity_id: 'fac:price:v2', field: 'value', before: { raw: 1 }, after: { raw: 2 }, change: 'changed' }],
    }
    const g: CurrentGraph = { ...GRAPH, nodes: [...GRAPH.nodes, { id: 'fac:price:v2', kind: 'factor' }] }
    const v = buildGraphChangesView(view(colon), g, false)
    expect(v.nodeMarks.get('fac:price:v2')).toBe('changed')
    expect([...v.focusByRowKey.values()]).toEqual([{ kind: 'node', id: 'fac:price:v2' }])
  })
  it('a link row that is still drawn resolves to the edge by its ends', () => {
    const drawn = {
      ...maximalRunDelta,
      input_changes: [{ ...maximalRunDelta.input_changes[1], change: 'changed', after: { raw: 0.6 } }],
    }
    const g: CurrentGraph = { ...GRAPH, edges: [...GRAPH.edges, { id: 'e-f1-f2', source: 'fixture_factor_1', target: 'fixture_factor_2' }] }
    const v = buildGraphChangesView(view(drawn), g, false)
    expect(v.edgeMarks.get('e-f1-f2')).toBe('changed')
  })
})
