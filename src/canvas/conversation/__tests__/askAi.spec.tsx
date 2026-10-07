// Batch 1 regression rows authored before implementation; Vitest execution prohibited by brief.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { askAi, buildAskAiQuestion } from '../askAi'
import { buildChipMeta } from '../chipMeta'
import { useCanvasStore } from '../../store'
import { useGuidanceStore } from '../../stores/guidanceStore'
import { clearAskTargetBinding, takeAskTargetBinding } from '../../ui/inspector-v2/askTargetBinding'
import { requestAsk } from '../../ui/inspector-v2/askSemantic'
import { useAskOlumiStore } from '../../../components/results/coaching/askOlumiStore'
import { buildV5Payload } from '../../../v5/buildPayload'
import { OrchestratorTurnPayloadSchema } from '@talchain/schemas/boundary'
import { revealOlumiSurface } from '../revealOlumi'
import { isQuestionAssumptionEnabled, isTestWithoutLinkEnabled } from '../../../flags'
vi.mock('../../../flags', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  isQuestionAssumptionEnabled: vi.fn(() => false),
  isTestWithoutLinkEnabled: vi.fn(() => false),
}))
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
  vi.mocked(isQuestionAssumptionEnabled).mockReturnValue(false)
  vi.mocked(isTestWithoutLinkEnabled).mockReturnValue(false)
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
  it('Examine keeps the Q3 basis question while ordinary Challenge keeps its distinct question', () => {
    askAi({ intent: 'examine-link', nodeIds: [], edgeIds: ['ab'] })
    expect(dispatch).toHaveBeenCalledWith({ id: 'ask:link',
      label: 'Why would ‘Capacity’ change ‘Delivery’, and how sure are we?',
      message: 'Why would ‘Capacity’ change ‘Delivery’, and how sure are we?', source: 'chip' })
    expect(takeAskTargetBinding(dispatch.mock.calls[0][0].message)?.edgeIds).toEqual(new Set(['ab']))
    askAi({ intent: 'question-link', nodeIds: [], edgeIds: ['ab'] })
    expect(dispatch).toHaveBeenCalledTimes(2)
    expect(dispatch.mock.calls[1][0]).toEqual({ id: 'ask:question-link',
      label: 'Is the link from ‘Capacity’ to ‘Delivery’ right, and what other route could reach the goal?',
      message: 'Is the link from ‘Capacity’ to ‘Delivery’ right, and what other route could reach the goal?', source: 'chip' })
    expect(takeAskTargetBinding(dispatch.mock.calls[1][0].message)?.edgeIds).toEqual(new Set(['ab']))
  })
  it.each(['examine-link', 'question-link'] as const)('%s retains the eligible open-assumption press', intent => {
    vi.mocked(isQuestionAssumptionEnabled).mockReturnValue(true)
    useCanvasStore.setState({ edges: [{ ...edge, data: { weight: 0.2, weightSource: 'cee', strengthPlaceholder: 0.2 } }] } as never)
    askAi({ intent, nodeIds: [], edgeIds: ['ab'] })
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith({ id: 'agent-question-assumption:a>b',
      label: 'Is the link from ‘Capacity’ to ‘Delivery’ right, and what other route could reach the goal?',
      message: 'Is the link from ‘Capacity’ to ‘Delivery’ right, and what other route could reach the goal?', source: 'chip' })
    expect(takeAskTargetBinding(dispatch.mock.calls[0][0].message)?.edgeIds).toEqual(new Set(['ab']))
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
import { resolveNodeCoaching } from '../../nodes/coaching/resolveNodeCoaching'

it.each(['42% of influence', undefined])('confirmation rail keeps resolver context %s out of the actual send', influencePhrase => {
  useCanvasStore.setState({ nodes: [{ ...nodes[0], data: { label: 'Engineering Capacity', value: 42 } }], lodRung: 'full' } as never)
  useGuidanceStore.setState({ guidanceItems: [] })
  const chips = resolveNodeCoaching({ kind: 'factor', surface: 'card',
    state: { needsInput: false, isExternalCategory: false, isInferred: true, leadsInfluence: true },
    context: { label: 'Engineering Capacity', influencePhrase } })
  expect(chips).not.toBeNull()
  expect(chips![0].id).toBe('factor_confirm_top_influence')
  expect(chips![0].message).toBe((influencePhrase ? `${influencePhrase} — and ` : '')
    + "Engineering Capacity's value is still an unconfirmed estimate. What would it take to confirm it?")
  render(<NodeCoachingIcon nodeId="a" chips={chips!} />)
  fireEvent.click(screen.getByTestId('node-coaching-icon-a'))
  expect(dispatch).toHaveBeenCalledTimes(1)
  expect(dispatch).toHaveBeenCalledWith({ id: 'ask:confirm',
    label: 'What would it take to confirm ‘Engineering Capacity’?',
    message: 'What would it take to confirm ‘Engineering Capacity’?', source: 'chip' })
  const sent = dispatch.mock.calls[0][0].message
  expect(sent).not.toContain('42')
  expect(sent).not.toContain('—')
  expect(takeAskTargetBinding(sent)?.nodeIds).toEqual(new Set(['a']))
  expect(revealOlumiSurface).toHaveBeenCalled()
})

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
  // The decision's "more options" chip is the `more_options` action: typed at every stage (DL ruling, 7 Oct 2026).
  const id = chipId === 'decision_explore_more_options' ? 'agent-next-widen' : `ask:${COACHING_ASK_INTENTS[chipId]}`
  expect(sent).toMatchObject({ id, source: 'chip' })
  expect(sent.message).toContain(kind === 'decision' ? 'Delivery' : 'Capacity')
  expect(sent.message).not.toContain('42')
  expect(takeAskTargetBinding(sent.message)?.nodeIds).toEqual(new Set(['a']))
  expect(revealOlumiSurface).toHaveBeenCalled()
})
describe('the draft’s UNREQUESTED automatic Run asks the drafted question (DL ruling 7 Oct, Canvas askAi witness)', () => {
  // Served: staging d47c8d13, askai-2 — the draft's automatic first pass came back `complete_current` with the leader
  // withheld as `unrequested_analysis_withheld`, and node Explain asked "What does Olumi still need…" although nobody had
  // asked for a Run. The cause is read off the result it qualifies (`producer_leader_permission.producer_cause`).
  const DRAFTED = 'What does ‘Capacity’ do in this decision, and what is it assumed to depend on?'
  const WITHHELD = 'What does Olumi still need about ‘Capacity’ before it can say how likely each option is to meet the goal?'
  const ranWithheld = (permission: Record<string, unknown>) => {
    useCanvasStore.setState({ hasCompletedFirstRun: true, results: { status: 'complete', report: { producer_leader_permission: permission } } } as never)
    vi.mocked(selectRunAffirmedCurrent).mockReturnValue(true)
    vi.mocked(selectRunWithholdsFigures).mockReturnValue(true)
  }
  it('RED: the automatic first pass (unrequested_analysis_withheld) asks the drafted question', () => {
    ranWithheld({ permitted: false, producer_cause: 'unrequested_analysis_withheld' })
    askAi({ intent: 'explain', nodeIds: ['a'] })
    expect(dispatch.mock.calls[0][0].message).toBe(DRAFTED)
  })
  it.each(['constraint_verdict_withheld', 'options_do_not_separate', 'goal_scope_unresolved'])(
    'a Run the person asked for, withheld for %s, keeps the withheld question',
    (producer_cause) => {
      ranWithheld({ permitted: false, producer_cause })
      askAi({ intent: 'explain', nodeIds: ['a'] })
      expect(dispatch.mock.calls[0][0].message).toBe(WITHHELD)
    },
  )
  it('CONTROL: the token counts only on a withheld leader — a permitted leader carrying it is not the unrequested pass', () => {
    ranWithheld({ permitted: true, producer_cause: 'unrequested_analysis_withheld' })
    askAi({ intent: 'explain', nodeIds: ['a'] })
    expect(dispatch.mock.calls[0][0].message).toBe(WITHHELD)
  })
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

it('user responses carry block and method parameters through the schema-supported typed chip wire', () => {
  const message = 'On ‘A finding’:\n  My own words  '
  const parameters = { block_id: 'blk_finding', method_id: 'pre_mortem' }
  expect(askAi({ userWords: message, parameters, nodeIds: ['a'], edgeIds: [] })).toBe('sent')
  expect(dispatch).toHaveBeenCalledTimes(1)
  expect(dispatch).toHaveBeenCalledWith({ label: message, message, parameters, source: 'chip' })
  const sent = dispatch.mock.calls[0][0]
  const wire = buildV5Payload({ turnId: '11111111-1111-4111-8111-111111111111', scenarioId: '22222222-2222-4222-8222-222222222222', stage: 'analyse', turnClass: 'clarify', mode: 'user', source: sent.source, message: sent.message, chipMeta: buildChipMeta(sent) })
  expect(wire.ok).toBe(true)
  if (wire.ok) {
    expect(wire.payload).toMatchObject({ source: 'chip', message, chip: { parameters }, selected_elements: [{ id: 'a', kind: 'factor', label: 'Capacity' }] })
    expect(() => OrchestratorTurnPayloadSchema.parse(wire.payload)).not.toThrow()
  }
  expect(dispatch.mock.calls[0][0].message).not.toContain('blk_finding')
  expect(dispatch.mock.calls[0][0].message).not.toContain('method_id')
  expect(useGuidanceStore.getState()._sendMessage).not.toHaveBeenCalled()
})
it('a parameterised response requires its typed carrier and does not fall back to a text-only send', () => {
  useGuidanceStore.setState({ _dispatchAction: null })
  expect(askAi({ userWords: 'My response', parameters: { block_id: 'blk_finding' } })).toBe('none')
  expect(useGuidanceStore.getState()._sendMessage).not.toHaveBeenCalled()
})
it('response refire identity includes its typed parameters', () => {
  expect(askAi({ userWords: 'Same words', parameters: { block_id: 'a' } })).toBe('sent')
  expect(askAi({ userWords: 'Same words', parameters: { block_id: 'b' } })).toBe('sent')
  expect(askAi({ userWords: 'Same words', parameters: { block_id: 'b' } })).toBe('refire')
  expect(dispatch).toHaveBeenCalledTimes(2)
})
