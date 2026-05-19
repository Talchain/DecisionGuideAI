/**
 * Interaction-regression tests for aiPanelV2 fixes.
 *
 * Covers the scenarios called out in the latest feedback rounds:
 *   1. Persisted-tab auto-dock — forceActivateOutputTab bumps the version
 *      counter so OutputsDock's sync effect fires even when the tab value
 *      itself did not change.
 *   2. Non-Olumi tab strip is redirect-only — no textarea, no submit; any
 *      click opens the floating panel.
 *   3. Minimise → focus path — focusFloating restores the panel from its
 *      minimised state before focusing the textarea.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'

// OutputsDock is imported dynamically in the deriveNextDockIsOpen tests
// below; that chain pulls in supabase + dompurify which break under the
// test env. Stub both ahead of any module evaluation. Mirrors the parity
// spec's pattern — these mocks are unused by the other test blocks but
// must precede any potential transitive import.
vi.mock('../../../lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }) }) },
  isSupabaseAvailable: () => false,
}))
vi.mock('dompurify', () => ({ default: { sanitize: (s: string) => s } }))
vi.mock('../../utils/markdown', () => ({
  renderMarkdown: (s: string) => s,
  sanitiseMarkdown: (s: string) => s,
}))

import { useUIStore } from '../../../stores/uiStore'
import { useFloatingPanelState } from '../../hooks/useFloatingPanelState'
import {
  ConversationProvider,
  useConversationContext,
} from '../../conversation/ConversationContext'
import { PersistentInputStrip } from '../PersistentInputStrip'
import { focusFloating, registerFloatingFocus } from '../../hooks/useFloatingFocus'

// Stub heavyweight conversation runtime. Critical: the inner vi.fn() values
// must be STABLE across renders — captured references in test assertions go
// stale otherwise. `useState(() => vi.fn(...))` pins each mock fn to the
// provider's lifetime so capturedSendMessage === the function AIInputBar
// invokes at Enter time.
vi.mock('../../conversation/useConversation', async () => {
  const { useState } = await import('react')
  return {
    useConversation: () => {
      const [messages, setMessages] = useState<any[]>([])
      const [sendMessage] = useState(() =>
        vi.fn((text: string) => {
          setMessages((m) => [
            ...m,
            { id: `u-${m.length}`, role: 'user', content: text, blocks: [] },
          ])
        }),
      )
      const [sendSystemEvent] = useState(() => vi.fn())
      const [sendChip] = useState(() => vi.fn())
      const [retryLast] = useState(() => vi.fn())
      const [setPatchBlockState] = useState(() => vi.fn())
      const [setPatchRejection] = useState(() => vi.fn())
      return {
        messages,
        isThinking: false,
        longRunningHint: null,
        lastFailedInput: null,
        sendMessage,
        sendSystemEvent,
        sendChip,
        retryLast,
        patchBlockStates: new Map(),
        setPatchBlockState,
        patchRejections: new Map(),
        setPatchRejection,
      }
    },
  }
})

vi.mock('../../ui/inspector-v2/useStaleGuard', () => ({
  useStaleGuard: () => ({ analysisState: 'none', isStale: false }),
}))

vi.mock('../../hooks/useStageAwarePlaceholder', () => ({
  useStageAwarePlaceholder: () => 'Ask about this model…',
}))

// AIInputBar derives node count from the canvas store. The mock state is
// held in a mutable object so individual tests can flip it between empty
// canvas (→ explicit_generate routing) and populated canvas (→ conversation
// routing) without needing to re-import the module.
const canvasMockState = { nodes: [{ id: 'n1' } as any] as Array<{ id: string }> }
vi.mock('../../store', () => ({
  useCanvasStore: (selector: (s: any) => any) => selector(canvasMockState),
}))

function Wrapper({ children }: { children: ReactNode }) {
  return <ConversationProvider>{children}</ConversationProvider>
}

describe('Persisted-tab auto-dock (forceActivateOutputTab)', () => {
  beforeEach(() => {
    useUIStore.setState({ activeOutputTab: 'results', activeOutputTabVersion: 0 })
  })

  it('forceActivateOutputTab bumps the version even when tab value is unchanged', () => {
    const before = useUIStore.getState().activeOutputTabVersion
    useUIStore.getState().forceActivateOutputTab('results')
    const after = useUIStore.getState().activeOutputTabVersion
    expect(after).toBe(before + 1)
    expect(useUIStore.getState().activeOutputTab).toBe('results')
  })

  it('forceActivateOutputTab bumps the version when tab changes too', () => {
    const before = useUIStore.getState().activeOutputTabVersion
    useUIStore.getState().forceActivateOutputTab('compare')
    const after = useUIStore.getState().activeOutputTabVersion
    expect(after).toBe(before + 1)
    expect(useUIStore.getState().activeOutputTab).toBe('compare')
  })

  it('setActiveOutputTab does NOT bump the version (legacy path)', () => {
    const before = useUIStore.getState().activeOutputTabVersion
    useUIStore.getState().setActiveOutputTab('compare')
    expect(useUIStore.getState().activeOutputTabVersion).toBe(before)
  })
})

describe('Non-Olumi strip is redirect-only', () => {
  beforeEach(() => {
    useFloatingPanelState.getState().reset()
  })

  it('renders the redirect placeholder (no textarea) on non-Olumi tabs', () => {
    render(<PersistentInputStrip isOlumiTabActive={false} onOpenFloating={() => {}} onCogClick={() => {}} />, {
      wrapper: Wrapper,
    })
    expect(screen.getByTestId('persistent-strip-composer-redirect')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('clicking anywhere on the redirect strip opens the floating panel', () => {
    const onOpenFloating = vi.fn()
    render(<PersistentInputStrip isOlumiTabActive={false} onOpenFloating={onOpenFloating} onCogClick={() => {}} />, {
      wrapper: Wrapper,
    })
    fireEvent.click(screen.getByTestId('persistent-strip-composer-redirect'))
    expect(onOpenFloating).toHaveBeenCalledTimes(1)
  })

  it('the redirect strip cannot submit a message', () => {
    // Capture sendMessage from context.
    let capturedSendMessage: ((text: string) => void) | null = null
    function Capture() {
      const ctx = useConversationContext()
      capturedSendMessage = ctx.sendMessage as any
      return null
    }
    const onOpenFloating = vi.fn()
    render(
      <>
        <Capture />
        <PersistentInputStrip isOlumiTabActive={false} onOpenFloating={onOpenFloating} onCogClick={() => {}} />
      </>,
      { wrapper: Wrapper },
    )
    // No textbox → typing/Enter not possible. The whole strip routes to
    // onOpenFloating. Spy on sendMessage to prove no submission happens.
    fireEvent.click(screen.getByTestId('persistent-strip-composer-redirect'))
    expect(onOpenFloating).toHaveBeenCalled()
    expect(capturedSendMessage).toBeTruthy()
    // Direct verification: a click on the redirect strip must not result in
    // a sendMessage call (the redirect is purely navigational).
    expect((capturedSendMessage as any).mock?.calls ?? []).toHaveLength(0)
  })
})

describe('focusFloating restores from minimised', () => {
  beforeEach(() => {
    useFloatingPanelState.getState().reset()
  })

  it('focusFloating returns false when no panel is registered', () => {
    expect(focusFloating()).toBe(false)
  })

  it('focusFloating invokes the registered callback', () => {
    const fn = vi.fn()
    const unregister = registerFloatingFocus(fn)
    expect(focusFloating()).toBe(true)
    expect(fn).toHaveBeenCalledTimes(1)
    unregister()
  })

  it('after minimise, restore must run before focus (simulated)', () => {
    // Simulate the floating panel's registered handler: when minimised it
    // restores first and schedules focus on the next frame.
    useFloatingPanelState.getState().open('user')
    useFloatingPanelState.getState().minimise()
    expect(useFloatingPanelState.getState().isMinimised).toBe(true)

    const focusSpy = vi.fn()
    const unregister = registerFloatingFocus(() => {
      const state = useFloatingPanelState.getState()
      if (state.isMinimised) {
        state.restore()
      }
      focusSpy()
    })
    focusFloating()
    expect(useFloatingPanelState.getState().isMinimised).toBe(false)
    expect(focusSpy).toHaveBeenCalledTimes(1)
    unregister()
  })
})

describe('AIInputBar send routing (empty canvas → explicit_generate)', () => {
  // The P0 routing fix: when the canvas is empty, send must include
  // turnType=explicit_generate + debugSource=generate_model so the
  // orchestrator drafts a model instead of routing as a chat reply. We
  // flip the shared canvasMockState to nodes: [] for this block, then
  // restore it afterwards so later test files don't see a polluted mock.
  let originalNodes: typeof canvasMockState.nodes
  beforeEach(() => {
    originalNodes = canvasMockState.nodes
    canvasMockState.nodes = []
  })
  afterEach(() => {
    canvasMockState.nodes = originalNodes
  })

  it('routes with turnType=explicit_generate when nodeCount === 0', async () => {
    const { AIInputBar } = await import('../AIInputBar')
    let capturedSendMessage: any = null
    function Capture() {
      capturedSendMessage = useConversationContext().sendMessage
      return null
    }
    render(
      <Wrapper>
        <Capture />
        <AIInputBar variant="first-use" hideChevron />
      </Wrapper>,
    )
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    act(() => {
      fireEvent.change(textarea, { target: { value: 'please draft a model for me' } })
    })
    fireEvent.keyDown(textarea, { key: 'Enter' })

    const calls = (capturedSendMessage as any).mock.calls
    expect(calls.length).toBeGreaterThan(0)
    const [text, opts] = calls[0]
    expect(text).toBe('please draft a model for me')
    expect(opts).toEqual({
      turnType: 'explicit_generate',
      debugSource: 'generate_model',
      debugSourceSurface: 'ai_panel',
    })
  })

  it('routes WITHOUT turnType opts when nodeCount > 0 (chat reply)', async () => {
    canvasMockState.nodes = [{ id: 'n1' }]
    const { AIInputBar } = await import('../AIInputBar')
    let capturedSendMessage: any = null
    function Capture() {
      capturedSendMessage = useConversationContext().sendMessage
      return null
    }
    render(
      <Wrapper>
        <Capture />
        <AIInputBar variant="docked-tab" hideChevron />
      </Wrapper>,
    )
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    act(() => {
      fireEvent.change(textarea, { target: { value: 'why this option?' } })
    })
    fireEvent.keyDown(textarea, { key: 'Enter' })

    const calls = (capturedSendMessage as any).mock.calls
    expect(calls.length).toBeGreaterThan(0)
    const [text, opts] = calls[0]
    expect(text).toBe('why this option?')
    expect(opts).toBeUndefined()
  })
})

describe('deriveNextDockIsOpen (toggleOpen first-use rail invariant)', () => {
  // Hoist the dynamic import out of the test body. The OutputsDock module has
  // ~150 transitive imports (pre-analysis panels, results sections, V5 chip
  // dispatch, etc.); evaluating it inside a `it(...)` body can exceed the
  // 5s default test timeout when module cache pressure is high after earlier
  // specs in the run. One-shot import in beforeAll keeps each test fast.
  let deriveNextDockIsOpen: (a: boolean, b: boolean) => boolean
  beforeAll(async () => {
    const mod = await import('../OutputsDock')
    deriveNextDockIsOpen = mod.deriveNextDockIsOpen
  }, 30_000)

  it('opens when user is on the first-use rail (regardless of stored value)', () => {
    // First-use rail is showing — visual state is collapsed. Clicking the
    // expand chevron MUST open the dock, not collapse it.
    expect(deriveNextDockIsOpen(true, true)).toBe(true)
    expect(deriveNextDockIsOpen(true, false)).toBe(true)
  })

  it('toggles normally outside first-use', () => {
    expect(deriveNextDockIsOpen(false, true)).toBe(false)
    expect(deriveNextDockIsOpen(false, false)).toBe(true)
  })
})

// Attach evidence: intentionally not tested as a functional feature here —
// it is shipped as "Coming soon" until the orchestrator turn API supports a
// file parameter. The CogPopover spec covers the disabled / Coming-soon
// rendering. Re-introduce attachment lifecycle tests when backend support
// lands.
