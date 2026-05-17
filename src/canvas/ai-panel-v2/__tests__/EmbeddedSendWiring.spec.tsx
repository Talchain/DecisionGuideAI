import { describe, it, expect, vi, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, cleanup, act } from '@testing-library/react'

// Regression test for the embedded-dock send wiring (Imp #2).
//
// Goal: prove that AIPanelV2Layout passes its singleton conversation's
// sendMessage into the embedded OutputsDock — so a send from inside the
// dock body lands on the same conversation instance as a send from the
// visible AIZone, never on a second hook-owned instance.
//
// Strategy: spy on useConversation at the module level. The spy returns
// a stable conversation object whose sendMessage identity is captured.
// We mock OutputsDock (the wrapper) so we can capture the
// `embeddedSendMessage` prop it receives. The assertion: the captured
// prop IS the conversation.sendMessage returned by the spy — by
// reference. Invoking the captured prop also lands on that exact mock.

const captured = vi.hoisted(() => ({
  embeddedSendFromProp: null as ((text: string) => unknown) | null,
  zoneSendMessage: null as ((text: string) => unknown) | null,
  sharedSendMessage: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../conversation/useConversation', async () => {
  const actual = await vi.importActual<typeof import('../../conversation/useConversation')>(
    '../../conversation/useConversation',
  )
  return {
    ...actual,
    useConversation: () => ({
      messages: [],
      isThinking: false,
      longRunningHint: null,
      lastFailedInput: null,
      sendMessage: captured.sharedSendMessage,
      sendSystemEvent: vi.fn(),
      sendChip: vi.fn(),
      dispatchAction: vi.fn(),
      clearHistory: vi.fn(),
      retryLast: vi.fn(),
      cancelTurn: vi.fn(),
      patchBlockStates: new Map(),
      setPatchBlockState: vi.fn(),
      patchRejections: new Map(),
      setPatchRejection: vi.fn(),
    }),
  }
})

// Mock the OutputsDock wrapper to capture the embeddedSendMessage prop
// AIPanelV2Layout supplies. The actual wrapper (production code) wires
// this prop through to OutputsDockBody — verified separately by
// SingletonInvariant.spec.tsx. Here we focus on the LAYOUT-side wiring:
// the prop must be the singleton conversation's sendMessage.
vi.mock('../../components/OutputsDock', () => ({
  OutputsDock: (props: { embedded?: boolean; embeddedSendMessage?: (text: string) => unknown }) => {
    if (props.embedded && props.embeddedSendMessage) {
      captured.embeddedSendFromProp = props.embeddedSendMessage
    }
    return (
      <div
        data-testid="outputs-dock"
        data-embedded={String(!!props.embedded)}
        data-has-send={String(typeof props.embeddedSendMessage === 'function')}
      />
    )
  },
}))

// Stub AIZone (we test the LAYOUT side here, not the zone internals).
vi.mock('../AIZone', () => ({
  AIZone: ({ conversation }: { conversation: { sendMessage: (text: string) => unknown } }) => {
    captured.zoneSendMessage = conversation.sendMessage
    return <div data-testid="ai-zone-stub" />
  },
}))

import { AIPanelV2Layout } from '../AIPanelV2Layout'

afterEach(() => {
  cleanup()
  captured.embeddedSendFromProp = null
  captured.zoneSendMessage = null
  captured.sharedSendMessage.mockReset()
})

describe('Embedded dock send wiring — AIPanelV2Layout threads the singleton sendMessage to OutputsDock', () => {
  it('passes embeddedSendMessage to OutputsDock when embedded', () => {
    render(<AIPanelV2Layout />)
    const dock = screen.getByTestId('outputs-dock')
    expect(dock.dataset.embedded).toBe('true')
    expect(dock.dataset.hasSend).toBe('true')
    expect(captured.embeddedSendFromProp).toBeTypeOf('function')
  })

  it('the embedded sendMessage IS the singleton conversation.sendMessage (same reference)', () => {
    render(<AIPanelV2Layout />)
    expect(captured.embeddedSendFromProp).toBe(captured.sharedSendMessage)
  })

  it('AIZone receives the SAME sendMessage as embedded OutputsDock (one conversation instance, two consumers)', () => {
    render(<AIPanelV2Layout />)
    expect(captured.zoneSendMessage).toBe(captured.embeddedSendFromProp)
    expect(captured.zoneSendMessage).toBe(captured.sharedSendMessage)
  })

  it('calling the embedded sendMessage invokes the singleton mock exactly once', async () => {
    render(<AIPanelV2Layout />)
    await act(async () => {
      captured.embeddedSendFromProp?.('Investigate this driver')
    })
    expect(captured.sharedSendMessage).toHaveBeenCalledTimes(1)
    expect(captured.sharedSendMessage).toHaveBeenCalledWith('Investigate this driver')
  })
})
