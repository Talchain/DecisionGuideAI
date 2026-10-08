import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, fireEvent } from '@testing-library/react'
import type { ComponentType } from 'react'
import type { NodeProps } from '@xyflow/react'
import { ReactFlowProvider } from '@xyflow/react'
import { FactorNode } from '../FactorNode'
import { OptionNode } from '../OptionNode'
import { OutcomeNode } from '../OutcomeNode'
import { RiskNode } from '../RiskNode'
import { GoalNode } from '../GoalNode'
import { DecisionNode } from '../DecisionNode'
import { useCanvasStore } from '../../store'
import { useGuidanceStore } from '../../stores/guidanceStore'
import { AnalysisStateCue } from '../../components/AnalysisStateCue'
import { TOOLTIP_SURFACE_CLASS } from '../../../components/Tooltip'
vi.mock('@xyflow/react', async () => ({ ...await vi.importActual('@xyflow/react'), Handle: () => null }))
vi.mock('../shared/useNodeAttention', () => ({ useNodeAttention: () => ({ reasons: [{ kind: 'fragile_link', order: 1, label: 'The comparison depends on a link from here. How sure are you of it?' }], marked: true, markedCount: 1, candidateCount: 1, fromLastRun: null }) }))
const components = { factor: FactorNode, option: OptionNode, outcome: OutcomeNode, risk: RiskNode, goal: GoalNode, decision: DecisionNode }
function seed(type: keyof typeof components, data: Record<string, unknown> = {}, run = false, detailed = false) {
  const id = `marks-${type}`
  const own = { label: 'Test reasoning', type, provenance: 'user_set', ...data }
  const nodes = [{ id, type, data: own, position: { x: 0, y: 0 } }, { id: 'option-other', type: 'option', data: { label: 'Try a pilot', type: 'option', provenance: 'ai_inferred' }, position: { x: 0, y: 0 } }]
  if (type === 'decision') nodes.push({ id: 'assumption', type: 'factor', data: { label: 'Assumption', type: 'factor', provenance: 'ai_inferred', observedState: { value: .5, raw_value: .5, source: 'cee_inference', extractionType: 'inferred' } } as never, position: { x: 0, y: 0 } })
  useCanvasStore.setState({ nodes, edges: type === 'decision' ? [{ id: 'choice', source: id, target: 'option-other' }] : [], lodRung: 'full', viewMode: detailed ? 'expert' : 'standard', ceeAnalysisReady: null, analysisStateV1: null, currentScenarioId: 'marks', importPendingServerRegistration: false, hasCompletedFirstRun: run,
    v5AnalysisFact: { scenarioId: 'marks', analysisHash: run ? 'run' : null, hasRunAnalysisFact: run }, analysisFreshnessDirty: false,
    analysisFreshness: run ? { freshness: 'fresh', freshnessReason: 'graph_hash_match', computedAt: '2026-10-07T12:00:00Z' } : null, results: { status: run ? 'complete' : 'idle', report: run ? { option_probabilities: { 'option-other': { status: 'computed', win_probability: 1 } } } : null } } as never)
  useGuidanceStore.setState({ _sendMessage: () => {}, guidanceItems: [{ item_id: 'guidance', category: 'should_fix', title: 'Review this node', priority: 50, primary_action: { type: 'discuss', prompt: 'Let us discuss.' }, target_object: { type: 'node', id } }] } as never)
  const Component = components[type] as ComponentType<NodeProps>
  return render(<ReactFlowProvider><Component id={id} type={type} data={own} selected={false} isConnectable positionAbsoluteX={0} positionAbsoluteY={0} dragging={false} zIndex={0} deletable selectable draggable /><AnalysisStateCue /></ReactFlowProvider>)
}
function exact(testId: string, words: string) {
  const el = screen.getByTestId(testId)
  expect(el).toHaveAttribute('aria-label', words)
  expect(el.getAttribute('title') ?? '').toBe('')
  expect(el.textContent).not.toContain(words)
  return el
}
beforeEach(() => useCanvasStore.setState({ nodes: [], results: { status: 'idle', report: null } } as never))
afterEach(cleanup)
it.each((Object.keys(components) as (keyof typeof components)[]).flatMap(type => [false, true].map(detailed => [type, detailed] as const)))('%s detailed %s: every information mark lives in one bottom band; title and Olumi are preserved', (type, detailed) => {
  seed(type, type === 'factor' ? { provenance: 'ai_inferred', observedState: { value: 50, raw_value: 50, unit: 'GBP', source: 'brief_extraction', extractionType: 'explicit' } } : {}, false, detailed)
  const band = screen.getByTestId(`${type}-bottom-marks-marks-${type}`)
  expect(band).toHaveClass('absolute', 'bottom-1.5', 'left-3')
  const marks = document.querySelectorAll('[data-card-mark]')
  expect(marks.length).toBeGreaterThan(0)
  for (const mark of marks) expect(band.contains(mark)).toBe(true)
  for (const testId of ['node-provenance-mark', `attention-marker-marks-${type}`, `node-coaching-marker-marks-${type}`]) expect(band.contains(screen.getByTestId(testId))).toBe(true)
  expect(screen.getByTestId('node-header-row').querySelector('[data-card-mark], [data-testid="node-provenance-mark"]')).toBeNull()
  expect(screen.queryByTestId('node-title-corner-spacer')).toBeNull()
  const olumi = screen.getByTestId(`node-coaching-icon-marks-${type}`)
  expect(band.contains(olumi)).toBe(false)
  expect(olumi.querySelector('img')).toHaveAttribute('src', '/olumi-mark-card.svg')
  expect(olumi.querySelector('img')).toHaveAttribute('width', '15')
  expect(olumi.querySelector('img')).toHaveAttribute('height', '15')
  expect(olumi.querySelector('img')).toHaveClass('olumi-glyph-ai')
  expect(olumi.querySelector('img')).toHaveAttribute('data-icon', 'olumi-brand-mark')
  expect(olumi.closest(`[data-testid="node-card-rail-marks-${type}"]`)).toHaveClass(type === 'goal' || type === 'decision' ? 'bottom-[6px]' : 'bottom-[5px]', 'right-[6px]')
})
it.each([[.05, 'Very low', 1], [.3, 'Low', 2], [.5, 'Medium', 3], [.7, 'High', 4], [.95, 'Very high', 5]] as const)('factor %s: exact tier words explain the filled steps', (value, words, count) => {
  seed('factor', { provenance: 'ai_inferred', observedState: { value, raw_value: value, source: 'cee_inference', extractionType: 'inferred' } })
  const meter = exact('factor-value-tier-marks-factor', words)
  expect(meter.querySelectorAll('[data-filled="true"]')).toHaveLength(count)
  expect(meter.querySelectorAll('[data-level-step]')).toHaveLength(5)
  cleanup(); seed('factor', { observedState: { value: 100, raw_value: 100, unit: 'GBP', source: 'user' }, unit: 'GBP' })
  expect(screen.queryByTestId('factor-value-tier-marks-factor')).toBeNull()
  expect(screen.getByTestId('factor-recorded-value')).toBeDefined()
})
it('outcome: empty value pill has the exact words; a recorded value is the control', () => {
  seed('outcome'); expect(exact('outcome-unquantified', 'Outcome not quantified')).toHaveTextContent('—')
  cleanup(); seed('outcome', { observedState: { value: 40, raw_value: 40, unit: 'GBP', source: 'brief_extraction', extractionType: 'explicit' }, unit: 'GBP' })
  expect(screen.queryByTestId('outcome-unquantified')).toBeNull()
  expect(screen.getByTestId('outcome-recorded-value')).toBeDefined()
})
it.each(([ [undefined, undefined, null], [.2, 'low', 0], [.8, 'high', 3], [.2, 'high', 1], [.8, 'low', 2] ] as const).flatMap(pair => [false, true].map(detailed => [...pair, detailed] as const)))('risk matrix follows its own pair %s/%s cell %s detailed %s', (probability, impact, cell, detailed) => {
  seed('risk', { probability, impact }, false, detailed)
  const matrix = screen.getByTestId(cell === null ? 'risk-exposure-unset' : 'risk-exposure-line')
  const pair = cell === null ? null : `${Math.round(probability! * 100)}% likely · ${impact![0].toUpperCase()}${impact!.slice(1)} impact`
  const words = pair ? `${detailed ? 'Entered estimate · ' : ''}${pair}` : 'Likelihood and impact not set yet'
  exact(matrix.dataset.testid!, words)
  expect(matrix.querySelectorAll('[data-risk-cell]')).toHaveLength(4)
  expect(matrix.querySelectorAll('[data-filled="true"]')).toHaveLength(cell === null ? 0 : 1)
  if (cell !== null) { expect(matrix.querySelector(`[data-risk-cell="${cell}"]`)).toHaveAttribute('data-filled', 'true'); exact('risk-exposure-provenance', ' · entered') }
  else expect(screen.queryByTestId('risk-exposure-provenance')).toBeNull()
})
it('goal keeps the same button route and exact absence words', () => {
  seed('goal')
  const button = screen.getByTestId('goal-node-no-target-chip')
  expect(button.tagName).toBe('BUTTON')
  expect(button.getAttribute('aria-label')).toMatch(/^Target not captured — /)
  exact('goal-target-status-marks-goal', 'Target not captured')
  expect(button.textContent).not.toContain('Target not captured')
  expect(button.querySelector('.lucide-target')).not.toBeNull()
  fireEvent.click(button)
  expect(useCanvasStore.getState().selection.nodeIds.has('marks-goal')).toBe(true)
  cleanup(); seed('goal', { goal_threshold_raw: 10, goal_threshold_unit: 'GBP' })
  expect(screen.queryByTestId('goal-node-no-target-chip')).toBeNull()
})
it('working assumption is a band mark on the factor (words in aria + tooltip, never visible text), and leaves after a Run', () => {
  seed('factor', { observedState: { value: 10, source: 'user' }, unit: 'GBP' })
  expect(screen.getByTestId('node-header-row').closest('[role="group"]')!.textContent).not.toContain('Working assumption')
  expect(screen.queryAllByText(/Working assumption/)).toHaveLength(0)
  // DL landing condition 5 (8 Oct): the mark keeps its words for AT and on hover.
  exact('factor-working-assumption-mark-marks-factor', 'Working assumption · no analysis yet')
  expect(screen.getByTestId('factor-working-assumption-mark-marks-factor')).toHaveAttribute('data-card-mark', 'working-assumption')
  expect(screen.getByTestId('factor-working-assumption-mark-marks-factor').closest('[data-card-bottom-band]')).not.toBeNull()
  expect(screen.queryByTestId('working-assumption-board-line')).toBeNull()
  expect(screen.getByTestId('factor-driver-slot-marks-factor')).toHaveClass('h-[1lh]')
  cleanup(); seed('factor', { observedState: { value: 10, source: 'user' }, unit: 'GBP' }, true)
  expect(screen.getByTestId('node-header-row')).toBeInTheDocument()
  expect(screen.queryByTestId('factor-working-assumption-mark-marks-factor')).toBeNull()
})
it('focusing the working-assumption band mark shows its exact words in the styled tooltip, with no non-empty native title', async () => {
  seed('factor', { observedState: { value: 10, source: 'user' }, unit: 'GBP' })
  const mark = screen.getByTestId('factor-working-assumption-mark-marks-factor')
  const words = 'Working assumption · no analysis yet'
  expect(mark).toHaveAttribute('aria-label', words)
  expect(mark.getAttribute('title') ?? '').toBe('')
  expect(mark.closest('[data-card-bottom-band]')).not.toBeNull()
  expect(screen.queryByRole('tooltip')).toBeNull()
  // Same real focus -> styled Tooltip pattern as GoalNode.limitPillsOnTheTargetRow.
  act(() => mark.focus())
  expect(document.activeElement).toBe(mark)
  const tip = await screen.findByRole('tooltip')
  expect(tip.textContent).toBe(words)
  expect(tip).toHaveClass(TOOLTIP_SURFACE_CLASS)
})
it('decision assumptions become a band glyph, with the exact old sentence', () => {
  seed('decision')
  exact('decision-assumptions-open', 'Assumptions open for review')
  cleanup(); seed('decision', {}, true)
  expect(screen.queryByTestId('decision-assumptions-open')).toBeNull()
})
