import { describe, it, expect, vi, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react'

// Integration test for batch-1 P1 #4 (popover dismiss on mode change).
//
// Renders the REAL AIPanelV2Layout → AIZone → AIInputBar tree so the
// `activeMode` change actually propagates through the real prop chain
// to AIInputBar's imperative `closePopover()` handle, AND the
// capture-phase pointerdown outside-click also gets a real test.
//
// Two paths covered:
//   1. Mouse path: click the mode-control button. The button's
//      `onPointerDown={ev => ev.stopPropagation()}` would have
//      previously eaten the popover's bubble-phase outside-click —
//      capture-phase pointerdown listener should still see it.
//   2. Keyboard path: focus the mode-control button and activate via
//      Enter. Keyboard activation does NOT fire pointerdown, so the
//      AIZone `useEffect(..., [activeMode])` path that calls
//      `closePopover()` on the AIInputBar imperative handle is what
//      catches it.

vi.mock('../../conversation/useConversation', async () => {
  const actual = await vi.importActual<typeof import('../../conversation/useConversation')>(
    '../../conversation/useConversation',
  )
  return {
    ...actual,
    useConversation: () => ({
      messages: [{ id: 'm1', role: 'user' as const, content: 'hi', timestamp: 0 }],
      isThinking: false,
      longRunningHint: null,
      lastFailedInput: null,
      sendMessage: vi.fn().mockResolvedValue(undefined),
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

// Bypass orchestrator + router-dependent surfaces so the layout boots.
vi.mock('../../hooks/useV2Run', () => ({
  useV2Run: () => ({ runV2Analysis: vi.fn(), cancelRun: vi.fn(), isRunning: false }),
}))
vi.mock('../../hooks/useGraphReadiness', () => ({
  useGraphReadiness: () => ({ readiness: null }),
}))
vi.mock('../../../hooks/useScenario', () => ({
  useScenario: () => ({
    isPersistenceActive: false,
    supabaseSaveStatus: 'idle',
    supabaseSaveError: null,
  }),
}))
vi.mock('../../conversation/hooks/useThreadPersistence', () => ({
  useThreadPersistence: () => ({ onBlockAction: vi.fn(), onChipTaken: vi.fn() }),
}))
vi.mock('../../../adapters/plot', () => ({ plot: { validatePatch: vi.fn() } }))
// Keep ConversationPanel structure but stub heavy chat-thread internals.
vi.mock('../../conversation/zones/ChatThread', () => ({
  ChatThread: () => <div data-testid="stub-chat-thread" />,
}))
vi.mock('../../conversation/zones/ChatComposer', () => ({
  ChatComposer: () => null,
}))

import { AIPanelV2Layout } from '../AIPanelV2Layout'

afterEach(() => {
  cleanup()
})

describe('Popover dismiss on mode change — real AIPanelV2Layout → AIZone → AIInputBar path', () => {
  it('mouse click on a mode-control button closes the cog popover (capture-phase pointerdown wins over button stopPropagation)', async () => {
    render(<AIPanelV2Layout />)
    // Open the popover via its anchor button.
    const cog = screen.getByTestId('ai-panel-v2-cog')
    await act(async () => { cog.click() })
    expect(screen.getByTestId('ai-panel-v2-cog-popover')).toBeInTheDocument()

    // Click a mode-control button. PullTab's mode buttons call
    // `event.stopPropagation()` on pointerdown to suppress drag-start;
    // before the capture-phase fix this would consume the popover's
    // outside-click signal. Use fireEvent to dispatch a real
    // pointerdown that bubbles, then trigger the click handler too.
    const modeBtn = screen.getByTestId('ai-panel-v2-mode-conversation')
    await act(async () => {
      fireEvent.pointerDown(modeBtn)
      modeBtn.click()
    })

    expect(screen.queryByTestId('ai-panel-v2-cog-popover')).toBeNull()
  })

  it('keyboard activation of a mode-control button (no pointerdown) still closes the popover via the activeMode useEffect path', async () => {
    render(<AIPanelV2Layout />)
    const cog = screen.getByTestId('ai-panel-v2-cog')
    await act(async () => { cog.click() })
    expect(screen.getByTestId('ai-panel-v2-cog-popover')).toBeInTheDocument()

    // Keyboard activation fires `click` event on the button without
    // any pointer events — so the capture-phase pointerdown listener
    // can't see it. Closing must come from AIZone's
    // `useEffect(..., [activeMode])` calling the AIInputBarHandle's
    // `closePopover()` once the mode prop updates.
    const modeBtn = screen.getByTestId('ai-panel-v2-mode-conversation')
    modeBtn.focus()
    await act(async () => {
      // Simulating Enter on a real <button> fires `click` natively;
      // assistive technologies do the same. We dispatch click without
      // any preceding pointer event to model that path explicitly.
      modeBtn.click()
    })

    expect(screen.queryByTestId('ai-panel-v2-cog-popover')).toBeNull()
  })

  it('the tablist aria-label announces the current mode', () => {
    render(<AIPanelV2Layout />)
    const tablist = screen.getByRole('tablist', { name: /AI panel mode, currently/i })
    expect(tablist).toBeInTheDocument()
  })
})
