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
