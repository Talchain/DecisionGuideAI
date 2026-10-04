import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach } from 'vitest'

const { loadScenario, listScenarios, fetchScenarioGraph } = vi.hoisted(() => ({ loadScenario: vi.fn(), listScenarios: vi.fn(), fetchScenarioGraph: vi.fn() }))
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }))
vi.mock('../../services/scenarioService', () => ({ loadScenario, listScenarios }))
vi.mock('../../adapters/cee/scenarioGraph', () => ({ fetchScenarioGraph }))
import ScenarioComparePage from '../ScenarioComparePage'

const row = (id: string, label: string, edgeStrength = 0.3) => ({
  id, user_id: 'user-1', title: id, scenario_schema_version: 1, stage: 'evaluate', analysis_status: 'ready',
  graph: { nodes: [{ id: 'option-a', data: { kind: 'option', label } }, { id: 'factor', data: { kind: 'factor', label: 'Factor' } }], edges: [{ id: 'link', source: 'option-a', target: 'factor', data: { strength: { mean: edgeStrength } } }] },
  framing: null, analysis: null, analysis_error: null, analysis_provenance: null, events: [], event_seq: 0, brief: null, is_pinned: false, is_archived: false, source_scenario_id: null, thread: [], created_at: '', updated_at: '',
})
const read = (label: string, permitted = true) => ({ status: 'graph', analysisState: { run_state: { kind: 'complete_current' }, leader_claim: { permitted }, readiness: { status: 'ready', blockers: [] }, requires_rerun: false, blocked_unusable: false, contradictions: [] }, analysisResult: { type: 'analysis_result', summary: 'Service summary', leading_option_id: 'option-a', enrichment: { option_comparison: [{ id: 'option-a', label }] } } })

function renderPage() { return render(<MemoryRouter initialEntries={['/compare/a']}><Routes><Route path="/compare/:id" element={<ScenarioComparePage />} /></Routes></MemoryRouter>) }

describe('ScenarioComparePage', () => {
  beforeEach(() => { vi.clearAllMocks(); const a = row('a', 'Option A'); const b = row('b', 'Option B', 0.7); (b.graph.nodes as Array<{ id: string }>)[0].id = 'independent-option'; (b.graph.nodes as Array<{ id: string }>)[1].id = 'independent-factor'; (b.graph.edges as Array<{ source: string; target: string }>)[0].source = 'independent-option'; (b.graph.edges as Array<{ source: string; target: string }>)[0].target = 'independent-factor'; loadScenario.mockImplementation(async (id: string) => id === 'a' ? a : b); listScenarios.mockResolvedValue([{ id: 'a', title: 'a', is_archived: false }, { id: 'b', title: 'b', is_archived: false }]); fetchScenarioGraph.mockImplementation(async (id: string) => read(id === 'a' ? 'Option A' : 'Option B', id !== 'b')) })
  it('uses server reads, bands link changes, and cannot select the same scenario', async () => { renderPage(); await screen.findByText('Compare scenarios'); const select = screen.getByLabelText('Scenario to compare'); expect([...select.querySelectorAll('option')].map(option => option.value)).not.toContain('a'); fireEvent.change(select, { target: { value: 'b' } }); await waitFor(() => expect(screen.getAllByText(/No current result/)).toHaveLength(1)); expect(screen.getByTestId('comparison-differences')).toHaveTextContent(/Option A → Factor/); expect(screen.getByTestId('comparison-differences')).not.toHaveTextContent('0.3') })
  it('matches independently-created items by name and states unavailable results plainly', async () => { renderPage(); fireEvent.change(await screen.findByLabelText('Scenario to compare'), { target: { value: 'b' } }); await waitFor(() => expect(screen.getByTestId('comparison-differences')).toHaveTextContent('matched by name')) })
})
