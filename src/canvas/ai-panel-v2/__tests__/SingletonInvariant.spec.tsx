import { describe, it, expect, vi, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, cleanup, act } from '@testing-library/react'

// Spy on useConversation at the module level so we can count how many
// times it's called across the full panel-v2 tree (AIPanelV2Layout +
// embedded OutputsDock + AIZone). The brief's singleton invariant
// (correction #9 + the latest P0) requires exactly one call per active
// AI surface — the embedded OutputsDock must NOT spin up a second
// useConversation instance.

const { useConversationSpy } = vi.hoisted(() => ({ useConversationSpy: vi.fn() }))
vi.mock('../../conversation/useConversation', async () => {
  const actual = await vi.importActual<typeof import('../../conversation/useConversation')>(
    '../../conversation/useConversation',
  )
  return {
    ...actual,
    useConversation: () => {
      useConversationSpy()
      return {
        messages: [],
        isThinking: false,
        longRunningHint: null,
        lastFailedInput: null,
        sendMessage: vi.fn(),
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
      }
    },
  }
})

// Stub heavy peripheral hooks/components so the test boots without the
// orchestrator. The mounts of OutputsDock and AIZone still run their
// own renders (and any useConversation hooks they contain).
vi.mock('../../hooks/useV2Run', () => ({
  useV2Run: () => ({ runV2Analysis: vi.fn(), cancelRun: vi.fn(), isRunning: false }),
}))
vi.mock('../../hooks/useGraphReadiness', () => ({
  useGraphReadiness: () => ({ readiness: null }),
}))
vi.mock('../../conversation/hooks/useThreadPersistence', () => ({
  useThreadPersistence: () => ({ onBlockAction: vi.fn(), onChipTaken: vi.fn() }),
}))
vi.mock('../../../adapters/plot', () => ({ plot: { validatePatch: vi.fn() } }))
vi.mock('../../conversation/zones/ChatThread', () => ({
  ChatThread: () => <div data-testid="stub-chat-thread" />,
}))
vi.mock('../../conversation/zones/ChatComposer', () => ({
  ChatComposer: () => null,
}))
// OutputsDock's body pulls in useScenario which calls react-router's
// useNavigate — without Router context the render crashes. Mock the
// scenario hook so the body renders. We keep the REAL OutputsDock
// wrapper + hosts in scope so the singleton invariant (embedded host
// skipping useConversation) is genuinely exercised.
vi.mock('../../../hooks/useScenario', () => ({
  useScenario: () => ({
    isPersistenceActive: false,
    supabaseSaveStatus: 'idle',
    supabaseSaveError: null,
  }),
}))

import { AIPanelV2Layout } from '../AIPanelV2Layout'

afterEach(() => {
  cleanup()
  useConversationSpy.mockReset()
})

describe('Singleton invariant — useConversation count under FF on', () => {
  it('AIPanelV2Layout calls useConversation() exactly once across both zones', async () => {
    render(<AIPanelV2Layout />)
    await act(async () => { await Promise.resolve() })
    // The whole tree — AIPanelV2Layout owns the hook; embedded
    // OutputsDock receives sendMessage via prop and does NOT call
    // useConversation; AIZone receives the conversation as a prop.
    expect(useConversationSpy).toHaveBeenCalledTimes(1)
  })

  it('the embedded OutputsDock wrapper does not call useConversation', () => {
    // Render the panel and assert the spy count is still 1 even after
    // OutputsDock mounts. (The previous test already covers this; this
    // one is the deliberate regression guard if someone re-adds a
    // useConversation call inside OutputsDockBody.)
    render(<AIPanelV2Layout />)
    expect(useConversationSpy).toHaveBeenCalledTimes(1)
    // The embedded OutputsDock host is a separate component that
    // renders the body without the hook.
    expect(screen.getByTestId('outputs-dock').dataset.embedded).toBe('true')
  })
})
