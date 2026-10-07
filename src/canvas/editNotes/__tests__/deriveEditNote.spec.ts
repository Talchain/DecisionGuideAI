import { describe, expect, it } from 'vitest'
import { deriveEditNote, type EditGraph, type ManualEdit } from '../deriveEditNote'
import served from '../../hooks/__tests__/fixtures/cee-persisted-graph-wire-2026-08-12.json'

// SELF-AUTHORED hiring row, using the observed_state and object-valued interventions
// shape of the served CRM draft below. No served hiring draft exists in node fixtures.
const hiring = (): EditGraph => ({
  nodes: [
    { id: 'developer_hires', type: 'factor', data: { label: 'Developer Hires', observed_state: { value: 0 } } },
    { id: 'existing_team', type: 'factor', data: { label: 'Existing team', observed_state: { value: 5 } } },
    { id: 'hire', type: 'option', data: { label: 'Hire two developers', interventions: { developer_hires: { value: 2 } } } },
    { id: 'carry', type: 'option', data: { label: 'Carry on as now', interventions: {} } },
    { id: 'goal', type: 'goal', data: { label: 'meet our next feature-launch deadline' } },
  ], edges: [{ id: 'path', source: 'developer_hires', target: 'goal' }],
})
const edit = (kind: ManualEdit['kind'], elementId: string, extra = {}): ManualEdit => ({ kind, elementId, accepted: true, ...extra })
const note = (e: ManualEdit, before: EditGraph, after = before) => deriveEditNote({ edit: e, before, after })
const assertNote = (result: ReturnType<typeof note>, check: string, id: string, words: string) => {
  expect(result).toMatchObject({ check, elementId: id, words })
  expect(result!.actions.length).toBeLessThanOrEqual(3)
}

describe('after-edit checks, bound by identity and exact words', () => {
  // SELF-AUTHORED slice-2 rows. Edges use the canvas shape (`strength_mean` signed, `direction`), as
  // `edgeValueProvenance.resolveEdgeSignedStrengthDisplay` reads it.
  const runGraph = (): EditGraph => ({ nodes: [
    { id: 'a', type: 'factor', data: { label: 'Demand', observed_state: { value: 4, unit: '%' } } },
    { id: 'b', type: 'goal', data: { label: 'Growth', goal_threshold_raw: 10 } },
    { id: 'o', type: 'option', data: { label: 'Launch', interventions: { a: { value: 6 } } } },
  ], edges: [{ id: 'ab', source: 'a', target: 'b', data: { strength_mean: 0.3, direction: 'positive' } as Record<string, unknown> }] })
  const linkDriver = { kind: 'link_strength' as const, from: 'a', to: 'b', strength: 'stronger' as const, authoredBy: 'user' as const, userStatedLink: true }
  const visibleRun = { visible: true, runId: 'run-1', drivers: { o: linkDriver } }
  const fragileAB = [{ edge_id: 'ab', from: 'a', to: 'b', switch_probability: 0.8 }]
  const resized = () => { const before = runGraph(), after = structuredClone(before); after.edges[0].data!.strength_mean = 0.55; return { before, after } }
  const reversed = () => { const before = runGraph(), after = structuredClone(before); Object.assign(after.edges[0].data!, { strength_mean: -0.3, direction: 'negative' }); return { before, after } }
  const strengthEdit = edit('edge_strength_edit', 'ab')

  it('S1: a resized driver link beats fragility, with exact words and actions', () => {
    const { before, after } = resized()
    const result = deriveEditNote({ edit: strengthEdit, before, after, lastRun: { ...visibleRun, fragileEdges: fragileAB } })
    assertNote(result, 'S1', 'ab', 'The chance for ‘Launch’ rests most on this link, so this change could move it a lot. Run again to see.')
    expect(result?.actions.map(a => a.label)).toEqual(['Run again', 'Undo', 'Discuss with Olumi'])
    expect(result?.actions[2]).toMatchObject({ intent: 'edit-driver', nodeIds: ['a', 'b'], edgeIds: ['ab'] })
  })
  it('S1 own: an Olumi-authored driver reads as replaced; an invisible Run is silent (control: visible)', () => {
    const { before, after } = resized()
    const own = { ...visibleRun, drivers: { o: { ...linkDriver, authoredBy: 'olumi' as const } } }
    expect(deriveEditNote({ edit: strengthEdit, before, after, lastRun: own })?.words)
      .toBe('You’ve replaced Olumi’s estimate on the link the chance for ‘Launch’ rested most on. Run again to see.')
    expect(deriveEditNote({ edit: strengthEdit, before, after, lastRun: { ...own, visible: false } })).toBeNull()
  })
  it('D1: reversing a driver link; a reversed NON-driver link gets no note, not S2 (control)', () => {
    const { before, after } = reversed()
    assertNote(deriveEditNote({ edit: strengthEdit, before, after, lastRun: visibleRun }), 'D1', 'ab',
      'You’ve reversed the link the chance for ‘Launch’ rested most on. The options may now compare very differently. Run again to see.')
    expect(deriveEditNote({ edit: strengthEdit, before, after, lastRun: { visible: true, runId: 'r', drivers: {}, fragileEdges: fragileAB } })).toBeNull()
  })
  it('S2: a resized fragile non-driver link; an untagged non-fragile link gets no note (control)', () => {
    const { before, after } = resized()
    const result = deriveEditNote({ edit: strengthEdit, before, after, lastRun: { visible: true, runId: 'r', drivers: {}, fragileEdges: fragileAB } })
    assertNote(result, 'S2', 'ab', 'The last Run’s comparison could change if this link’s strength changes. Run again to see whether it still holds.')
    expect(result?.actions[1]).toMatchObject({ intent: 'link', edgeIds: ['ab'] })
    expect(deriveEditNote({ edit: strengthEdit, before, after, lastRun: { visible: true, runId: 'r', drivers: {} } })).toBeNull()
  })
  // F3/F4 rows: no option sets 'Demand' (CEE never names a driver the option sets, and F1 would outrank them).
  const unset = () => { const g = runGraph(); g.nodes[2].data.interventions = {}; return g }
  it('F3 needs a crossing of the last Run\'s turning point (control: same side)', () => {
    const before = unset(), after = structuredClone(before); after.nodes[0].data.observed_state = { value: 7, unit: '%' }
    const base = { visible: true, runId: 'r', drivers: {}, turningPoints: new Map([['a', { currentValue: 4, flipValue: 5, unit: '%', displayScale: true }]]) }
    expect(deriveEditNote({ edit: edit('factor_value_edit', 'a'), before, after, lastRun: base })?.check).toBe('F3')
    after.nodes[0].data.observed_state = { value: 4.5, unit: '%' }
    expect(deriveEditNote({ edit: edit('factor_value_edit', 'a'), before, after, lastRun: base })).toBeNull()
  })
  it('F4: a factor-value driver (control: a factor that drives nothing)', () => {
    const before = unset(), after = structuredClone(before); after.nodes[0].data.observed_state = { value: 4.2, unit: '%' }
    const fDriver = { kind: 'factor_value' as const, factorId: 'a', side: 'low' as const, cutValue: 3, cutUnit: '%', pctIfSide: 20, authoredBy: 'user' as const }
    assertNote(deriveEditNote({ edit: edit('factor_value_edit', 'a'), before, after, lastRun: { visible: true, runId: 'r', drivers: { o: fDriver } } }), 'F4', 'a',
      'The chance for ‘Launch’ rested most on ‘Demand’. Run again to see what your figure does to it.')
    expect(deriveEditNote({ edit: edit('factor_value_edit', 'a'), before, after, lastRun: { visible: true, runId: 'r', drivers: {} } })).toBeNull()
  })
  it('X1: deleting the driver link, or a card a driver link touches; a turning point alone gets no note', () => {
    const before = runGraph()
    const noEdge = { ...before, edges: [] }
    assertNote(deriveEditNote({ edit: edit('structural_delete', 'ab'), before, after: noEdge, lastRun: visibleRun }), 'X1', 'ab',
      'The last Run’s chance for ‘Launch’ rested most on this link. Run again to see the options without it.')
    const noCard = { nodes: before.nodes.filter(n => n.id !== 'a'), edges: [] }
    assertNote(deriveEditNote({ edit: edit('structural_delete', 'a'), before, after: noCard, lastRun: visibleRun }), 'X1', 'a',
      'The last Run’s chance for ‘Launch’ rested most on ‘Demand’. Run again to see the options without it.')
    const tpOnly = { visible: true, runId: 'r', drivers: {}, turningPoints: new Map([['a', { currentValue: 4, flipValue: 5, unit: '%', displayScale: true }]]) }
    expect(deriveEditNote({ edit: edit('structural_delete', 'a'), before, after: noCard, lastRun: tpOnly })).toBeNull()
  })
  it('G2: the target changed after a visible Run (control: no previous target is G1, not G2)', () => {
    const before = runGraph(), after = structuredClone(before); after.nodes[1].data.goal_threshold_raw = 12
    expect(deriveEditNote({ edit: edit('goal_target_edit', 'b'), before, after, lastRun: visibleRun })?.check).toBe('G2')
    const unset = structuredClone(before); delete unset.nodes[1].data.goal_threshold_raw
    expect(deriveEditNote({ edit: edit('goal_target_edit', 'b'), before: unset, after, lastRun: visibleRun })?.check).toBe('G1')
  })
  it('O3: an option value past the user\'s limit on the same node and unit; another unit is silent (control)', () => {
    const before = runGraph(), after = structuredClone(before)
    after.goal_constraints = [{ node_id: 'a', operator: '<=', value: 5, unit: '%' }]
    assertNote(deriveEditNote({ edit: edit('option_intervention_edit', 'o', { factorId: 'a' }), before, after }), 'O3', 'o',
      '‘Launch’ now sets ‘Demand’ to 6%, above the 5% limit you set.')
    after.goal_constraints = [{ node_id: 'a', operator: '<=', value: 5, unit: 'weeks' }]
    expect(deriveEditNote({ edit: edit('option_intervention_edit', 'o', { factorId: 'a' }), before, after })).toBeNull()
  })
  it('O4: a limit no option\'s SET factors can reach; reached through a set factor is silent (control)', () => {
    const before = runGraph(), after = structuredClone(before)
    after.nodes.push({ id: 'cap', type: 'factor', data: { label: 'Budget' } })
    after.goal_constraints = [{ node_id: 'cap', operator: '<=', value: 200000, unit: '£' }]
    const o4 = deriveEditNote({ edit: edit('option_intervention_edit', 'o', { factorId: 'a' }), before, after })
    expect(o4).toMatchObject({ check: 'O4', elementId: 'o', onceKey: 'limit\u0000cap' })
    expect(o4!.words).toMatch(/^No option changes anything that leads to ‘Budget’, so the .+ limit can’t rule any option out yet\.$/)
    after.edges.push({ id: 'acap', source: 'a', target: 'cap', data: {} })
    expect(deriveEditNote({ edit: edit('option_intervention_edit', 'o', { factorId: 'a' }), before, after })?.check).not.toBe('O4')
  })
  it('F1: card 0 → 2, some options set the factor', () => {
    const before = hiring(), after = hiring()
    after.nodes[0].data.observed_state = { value: 2 }
    assertNote(note(edit('factor_value_edit', 'developer_hires'), before, after), 'F1', 'developer_hires',
      '‘Hire two developers’ sets ‘Developer Hires’ itself. The figure on this card is today’s value, which ‘Carry on as now’ keeps. Did you mean to change it for ‘Hire two developers’?')
  })
  it('F1: served CRM draft and object-valued settings, every option', () => {
    const graph: EditGraph = { nodes: served.nodes.map(n => ({ id: n.id, type: n.kind, data: n })), edges: [] }
    const after = structuredClone(graph)
    const factor = after.nodes.find(n => n.id === 'fac_build_completion')!
    expect((factor.data.observed_state as { value: number }).value).toBe(0)
    factor.data.observed_state = { ...(factor.data.observed_state as Record<string, unknown>), value: 2 }
    assertNote(note(edit('factor_value_edit', 'fac_build_completion'), graph, after), 'F1', 'fac_build_completion',
      'Every option sets ‘In-House Build Commitment’ itself, so this figure can’t change how they compare. Did you mean to change it for one option?')
  })
  it('F1 twin: no option sets this factor', () => expect(note(edit('factor_value_edit', 'existing_team'), hiring())).toBeNull())
  it('F1 twin: an option edit is not a baseline edit', () => expect(note(edit('option_intervention_edit', 'hire', { factorId: 'developer_hires' }), hiring())).toBeNull())
  it('F1 twin: a refused edit is silent', () => expect(note(edit('factor_value_edit', 'developer_hires', { accepted: false }), hiring())).toBeNull())
  it('F1 twin: approval from a proposal is silent', () => expect(note(edit('factor_value_edit', 'developer_hires', { origin: 'proposal' }), hiring())).toBeNull())
  it('F1: option-to-factor fallback', () => {
    const graph = hiring(); graph.nodes[2].data.interventions = {}
    graph.edges.push({ id: 'setting', source: 'hire', target: 'developer_hires' })
    expect(note(edit('factor_value_edit', 'developer_hires'), graph)?.check).toBe('F1')
  })
  it('A1: unlinked new card, not a connected card', () => {
    const graph = hiring(); graph.nodes.push({ id: 'contractor', type: 'factor', data: { label: 'Contractor hours' } })
    assertNote(note(edit('structural_add', 'contractor'), graph), 'A1', 'contractor',
      '‘Contractor hours’ isn’t linked to anything yet, so it can’t affect ‘meet our next feature-launch deadline’.')
    graph.edges.push({ id: 'c-goal', source: 'contractor', target: 'goal' })
    expect(note(edit('structural_add', 'contractor'), graph)).toBeNull()
  })
  it('A2: linked without a path, not a goal path', () => {
    const graph = hiring(); graph.nodes.push({ id: 'contractor', type: 'factor', data: { label: 'Contractor hours' } })
    graph.edges.push({ id: 'c-team', source: 'contractor', target: 'existing_team' })
    assertNote(note(edit('structural_add', 'contractor'), graph), 'A2', 'contractor',
      '‘Contractor hours’ doesn’t reach ‘meet our next feature-launch deadline’ yet, so it can’t change any option’s chance.')
    graph.edges.push({ id: 'team-goal', source: 'existing_team', target: 'goal' })
    expect(note(edit('structural_add', 'contractor'), graph)).toBeNull()
  })
  it('O1: equal complete profiles, not partial overlap or provenance differences', () => {
    const before = hiring(), graph = hiring(); graph.nodes[3].data.interventions = { developer_hires: 2 }
    assertNote(note(edit('option_intervention_edit', 'hire', { factorId: 'developer_hires' }), before, graph), 'O1', 'hire',
      '‘Hire two developers’ now changes the same things by the same amounts as ‘Carry on as now’, so the analysis can’t tell them apart.')
    graph.nodes[3].data.interventions = { developer_hires: 1 }
    expect(note(edit('option_intervention_edit', 'hire', { factorId: 'developer_hires' }), before, graph)).toBeNull()
    graph.nodes[3].data.interventions = { developer_hires: 2, existing_team: 5 }
    expect(note(edit('option_intervention_edit', 'hire', { factorId: 'developer_hires' }), before, graph)).toBeNull()
  })
  it('O2: setting a disconnected factor, not a connected one', () => {
    const graph = hiring(); graph.edges = []
    assertNote(note(edit('option_intervention_edit', 'hire', { factorId: 'developer_hires' }), hiring(), graph), 'O2', 'hire',
      '‘Developer Hires’ doesn’t reach the goal yet, so setting it for ‘Hire two developers’ won’t change that option’s chance.')
    expect(note(edit('option_intervention_edit', 'hire', { factorId: 'developer_hires' }), hiring())).toBeNull()
  })
  it('R1: trimmed case-insensitive collision, not a unique name', () => {
    const graph = hiring(); graph.nodes[1].data.label = ' developer hires '
    assertNote(note(edit('structural_rename', 'developer_hires'), graph), 'R1', 'developer_hires',
      'Another card is also called ‘Developer Hires’. In chat, Olumi may not know which one you mean.')
    graph.nodes[1].data.label = 'Existing team'
    expect(note(edit('structural_rename', 'developer_hires'), graph)).toBeNull()
  })
  it('G1: first captured target, not a target revision or a constant', () => {
    const graph = hiring(); graph.nodes[4].data.goal_threshold_raw = 10
    assertNote(note(edit('goal_target_edit', 'goal'), hiring(), graph), 'G1', 'goal',
      'Your target for ‘meet our next feature-launch deadline’ is set. Run to include it in the analysis.')
    expect(note(edit('goal_target_edit', 'goal'), graph, graph)).toBeNull()
    graph.nodes[4].data = { label: 'meet our next feature-launch deadline', goal_threshold: 0.8 }
    expect(note(edit('goal_target_edit', 'goal'), hiring(), graph)).toBeNull()
  })
  it('add-edge reports no excluded L2 check', () => expect(note(edit('structural_add_edge', 'path'), hiring())).toBeNull())
})
