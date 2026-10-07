export const worksheetFixture = () => ({
  kind: 'premortem', version: 1, scenario_id: '22222222-2222-4222-8222-222222222222', turn_id: 'turn-1',
  run: { graph_hash_at_run: '0123456789abcdef', computed_at: '2026-10-07T10:00:00.000Z' },
  binding: { scenario_id: '22222222-2222-4222-8222-222222222222', graph_revision: '0123456789abcdef', dependencies: [
    { kind: 'map_structure', id: 'whole_graph', fingerprint: 'a'.repeat(64) },
    { kind: 'analysis', id: 'run', fingerprint: 'b'.repeat(64) },
  ] },
  rows: [{ row_id: 'row-b', option_id: 'opt-b', option_label: 'Build', failure_way: 'Capacity disappears.', early_warning: 'Delivery slows.',
    grounding: { kind: 'factor', ids: ['factor'], labels: ['Capacity'] }, provenance: 'olumi_hypothesis',
    risk_request: { chip_id: 'agent-next-suggest-risks', message: 'Prepare capacity loss as one risk affecting Growth.', affected_node_id: 'goal', direction: 'negative', grounding_ids: ['factor'] } }],
  coverage: [{ option_id: 'opt-b', option_label: 'Build', status: 'stress_tested' }, { option_id: 'opt-a', option_label: 'Buy', status: 'not_stress_tested' }],
  blindspot_question: 'What have we missed?',
})
export const wireFixture = () => ({ response_version: 2, assistant_text: 'Worksheet prepared.', blocks: [{ type: 'analysis_result', summary: 'Held analysis', leading_option_id: 'opt-b', win_probabilities: { 'opt-b': 0.5 }, computed_against_hash: worksheetFixture().run.graph_hash_at_run }], suggested_actions: [], insights: [], stage_indicator: 'analyse',
  analysis_state: { run_state: { kind: 'complete_current', computed_at: worksheetFixture().run.computed_at }, readiness: { status: 'ready', blockers: [] }, leader_claim: { permitted: false }, robustness: {}, usable_for_prose: true, usable_for_chips: true, usable_for_followup: true, requires_rerun: false, blocked_unusable: false, contradictions: [] },
  _premortem_worksheet: worksheetFixture(),
})
