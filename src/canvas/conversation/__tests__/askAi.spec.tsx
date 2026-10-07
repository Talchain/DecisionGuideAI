// Batch 1 regression rows authored before implementation; Vitest execution prohibited by brief.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { askAi, buildAskAiQuestion } from '../askAi'
import { useCanvasStore } from '../../store'
import { useGuidanceStore } from '../../stores/guidanceStore'
import { clearAskTargetBinding, takeAskTargetBinding } from '../../ui/inspector-v2/askTargetBinding'
import { requestAsk } from '../../ui/inspector-v2/askSemantic'
import { useAskOlumiStore } from '../../../components/results/coaching/askOlumiStore'
import { buildV5Payload } from '../../../v5/buildPayload'
import { revealOlumiSurface } from '../revealOlumi'
vi.mock('../revealOlumi', () => ({ revealOlumiSurface: vi.fn(() => true) }))
vi.mock('../../state/analysisStateSelector', () => ({
  selectRunAffirmedCurrent: vi.fn(() => false),
}))
import { selectRunAffirmedCurrent } from '../../state/analysisStateSelector'
vi.mock('../../ui/inspector-v2/useAnalysisResults', () => ({ selectRunWithholdsFigures: vi.fn(() => false) }))
import { selectRunWithholdsFigures } from '../../ui/inspector-v2/useAnalysisResults'
const nodes = [
  { id: 'a', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Capacity', value: 42 } },
  { id: 'b', type: 'goal', position: { x: 1, y: 1 }, data: { label: 'Delivery' } },
  { id: 'raw-private-id', type: 'factor', position: { x: 2, y: 2 }, data: {} },
]
const edge = { id: 'ab', source: 'a', target: 'b', data: {} }
let dispatch: ReturnType<typeof vi.fn>
beforeEach(() => {
  vi.clearAllMocks(); clearAskTargetBinding()
  vi.mocked(selectRunAffirmedCurrent).mockReturnValue(false)
  vi.mocked(selectRunWithholdsFigures).mockReturnValue(false)
  useCanvasStore.setState({ nodes, edges: [edge], hasCompletedFirstRun: false, results: { status: 'idle' }, v5AnalysisFact: null } as never)
  dispatch = vi.fn()
  useGuidanceStore.setState({ _dispatchAction: dispatch, _sendMessage: vi.fn(), _prefillChat: vi.fn(), _isConversationBusy: () => false })
  useAskOlumiStore.getState().close()
})
describe('one immediate Ask builder', () => {
  it.each([
    ['explain', 'What does ‘Capacity’ do in this decision, and what is it assumed to depend on?'],
    ['challenge', 'What is the figure for ‘Capacity’ based on, and what would make a different figure more defensible?'],
    ['estimate', 'Help me estimate ‘Capacity’: what range is sensible, and what would narrow it?'],
    ['evidence', 'What evidence supports ‘Capacity’, and what would count against it?'],
  ] as const)('%s sends once as a chip, bound to the label, with no model figure', (intent, expected) => {
    const result = askAi({ intent, nodeIds: ['a'] })
    expect(result).toBe('sent')
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith({ id: `ask:${intent}`, label: expected, message: expected, source: 'chip' })
    const message = dispatch.mock.calls[0][0].message
    expect(message).toContain('Capacity'); expect(message).not.toContain('42')
    expect(takeAskTargetBinding(message)?.nodeIds).toEqual(new Set(['a']))
    expect(revealOlumiSurface).toHaveBeenCalled()
  })
  it.each([
    ['drafted', false, false, false, 'What does ‘Capacity’ do in this decision, and what is it assumed to depend on?'],
    ['ran-current', true, true, false, 'How much does ‘Capacity’ matter to the options’ chances of meeting the goal, and why?'],
    ['stale', true, false, false, 'I’ve changed the model since the last Run. How might that change what ‘Capacity’ does here?'],
    ['withheld', true, true, true, 'What does Olumi still need about ‘Capacity’ before it can say how likely each option is to meet the goal?'],
  ])('%s uses the Q1 stage wording', (_stage, ran, current, withheld, expected) => {
    useCanvasStore.setState({ hasCompletedFirstRun: ran } as never)
    vi.mocked(selectRunAffirmedCurrent).mockReturnValue(current as boolean)
    vi.mocked(selectRunWithholdsFigures).mockReturnValue(withheld as boolean)
    askAi({ intent: 'explain', nodeIds: ['a'] })
    expect(dispatch.mock.calls[0][0].message).toBe(expected)
  })
  it('C51: an edge rides the edge set and reaches selected_elements', () => {
    dispatch.mockImplementation((opts) => {
      const built = buildV5Payload({ turnId: '11111111-1111-4111-8111-111111111111', scenarioId: '22222222-2222-4222-8222-222222222222', stage: 'analyse', turnClass: 'clarify', mode: 'user', message: opts.message })
      expect(built.ok).toBe(true)
      if (built.ok) expect((built.payload as { selected_elements?: unknown }).selected_elements).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'a→b', kind: 'edge' })]))
    })
    requestAsk({ text: 'legacy edge question', label: 'Explore', targetId: 'ab', intent: 'link' })
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch.mock.calls[0][0].message).toContain('Capacity')
  })
  it('no label fails closed to a generic question, never an id', () => {
    askAi({ intent: 'explain', nodeIds: ['raw-private-id'] })
    expect(dispatch.mock.calls[0][0].message).not.toContain('raw-private-id')
    expect(dispatch.mock.calls[0][0].message).toBe('What does this element do in this decision, and what is it assumed to depend on?')
  })
  it('an editable template stays in the drawer byte-verbatim and is not sent', () => {
    requestAsk({ text: 'My reason: ', label: 'Disagree', targetId: 'a', editable: true })
    expect(dispatch).not.toHaveBeenCalled()
    expect(useAskOlumiStore.getState()).toMatchObject({ isOpen: true, draft: 'My reason: ' })
  })
  it('refires send once; the busy gate refuses other asks before binding', () => {
    askAi({ intent: 'explain', nodeIds: ['a'] })
    expect(askAi({ intent: 'explain', nodeIds: ['a'] })).toBe('refire')
    useGuidanceStore.setState({ _isConversationBusy: () => true })
    expect(askAi({ intent: 'challenge', nodeIds: ['b'] })).toBe('busy')
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(takeAskTargetBinding(dispatch.mock.calls[0][0].message)?.nodeIds).toEqual(new Set(['a']))
  })
  it('user words are sent verbatim through the composer wire', () => {
    const send = vi.fn(); useGuidanceStore.setState({ _sendMessage: send })
    askAi({ userWords: '  My own wording: 17 is my estimate.  ', nodeIds: ['a'] })
    expect(send).toHaveBeenCalledWith('  My own wording: 17 is my estimate.  ')
    expect(dispatch).not.toHaveBeenCalled()
  })
  it('what-would-change preserves its press id without an action_type', () => {
    askAi({ intent: 'what-would-change', pressId: 'agent-next-what-would-change' })
    expect(dispatch.mock.calls[0][0]).toMatchObject({ id: 'agent-next-what-would-change', source: 'chip' })
    expect(dispatch.mock.calls[0][0]).not.toHaveProperty('action_type')
  })
})

import { render, screen, fireEvent } from '@testing-library/react'
import { NodeCoachingIcon } from '../../nodes/shared/NodeCoachingIcon'
import { COACHING_ASK_INTENTS } from '../askAiQuestions'

// Actual FB1 rail buttons, including all four factor-door precedences.
it.each([
  ['decision_explore_more_options', 'decision'], ['goal_is_this_the_real_goal', 'goal'],
  ['factor_help_estimate', 'factor'], ['factor_what_if_changes', 'factor'],
  ['factor_confirm_top_influence', 'factor'], ['factor_evidence_supports', 'factor'],
  ['option_what_could_go_wrong', 'option'], ['risk_leading_indicator', 'risk'],
  ['outcome_what_would_falsify', 'outcome'],
])('FB1 rail %s submits once as a chip with its own typed target', (chipId, kind) => {
  useCanvasStore.setState({ nodes: [{ ...nodes[0], type: kind }, nodes[1]], lodRung: 'full' } as never)
  useGuidanceStore.setState({ guidanceItems: [] })
  render(<NodeCoachingIcon nodeId="a" chips={[{ id: chipId, label: 'Ask', message: 'Old static question with 42', actionType: null }]} />)
  fireEvent.click(screen.getByTestId('node-coaching-icon-a'))
  expect(dispatch).toHaveBeenCalledTimes(1)
  const sent = dispatch.mock.calls[0][0]
  expect(sent).toMatchObject({ id: `ask:${COACHING_ASK_INTENTS[chipId]}`, source: 'chip' })
  expect(sent.message).toContain(kind === 'decision' ? 'Delivery' : 'Capacity')
  expect(sent.message).not.toContain('42')
  expect(takeAskTargetBinding(sent.message)?.nodeIds).toEqual(new Set(['a']))
  expect(revealOlumiSurface).toHaveBeenCalled()
})
it('range-only chances use the withheld wording, without reading a model figure into the question', () => {
  vi.mocked(selectRunAffirmedCurrent).mockReturnValue(true)
  useCanvasStore.setState({ hasCompletedFirstRun: true, results: { status: 'complete', report: { option_probabilities: { x: { goal_probability: null } } } } } as never)
  askAi({ intent: 'explain', nodeIds: ['a'] })
  expect(dispatch.mock.calls[0][0].message).toBe('What does Olumi still need about ‘Capacity’ before it can say how likely each option is to meet the goal?')
})
it('a graph-level ask binds an empty set rather than an unrelated live selection', () => {
  useCanvasStore.setState({ selection: { nodeIds: new Set(['b']), edgeIds: new Set(), anchorPosition: null } })
  askAi({ intent: 'gaps', nodeIds: [], edgeIds: [] })
  const bound = takeAskTargetBinding(dispatch.mock.calls[0][0].message)
  expect(bound?.nodeIds.size).toBe(0)
  expect(bound?.edgeIds.size).toBe(0)
})

it('does not invent an intent for an unregistered askAi caller', () => {
  expect(askAi({ nodeIds: ['a'] })).toBe('none')
  expect(dispatch).not.toHaveBeenCalled()
})
it.each(['What should I do about confirmation bias?', 'Ask for options', 'Start a pre-mortem', 'Ask for base rates', 'Discuss the driver Productivity', 'My target is ', 'Something not currently captured: '])('legacy caller keeps its text and route: %s', text => {
  const prefill = vi.fn(); useGuidanceStore.setState({ _prefillChat: prefill })
  expect(requestAsk({ text, label: 'Legacy' })).toBe('composer')
  expect(prefill).toHaveBeenCalledWith(text.trim())
  expect(dispatch).not.toHaveBeenCalled()
})
it('legacy parameterised asks keep their drawer carrier and text', () => {
  requestAsk({ text: 'Discuss this exact finding', label: 'Discuss', parameters: { block_id: 'finding_7' } })
  expect(useAskOlumiStore.getState()).toMatchObject({ isOpen: true, draft: 'Discuss this exact finding', parameters: { block_id: 'finding_7' } })
  expect(dispatch).not.toHaveBeenCalled()
})
it('a different ask is sent within 500 ms when idle; a busy ask reports a literal visible notice', () => {
  const notices: unknown[] = []
  const listener = (e: Event) => notices.push((e as CustomEvent).detail)
  window.addEventListener('topbar:show-toast', listener)
  try {
    expect(askAi({ intent: 'explain', nodeIds: ['a'] })).toBe('sent')
    expect(askAi({ intent: 'challenge', nodeIds: ['b'] })).toBe('sent')
    useGuidanceStore.setState({ _isConversationBusy: () => true })
    expect(askAi({ intent: 'evidence', nodeIds: ['a'] })).toBe('busy')
    expect(notices).toEqual([{ message: 'Olumi is still answering — try again in a moment', level: 'warning' }])
    expect(dispatch).toHaveBeenCalledTimes(2)
  } finally { window.removeEventListener('topbar:show-toast', listener) }
})

it.each([
  ['goal_why_so_low', 'goal', 'What explains the low chance of meeting ‘Capacity’, and which assumptions should we examine?'],
  ['goal_target_realistic', 'goal', 'Is the target for ‘Capacity’ realistic, and what evidence would help me judge it?'],
  ['risk_what_reduces', 'risk', 'What could reduce ‘Capacity’, and what would need to change in this model?'],
  ['risk_add_mitigation', 'risk', 'What factors or actions could reduce ‘Capacity’?'],
  ['option_what_would_change', 'option', 'What would need to change for another option to be better supported than Capacity?'],
  ['decision_compare_options', 'decision', 'How do the options compare in what they gain, give up and depend on?'],
  ['option_risks_of_inaction', 'option', 'What risks does keeping ‘Capacity’ as it is carry, and what could make them worse?'],
] as const)('%s sends the question promised by its own label', (chipId, kind, expected) => {
  useCanvasStore.setState({ nodes: [{ ...nodes[0], type: kind }], lodRung: 'full' } as never)
  useGuidanceStore.setState({ guidanceItems: [] })
  render(<NodeCoachingIcon nodeId="a" chips={[{ id: chipId, label: 'Ask', message: 'Old text', actionType: null }]} />)
  fireEvent.click(screen.getByTestId('node-coaching-icon-a'))
  expect(dispatch).toHaveBeenCalledTimes(1)
  expect(dispatch.mock.calls[0][0].message).toBe(expected)
  expect(takeAskTargetBinding(expected)?.nodeIds).toEqual(new Set(['a']))
})
it('a stale non-option challenge omits the misplaced suffix and keeps risk/outcome wording', () => {
  useCanvasStore.setState({ hasCompletedFirstRun: true } as never)
  askAi({ intent: 'challenge', nodeIds: ['a'], node: { type: 'risk', data: { label: 'Capacity' } } })
  expect(dispatch.mock.calls[0][0].message).toBe('What could make ‘Capacity’ happen, and what evidence would change how we see that risk?')
  expect(dispatch.mock.calls[0][0].message).not.toContain('since the model changed')
  expect(buildAskAiQuestion({ intent: 'challenge', node: { type: 'outcome', data: { label: 'Delivery' } } }).question).toBe('What would have to be true for ‘Delivery’ to happen, and what evidence would challenge that?')
})

it('baseline status uses the shared resolver, including CEE flags and explicit false controls', () => {
  vi.mocked(selectRunAffirmedCurrent).mockReturnValue(true)
  useCanvasStore.setState({ hasCompletedFirstRun: true, nodes: [{ ...nodes[0], type: 'option', data: { label: 'Keep things as they are' } }], ceeAnalysisReady: { options: [{ id: 'a', is_baseline: true }] } } as never)
  expect(buildAskAiQuestion({ intent: 'option', nodeIds: ['a'] }).question).toBe('What happens to the goal if we keep things as they are?')
  useCanvasStore.setState({ nodes: [{ ...nodes[0], type: 'option', data: { label: 'Keep things as they are', is_baseline: false } }] } as never)
  expect(buildAskAiQuestion({ intent: 'option', nodeIds: ['a'] }).question).toBe('What does ‘Keep things as they are’’s chance of meeting the goal rest on, and what would change it?')
})
