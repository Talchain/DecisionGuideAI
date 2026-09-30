/**
 * GRAPH DIFF STAGE 1 — the view-model's acceptance rows (DL #75 5918004424, row E).
 *
 * CONTRACT ROWS: `CONTRACT_ROWS` are `maximalRunDelta.input_changes` from @talchain/schemas 0.68.0's own fixtures
 * (`dist/fixtures/index.js`, the vendored tgz on DGAI #2358 @ a02234c9): same ids, kinds, fields, labels and
 * `change`; `before`/`after`/`kind_*` are left out because this module never reads them. The producer contract wrote
 * them, not this lane. They cover four kinds: an option's setting, a removed link, a goal unit, and an option that
 * entered the comparison. The graph they are marked on is the smallest one holding their ids.
 */
import { describe, expect, it } from 'vitest'
import { buildGraphChangesView, type CurrentGraph, type GraphChangeInput } from '../graphChangesView'

const CONTRACT_ROWS: GraphChangeInput[] = [
  {
    entity_kind: 'option_setting', entity_id: 'fixture_factor_1', option_id: 'fixture_option_a', field: 'value',
    label_before: 'Pro price', label_after: 'Pro price', change: 'changed',
  },
  { entity_kind: 'link', entity_id: 'fixture_factor_1->fixture_factor_2', link: { from: 'fixture_factor_1', to: 'fixture_factor_2' }, field: 'strength', change: 'removed' },
  { entity_kind: 'goal', entity_id: 'fixture_goal', field: 'unit', change: 'changed' },
  { entity_kind: 'option', entity_id: 'fixture_option_c', field: 'presence', change: 'added' },
]

const node = (id: string, kind: string, label = id) => ({ id, kind, label })
const GRAPH: CurrentGraph = {
  nodes: [
    node('fixture_goal', 'goal', 'Monthly revenue'), node('fixture_option_a', 'option', 'Raise to £60'),
    node('fixture_option_b', 'option'), node('fixture_option_c', 'option', 'Keep £49'),
    node('fixture_factor_1', 'factor', 'Pro price'), node('fixture_factor_2', 'factor', 'Churn'),
  ],
  edges: [{ id: 'e-f1-goal', source: 'fixture_factor_1', target: 'fixture_goal' }],
}

describe('⭐ the contract\'s own delta, on the current graph', () => {
  const v = buildGraphChangesView(CONTRACT_ROWS, 'complete', GRAPH)

  it('an option\'s setting marks the OPTION (its card carries the change row), not the factor', () => {
    expect(v.nodeMarks.get('fixture_option_a')).toBe('changed')
    expect(v.nodeMarks.has('fixture_factor_1')).toBe(false)
  })
  it('a goal unit change marks the goal', () => {
    expect(v.nodeMarks.get('fixture_goal')).toBe('changed')
  })
  it('an option that entered the comparison is `added`, not `changed`', () => {
    expect(v.nodeMarks.get('fixture_option_c')).toBe('added')
  })
  it('the removed link is listed, not marked; with no link drawn it has nothing to focus', () => {
    expect(v.removed.map(r => r.key)).toEqual(['link:fixture_factor_1->fixture_factor_2:strength'])
    expect(v.removed[0].focus).toBeNull()
    expect(v.edgeMarks.size).toBe(0)
  })
  it('CONTROL: nothing the producer did not name is marked', () => {
    expect([...v.nodeMarks.keys()].sort()).toEqual(['fixture_goal', 'fixture_option_a', 'fixture_option_c'])
    expect(v.nodeMarks.has('fixture_option_b')).toBe(false)
    expect(v.notOnGraph).toEqual([])
    expect(v.empty).toBe(false)
  })
})

describe('coverage decides whether anything is marked', () => {
  it('partial marks the rows it has and says partial', () => {
    const v = buildGraphChangesView(CONTRACT_ROWS, 'partial', GRAPH)
    expect(v.coverage).toBe('partial')
    expect(v.nodeMarks.get('fixture_option_a')).toBe('changed')
  })
  it('not_recorded marks nothing, even if rows were passed', () => {
    const v = buildGraphChangesView(CONTRACT_ROWS, 'not_recorded', GRAPH)
    expect(v.coverage).toBe('not_recorded')
    expect(v.nodeMarks.size + v.edgeMarks.size + v.removed.length + v.notOnGraph.length).toBe(0)
  })
  it('a pre-0.68 producer (no coverage) reads as unknown and marks nothing', () => {
    const v = buildGraphChangesView(CONTRACT_ROWS, undefined, GRAPH)
    expect(v.coverage).toBe('unknown')
    expect(v.empty).toBe(true)
  })
  it('complete with no rows is empty', () => {
    const v = buildGraphChangesView([], 'complete', GRAPH)
    expect(v.empty).toBe(true)
    expect(v.coverage).toBe('complete')
  })
})

describe('removed, moved and ambiguous inputs are listed, never dropped or guessed', () => {
  it('a removed link that is still drawn is focusable', () => {
    const drawn: CurrentGraph = { ...GRAPH, edges: [...GRAPH.edges, { id: 'e-f1-f2', source: 'fixture_factor_1', target: 'fixture_factor_2' }] }
    const v = buildGraphChangesView([CONTRACT_ROWS[1]], 'complete', drawn)
    expect(v.removed[0].focus).toEqual({ kind: 'edge', id: 'e-f1-f2' })
    expect(v.edgeMarks.size).toBe(0)
  })
  it('an option that LEFT the comparison but is still drawn is listed and focusable, not marked', () => {
    const left: GraphChangeInput = { entity_kind: 'option', entity_id: 'fixture_option_b', field: 'presence', label_before: 'Hybrid', change: 'removed' }
    const v = buildGraphChangesView([left], 'complete', GRAPH)
    expect(v.removed).toEqual([{ key: 'option:fixture_option_b:presence', entityKind: 'option', field: 'presence', label: 'Hybrid', focus: { kind: 'node', id: 'fixture_option_b' } }])
    expect(v.nodeMarks.size).toBe(0)
  })
  it('a changed input whose node is gone from the current graph goes to notOnGraph', () => {
    const gone: GraphChangeInput = { entity_kind: 'factor_value', entity_id: 'fac_deleted_since', field: 'value', label_after: 'Support cost', change: 'changed' }
    const v = buildGraphChangesView([gone], 'complete', GRAPH)
    expect(v.notOnGraph.map(r => [r.key, r.label, r.focus])).toEqual([['factor_value:fac_deleted_since:value', 'Support cost', null]])
    expect(v.nodeMarks.size).toBe(0)
  })
  it('a changed link that is drawn is marked on the edge', () => {
    const link: GraphChangeInput = { entity_kind: 'link', entity_id: 'x', link: { from: 'fixture_factor_1', to: 'fixture_goal' }, field: 'strength', change: 'changed' }
    expect(buildGraphChangesView([link], 'complete', GRAPH).edgeMarks.get('e-f1-goal')).toBe('changed')
  })
})

describe('limits live on the goal card', () => {
  const limit: GraphChangeInput = { entity_kind: 'constraint', entity_id: 'c1', field: 'target', label_after: 'Churn under 4%', change: 'changed' }
  it('one goal: the limit marks it', () => {
    expect(buildGraphChangesView([limit], 'complete', GRAPH).nodeMarks.get('fixture_goal')).toBe('changed')
  })
  it('CONTROL: two goals: never guessed onto one; listed instead', () => {
    const two: CurrentGraph = { ...GRAPH, nodes: [...GRAPH.nodes, node('goal_2', 'goal')] }
    const v = buildGraphChangesView([limit], 'complete', two)
    expect(v.nodeMarks.size).toBe(0)
    expect(v.notOnGraph.map(r => r.label)).toEqual(['Churn under 4%'])
  })
})

describe('precedence', () => {
  it('`added` outranks `changed` on the same option, whichever row comes first', () => {
    const setting: GraphChangeInput = { entity_kind: 'option_setting', entity_id: 'fixture_factor_1', option_id: 'fixture_option_c', field: 'value', change: 'changed' }
    expect(buildGraphChangesView([CONTRACT_ROWS[3], setting], 'complete', GRAPH).nodeMarks.get('fixture_option_c')).toBe('added')
    expect(buildGraphChangesView([setting, CONTRACT_ROWS[3]], 'complete', GRAPH).nodeMarks.get('fixture_option_c')).toBe('added')
  })
  it('the label falls back to the current graph\'s, never invented', () => {
    const v = buildGraphChangesView([{ entity_kind: 'factor_value', entity_id: 'fixture_factor_2', field: 'value', change: 'removed' }], 'complete', GRAPH)
    expect(v.removed[0].label).toBe('Churn')
    const link = buildGraphChangesView([CONTRACT_ROWS[1]], 'complete', GRAPH)
    expect(link.removed[0].label).toBeNull()
  })
})
