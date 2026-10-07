// 7 Oct ruling reverses prefill-and-confirm: product asks send immediately as chip turns.
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { act, render, screen, fireEvent, renderHook } from '@testing-library/react'
import { NodeQuickActions } from '../../nodes/shared/NodeQuickActions'
import { askAI } from '../actions'
import { useMenuItems } from '../useMenuItems'
import { useCanvasStore } from '../../store'
import { useGuidanceStore } from '../../stores/guidanceStore'
import { takeAskTargetBinding, clearAskTargetBinding } from '../../ui/inspector-v2/askTargetBinding'
import { revealOlumiSurface } from '../../conversation/revealOlumi'
import type { ContextTarget, MenuItemDef } from '../types'
vi.mock('../../conversation/revealOlumi', () => ({ revealOlumiSurface: vi.fn(() => true) }))
const a = { id: 'a', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Hiring spend', value: 42 } }
const b = { id: 'b', type: 'factor', position: { x: 1, y: 1 }, data: { label: 'Productivity' } }
const edge = { id: 'ab', source: 'a', target: 'b', data: {} }
const point = { x: 0, y: 0 }
const targets: ContextTarget[] = [
  { kind: 'node', nodeId: 'a', nodeType: 'factor', node: a, screenPos: point } as ContextTarget,
  { kind: 'edge', edgeId: 'ab', edge, isStructural: false, screenPos: point } as ContextTarget,
  { kind: 'pane', screenPos: point },
  { kind: 'multi', nodeIds: ['a', 'b'], edgeIds: ['ab'], screenPos: point },
]
let dispatch: ReturnType<typeof vi.fn>
beforeEach(() => {
  vi.clearAllMocks(); clearAskTargetBinding()
  useCanvasStore.setState({ nodes: [a, b], edges: [edge], lodRung: 'quiet', hasCompletedFirstRun: false, results: { status: 'idle' }, v5AnalysisFact: null } as never)
  dispatch = vi.fn()
  useGuidanceStore.setState({ _dispatchAction: dispatch, _prefillChat: vi.fn(), _sendMessage: vi.fn(), _isConversationBusy: () => false })
})
describe('canvas Ask doors: one click, one bound chip, panel fronted', () => {
  it.each([
    [0, 'ask-ai', 'ask-ai-explain', 'explain_element', 'What does ‘Hiring spend’ do in this decision, and what is it assumed to depend on?'],
    [0, 'ask-ai', 'ask-ai-challenge', 'challenge_element', 'What is the figure for ‘Hiring spend’ based on, and what would make a different figure more defensible?'],
    [1, 'ask-ai', 'ask-ai-explain', 'explain_element', 'Why would ‘Hiring spend’ change ‘Productivity’, and how sure are we?'],
    [1, 'ask-ai', 'ask-ai-challenge', 'challenge_element', 'Is the link from ‘Hiring spend’ to ‘Productivity’ right, and what other route could reach the goal?'],
    [2, 'ask-ai-pane', 'ask-ai-missing', 'review_model_gaps', 'What is missing from this model that could change how the options compare?'],
    [3, 'ask-ai', 'ask-ai-explain', 'explain_subgraph', 'What does ‘Hiring spend’ do in this decision, and what is it assumed to depend on?'],
  ] as const)('menu target %s / %s / %s sends once', (index, parent, child, _intent, expected) => {
    const target = targets[index]
    const { result } = renderHook(() => useMenuItems({ target, showToast: vi.fn(), screenToFlowPosition: p => p, onClose: vi.fn() }))
    const root = result.current.find(e => 'id' in e && e.id === parent) as MenuItemDef
    const item = root.submenuItems!.find(e => 'id' in e && e.id === child) as MenuItemDef
    vi.useFakeTimers()
    act(() => { item.action(); vi.advanceTimersByTime(1500) })
    vi.useRealTimers()
    expect(dispatch).toHaveBeenCalledTimes(1)
    const sent = dispatch.mock.calls[0][0]
    expect(sent).toMatchObject({ source: 'chip', message: expected })
    expect(sent.id).toBe(target.kind === 'edge' ? child === 'ask-ai-challenge' ? 'ask:question-link' : 'ask:link' : target.kind === 'pane' ? 'ask:gaps' : child === 'ask-ai-challenge' ? 'ask:challenge' : 'ask:explain')
    expect(sent.message).not.toContain('42')
    const bound = takeAskTargetBinding(sent.message)
    if (target.kind === 'node') expect(bound?.nodeIds).toEqual(new Set(['a']))
    if (target.kind === 'edge') expect(bound?.edgeIds).toEqual(new Set(['ab']))
    if (target.kind === 'pane') expect(bound?.nodeIds.size).toBe(0)
    expect(useGuidanceStore.getState()._prefillChat).not.toHaveBeenCalled()
    expect(useGuidanceStore.getState()._sendMessage).not.toHaveBeenCalled()
    expect(revealOlumiSurface).toHaveBeenCalled()
  })
  it('hover explain and Challenge each send one chip with their own target across two nodes', () => {
    const bindings: Array<ReturnType<typeof takeAskTargetBinding>> = []
    dispatch.mockImplementation(o => bindings.push(takeAskTargetBinding(o.message)))
    render(<NodeQuickActions nodeId="a" nodeType="factor" label="Hiring spend" />)
    vi.useFakeTimers()
    act(() => { fireEvent.click(screen.getByTestId('node-action-ask-a')); vi.advanceTimersByTime(501) })
    render(<NodeQuickActions nodeId="b" nodeType="factor" label="Productivity" />)
    fireEvent.click(screen.getByTestId('node-action-challenge-b'))
    vi.useRealTimers()
    expect(dispatch).toHaveBeenCalledTimes(2)
    expect(dispatch.mock.calls.map(([o]) => o.id)).toEqual(['ask:explain', 'ask:challenge'])
    const [explain, challenge] = dispatch.mock.calls.map(([o]) => o.message)
    expect(explain).toBe('What does ‘Hiring spend’ do in this decision, and what is it assumed to depend on?')
    expect(challenge).toBe('What is the figure for ‘Productivity’ based on, and what would make a different figure more defensible?')
    expect(bindings[0]?.nodeIds).toEqual(new Set(['a']))
    expect(bindings[1]?.nodeIds).toEqual(new Set(['b']))
  })
  it('the second node’s hover Ask sends its own literal question, never the first node’s', () => {
    render(<>
      <NodeQuickActions nodeId="a" nodeType="factor" label="Hiring spend" />
      <NodeQuickActions nodeId="b" nodeType="factor" label="Productivity" />
    </>)
    vi.useFakeTimers()
    act(() => { fireEvent.click(screen.getByTestId('node-action-ask-b')); vi.advanceTimersByTime(1500) })
    vi.useRealTimers()
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith({ id: 'ask:explain', source: 'chip',
      label: 'What does ‘Productivity’ do in this decision, and what is it assumed to depend on?',
      message: 'What does ‘Productivity’ do in this decision, and what is it assumed to depend on?' })
    const message = dispatch.mock.calls[0][0].message
    expect(message).not.toContain('Hiring spend')
    expect(takeAskTargetBinding(message)?.nodeIds).toEqual(new Set(['b']))
    expect(useCanvasStore.getState().selection.nodeIds.has('b')).toBe(true)
  })
  it('without a chip dispatcher, never substitutes a composer send', () => {
    useGuidanceStore.setState({ _dispatchAction: null })
    const toast = vi.fn(); vi.useFakeTimers()
    act(() => { askAI(targets[0], 'explain_element', toast); vi.advanceTimersByTime(1500) })
    vi.useRealTimers()
    expect(useGuidanceStore.getState()._sendMessage).not.toHaveBeenCalled()
    expect(toast).toHaveBeenCalled()
  })
})

it('a second node gets its own question and typed identity', () => {
  const target = { kind: 'node', nodeId: 'b', nodeType: 'factor', node: b, screenPos: point } as ContextTarget
  vi.useFakeTimers()
  act(() => { askAI(target, 'explain_element'); vi.advanceTimersByTime(100) })
  vi.useRealTimers()
  expect(dispatch).toHaveBeenCalledTimes(1)
  const sent = dispatch.mock.calls[0][0]
  expect(sent.message).toBe('What does ‘Productivity’ do in this decision, and what is it assumed to depend on?')
  expect(sent.message).not.toContain('Hiring spend')
  expect(takeAskTargetBinding(sent.message)?.nodeIds).toEqual(new Set(['b']))
})
it('polls until a dispatcher registers, then sends exactly once', () => {
  useGuidanceStore.setState({ _dispatchAction: null })
  vi.useFakeTimers()
  act(() => { askAI(targets[0], 'explain_element'); vi.advanceTimersByTime(150) })
  expect(dispatch).not.toHaveBeenCalled()
  act(() => { useGuidanceStore.setState({ _dispatchAction: dispatch }); vi.advanceTimersByTime(1500) })
  vi.useRealTimers()
  expect(dispatch).toHaveBeenCalledTimes(1)
  expect(dispatch.mock.calls[0][0].message).toBe('What does ‘Hiring spend’ do in this decision, and what is it assumed to depend on?')
  expect(useGuidanceStore.getState()._prefillChat).not.toHaveBeenCalled()
  expect(useGuidanceStore.getState()._sendMessage).not.toHaveBeenCalled()
})
