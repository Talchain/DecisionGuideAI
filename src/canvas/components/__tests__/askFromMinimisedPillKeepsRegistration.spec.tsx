/**
 * AN ASK FROM THE MINIMISED PILL MUST NOT DISCONNECT EVERY ASK DOOR.
 *
 * ── THE MEASURED DEFECT (Canvas Browser Gate, #1926, 24 Sep 2026) ────────────
 * With the floating Olumi panel minimised to its pill — the state every fresh
 * user reaches after the first draft, and CI's default at 1280x800 — one
 * `requestAsk(...)` left the guidance store with NO conversation registration:
 * `_prefillChat`, `_sendMessage` and `_dispatchAction` all null. `canReceiveAsk`
 * went false, so every `NodeCoachingIcon` on the canvas unmounted and the
 * quick-action "Ask" disappeared (CI diagnostic: `lodRung 'full', coachingIcons
 * 0, askActions 0`). The same flow calling `_sendMessage` did not break, and a
 * docked panel did not break.
 *
 * ── THE MECHANISM (measured in this file's harness, not inferred) ────────────
 *   1. The pill registers no focus channel (`revealWouldImposeFloating`), so
 *      the reveal inside `requestAsk` claims the DOCK
 *      (`forceActivateOutputTab('olumi')`).
 *   2. `FloatingOlumiPanel` yields to the docked Olumi and unmounts its
 *      `ConversationPanel`, whose token-guarded unregister nulls every slot.
 *   3. The only other host, `OlumiTabBody` (empty conversation → no
 *      `ConversationPanel` of its own), wrote its slots WITHOUT a token, so the
 *      guard could not see them, and re-registered only when its own deps
 *      changed. They did not: a prefill adds no message.
 *   The `_sendMessage` path survived because a send adds a message, which
 *   mounts the dock's own `ConversationPanel` and re-runs the tab body's
 *   effect. The double reveal in `requestAsk` is NOT the cause: removing it
 *   left the store just as empty.
 *
 * ── WHAT THIS FILE BINDS TO ─────────────────────────────────────────────────
 * The REAL composition: `ConversationProvider` → `OutputsDock` (which hosts the
 * real `OlumiTabBody`) + `FloatingOlumiPanel` (which hosts the real
 * `ConversationPanel`), exactly as `ReactFlowGraph` mounts them, driven through
 * the REAL `requestAsk` → `withOlumiReveal` → `revealOlumiSurface` chain. Only
 * `useConversation` (network) and leaf render deps are stubbed.
 *
 * ⚠ WHAT IT DOES NOT CLAIM (trap 3): jsdom runs no layout, so nothing here
 * proves the coaching icon PAINTS. It proves the gate the icon reads —
 * `canReceiveAsk(useGuidanceStore.getState())` — survives the ask.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, render } from '@testing-library/react'
import { StrictMode, type ReactNode } from 'react'

vi.mock('../../../lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }) }) },
  isSupabaseAvailable: () => false,
}))
vi.mock('dompurify', () => ({ default: { sanitize: (s: string) => s } }))
vi.mock('../../utils/markdown', () => ({
  renderMarkdown: (s: string) => s,
  sanitiseMarkdown: (s: string) => s,
}))
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: vi.fn(() => vi.fn()) }
})
const flagState = vi.hoisted(() => ({ aiPanelV2: true }))
vi.mock('../../../flags', async (io) => ({
  ...(await io<Record<string, unknown>>()),
  isAiPanelV2Enabled: () => flagState.aiPanelV2,
}))
vi.mock('../pre-analysis', () => ({ PreAnalysisPanel: () => null }))
vi.mock('../../hooks/useGraphReadiness', () => ({
  useGraphReadiness: () => ({ readiness: { state: 'ready' } }),
}))
vi.mock('../../hooks/useStageAwarePlaceholder', () => ({
  useStageAwarePlaceholder: () => 'Ask',
}))

/**
 * A STATEFUL conversation, so the `_sendMessage` contrast is real: a send
 * appends a user message, exactly the transition that changes
 * `OlumiTabBody`'s `realMessageCount` in the deployed hook.
 */
vi.mock('../../conversation/useConversation', async (io) => {
  const { useState, useCallback, useMemo } = await import('react')
  return {
    // The module's other exports (constants the populated thread reads) stay real.
    ...(await io<Record<string, unknown>>()),
    useConversation: () => {
      const [messages, setMessages] = useState<Array<Record<string, unknown>>>([])
      const sendMessage = useCallback(async (text: string) => {
        setMessages((prev) => [
          ...prev,
          { id: `u-${prev.length}`, role: 'user', content: text, timestamp: new Date() },
        ])
      }, [])
      const [stable] = useState(() => ({
        sendSystemEvent: vi.fn(async () => ({ kind: 'sent' })),
        sendChip: vi.fn(async () => {}),
        dispatchAction: vi.fn(async () => {}),
        clearHistory: vi.fn(),
        retryLast: vi.fn(async () => {}),
        cancelTurn: vi.fn(),
        startNewDraft: vi.fn(async () => {}),
        patchBlockStates: new Map(),
        setPatchBlockState: vi.fn(),
        patchRejections: new Map(),
        setPatchRejection: vi.fn(),
      }))
      return useMemo(
        () => ({
          ...stable,
          messages,
          isThinking: false,
          longRunningHint: null,
          lastSendFailure: null,
          sendMessage,
        }),
        [stable, messages, sendMessage],
      )
    },
  }
})

import { ConversationProvider } from '../../conversation/ConversationContext'
import { FloatingOlumiPanel } from '../FloatingOlumiPanel'
import { OutputsDock } from '../OutputsDock'
import { useFloatingPanelState } from '../../hooks/useFloatingPanelState'
import { useGuidanceStore } from '../../stores/guidanceStore'
import { useUIStore } from '../../../stores/uiStore'
import { useCanvasStore } from '../../store'
import { requestAsk, canReceiveAsk } from '../../ui/inspector-v2/askSemantic'

function Canvas({ children }: { children?: ReactNode }) {
  // ReactFlowGraph's order: the dock first, then the floating host.
  return (
    <ConversationProvider>
      <OutputsDock />
      <FloatingOlumiPanel onDock={() => {}} />
      {children}
    </ConversationProvider>
  )
}

function ensureMatchMedia() {
  if (typeof window.matchMedia !== 'function') {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true,
      }),
    })
  }
}

/** Flush effects, rAF and the dock's close-effect, several rounds. */
async function settle() {
  for (let i = 0; i < 4; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 25))
    })
  }
}

const canAsk = () => canReceiveAsk(useGuidanceStore.getState())

beforeEach(() => {
  ensureMatchMedia()
  // jsdom has no scrollIntoView; the populated thread calls it on mount.
  if (typeof Element.prototype.scrollIntoView !== 'function') {
    Element.prototype.scrollIntoView = function scrollIntoView() {}
  }
  flagState.aiPanelV2 = true
  Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true })
  Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true })
  try { sessionStorage.clear() } catch {}
  try { localStorage.clear() } catch {}
  useGuidanceStore.setState({
    _sendMessage: null, _runAnalysis: null, _sendChip: null, _scrollToPatch: null,
    _prefillChat: null, _dispatchAction: null, _registrationToken: null,
  })
  useUIStore.setState({ activeOutputTab: 'results', activeOutputTabVersion: 0 })
  useCanvasStore.getState().resetCanvas()
  useCanvasStore.getState().addNode(undefined, 'decision')
  useFloatingPanelState.getState().reset()
})
afterEach(() => {
  useFloatingPanelState.getState().reset()
  useCanvasStore.getState().resetCanvas()
})


const STRIP_TEXTAREA = 'ai-input-bar-strip-textarea'
const stripValue = () =>
  (document.querySelector(`[data-testid="${STRIP_TEXTAREA}"]`) as HTMLTextAreaElement | null)?.value ?? null

/** The post-draft state every fresh user reaches: system-opened, never moved, minimised. */
function minimisedPill(dockOpen: boolean) {
  sessionStorage.setItem('canvas.outputsDock.v1', JSON.stringify({ isOpen: dockOpen, activeTab: 'results' }))
  useFloatingPanelState.setState({
    isOpen: true,
    source: 'system-first-use',
    userRepositioned: false,
    isMinimised: true,
    userChoseFloating: false,
  })
}

/**
 * Pin the measured precondition IN-TEST (trap 13b): the pill is what is on
 * screen, the FLOATING host's ConversationPanel owns the registration (a token
 * is minted only by `registerConversationCallbacks`, whose only caller is
 * ConversationPanel), and the conversation is empty so the docked tab has no
 * ConversationPanel of its own. Without all three this file would be measuring
 * a different state from the one CI measured.
 */
async function mountAndPinPrecondition() {
  render(<Canvas />)
  await settle()
  expect(document.querySelector('[data-testid="floating-olumi-panel-pill"]'), 'PRECONDITION: the pill is mounted').not.toBeNull()
  expect(useGuidanceStore.getState()._registrationToken, 'PRECONDITION: the floating ConversationPanel owns the registration').not.toBeNull()
  expect(document.querySelector('[data-testid="olumi-tab-body"]'), 'PRECONDITION: empty conversation, so the dock has no ConversationPanel').toBeNull()
  expect(canAsk(), 'PRECONDITION: an ask door exists before the ask').toBe(true)
}

describe('an ask from the minimised pill keeps every ask door connected', () => {
  it('COLLECTION GUARD — every case in this file was collected and runs, by name', (ctx) => {
    const siblings = ctx.task.suite?.tasks ?? []
    expect(siblings.map((t) => t.name)).toEqual([
      'COLLECTION GUARD — every case in this file was collected and runs, by name',
      'RED at base — dock OPEN on another tab: requestAsk leaves canReceiveAsk true, the question in the composer, and a second ask still lands',
      'RED at base — dock COLLAPSED: requestAsk leaves canReceiveAsk true, the question in the composer, and a second ask still lands',
      'CONTRAST — the served ghost-card path (`_sendMessage`) survives the same reveal',
      'CONTRAST — a docked (non-minimised) Olumi was never broken and still is not',
      'NEVER OVERWRITES — a live ConversationPanel owner keeps its reveal-wrapped callbacks across an unrelated store write',
      'DOCK COLLAPSE after the pill ask — the tab body unmounts, no host is left, and the next ask still lands',
      'DOCK COLLAPSE for a docked user — the tab body unmounts, no host is left, and the next ask still lands',
      'STRICT MODE — the simulated unmount/remount does not release the live tab body\'s callbacks',
      'CANVAS UNMOUNT — the provider leaving leaves no callable callback into its session; another host\'s slot survives',
      'CANVAS REMOUNT — the new canvas\'s tab body replaces the departed one\'s callbacks; the ask lands in the NEW composer',
    ])
    expect(siblings.filter((t) => t.mode !== 'run').map((t) => t.name)).toEqual([])
  })

  it.each([
    ['OPEN on another tab', true],
    ['COLLAPSED', false],
  ] as const)(
    'RED at base — dock %s: requestAsk leaves canReceiveAsk true, the question in the composer, and a second ask still lands',
    async (_label, dockOpen) => {
      minimisedPill(dockOpen)
      await mountAndPinPrecondition()

      let surface: ReturnType<typeof requestAsk> = 'none'
      act(() => {
        surface = requestAsk({ text: 'q', label: 'x', source: 'ghost-option' })
      })
      await settle()
      expect(surface).toBe('composer')

      // The path CI measured was taken: the pill registers no focus channel, so
      // the reveal claimed the DOCK and the floating host (with its
      // ConversationPanel) left. If this ever stops being true the case below
      // proves nothing about the defect.
      expect(useUIStore.getState().activeOutputTab, 'the reveal claimed the dock').toBe('olumi')
      expect(document.querySelector('[data-testid="floating-olumi-panel"]'), 'the floating host unmounted').toBeNull()

      // THE OUTCOME: the gate every NodeCoachingIcon / quick-action Ask reads.
      const s = useGuidanceStore.getState()
      expect(
        { prefill: s._prefillChat !== null, send: s._sendMessage !== null, dispatch: s._dispatchAction !== null },
        'every ask slot must survive the ask',
      ).toEqual({ prefill: true, send: true, dispatch: true })
      expect(canAsk()).toBe(true)

      // The question reached the composer that is now on screen.
      expect(stripValue()).toBe('q')

      // And the door is not merely non-null: a SECOND ask lands too.
      let second: ReturnType<typeof requestAsk> = 'none'
      act(() => {
        second = requestAsk({ text: 'q2', label: 'x', source: 'ghost-option' })
      })
      await settle()
      expect(second).toBe('composer')
      expect(stripValue()).toBe('q2')
      expect(canAsk()).toBe(true)
    },
    30_000,
  )

  it('CONTRAST — the served ghost-card path (`_sendMessage`) survives the same reveal', async () => {
    minimisedPill(true)
    await mountAndPinPrecondition()
    act(() => {
      useGuidanceStore.getState()._sendMessage!('q')
    })
    await settle()
    expect(useUIStore.getState().activeOutputTab).toBe('olumi')
    expect(document.querySelector('[data-testid="floating-olumi-panel"]')).toBeNull()
    // The send populated the conversation, so the dock's own ConversationPanel
    // mounted and re-registered — the reason this path never broke.
    expect(document.querySelector('[data-testid="olumi-tab-body"]')).not.toBeNull()
    expect(canAsk()).toBe(true)
  }, 30_000)

  it('CONTRAST — a docked (non-minimised) Olumi was never broken and still is not', async () => {
    sessionStorage.setItem('canvas.outputsDock.v1', JSON.stringify({ isOpen: true, activeTab: 'olumi' }))
    useUIStore.setState({ activeOutputTab: 'olumi', activeOutputTabVersion: 0 })
    render(<Canvas />)
    await settle()
    expect(document.querySelector('[data-testid="floating-olumi-panel"]'), 'PRECONDITION: no floating host').toBeNull()
    expect(canAsk(), 'PRECONDITION').toBe(true)
    let surface: ReturnType<typeof requestAsk> = 'none'
    act(() => {
      surface = requestAsk({ text: 'q', label: 'x', source: 'ghost-option' })
    })
    await settle()
    expect(surface).toBe('composer')
    expect(canAsk()).toBe(true)
    expect(stripValue()).toBe('q')
  }, 30_000)

  it('NEVER OVERWRITES — a live ConversationPanel owner keeps its reveal-wrapped callbacks across an unrelated store write', async () => {
    // A user-opened, VISIBLE floating panel: its ConversationPanel registers
    // (token + reveal-wrapped callbacks) AFTER the dock's OlumiTabBody, so it
    // is the live owner. The takeover must only FILL HOLES: replacing the
    // owner's wrapped callbacks with the tab body's bare ones would silently
    // drop the reveal from every send and prefill.
    sessionStorage.setItem('canvas.outputsDock.v1', JSON.stringify({ isOpen: true, activeTab: 'results' }))
    useFloatingPanelState.getState().open('user')
    render(<Canvas />)
    await settle()
    const before = useGuidanceStore.getState()
    expect(before._registrationToken, 'PRECONDITION: a ConversationPanel owns the registration').not.toBeNull()
    expect(document.querySelector('[data-testid="olumi-tab-wrapper"]'), 'PRECONDITION: the tab body is mounted').not.toBeNull()

    act(() => {
      useGuidanceStore.getState().setGuidanceItems([])
    })
    await settle()

    const after = useGuidanceStore.getState()
    expect(after._registrationToken).toBe(before._registrationToken)
    expect(after._prefillChat).toBe(before._prefillChat)
    expect(after._sendMessage).toBe(before._sendMessage)
    expect(after._dispatchAction).toBe(before._dispatchAction)

    // BEHAVIOURAL identity — the stored prefill is the OWNER's, reveal-wrapped
    // one: it fronts the visible floating composer. The tab body's bare
    // `setDraft` would write the draft and focus nothing.
    act(() => {
      after._prefillChat!('z')
    })
    await settle()
    expect(document.activeElement?.getAttribute('data-testid')).toBe('ai-input-bar-floating-textarea')
  }, 30_000)

  /*
   * ⚠ THE TAB BODY UNMOUNTS ON EVERY DOCK COLLAPSE, NOT ONLY WITH THE CANVAS.
   * `OutputsDock` renders it inside `{effectiveIsOpen && …}`. The session its
   * callbacks close over (`ConversationProvider`, at the canvas root) outlives
   * that, so they stay valid — and after an ask from the pill they are the only
   * registration left: the floating host does not come back when the dock
   * collapses. A rule that cleared the tab body's slots on unmount would empty
   * the store here and take every ask door with it: the defect this file
   * exists for, reached by a second route.
   */
  const collapseDock = () => {
    const control = document.querySelector('[data-testid="dock-collapse-control"]') as HTMLElement | null
    expect(control?.getAttribute('aria-label'), 'PRECONDITION: the dock is open and can collapse').toBe('Collapse outputs dock')
    act(() => { control!.click() })
  }
  const assertCollapsedWithNoHost = () => {
    expect(document.querySelector('[data-testid="olumi-tab-wrapper"]'), 'the collapse unmounted the tab body').toBeNull()
    expect(document.querySelector('[data-testid="floating-olumi-panel"]'), 'no floating host').toBeNull()
    expect(document.querySelector('[data-testid="floating-olumi-panel-pill"]'), 'no pill host').toBeNull()
    expect(useGuidanceStore.getState()._registrationToken, 'no ConversationPanel owns anything').toBeNull()
  }

  it('DOCK COLLAPSE after the pill ask — the tab body unmounts, no host is left, and the next ask still lands', async () => {
    minimisedPill(true)
    await mountAndPinPrecondition()
    act(() => { requestAsk({ text: 'q', label: 'x', source: 'ghost-option' }) })
    await settle()
    expect(stripValue(), 'PRECONDITION: the first ask landed').toBe('q')

    collapseDock()
    await settle()
    assertCollapsedWithNoHost()
    expect(canAsk(), 'the ask doors survive the collapse').toBe(true)

    let surface: ReturnType<typeof requestAsk> = 'none'
    act(() => { surface = requestAsk({ text: 'q2', label: 'x', source: 'ghost-option' }) })
    await settle()
    expect(surface).toBe('composer')
    expect(useUIStore.getState().activeOutputTab).toBe('olumi')
    expect(stripValue()).toBe('q2')
  }, 30_000)

  it('DOCK COLLAPSE for a docked user — the tab body unmounts, no host is left, and the next ask still lands', async () => {
    sessionStorage.setItem('canvas.outputsDock.v1', JSON.stringify({ isOpen: true, activeTab: 'olumi' }))
    useUIStore.setState({ activeOutputTab: 'olumi', activeOutputTabVersion: 0 })
    render(<Canvas />)
    await settle()
    expect(document.querySelector('[data-testid="floating-olumi-panel"]'), 'PRECONDITION: no floating host').toBeNull()
    expect(useGuidanceStore.getState()._registrationToken, 'PRECONDITION: only the tab body is registered').toBeNull()
    expect(canAsk(), 'PRECONDITION').toBe(true)

    collapseDock()
    await settle()
    assertCollapsedWithNoHost()
    expect(canAsk(), 'the ask doors survive the collapse').toBe(true)

    let surface: ReturnType<typeof requestAsk> = 'none'
    act(() => { surface = requestAsk({ text: 'q', label: 'x', source: 'ghost-option' }) })
    await settle()
    expect(surface).toBe('composer')
    expect(stripValue()).toBe('q')
  }, 30_000)

  it('STRICT MODE — the simulated unmount/remount does not release the live tab body\'s callbacks', async () => {
    // Dev runs under <StrictMode>, which runs every effect's cleanup and setup
    // once more on mount. The provider's queued release must not null the
    // callbacks the SAME tab body re-claims (its `sendMessage` is the
    // provider's stable function, so the identity it re-claims is the one its
    // simulated cleanup just marked departed).
    sessionStorage.setItem('canvas.outputsDock.v1', JSON.stringify({ isOpen: true, activeTab: 'olumi' }))
    useUIStore.setState({ activeOutputTab: 'olumi', activeOutputTabVersion: 0 })
    render(<StrictMode><Canvas /></StrictMode>)
    await settle()
    const s = useGuidanceStore.getState()
    expect({ prefill: s._prefillChat !== null, send: s._sendMessage !== null, dispatch: s._dispatchAction !== null }).toEqual({ prefill: true, send: true, dispatch: true })
    let surface: ReturnType<typeof requestAsk> = 'none'
    act(() => { surface = requestAsk({ text: 'q', label: 'x', source: 'ghost-option' }) })
    await settle()
    expect(surface).toBe('composer')
    expect(stripValue()).toBe('q')
  }, 30_000)

  it('CANVAS UNMOUNT — the provider leaving leaves no callable callback into its session; another host\'s slot survives', async () => {
    // Codex CHANGES_REQUIRED 5807693253: "unmounting the last provider leaves
    // no callable callback into it". The tab body cannot tell a dock collapse
    // (its callbacks must SURVIVE — DOCK COLLAPSE cases) from the canvas going
    // (they must NOT); only the provider knows its session ended.
    sessionStorage.setItem('canvas.outputsDock.v1', JSON.stringify({ isOpen: true, activeTab: 'olumi' }))
    useUIStore.setState({ activeOutputTab: 'olumi', activeOutputTabVersion: 0 })
    const view = render(<Canvas />)
    await settle()
    const before = useGuidanceStore.getState()
    expect(before._prefillChat, 'PRECONDITION: the tab body registered').not.toBeNull()
    expect(before._registrationToken, 'PRECONDITION: only the tab body is registered').toBeNull()
    // CONTRAST: a callback NO tab body wrote, in one slot. The tab body must
    // not overwrite it while mounted, and the provider must not clear it.
    const foreign = vi.fn()
    act(() => { useGuidanceStore.setState({ _dispatchAction: foreign }) })
    await settle()
    expect(useGuidanceStore.getState()._dispatchAction, 'the tab body overwrote another host').toBe(foreign)

    act(() => { view.unmount() })
    await settle()
    const after = useGuidanceStore.getState()
    expect(after._prefillChat, 'a prefill into the unmounted session is still callable').toBeNull()
    expect(after._sendMessage, 'a send into the unmounted session is still callable').toBeNull()
    expect(after._dispatchAction, 'the provider cleared a slot it did not own').toBe(foreign)
  }, 30_000)

  it('CANVAS REMOUNT — the new canvas\'s tab body replaces the departed one\'s callbacks; the ask lands in the NEW composer', async () => {
    sessionStorage.setItem('canvas.outputsDock.v1', JSON.stringify({ isOpen: true, activeTab: 'olumi' }))
    useUIStore.setState({ activeOutputTab: 'olumi', activeOutputTabVersion: 0 })
    const first = render(<Canvas />)
    await settle()
    expect(useGuidanceStore.getState()._registrationToken, 'PRECONDITION: only the tab body is registered').toBeNull()
    const departed = useGuidanceStore.getState()
    act(() => { first.unmount() })
    await settle()

    render(<Canvas />)
    await settle()
    const now = useGuidanceStore.getState()
    expect(now._prefillChat, 'the departed canvas\'s prefill is gone').not.toBe(departed._prefillChat)
    expect(now._sendMessage, 'the departed canvas\'s send is gone').not.toBe(departed._sendMessage)
    expect(now._dispatchAction, 'the departed canvas\'s dispatch is gone').not.toBe(departed._dispatchAction)

    let surface: ReturnType<typeof requestAsk> = 'none'
    act(() => { surface = requestAsk({ text: 'q', label: 'x', source: 'ghost-option' }) })
    await settle()
    expect(surface).toBe('composer')
    expect(stripValue(), 'the question reached the composer on screen, not the departed one').toBe('q')
  }, 30_000)
})
