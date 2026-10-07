/**
 * Item 3 (Paul 7 Oct; CEE #2776): a link the user draws has no strength yet, so the canvas presses
 * `agent-drawn-link:<from>><to>` and Olumi proposes a direction, a band and one reason as a card the user accepts,
 * changes or declines. Bound by the press id and the edge pair; the controls are the pairs whose links state a setting
 * or a choice (option, decision), and a conversation that is already answering.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildAskAiQuestion } from '../askAi'
import { proposeForDrawnLink } from '../drawnLinkProposal'
import { useCanvasStore } from '../../store'
import { useGuidanceStore } from '../../stores/guidanceStore'
import { QUESTIONS } from '../askAiQuestions'
vi.mock('../revealOlumi', () => ({ revealOlumiSurface: vi.fn(() => true) }))

const node = (id: string, type: string, label: string) => ({ id, type, position: { x: 0, y: 0 }, data: { label } })
const nodes = [
  node('fac_friction', 'factor', 'Adoption friction'),
  node('out_nrr', 'outcome', 'Net revenue retention'),
  node('risk_churn', 'risk', 'Churn spike'),
  node('goal_rev', 'goal', 'Revenue'),
  node('opt_hybrid', 'option', 'Hybrid pricing'),
  node('dec_pricing', 'decision', 'How should we price?'),
]
const edges = [
  { id: 'e-causal', source: 'fac_friction', target: 'out_nrr', data: {} },
  { id: 'e-risk-goal', source: 'risk_churn', target: 'goal_rev', data: {} },
  { id: 'e-option', source: 'opt_hybrid', target: 'fac_friction', data: {} },
  { id: 'e-decision', source: 'dec_pricing', target: 'opt_hybrid', data: {} },
]
let dispatch: ReturnType<typeof vi.fn>
let busy = false
const toasts: unknown[] = []
window.addEventListener('topbar:show-toast', (e) => toasts.push((e as CustomEvent).detail))

beforeEach(() => {
  busy = false; toasts.length = 0
  useCanvasStore.setState({ nodes, edges, hasCompletedFirstRun: false, results: { status: 'idle' }, v5AnalysisFact: null } as never)
  dispatch = vi.fn()
  useGuidanceStore.setState({ _dispatchAction: dispatch, _sendMessage: vi.fn(), _prefillChat: vi.fn(), _isConversationBusy: () => busy })
})

describe('a drawn link asks Olumi for a direction, a band and a reason', () => {
  it('the press id names the drawn pair, and the question names both cards', () => {
    const built = buildAskAiQuestion({ intent: 'drawn-link', edgeIds: ['e-causal'] })
    expect(built.id).toBe('agent-drawn-link:fac_friction>out_nrr')
    expect(built.question).toBe(QUESTIONS['drawn-link']({ stage: 'drafted', sourceLabel: 'Adoption friction', targetLabel: 'Net revenue retention' }))
    expect(built.question).toContain('‘Adoption friction’')
    expect(built.question).toContain('‘Net revenue retention’')
  })

  it.each([
    ['e-causal', 'agent-drawn-link:fac_friction>out_nrr'],
    ['e-risk-goal', 'agent-drawn-link:risk_churn>goal_rev'],
  ])('%s: exactly one chip press for THAT pair', (edgeId, pressId) => {
    expect(proposeForDrawnLink(edgeId)).toBe('sent')
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch.mock.calls[0][0]).toMatchObject({ id: pressId, source: 'chip' })
  })

  it.each(['e-option', 'e-decision'])('CONTROL %s: a link that states a setting or a choice is not pressed', (edgeId) => {
    expect(proposeForDrawnLink(edgeId)).toBe('none')
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('CONTROL: an unknown edge is not pressed', () => {
    expect(proposeForDrawnLink('nope')).toBe('none')
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('while Olumi is answering, the draw stays quiet: no press and no busy notice (a gesture is not an ask)', () => {
    busy = true
    expect(proposeForDrawnLink('e-causal')).toBe('busy')
    expect(dispatch).not.toHaveBeenCalled()
    expect(toasts).toEqual([])
  })
})
