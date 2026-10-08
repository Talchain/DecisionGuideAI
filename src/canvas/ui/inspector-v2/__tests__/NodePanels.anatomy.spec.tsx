/** EDIT-UX slice 2: real Router → shell → every node panel. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { Node } from '@xyflow/react'
import { InspectorRouter } from '../InspectorRouter'
import { ToastProvider } from '../../../ToastContext'
import { requestAsk } from '../askSemantic'
import { useCanvasStore } from '../../../store'
import { useGuidanceStore } from '../../../stores/guidanceStore'
import { revealOlumiSurface } from '../../../conversation/revealOlumi'
import { factorDisplayText } from '../../../../utils/formatFactorDisplayValue'

vi.mock('@xyflow/react', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useViewport: () => ({ x: 0, y: 0, zoom: 1 }),
}))
vi.mock('../../../../lib/supabase', () => ({ supabase: {}, isSupabaseAvailable: () => false }))
vi.mock('../../../../adapters/plot', () => ({ plot: { validatePatch: vi.fn() } }))
vi.mock('../../../conversation/revealOlumi', () => ({ revealOlumiSurface: vi.fn(() => true) }))
vi.mock('../askSemantic', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()), requestAsk: vi.fn(() => 'sent'),
}))

const initialCanvas = useCanvasStore.getState()
const initialGuidance = useGuidanceStore.getState()
const close = vi.fn()
const factorData = {
  label: 'Price', kind: 'factor', factorType: 'revenue',
  observedState: { value: 0.49, raw_value: 49, cap: 100, unit: '£', source: 'brief_extraction' },
}
const node = (id: string, type: string, data: Record<string, unknown>): Node =>
  ({ id, type, data: { kind: type, ...data }, position: { x: 0, y: 0 } })
const nodes = [
  ...['controllable', 'external', 'observable'].map(category => node(category, 'factor', { ...factorData, category })),
  node('option', 'option', { label: 'Grow', interventions: { controllable: { value: 0.6, source: 'brief_extraction' } } }),
  node('unset-option', 'option', { label: 'Hold' }),
  node('goal', 'goal', { label: 'Revenue' }),
  node('risk', 'risk', { label: 'Churn' }),
  node('outcome', 'outcome', { label: 'Profit' }),
  node('decision', 'decision', { label: 'Strategy' }),
  node('generic', 'constraint', { label: 'Capacity' }),
]

function seed(replacements: Node[] = nodes) {
  useCanvasStore.setState({
    nodes: replacements, edges: [
      { id: 'decision-option', source: 'decision', target: 'option', data: {} },
      { id: 'decision-unset', source: 'decision', target: 'unset-option', data: {} },
      { id: 'option-factor', source: 'option', target: 'controllable', data: {} },
      { id: 'factor-risk', source: 'external', target: 'risk', data: {} },
      { id: 'factor-outcome', source: 'controllable', target: 'outcome', data: {} },
    ],
    results: { status: 'none', report: null }, analysisStateV1: null, analysisFreshness: null,
    ceeAnalysisReady: null, lastAuthoritativeGraph: null, hasCompletedFirstRun: false, v5AnalysisFact: null,
    goalThreshold: null, goalThresholdRepresentation: null, goalConstraints: null,
    confirmedNodeIds: new Set(), _internal: {},
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  } as never)
}
function open(id: string) {
  render(<InspectorRouter nodeId={id} edgeId={null} onClose={close} />, { wrapper: ToastProvider })
  return screen.getByTestId('inspector-body')
}
function more() { return screen.getByTestId('inspector-more') }
beforeEach(() => {
  vi.clearAllMocks()
  useGuidanceStore.setState({ guidanceItems: [], _sendChip: vi.fn(), _prefillChat: vi.fn(),
    _sendMessage: null, _dispatchAction: vi.fn(), _isConversationBusy: () => false } as never)
  seed()
})
afterEach(() => {
  cleanup()
  useCanvasStore.setState(initialCanvas, true)
  useGuidanceStore.setState(initialGuidance, true)
})

for (const id of ['controllable', 'external', 'observable', 'option', 'goal', 'risk', 'outcome', 'decision', 'generic']) {
  describe(`${id} anatomy`, () => {
    it('has one sentence first, one merged Ask after the panel, and one collapsed More', () => {
      const body = open(id)
      const sentences = within(body).getAllByTestId('inspector-summary-sentence')
      expect(sentences).toHaveLength(1)
      expect(sentences[0]).toBeVisible()
      expect(body.querySelector('p')).toBe(sentences[0])
      const asks = within(body).getAllByRole('button', { name: /^Ask Olumi about / })
      expect(asks).toHaveLength(1)
      expect(asks[0]).toHaveAttribute('data-testid', 'inspector-quick-ask')
      expect(asks[0].textContent).toBe('Ask Olumi')
      expect(asks[0].closest('fieldset')).toBeNull()
      expect(within(body).queryByRole('button', { name: /Explore with Olumi|Examine with Olumi/ })).toBeNull()
      expect(within(body).queryByTestId('inspector-examine-prepare')).toBeNull()
      expect(more()).toHaveAttribute('hidden')
      expect(screen.getByTestId('inspector-more-toggle')).toHaveAttribute('aria-expanded', 'false')
      for (const moved of ['inspector-tech-toggle', 'inspector-authority-notice']) {
        const item = screen.getByTestId(moved)
        expect(more()).toContainElement(item)
        expect(item).not.toBeVisible()
      }
      expect(screen.queryByTestId('inspector-description-empty')).toBeNull()
      expect(body.textContent).not.toContain('No description recorded.')
    })
  })
}

describe('factor primary and More content', () => {
  it.each(['controllable', 'external', 'observable'])('%s states its value and honest source, and moves the stored readout', id => {
    open(id)
    expect(screen.getByTestId('inspector-summary-sentence').textContent).toBe('Price is £49.')
    expect(screen.getByTestId('inspector-provenance-chip')).toHaveAttribute('data-provenance', 'brief')
    const stored = screen.getByTestId('factor-display-text')
    expect(more()).toContainElement(stored)
    expect(stored).not.toBeVisible()
    expect(more()).toHaveTextContent('Stored as')
    const primaryReadouts = screen.queryAllByTestId('factor-display-text').filter(item => !more().contains(item))
    expect(primaryReadouts).toHaveLength(0)
    if (id === 'controllable') {
      expect(screen.getByTestId('factor-value-row')).toBeVisible()
      expect(within(screen.getByTestId('factor-value-row')).getByRole('spinbutton')).toHaveValue(49)
    }
    if (id === 'observable') expect(screen.getByTestId('observable-value-display')).toBeVisible()
  })
  it.each(['controllable', 'external', 'observable'])('%s with no value states absence and invents no source', id => {
    seed(nodes.map(n => n.id === id ? { ...n, data: { label: 'Price', kind: 'factor', category: id } } : n))
    open(id)
    expect(screen.getByTestId('inspector-summary-sentence').textContent).toBe('Price has no value yet.')
    expect(screen.queryByTestId('inspector-provenance-chip')).toBeNull()
  })
  for (const value of [70, 0]) {
    it.each(['controllable', 'external', 'observable'])(`%s with stored ${value} and no display scale states the value exists without a chip`, id => {
      const data = {
        label: 'Price', kind: 'factor', category: id,
        observedState: { value, factor_type: 'continuous', source: 'brief_extraction' },
      }
      expect(factorDisplayText(data)).toBeNull()
      seed(nodes.map(n => n.id === id ? { ...n, data } : n))
      open(id)
      const sentence = screen.getByTestId('inspector-summary-sentence')
      expect(sentence.textContent).toBe('Price has a value, but no unit is recorded for it.')
      expect(sentence).toBeVisible()
      expect(screen.queryByTestId('inspector-provenance-chip')).toBeNull()
      if (id === 'controllable' && value === 70) {
        const warning = screen.getByTestId('factor-value-no-scale')
        expect(warning).toBeVisible()
        expect(warning).toHaveTextContent('This value has no scale recorded')
        expect(more()).not.toContainElement(warning)
      }
    })
  }
  it('shows an option that sets the factor; only non-setters move under More', () => {
    const body = open('controllable')
    const setters = within(body).getAllByRole('button', { name: /Grow/ })
    expect(setters.some(row => !more().contains(row))).toBe(true)
    expect(within(body).queryByRole('button', { name: /Hold/ })).toBeNull()
    expect(more()).toHaveTextContent("Options that don't set it")
    fireEvent.click(screen.getByTestId('inspector-more-toggle'))
    expect(within(more()).getByRole('button', { name: /Hold/ })).toBeVisible()
    expect(more()).toHaveTextContent('No setting recorded')
  })
  it.each([
    ['cee_inference', 'olumi'], ['user_override', 'user'],
    ['user_confirmed', 'user'], ['user_assumption', 'user'], ['unrecognised', null],
  ])('uses recorded source %s without inventing provenance', (source, kind) => {
    seed(nodes.map(n => n.id === 'controllable' ? { ...n, data: { ...n.data,
      observedState: { ...factorData.observedState, source } } } : n))
    open('controllable')
    const chip = screen.queryByTestId('inspector-provenance-chip')
    if (kind === null) {
      expect(chip).toBeNull()
      expect(more()).toHaveTextContent('Source not recorded')
    } else {
      expect(chip).toHaveAttribute('data-provenance', kind)
    }
  })
  it('a recorded zero is still a value, with its recorded source', () => {
    seed(nodes.map(n => n.id === 'controllable' ? { ...n, data: { ...n.data,
      observedState: { ...factorData.observedState, value: 0, raw_value: 0 } } } : n))
    open('controllable')
    expect(screen.getByTestId('inspector-summary-sentence').textContent).toBe('Price is £0.')
    expect(screen.getByTestId('inspector-provenance-chip')).toHaveAttribute('data-provenance', 'brief')
    expect(within(screen.getByTestId('factor-value-row')).getByRole('spinbutton')).toHaveValue(0)
  })
  it('honours zero-valued CEE setters even when the canvas has no setting', () => {
    useCanvasStore.setState({ ceeAnalysisReady: { options: [
      { id: 'option', interventions: {} },
      { id: 'unset-option', interventions: { controllable: 0 } },
    ] } } as never)
    const body = open('controllable')
    expect(within(body).getByRole('button', { name: /Hold/ })).toBeVisible()
    expect(within(body).queryByRole('button', { name: /Grow/ })).toBeNull()
    fireEvent.click(screen.getByTestId('inspector-more-toggle'))
    expect(within(more()).getByRole('button', { name: /Grow/ })).toBeVisible()
  })
  it('shows a description directly below its sentence and leaves its local writer fenced in More', () => {
    seed(nodes.map(n => n.id === 'controllable'
      ? { ...n, data: { ...n.data, description: 'Our current price.' } } : n))
    open('controllable')
    expect(screen.getByText('Our current price.', { selector: 'p' })).toBeVisible()
    const writer = within(more()).getByDisplayValue('Our current price.')
    expect(writer).toBeDisabled()
    expect(writer.closest('fieldset')).toHaveAttribute('data-writer-fence', 'description')
    expect(writer).not.toBeVisible()
  })
  it('keeps the existing grounded Worth reviewing reason directly beneath the summary', () => {
    useCanvasStore.setState({ ceeAnalysisReady: { bias_findings: [
      { code: 'anchoring', target_factor_id: 'controllable' },
    ] } } as never)
    open('controllable')
    const attention = screen.getByTestId('inspector-attention-context')
    expect(attention).toBeVisible()
    expect(attention).toHaveTextContent('Worth reviewing')
    expect(screen.getByTestId('inspector-summary-sentence').parentElement?.nextElementSibling).toBe(attention)
  })
  it('preserves the existing examine request with priority over explore', () => {
    seed(nodes.map(n => n.id === 'controllable' ? { ...n, data: { ...n.data,
      observedState: { ...factorData.observedState, source: 'cee_inference' } } } : n))
    open('controllable')
    fireEvent.click(screen.getByTestId('inspector-quick-ask'))
    expect(requestAsk).toHaveBeenCalledTimes(1)
    expect(requestAsk).toHaveBeenCalledWith({
      text: 'What is the figure for ‘Price’ based on, and what would make a different figure more defensible?',
      label: 'Examine Price', targetId: 'controllable', intent: 'challenge',
    })
  })
})

describe('specific node contracts', () => {
  it('keeps the existing explore payload on a node with no examine semantics', () => {
    open('risk')
    fireEvent.click(screen.getByTestId('inspector-quick-ask'))
    expect(requestAsk).toHaveBeenCalledWith(expect.objectContaining({
      label: 'Ask about Churn', context: '', targetId: 'risk', intent: 'explain', nodeIds: ['risk'], edgeIds: [],
    }))
  })
  it('summarises the option target and retains exactly one provenance pill in its row', () => {
    open('option')
    expect(screen.getByTestId('inspector-summary-sentence')).toHaveTextContent(/^Sets Price to /)
    const row = screen.getByTestId('inspector-intervention-controllable')
    expect(row.querySelectorAll('[data-testid="inspector-intervention-controllable-provenance"]')).toHaveLength(1)
  })
  it('keeps the goal target invitation primary and moves Model completeness', () => {
    open('goal')
    expect(screen.getByTestId('inspector-summary-sentence').textContent).toBe('No target set yet.')
    expect(screen.getByText('What would success look like?')).toBeVisible()
    expect(more()).toContainElement(screen.getByTestId('goal-progress-checklist'))
    expect(more()).toHaveTextContent('Model completeness')
  })
  it.each([
    { name: 'a held normalised target', data: {}, threshold: 0.8, representation: 'normalised', sentence: 'No target we can show' },
    { name: 'an unattributed raw target', data: {}, threshold: 85000, representation: 'raw', sentence: 'Success means 85000.' },
    { name: 'a readable node target before a normalised store value', data: { goal_threshold_raw: 85000, goal_threshold_unit: '£' }, threshold: 0.8, representation: 'normalised', sentence: 'Success means £85,000.' },
    { name: 'an unread held frame', data: { goal_threshold_frame: 'CHANGE_REL', goal_threshold_raw: -0.15 }, threshold: -0.15, representation: 'raw', sentence: 'No target we can show' },
  ])('preserves the target control’s display honesty for $name', ({ data, threshold, representation, sentence }) => {
    seed(nodes.map(n => n.id === 'goal' ? { ...n, data: { ...n.data, ...data } } : n))
    useCanvasStore.setState({ goalThreshold: threshold, goalThresholdRepresentation: representation } as never)
    open('goal')
    expect(screen.getByTestId('inspector-summary-sentence').textContent).toBe(sentence)
    expect(screen.queryByTestId('inspector-provenance-chip')).toBeNull()
  })
  it.each(['risk', 'outcome'])('%s keeps the honesty sentence and the route to record likelihood/impact visible', id => {
    open(id)
    expect(screen.getByTestId('inspector-summary-sentence').textContent)
      .toBe('Likelihood and impact are not recorded. That does not imply low risk.')
    expect(screen.getByText('To record likelihood or impact, ask Olumi.')).toBeVisible()
    expect(screen.getByTestId('drivers-list').closest('[data-panel-group="connections"]')).not.toBeNull()
  })
  it.each(['decision', 'generic'])('%s exposes its structure route', id => {
    open(id)
    expect(screen.getByText('To change its structure, ask Olumi.')).toBeVisible()
  })
  it('keeps Add option live outside the decision fieldset and removes the alternative-count duplicate', () => {
    const body = open('decision')
    const add = screen.getByTestId('decision-add-option')
    expect(add).toBeVisible()
    expect(add).not.toBeDisabled()
    expect(add.closest('fieldset')).toBeNull()
    expect(body.textContent).not.toMatch(/options above are its only connections/)
  })
  it.each(['decision', 'generic'])('%s preserves its portalled description authority fence', id => {
    seed(nodes.map(n => n.id === id ? { ...n, data: { ...n.data, description: 'Recorded context.' } } : n))
    open(id)
    expect(screen.getByText('Recorded context.', { selector: 'p' })).toBeVisible()
    const writer = within(more()).getByDisplayValue('Recorded context.')
    expect(writer).toBeDisabled()
    expect(writer.closest('fieldset')).toHaveAttribute('data-authority', 'disabled')
    expect(writer.closest('fieldset')).toHaveAttribute('aria-describedby', 'inspector-authority-notice')
    fireEvent.click(screen.getByTestId('inspector-more-toggle'))
    expect(writer).toBeVisible()
    expect(writer).toBeDisabled()
  })
  it('a risk with recorded likelihood and impact retains those facts without an absence claim', () => {
    seed(nodes.map(n => n.id === 'risk' ? { ...n, data: { ...n.data, probability: 0.3, impact: 'high' } } : n))
    open('risk')
    expect(screen.getByTestId('inspector-summary-sentence')).toHaveTextContent('30%')
    expect(screen.getByTestId('inspector-summary-sentence')).toHaveTextContent('impact is high.')
    expect(screen.queryByTestId('risk-absence')).toBeNull()
    expect(screen.getByTestId('risk-likelihood-row')).toBeVisible()
    expect(screen.getByTestId('risk-impact-row')).toBeVisible()
  })
  it('after a Run the goal chance is stated once while its scientific formatter is preserved', () => {
    seed(nodes.map(n => n.id === 'goal' ? { ...n, data: { ...n.data, goal_threshold_raw: 0.8 } } : n))
    useCanvasStore.setState({ goalThreshold: 0.8, results: { status: 'complete', report: {
      option_probabilities: { option: { win_probability: 0.62, probability_of_goal: 0.004, status: 'ok' } },
      option_comparison: [{ option_id: 'option', option_label: 'Grow', win_probability: 0.62, probability_of_goal: 0.004 }],
      robustness: { recommended_option_id: 'option', display_verdict: 'fragile' },
    } } } as never)
    open('goal')
    const chances = screen.getAllByText(/chance of meeting your goal/)
    expect(chances).toHaveLength(1)
    expect(chances[0]).toBeVisible()
    expect(chances[0]).toHaveTextContent('Less than 1% chance of meeting your goal.')
    expect(screen.queryByText('0%')).toBeNull()
  })
  it('after a Run the option keeps its headline words and moves the duplicate explanation and comparison context', () => {
    useCanvasStore.setState({ results: { status: 'complete', report: {
      option_probabilities: { option: { win_probability: 0.62, status: 'ok' }, 'unset-option': { win_probability: 0.38, status: 'ok' } },
      option_comparison: [{ option_id: 'option', option_label: 'Grow', win_probability: 0.62 },
        { option_id: 'unset-option', option_label: 'Hold', win_probability: 0.38 }],
    } }, analysisFreshness: { freshness: 'fresh', freshnessReason: 'graph_hash_match' }, analysisFreshnessDirty: false } as never)
    open('option')
    const caption = screen.getByTestId('option-panel-result-caption')
    expect(caption).toBeVisible()
    expect(caption).toHaveTextContent('Current model · of runs')
    expect(caption.previousElementSibling?.textContent).toBe('62%')
    expect(caption).not.toHaveAttribute('title')
    const explanation = screen.getByTestId('option-result-explanation')
    expect(explanation).toHaveTextContent('In this model, 62% of runs supported this option.')
    expect(more()).toContainElement(explanation)
    expect(more()).toContainElement(screen.getByTestId('option-comparative-context'))
    expect(explanation).not.toBeVisible()
  })
  it('moves conversation navigation to the same header menu', () => {
    open('risk')
    fireEvent.click(screen.getByTestId('inspector-header-menu'))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Back to the conversation' }))
    expect(revealOlumiSurface).toHaveBeenCalledTimes(1)
    expect(close).toHaveBeenCalledTimes(1)
  })
})
