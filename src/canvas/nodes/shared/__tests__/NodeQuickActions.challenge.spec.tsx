// 7 Oct: Challenge sends one chip; its kind, target and layout invariants still hold.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { NodeQuickActions } from '../NodeQuickActions'
import { CHALLENGE_KINDS } from '../../../contextMenu/actions'
import { NodeTypeEnum, type NodeType } from '../../../domain/nodes'
import { useCanvasStore } from '../../../store'
import { useGuidanceStore } from '../../../stores/guidanceStore'
import { takeAskTargetBinding, clearAskTargetBinding } from '../../../ui/inspector-v2/askTargetBinding'
import { revealOlumiSurface } from '../../../conversation/revealOlumi'
const showToast = vi.hoisted(() => vi.fn())
vi.mock('../../../ToastContext', () => ({ useShowToastSafe: () => showToast }))
vi.mock('../../../conversation/revealOlumi', () => ({ revealOlumiSurface: vi.fn(() => true) }))
const a = { id: 'a', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Hiring spend', value: 42 } }
const b = { ...a, id: 'b', data: { label: 'Team productivity', value: 42 } }
let dispatch: ReturnType<typeof vi.fn>
beforeEach(() => {
  vi.clearAllMocks(); clearAskTargetBinding()
  useCanvasStore.setState({ nodes: [a, b], edges: [], lodRung: 'quiet', hasCompletedFirstRun: false, results: { status: 'idle' }, v5AnalysisFact: null } as never)
  dispatch = vi.fn()
  useGuidanceStore.setState({ _dispatchAction: dispatch, _prefillChat: vi.fn(), _sendMessage: vi.fn(), _isConversationBusy: () => false })
})
const mount = (kind: NodeType = 'factor', id = 'a', label = 'Hiring spend') => render(<NodeQuickActions nodeId={id} nodeType={kind} label={label} />)
const click = (id = 'a') => fireEvent.click(screen.getByTestId(`node-action-challenge-${id}`))
const message = () => dispatch.mock.calls[0][0].message

describe('Challenge submits typed context', () => {
  it('names its element in the accessible control', () => {
    mount()
    expect(screen.getByRole('button', { name: 'Challenge Hiring spend' })).toBeInTheDocument()
    expect(screen.getByTestId('node-action-challenge-a')).toBeInTheDocument()
  })
  it.each([...CHALLENGE_KINDS])('%s submits once with its own label and bound target', kind => {
    mount(kind); click()
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch.mock.calls[0][0]).toMatchObject({ id: 'ask:challenge', source: 'chip' })
    expect(message()).toContain('Hiring spend'); expect(message()).not.toContain('42')
    expect(takeAskTargetBinding(message())?.nodeIds).toEqual(new Set(['a']))
    expect(revealOlumiSurface).toHaveBeenCalled()
    expect(useGuidanceStore.getState()._sendMessage).not.toHaveBeenCalled()
    expect(useGuidanceStore.getState()._prefillChat).not.toHaveBeenCalled()
  })
  it('selects the target before sending', () => {
    mount(); click()
    expect(useCanvasStore.getState().selection.nodeIds.has('a')).toBe(true)
  })
  it('binds to the second node, never the first (discriminating pair)', () => {
    mount(); mount('factor', 'b', 'Team productivity'); click('b')
    expect(message()).toBe('What is the figure for ‘Team productivity’ based on, and what would make a different figure more defensible?')
    expect(message()).not.toContain('Hiring spend')
    expect(takeAskTargetBinding(message())?.nodeIds).toEqual(new Set(['b']))
    expect(useCanvasStore.getState().selection.nodeIds.has('b')).toBe(true)
    expect(useCanvasStore.getState().selection.nodeIds.has('a')).toBe(false)
  })
  it('uses the chip wire when no composer is registered', () => {
    useGuidanceStore.setState({ _prefillChat: null }); mount(); click()
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(useGuidanceStore.getState()._sendMessage).not.toHaveBeenCalled()
  })
  it.each([
    ['decision', 'Is ‘Hiring spend’ the right question, how is it framed, and what is it assuming?'],
    ['option', 'What would make ‘Hiring spend’ a worse choice than it looks, what is it assuming, and what alternative is missing?'],
  ] as const)('%s gets its own words, never the factor sentence', (kind, expected) => {
    mount(kind); click()
    expect(message()).toBe(expected)
    expect(message()).not.toBe('What is the figure for ‘Hiring spend’ based on, and what would make a different figure more defensible?')
    expect(useGuidanceStore.getState()._sendMessage).not.toHaveBeenCalled()
  })
  it.each([
    { _dispatchAction: null, _sendMessage: null, _prefillChat: null },
    { _dispatchAction: null, _sendMessage: vi.fn(), _prefillChat: vi.fn() },
  ])('no chip send surface → no Challenge button; More remains', channels => {
    useGuidanceStore.setState(channels); mount()
    expect(screen.queryByTestId('node-action-challenge-a')).toBeNull()
    expect(dispatch).not.toHaveBeenCalled()
    expect(showToast).not.toHaveBeenCalled()
    expect(screen.getByTestId('node-action-menu-a')).toBeInTheDocument()
  })
  it('withholds Challenge for action nodes', () => {
    mount('action')
    expect(screen.queryByTestId('node-action-challenge-a')).toBeNull()
  })
  it('renders for EXACTLY the kinds the menu producer admits', () => {
    const admitted: NodeType[] = [], withheld: NodeType[] = []
    for (const kind of NodeTypeEnum.options) {
      const { unmount } = mount(kind)
      const rendered = screen.queryByTestId('node-action-challenge-a') !== null
      ;(rendered ? admitted : withheld).push(kind)
      unmount()
    }
    expect(admitted.length).toBeGreaterThan(0)
    expect(withheld.length).toBeGreaterThan(0)
    expect(new Set(admitted)).toEqual(new Set(CHALLENGE_KINDS))
    for (const kind of withheld) expect(CHALLENGE_KINDS.has(kind)).toBe(false)
  })
  it('keeps Challenge in the tab order with a visible focus ring', () => {
    mount()
    const button = screen.getByTestId('node-action-challenge-a')
    expect(button.tagName).toBe('BUTTON')
    expect(button).not.toHaveAttribute('tabindex', '-1')
    expect(button).not.toHaveAttribute('hidden')
    expect(button.className).toContain('focus-visible:ring-2')
  })
})
