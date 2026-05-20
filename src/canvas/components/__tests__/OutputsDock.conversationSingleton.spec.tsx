/**
 * Regression guard: under aiPanelV2 ON, `useConversation()` must be called
 * exactly ONCE across the canvas-root <ConversationProvider> and the
 * <OutputsDock /> subtree. Two instances trigger the scenario-hydration
 * race at `useConversation.ts:797`, double-emit telemetry, and split the
 * message stream between the dock's Analysis/Model CTAs and the Olumi
 * floating surfaces.
 *
 * Under aiPanelV2 OFF: the provider is not mounted; OutputsDock's legacy
 * host owns the only useConversation() call. This file also pins that
 * legacy invariant (exactly one call, mounted by the dock).
 *
 * Mirrors the heavyweight mock layout from aiPanelV2.interactions.spec —
 * supabase/dompurify/markdown stubs are required because OutputsDock's
 * transitive imports otherwise pull them in.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render } from '@testing-library/react'
import type { ReactNode } from 'react'

// Heavy-import stubs — must precede any OutputsDock evaluation.
vi.mock('../../../lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }) }) },
  isSupabaseAvailable: () => false,
}))
vi.mock('dompurify', () => ({ default: { sanitize: (s: string) => s } }))
vi.mock('../../utils/markdown', () => ({
  renderMarkdown: (s: string) => s,
  sanitiseMarkdown: (s: string) => s,
}))

// react-router (useScenario calls useNavigate).
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: vi.fn(() => vi.fn()) }
})

// V2 run hook + dependent telemetry — keep stable across renders.
vi.mock('../../hooks/useV2Run', () => ({
  useV2Run: () => ({ runV2Analysis: vi.fn(), cancelRun: vi.fn() }),
}))

// Flag toggle: per-test mutation via `flagState.aiPanelV2`. All other flags
// default false to keep the dock surface minimal.
const flagState = { aiPanelV2: false }
vi.mock('../../../flags', () => ({
  isTelemetryEnabled: () => false,
  isCompareEnabled: () => false,
  isOrchestratorV2Enabled: () => false,
  isLegacyDirectRunEnabled: () => true,
  isJourneyTabEnabled: () => false,
  isCompareTabEnabled: () => false,
  isAiPanelV2Enabled: () => flagState.aiPanelV2,
  isV5CanonicalAnalysisEnabled: () => false,
}))

// THE counter: every time the real useConversation hook executes, we
// increment. The mock returns a stable shape (matches UseConversationReturn
// loosely — fields used by the dock/provider only).
const useConversationCallCount = { n: 0 }
const stableConversation = {
  messages: [] as any[],
  isThinking: false,
  longRunningHint: null as any,
  lastFailedInput: null as any,
  sendMessage: vi.fn(),
  sendSystemEvent: vi.fn(),
  sendChip: vi.fn(),
  retryLast: vi.fn(),
  patchBlockStates: new Map(),
  setPatchBlockState: vi.fn(),
  patchRejections: new Map(),
  setPatchRejection: vi.fn(),
}
vi.mock('../../conversation/useConversation', () => ({
  useConversation: () => {
    useConversationCallCount.n += 1
    return stableConversation
  },
}))

// Stale guard + stage placeholder — unused outputs, but the dock body
// transitively touches them via the strip / Olumi tab body.
vi.mock('../../ui/inspector-v2/useStaleGuard', () => ({
  useStaleGuard: () => ({ analysisState: 'none', isStale: false }),
}))
vi.mock('../../hooks/useStageAwarePlaceholder', () => ({
  useStageAwarePlaceholder: () => 'Describe your decision…',
}))

// Imported lazily inside tests so the mocks above are honoured at module
// evaluation time.
import { ConversationProvider } from '../../conversation/ConversationContext'

function Wrapper({ children }: { children: ReactNode }) {
  return <ConversationProvider>{children}</ConversationProvider>
}

function ensureMatchMedia() {
  if (typeof window.matchMedia !== 'function') {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
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

describe('useConversation singleton invariant', () => {
  beforeEach(() => {
    ensureMatchMedia()
    useConversationCallCount.n = 0
    flagState.aiPanelV2 = false
    try { sessionStorage.clear() } catch {}
    try { localStorage.clear() } catch {}
  })

  it('FF-on: ConversationProvider + OutputsDock mount one and only one useConversation() instance', async () => {
    flagState.aiPanelV2 = true
    const { OutputsDock } = await import('../OutputsDock')
    render(
      <Wrapper>
        <OutputsDock />
      </Wrapper>,
    )
    // The Provider owns the singleton. OutputsDockProviderHost consumes
    // context — it MUST NOT call useConversation() itself. If the regression
    // returns (e.g. OutputsDockBody resumes its own hook call, or a new
    // surface mounted under the dock subtree adds another call), this
    // count climbs to 2+ and the test fails.
    expect(useConversationCallCount.n).toBe(1)
  })

  it('FF-off: OutputsDock alone mounts exactly one useConversation() instance (legacy host)', async () => {
    flagState.aiPanelV2 = false
    const { OutputsDock } = await import('../OutputsDock')
    // No provider — OutputsDockLegacyHost owns the call directly.
    render(<OutputsDock />)
    expect(useConversationCallCount.n).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Olumi tab click intercept (UX correction P0.1)
// ---------------------------------------------------------------------------

describe('Olumi tab click while floating is open', () => {
  beforeEach(() => {
    ensureMatchMedia()
    useConversationCallCount.n = 0
    flagState.aiPanelV2 = true
    try { sessionStorage.clear() } catch {}
    try { localStorage.clear() } catch {}
    // Pin the dock to expanded so the tab-row renders (the collapsed
    // icon rail uses different testids / labels and would skip the
    // intercept under test).
    try {
      // useDockState uses sessionStorage (not localStorage).
      sessionStorage.setItem(
        'canvas.outputsDock.v1',
        JSON.stringify({ isOpen: true, activeTab: 'results' }),
      )
    } catch {}
  })

  it('focuses the floating panel and does NOT switch the active tab', async () => {
    const { fireEvent } = await import('@testing-library/react')
    const { useFloatingPanelState } = await import('../../hooks/useFloatingPanelState')
    const { registerFloatingFocus, focusFloating } = await import('../../hooks/useFloatingFocus')
    const { useUIStore } = await import('../../../stores/uiStore')
    const { OutputsDock } = await import('../OutputsDock')

    // Pre-state: Analysis tab is active in the global store, and the
    // floating panel is open.
    useUIStore.setState({ activeOutputTab: 'results', activeOutputTabVersion: 0 })
    useFloatingPanelState.getState().reset()
    useFloatingPanelState.getState().open('user')

    // Register a focus channel so we can prove focusFloating fired.
    const focusSpy = vi.fn()
    const unregister = registerFloatingFocus(focusSpy)

    const { findByLabelText } = render(
      <Wrapper>
        <OutputsDock />
      </Wrapper>,
    )

    // Find by aria-label — when floating is open the button's aria-label
    // becomes "Olumi is open. Focus floating panel" (accessible state
    // moved off the dot indicator onto the interactive control).
    const olumiTab = (await findByLabelText('Olumi is open. Focus floating panel')) as HTMLElement
    expect(olumiTab).toBeTruthy()
    fireEvent.click(olumiTab)

    // Intercept fired: the focusFloating channel was invoked.
    expect(focusSpy).toHaveBeenCalledTimes(1)
    // And the global active tab was NOT switched to 'olumi'.
    expect(useUIStore.getState().activeOutputTab).toBe('results')

    // Sanity: calling focusFloating directly hits the spy too.
    focusFloating()
    expect(focusSpy).toHaveBeenCalledTimes(2)
    unregister()
  })

  it('programmatic activeTab=olumi while floating open is auto-redirected to results (render-level intercept)', async () => {
    const { useFloatingPanelState } = await import('../../hooks/useFloatingPanelState')
    const { useUIStore } = await import('../../../stores/uiStore')
    const { OutputsDock } = await import('../OutputsDock')

    // Pre-seed: dock state persisted with activeTab='olumi'. This is the
    // path the click intercept does NOT cover — restoration from
    // sessionStorage / external programmatic state.
    try {
      sessionStorage.setItem(
        'canvas.outputsDock.v1',
        JSON.stringify({ isOpen: true, activeTab: 'olumi' }),
      )
    } catch {}
    useFloatingPanelState.getState().reset()
    useFloatingPanelState.getState().open('user')

    render(
      <Wrapper>
        <OutputsDock />
      </Wrapper>,
    )

    // The render-level effect must redirect away from 'olumi' so the
    // docked surface never renders the conversation while floating is open.
    await new Promise((r) => setTimeout(r, 50))
    // The dock's persisted activeTab should now be NOT 'olumi'. We can't
    // peek into the local useState directly, but the global useUIStore
    // sync (E1) reflects what the dock visibly shows; alternatively, the
    // docked Olumi body wrapper would carry an unhidden state if 'olumi'
    // were still active.
    const olumiWrapper = document.querySelector('[data-testid="olumi-tab-wrapper"]') as HTMLElement | null
    if (olumiWrapper) {
      // Wrapper exists but must be hidden (active tab is no longer 'olumi').
      expect(olumiWrapper.classList.contains('hidden')).toBe(true)
    }
    // Defensive: no docked-Olumi conversation surface should be visible.
    const visibleConversation = document.querySelector(
      '[data-testid="olumi-tab-body"]:not([aria-hidden="true"])',
    )
    expect(visibleConversation).toBeNull()
  })

  it('Olumi tab button carries an accessible "Focus floating panel" label when floating is open', async () => {
    const { useFloatingPanelState } = await import('../../hooks/useFloatingPanelState')
    const { OutputsDock } = await import('../OutputsDock')
    useFloatingPanelState.getState().reset()
    useFloatingPanelState.getState().open('user')
    const { findByLabelText } = render(
      <Wrapper>
        <OutputsDock />
      </Wrapper>,
    )
    // The BUTTON itself (interactive element) carries the accessible
    // state, not just a non-interactive dot indicator. AT users hear
    // the state when they reach the button.
    const olumiBtn = (await findByLabelText('Olumi is open. Focus floating panel')) as HTMLElement
    expect(olumiBtn.tagName).toBe('BUTTON')
    expect(olumiBtn.getAttribute('title')).toBe('Olumi is open. Focus floating panel')
  })

  it('falls through to normal tab activation when floating is CLOSED', async () => {
    const { fireEvent } = await import('@testing-library/react')
    const { useFloatingPanelState } = await import('../../hooks/useFloatingPanelState')
    const { useUIStore } = await import('../../../stores/uiStore')
    const { OutputsDock } = await import('../OutputsDock')

    useUIStore.setState({ activeOutputTab: 'results', activeOutputTabVersion: 0 })
    useFloatingPanelState.getState().reset()
    expect(useFloatingPanelState.getState().isOpen).toBe(false)

    const { findByLabelText } = render(
      <Wrapper>
        <OutputsDock />
      </Wrapper>,
    )

    // Find by aria-label — works for both the expanded tab row AND the
    // collapsed icon rail; both rails wire `handleTabClick` so the
    // intercept fires from either path.
    const olumiTab = (await findByLabelText('Olumi')) as HTMLElement
    expect(olumiTab).toBeTruthy()
    fireEvent.click(olumiTab)
    // With floating closed, the click activates the Olumi tab normally.
    expect(useUIStore.getState().activeOutputTab).toBe('olumi')
  })
})
