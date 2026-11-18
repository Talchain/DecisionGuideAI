// The olumi-core lane (Codex 23:56Z; menu review 18 Nov): a canvas Ask other than a challenge (right-click Explain, Details "Ask Olumi",
// gaps, a link) is put in the message box, bound to its target, for the person to change and send. A challenge still runs typed on its card.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from '@testing-library/react'
import { askAI } from '../actions'
import { useCanvasStore } from '../../store'
import { useGuidanceStore } from '../../stores/guidanceStore'
import { clearAskTargetBinding, takeAskTargetBinding } from '../../ui/inspector-v2/askTargetBinding'
import type { ContextTarget } from '../types'
vi.mock('../../../olumiCore/lane', async (orig) => ({ ...(await orig<object>()), isOlumiCoreLane: () => true }))
vi.mock('../../conversation/revealOlumi', () => ({ revealOlumiSurface: vi.fn(() => true) }))
const a = { id: 'a', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Hiring spend' } }
const target = { kind: 'node', nodeId: 'a', nodeType: 'factor', node: a, screenPos: { x: 0, y: 0 } } as ContextTarget
let dispatch: ReturnType<typeof vi.fn>, prefill: ReturnType<typeof vi.fn>, send: ReturnType<typeof vi.fn>
beforeEach(() => {
  vi.clearAllMocks(); clearAskTargetBinding()
  useCanvasStore.setState({ nodes: [a], edges: [] } as never)
  dispatch = vi.fn(); prefill = vi.fn(); send = vi.fn()
  useGuidanceStore.setState({ _dispatchAction: dispatch, _prefillChat: prefill, _sendMessage: send, _isConversationBusy: () => false })
})
const ask = (intent: string) => { vi.useFakeTimers(); act(() => { askAI(target, intent); vi.advanceTimersByTime(1500) }); vi.useRealTimers() }
describe('lane: canvas asks', () => {
  it('Explain puts its question in the box, bound to the card, and sends nothing. CONTRAST: Challenge runs typed on the card', () => {
    ask('explain_element')
    expect([prefill.mock.calls.length, dispatch.mock.calls.length, send.mock.calls.length]).toEqual([1, 0, 0])
    const words = prefill.mock.calls[0]![0] as string
    expect(words).toContain('Hiring spend')
    expect(takeAskTargetBinding(words)?.nodeIds).toEqual(new Set(['a']))
    ask('challenge_element')
    expect([prefill.mock.calls.length, dispatch.mock.calls.length]).toEqual([1, 1])
    expect(dispatch.mock.calls[0]![0]).toMatchObject({ id: 'ask:challenge' })
  })
})
