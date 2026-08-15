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

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
const flagState = { aiPanelV2: false, v5Canonical: false }
vi.mock('../../../flags', () => ({
  isTelemetryEnabled: () => false,
  isCompareEnabled: () => false,
  isRequireLoginEnabled: () => false, // login 3.4 — lib/poc.ts reads it
  isDecisionOverviewEnabled: () => false, // Wave 1 — OutputsDock mount gate reads it
  isOrchestratorV2Enabled: () => false,
  isLegacyDirectRunEnabled: () => true,
  isJourneyTabEnabled: () => false,
  isCompareTabEnabled: () => false,
  isAiPanelV2Enabled: () => flagState.aiPanelV2,
  isV5CanonicalAnalysisEnabled: () => flagState.v5Canonical,
  isPreAnalysisV3Enabled: () => false,
}))

// THE counter: every time the real useConversation hook executes, we
// increment. The mock returns a stable shape (matches UseConversationReturn
// loosely — fields used by the dock/provider only).
const useConversationCallCount = { n: 0 }
const stableConversation = {
  messages: [] as any[],
  isThinking: false,
  longRunningHint: null as any,
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
// PreAnalysisPanel pulls in ToastProvider + readiness fetches that fail
// outside the full app shell. Stub it to a placeholder so the dock can
// expand for tests that require non-empty canvas state.
vi.mock('../pre-analysis', () => ({
  PreAnalysisPanel: () => null,
}))
// Readiness store fetches /bff/cee/graph-readiness which jsdom can't parse
// as a relative URL. Stub the hook so the dock can render past readiness
// gating in dock-expanded tests.
vi.mock('../../hooks/useGraphReadiness', () => ({
  useGraphReadiness: () => ({ readiness: { state: 'ready' } }),
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
    flagState.v5Canonical = false
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
    flagState.v5Canonical = false
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

  it('closes the floating panel and activates the docked Olumi tab', async () => {
    const { fireEvent } = await import('@testing-library/react')
    const { useFloatingPanelState } = await import('../../hooks/useFloatingPanelState')
    const { useUIStore } = await import('../../../stores/uiStore')
    const { useCanvasStore } = await import('../../store')
    const { OutputsDock } = await import('../OutputsDock')

    // Populated canvas so the dock can ACTUALLY host Olumi (dockHostsOlumi=true)
    // — only then does clicking Olumi retire the floating. On the empty-canvas
    // first-use rail the dock can't host it and the surface is re-engaged
    // instead (covered separately below). Explicit so the test isn't
    // order-dependent on a leaked canvas state.
    useCanvasStore.getState().resetCanvas()
    useCanvasStore.getState().addNode(undefined, 'decision')
    // Since 16 Aug 2026 the first-use rail ends on an analysis RESULT, not on
    // graph content, so the node alone no longer expands the dock.
    useCanvasStore.setState({ hasCompletedFirstRun: true } as any)

    // Pre-state: Analysis tab is active in the global store, and the
    // floating panel is open.
    useUIStore.setState({ activeOutputTab: 'results', activeOutputTabVersion: 0 })
    useFloatingPanelState.getState().reset()
    useFloatingPanelState.getState().open('user')
    expect(useFloatingPanelState.getState().isOpen).toBe(true)

    const { findByTestId } = render(
      <Wrapper>
        <OutputsDock />
      </Wrapper>,
    )

    // On a populated canvas the dock is expanded and the tab strip renders the
    // text-only Olumi tab (no aria-label) — find it by testid (the rail's
    // icon-button label query only applies to the collapsed first-use rail).
    const olumiTab = (await findByTestId('outputs-dock-tab-olumi')) as HTMLElement
    expect(olumiTab).toBeTruthy()
    fireEvent.click(olumiTab)

    // The click closes the floating panel and activates the docked tab.
    // The singleton ConversationContext preserves draft + messages across
    // the surface switch (no data loss).
    expect(useFloatingPanelState.getState().isOpen).toBe(false)
    expect(useUIStore.getState().activeOutputTab).toBe('olumi')

    useCanvasStore.getState().resetCanvas() // cleanup for any later tests
  })

  it('persisted activeTab=olumi + floating open on a POPULATED canvas → floating closes, docked surface hosts (no duplicate)', async () => {
    // When the dock restores activeTab=olumi AND a floating surface happens to
    // be open, the duplicate-readable-surface invariant requires one to give.
    // Policy: the docked Olumi composer wins and the floating retires — but ONLY
    // because the dock can actually host it here (populated canvas → not the
    // first-use rail), i.e. dockHostsOlumi=true. The singleton
    // ConversationContext preserves draft + messages, so nothing is lost.
    const { useFloatingPanelState } = await import('../../hooks/useFloatingPanelState')
    const { useCanvasStore } = await import('../../store')
    const { OutputsDock } = await import('../OutputsDock')

    useCanvasStore.getState().resetCanvas()
    useCanvasStore.getState().addNode(undefined, 'decision') // populated → dock can host Olumi
    // …and an analysis result, which is what actually ends the rail since
    // 16 Aug 2026. "Populated" alone leaves the dock at 40px and unable to host.
    useCanvasStore.setState({ hasCompletedFirstRun: true } as any)
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

    // Allow the close-effect to run; dockHostsOlumi=true → it retires the floating.
    await new Promise((r) => setTimeout(r, 50))
    expect(useFloatingPanelState.getState().isOpen).toBe(false)
    useCanvasStore.getState().resetCanvas() // cleanup for any later tests
  })

  it('persisted activeTab=olumi + floating open on the first-use rail → floating STAYS (dock cannot host; no dead-state)', async () => {
    // Regression guard for the reported bug. On an EMPTY canvas the dock is the
    // collapsed first-use rail (effectiveIsOpen=false) and cannot show the
    // docked Olumi composer → dockHostsOlumi=false. The close-effect must NOT
    // retire the floating/hero surface here — doing so leaves ZERO composers
    // (the Olumi logo + text box flashing then vanishing — the reported bug).
    // See olumiSurface.ts (resolveOlumiSurface / dockHostsOlumi).
    const { useFloatingPanelState } = await import('../../hooks/useFloatingPanelState')
    const { useCanvasStore } = await import('../../store')
    const { OutputsDock } = await import('../OutputsDock')

    useCanvasStore.getState().resetCanvas() // force empty canvas → first-use rail
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

    // Allow the close-effect to run; it must NOT close the floating surface.
    await new Promise((r) => setTimeout(r, 50))
    expect(useFloatingPanelState.getState().isOpen).toBe(true)
  })

  // NOTE: the former 'programmatic activeTab=olumi while floating open → guard
  // closes floating' test asserted the OLD behaviour on an empty-canvas rail —
  // i.e. it pinned the dead-state bug (close the only composer while the dock
  // cannot host one). Its scenario is now covered correctly by the two tests
  // above: the docked composer wins ONLY on a populated canvas; on the
  // first-use rail the floating surface must stay. See olumiSurface.ts.

  it('Olumi tab button carries the plain "Olumi" label (text-only, round-3 UX)', async () => {
    const { useFloatingPanelState } = await import('../../hooks/useFloatingPanelState')
    const { OutputsDock } = await import('../OutputsDock')
    useFloatingPanelState.getState().reset()
    useFloatingPanelState.getState().open('user')
    const { findByLabelText } = render(
      <Wrapper>
        <OutputsDock />
      </Wrapper>,
    )
    // Round 3 removed the "Olumi is open" signage from the tab. The label
    // is now consistently "Olumi" regardless of floating-panel state.
    const olumiBtn = (await findByLabelText('Olumi')) as HTMLElement
    expect(olumiBtn.tagName).toBe('BUTTON')
    expect(olumiBtn.getAttribute('title')).toBe('Olumi')
  })

  it('programmatic activeTab=olumi keeps Olumi as the active dock tab (round-3 no-redirect)', async () => {
    // Round 3 removed the round-2 redirect-away-from-Olumi-when-floating-open
    // policy. With the click intercept now CLOSING the floating panel
    // instead of focusing it, the state `activeTab === 'olumi'` is the
    // canonical docked state and must NOT be redirected away from.
    const { fireEvent } = await import('@testing-library/react')
    const { useFloatingPanelState } = await import('../../hooks/useFloatingPanelState')
    const { useUIStore } = await import('../../../stores/uiStore')
    const { OutputsDock } = await import('../OutputsDock')

    useUIStore.setState({ activeOutputTab: 'results', activeOutputTabVersion: 0 })
    useFloatingPanelState.getState().reset()

    render(
      <Wrapper>
        <OutputsDock />
      </Wrapper>,
    )

    // Open floating, then programmatically request 'olumi' (e.g. from a
    // restored session or a deep link).
    act(() => {
      useFloatingPanelState.getState().open('user')
    })
    act(() => {
      useUIStore.getState().setActiveOutputTab('olumi')
    })
    await new Promise((r) => setTimeout(r, 50))

    // The dock honours the programmatic request — 'olumi' stays active.
    // (The click intercept that closes floating only fires on user clicks;
    // programmatic state restoration does not need to close floating, and
    // the duplicate-readable-surface invariant is enforced by users only
    // ever clicking the Olumi tab.)
    expect(useUIStore.getState().activeOutputTab).toBe('olumi')
    void fireEvent
  })

  it('docked-tab float-out switches active tab AND opens floating (round-3 regression guard)', async () => {
    // Round-3 follow-up: the `yieldToDockedOlumi` render-time guard and the
    // close-floating-when-olumi guard effect together would suppress the
    // floating panel if `onFloatOut` only called `open('user')`. The fix
    // is for `onFloatOut` to ALSO switch the active tab away from 'olumi'
    // so the docked surface yields and the floating panel becomes the
    // sole readable conversation surface.
    const { fireEvent } = await import('@testing-library/react')
    const { useFloatingPanelState } = await import('../../hooks/useFloatingPanelState')
    const { useUIStore } = await import('../../../stores/uiStore')
    const { useCanvasStore } = await import('../../store')
    const { OutputsDock } = await import('../OutputsDock')

    // Pre-state: user has a graph (so dock is expanded, not rail-mode) AND
    // is on the Olumi tab, no floating open.
    useCanvasStore.setState({
      nodes: [{ id: 'n1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'd', kind: 'decision' } }],
      // Since 16 Aug 2026 the first-use rail ends on an analysis RESULT, not on
      // graph content, so the graph alone no longer expands the dock. These
      // cases are about tab/floating-panel behaviour in an EXPANDED dock, so a
      // session that has produced an analysis is the accurate fixture.
      hasCompletedFirstRun: true,
    } as any)
    useUIStore.setState({ activeOutputTab: 'olumi', activeOutputTabVersion: 0 })
    useFloatingPanelState.getState().reset()
    try {
      sessionStorage.setItem(
        'canvas.outputsDock.v1',
        JSON.stringify({ isOpen: true, activeTab: 'olumi' }),
      )
    } catch {}

    const { findByTestId } = render(
      <Wrapper>
        <OutputsDock />
      </Wrapper>,
    )

    // Click the float-out icon in the docked Olumi tab body.
    const floatOutBtn = (await findByTestId('olumi-tab-float-out')) as HTMLElement
    fireEvent.click(floatOutBtn)
    await new Promise((r) => setTimeout(r, 50))

    // After the click:
    //   - Floating panel is OPEN (not suppressed by the yield/guard).
    //   - Active tab is no longer 'olumi' (so the docked surface yields).
    //   - Source is 'user' (so canAutoDock returns false).
    expect(useFloatingPanelState.getState().isOpen).toBe(true)
    expect(useUIStore.getState().activeOutputTab).not.toBe('olumi')
    expect(useFloatingPanelState.getState().source).toBe('user')

    // Round-8 fix: sessionStorage MUST be updated synchronously inside
    // onFloatOut (before openFloatingByUser fires the next render), so
    // FloatingOlumiPanel's render-time persisted-dock-tab read picks up
    // the new value and yieldToDockedOlumi returns false. Without this,
    // useDockState's post-commit effect would still hold 'olumi', and
    // the panel would suppress itself on the very render that should
    // mount it.
    const persisted = JSON.parse(sessionStorage.getItem('canvas.outputsDock.v1') || '{}').activeTab
    expect(persisted).not.toBe('olumi')

    // Cleanup: leave the canvas store empty for the next test.
    // Symmetric teardown: these tests now also seed `hasCompletedFirstRun`, and
    // clearing only `nodes` would leak an analysis result into the next test —
    // which is precisely what made a later rail-path case render expanded.
    useCanvasStore.setState({ nodes: [], hasCompletedFirstRun: false } as any)
  })

  it('persisted activeTab=olumi + global=results + floating open → floating yields on first render (round-5 race guard)', async () => {
    // Round-5 P0: OutputsDock restores `state.activeTab` from sessionStorage
    // synchronously, while useUIStore.activeOutputTab is still the default
    // 'results' until the post-paint E1 sync effect runs. Without the
    // persisted-state read in FloatingOlumiPanel's yield gate, both
    // surfaces would paint for one frame. The yield gate now reads the
    // same sessionStorage source as OutputsDock and pre-empts the flash.
    const { useFloatingPanelState } = await import('../../hooks/useFloatingPanelState')
    const { useUIStore } = await import('../../../stores/uiStore')
    const { useCanvasStore } = await import('../../store')
    const { FloatingOlumiPanel } = await import('../FloatingOlumiPanel')

    // Pre-state: persisted dock state says 'olumi'; global store still
    // 'results' (the disagreement is the bug condition).
    try {
      sessionStorage.setItem(
        'canvas.outputsDock.v1',
        JSON.stringify({ isOpen: true, activeTab: 'olumi' }),
      )
    } catch {}
    useUIStore.setState({ activeOutputTab: 'results', activeOutputTabVersion: 0 })
    useFloatingPanelState.getState().reset()
    useFloatingPanelState.getState().open('user')
    expect(useFloatingPanelState.getState().isOpen).toBe(true)

    // Render the floating panel in isolation (not via OutputsDock — the
    // race-of-interest is FloatingOlumiPanel's render-time gate alone).
    // Need a graph so the panel doesn't yield via yieldToFirstUse.
    useCanvasStore.setState({
      nodes: [{ id: 'n1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'd', kind: 'decision' } }],
      // Since 16 Aug 2026 the first-use rail ends on an analysis RESULT, not on
      // graph content, so the graph alone no longer expands the dock. These
      // cases are about tab/floating-panel behaviour in an EXPANDED dock, so a
      // session that has produced an analysis is the accurate fixture.
      hasCompletedFirstRun: true,
    } as any)

    const { container } = render(
      <Wrapper>
        <FloatingOlumiPanel onDock={() => {}} onCogClick={() => {}} />
      </Wrapper>,
    )

    // The yield gate read the persisted 'olumi' tab and returned null
    // immediately — no floating panel DOM, no duplicate-surface flash.
    expect(container.querySelector('[data-testid="floating-olumi-panel"]')).toBeNull()

    // Cleanup: clear the persisted state so subsequent tests don't inherit it.
    try { sessionStorage.removeItem('canvas.outputsDock.v1') } catch {}
    // Symmetric teardown: these tests now also seed `hasCompletedFirstRun`, and
    // clearing only `nodes` would leak an analysis result into the next test —
    // which is precisely what made a later rail-path case render expanded.
    useCanvasStore.setState({ nodes: [], hasCompletedFirstRun: false } as any)
  })

  it('docked Olumi float-out returns the user to the LAST non-Olumi tab (round-5 UX)', async () => {
    // Round-5: float-out should preserve the user's previous Analysis/
    // Compare/Model/Journey context rather than always defaulting to
    // Analysis. lastNonOlumiTabRef tracks whichever non-Olumi tab the
    // user was last on.
    const { fireEvent } = await import('@testing-library/react')
    const { useFloatingPanelState } = await import('../../hooks/useFloatingPanelState')
    const { useUIStore } = await import('../../../stores/uiStore')
    const { useCanvasStore } = await import('../../store')
    const { OutputsDock } = await import('../OutputsDock')

    // Pre-state: user has a graph (dock expanded), was on Model
    // (internally 'diagnostics'), then switched to Olumi.
    useCanvasStore.setState({
      nodes: [{ id: 'n1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'd', kind: 'decision' } }],
      // Since 16 Aug 2026 the first-use rail ends on an analysis RESULT, not on
      // graph content, so the graph alone no longer expands the dock. These
      // cases are about tab/floating-panel behaviour in an EXPANDED dock, so a
      // session that has produced an analysis is the accurate fixture.
      hasCompletedFirstRun: true,
    } as any)
    useUIStore.setState({ activeOutputTab: 'diagnostics', activeOutputTabVersion: 0 })
    useFloatingPanelState.getState().reset()
    try {
      sessionStorage.setItem(
        'canvas.outputsDock.v1',
        JSON.stringify({ isOpen: true, activeTab: 'diagnostics' }),
      )
    } catch {}

    const { findByTestId } = render(
      <Wrapper>
        <OutputsDock />
      </Wrapper>,
    )

    // Switch to Olumi — lastNonOlumiTabRef captures 'diagnostics'.
    // (Expanded-dock tab buttons identify by testid; the rail-mode aria-label
    //  used by other tests in this block isn't present once the dock expands.)
    const olumiBtn = (await findByTestId('outputs-dock-tab-olumi')) as HTMLElement
    fireEvent.click(olumiBtn)
    await new Promise((r) => setTimeout(r, 50))
    expect(useUIStore.getState().activeOutputTab).toBe('olumi')

    // Float out — should return to 'diagnostics', not the 'results' default.
    const floatOutBtn = (await findByTestId('olumi-tab-float-out')) as HTMLElement
    fireEvent.click(floatOutBtn)
    await new Promise((r) => setTimeout(r, 50))

    expect(useFloatingPanelState.getState().isOpen).toBe(true)
    expect(useUIStore.getState().activeOutputTab).toBe('diagnostics')

    // Cleanup.
    try { sessionStorage.removeItem('canvas.outputsDock.v1') } catch {}
    // Symmetric teardown: these tests now also seed `hasCompletedFirstRun`, and
    // clearing only `nodes` would leak an analysis result into the next test —
    // which is precisely what made a later rail-path case render expanded.
    useCanvasStore.setState({ nodes: [], hasCompletedFirstRun: false } as any)
  })

  it('persistent strip chevron from Olumi tab opens floating panel (round-14 regression)', async () => {
    // Round-14 P0: when the user is on the docked Olumi tab and the
    // floating panel is closed, the persistent strip renders the
    // AIInputBar variant='strip' with a chevron-up button. Clicking the
    // chevron must open the floating panel — and to do so, the active
    // tab must be swapped away from 'olumi' BEFORE the open() call.
    // Without the swap, FloatingOlumiPanel's render-time
    // yieldToDockedOlumi guard suppresses the panel mount and the user
    // sees nothing happen.
    //
    // Bug history: round-3 fixed the OlumiTabBody float-out icon path.
    // Round-8 added the synchronous sessionStorage write. Round-14
    // extracts both into a single `floatOutToWindow` helper and applies
    // it to BOTH the float-out icon AND the persistent strip's
    // onOpenFloating handler — previously the strip's chevron called
    // openFloatingByUser('user') without the tab swap, regressing the
    // round-3 fix for users who routed through the strip instead of the
    // OlumiTabBody icon.
    const { fireEvent } = await import('@testing-library/react')
    const { useFloatingPanelState } = await import('../../hooks/useFloatingPanelState')
    const { useUIStore } = await import('../../../stores/uiStore')
    const { useCanvasStore } = await import('../../store')
    const { OutputsDock } = await import('../OutputsDock')

    // Pre-state: graph exists (dock expanded), activeTab='olumi',
    // floating closed.
    useCanvasStore.setState({
      nodes: [{ id: 'n1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'd', kind: 'decision' } }],
      // Since 16 Aug 2026 the first-use rail ends on an analysis RESULT, not on
      // graph content, so the graph alone no longer expands the dock. These
      // cases are about tab/floating-panel behaviour in an EXPANDED dock, so a
      // session that has produced an analysis is the accurate fixture.
      hasCompletedFirstRun: true,
    } as any)
    useUIStore.setState({ activeOutputTab: 'olumi', activeOutputTabVersion: 0 })
    useFloatingPanelState.getState().reset()
    try {
      sessionStorage.setItem(
        'canvas.outputsDock.v1',
        JSON.stringify({ isOpen: true, activeTab: 'olumi' }),
      )
    } catch {}

    const { findByTestId } = render(
      <Wrapper>
        <OutputsDock />
      </Wrapper>,
    )

    // Persistent strip renders the AIInputBar variant='strip' with a
    // chevron when isOlumiTabActive=true && floating closed. The chevron
    // testid is wired by AIInputBar as `${testId ?? 'ai-input-bar-${variant}'}-chevron`.
    const chevron = (await findByTestId('ai-input-bar-strip-chevron')) as HTMLElement
    fireEvent.click(chevron)
    await new Promise((r) => setTimeout(r, 50))

    // After the click, the floating panel must be OPEN and the active
    // tab must have swapped away from 'olumi' so the yield gate clears.
    expect(useFloatingPanelState.getState().isOpen).toBe(true)
    expect(useUIStore.getState().activeOutputTab).not.toBe('olumi')
    // Synchronous sessionStorage write keeps the render-time fallback
    // read in agreement.
    const persisted = JSON.parse(sessionStorage.getItem('canvas.outputsDock.v1') || '{}').activeTab
    expect(persisted).not.toBe('olumi')

    // Cleanup.
    try { sessionStorage.removeItem('canvas.outputsDock.v1') } catch {}
    // Symmetric teardown: these tests now also seed `hasCompletedFirstRun`, and
    // clearing only `nodes` would leak an analysis result into the next test —
    // which is precisely what made a later rail-path case render expanded.
    useCanvasStore.setState({ nodes: [], hasCompletedFirstRun: false } as any)
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

// ---------------------------------------------------------------------------
// Canonical relationship recovery — exactly one reachable owner per topology
// ---------------------------------------------------------------------------

const RECOVERY_SCENARIO_ID = '11111111-2222-4333-8444-555555555555'

async function mountRecoveryTopology(args: {
  dockOpen: boolean
  floating: 'closed' | 'full' | 'minimised'
  viewportWidth?: number
  activeTab?: 'results' | 'olumi'
  floatingSource?: 'user' | 'system-first-use'
  graphPresent?: boolean
}) {
  const { useCanvasStore, EMPTY_EDGE_STRENGTH_SYNC } = await import('../../store')
  const { useFloatingPanelState } = await import('../../hooks/useFloatingPanelState')
  const { useUIStore } = await import('../../../stores/uiStore')
  const { OutputsDock } = await import('../OutputsDock')
  const { FloatingOlumiPanel } = await import('../FloatingOlumiPanel')

  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: args.viewportWidth ?? 1200,
  })
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    value: args.viewportWidth === 390 ? 844 : 900,
  })
  sessionStorage.setItem(
    'canvas.outputsDock.v1',
    JSON.stringify({ isOpen: args.dockOpen, activeTab: args.activeTab ?? 'results' }),
  )
  useUIStore.setState({ activeOutputTab: args.activeTab ?? 'results', activeOutputTabVersion: 0 })
  useFloatingPanelState.getState().reset()
  if (args.floating !== 'closed') {
    useFloatingPanelState.getState().open(args.floatingSource ?? 'user')
    if (args.floating === 'minimised') useFloatingPanelState.getState().minimise()
  }
  const graphPresent = args.graphPresent ?? true
  useCanvasStore.setState({
    currentScenarioId: RECOVERY_SCENARIO_ID,
    nodes: graphPresent ? [
      { id: 'fac_demand', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Demand' } },
      { id: 'goal_profit', type: 'goal', position: { x: 0, y: 100 }, data: { label: 'Sustainable profit' } },
    ] : [],
    edges: graphPresent ? [{
      id: 'rf-private-edge-id',
      source: 'fac_demand',
      target: 'goal_profit',
      data: { weight: -0.4, direction: 'negative' },
    }] : [],
    unconfirmedEmittedEdits: 0,
    edgeStrengthSync: {
      ...EMPTY_EDGE_STRENGTH_SYNC,
      scenarioId: RECOVERY_SCENARIO_ID,
      hydration: 'settled',
      issue: 'conflict',
      recoverySummary: {
        items: [{
          from: 'fac_demand',
          to: 'goal_profit',
          label: 'Demand → Sustainable profit',
          kind: 'conflict',
          relationshipExists: graphPresent,
        }],
        total: 1,
        remaining: 0,
      },
    },
  } as never)

  const dockFloatingPanel = () => {
    useUIStore.getState().forceActivateOutputTab('olumi')
    useFloatingPanelState.getState().close()
  }

  return render(
    <Wrapper>
      <OutputsDock />
      <FloatingOlumiPanel onDock={dockFloatingPanel} onCogClick={() => {}} />
    </Wrapper>,
  )
}

describe('canonical relationship recovery topology', () => {
  beforeEach(() => {
    ensureMatchMedia()
    useConversationCallCount.n = 0
    flagState.aiPanelV2 = true
    flagState.v5Canonical = true
    vi.stubEnv('VITE_ENABLE_V5_ORCHESTRATOR', 'true')
    window.history.replaceState({}, '', '/')
    try { sessionStorage.clear() } catch {}
    try { localStorage.clear() } catch {}
  })

  afterEach(async () => {
    vi.unstubAllEnvs()
    const { useFloatingPanelState } = await import('../../hooks/useFloatingPanelState')
    const { EMPTY_EDGE_STRENGTH_SYNC, useCanvasStore } = await import('../../store')
    useFloatingPanelState.getState().reset()
    useCanvasStore.setState({
      currentScenarioId: null,
      nodes: [],
      edges: [],
      edgeStrengthSync: EMPTY_EDGE_STRENGTH_SYNC,
    } as never)
    window.history.replaceState({}, '', '/')
    try { sessionStorage.clear() } catch {}
  })

  it('dock expanded + floating closed: the dock footer is the sole recovery owner', async () => {
    await mountRecoveryTopology({ dockOpen: true, floating: 'closed' })

    const footer = screen.getByTestId('ai-panel-footer-stack')
    expect(within(footer).getByTestId('edge-strength-recovery-notice')).toBeVisible()
    expect(screen.getAllByTestId('edge-strength-recovery-notice')).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: 'Check shared model' })).toHaveLength(1)
    expect(document.body.textContent).toContain('Demand → Sustainable profit')
    expect(document.body.textContent).not.toContain('rf-private-edge-id')
  })

  it('dock expanded + floating full: the floating panel owns the only live recovery controls', async () => {
    await mountRecoveryTopology({ dockOpen: true, floating: 'full' })

    const floating = screen.getByTestId('floating-olumi-panel')
    const footer = screen.getByTestId('ai-panel-footer-stack')
    expect(within(floating).getByTestId('edge-strength-recovery-notice')).toBeVisible()
    expect(within(footer).queryByTestId('edge-strength-recovery-notice')).not.toBeInTheDocument()
    expect(screen.getAllByTestId('edge-strength-recovery-notice')).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: 'Review relationship Demand → Sustainable profit' })).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: 'Check shared model' })).toHaveLength(1)
  })

  it('dock expanded on Olumi + floating opening: the dock owns recovery through the render-yield handoff', async () => {
    await mountRecoveryTopology({ dockOpen: true, floating: 'full', activeTab: 'olumi' })

    const footer = screen.getByTestId('ai-panel-footer-stack')
    expect(within(footer).getByTestId('edge-strength-recovery-notice')).toBeVisible()
    expect(screen.getAllByTestId('edge-strength-recovery-notice')).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: 'Check shared model' })).toHaveLength(1)
  })

  it('dock expanded + floating minimised: the dock remains the sole recovery owner', async () => {
    await mountRecoveryTopology({ dockOpen: true, floating: 'minimised' })

    const footer = screen.getByTestId('ai-panel-footer-stack')
    const pill = screen.getByRole('button', { name: 'Restore Olumi' })
    expect(within(footer).getByTestId('edge-strength-recovery-notice')).toBeVisible()
    expect(screen.getAllByTestId('edge-strength-recovery-notice')).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: 'Check shared model' })).toHaveLength(1)
    expect(within(pill).queryByTestId('floating-olumi-recovery-attention')).not.toBeInTheDocument()
  })

  it('live expanded/full → minimise → collapse transition publishes one endpoint-labelled recovery route', async () => {
    const user = userEvent.setup()
    await mountRecoveryTopology({ dockOpen: true, floating: 'full' })

    // Full floating owns the notice while the expanded Analysis dock remains
    // visible. Minimise transfers ownership to the dock without duplicating it.
    const minimise = screen.getByRole('button', { name: 'Minimise' })
    minimise.focus()
    await user.keyboard('{Enter}')
    expect(screen.getAllByTestId('edge-strength-recovery-notice')).toHaveLength(1)
    expect(within(screen.getByTestId('ai-panel-footer-stack')).getByTestId('edge-strength-recovery-notice')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Restore Olumi' })).toBeVisible()

    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 })
    vi.spyOn(screen.getByTestId('outputs-dock'), 'getBoundingClientRect').mockReturnValue({
      x: 338,
      y: 12,
      left: 338,
      top: 12,
      right: 378,
      bottom: 832,
      width: 40,
      height: 820,
      toJSON: () => ({}),
    })
    act(() => window.dispatchEvent(new Event('resize')))

    const collapse = screen.getByRole('button', { name: 'Collapse outputs dock' })
    collapse.focus()
    await user.keyboard('{Enter}')

    // This is the regression seam: FloatingOlumiPanel must receive the live
    // dock-close update without re-reading sessionStorage on an unrelated
    // render. The sole route now names the human endpoint, never the RF id.
    const attention = screen.getByRole('button', {
      name: 'Restore Olumi. Demand → Sustainable profit needs attention.',
    })
    expect(screen.queryByTestId('edge-strength-recovery-notice')).not.toBeInTheDocument()
    expect(document.body.textContent).not.toContain('rf-private-edge-id')

    attention.focus()
    expect(attention).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(screen.getAllByTestId('edge-strength-recovery-notice')).toHaveLength(1)
    expect(screen.getByTestId('edge-strength-recovery-notice')).toHaveTextContent('Demand → Sustainable profit')
    expect(screen.getByRole('button', { name: 'Check shared model' })).toBeVisible()
    expect(screen.queryByTestId('floating-olumi-panel-pill')).not.toBeInTheDocument()
  })

  it('dock collapsed + floating full: recovery remains in the floating panel', async () => {
    await mountRecoveryTopology({ dockOpen: false, floating: 'full' })

    expect(screen.queryByTestId('ai-panel-footer-stack')).not.toBeInTheDocument()
    expect(within(screen.getByTestId('floating-olumi-panel')).getByTestId('edge-strength-recovery-notice')).toBeVisible()
    expect(screen.queryByTestId('outputs-dock-recovery-attention')).not.toBeInTheDocument()
    expect(document.body.textContent).not.toContain('rf-private-edge-id')
  })

  it('dock collapsed + floating minimised at 390×844: the pill signals attention and keyboard restore reveals recovery', async () => {
    const user = userEvent.setup()
    await mountRecoveryTopology({ dockOpen: false, floating: 'minimised', viewportWidth: 390 })

    vi.spyOn(screen.getByTestId('outputs-dock'), 'getBoundingClientRect').mockReturnValue({
      x: 338,
      y: 12,
      left: 338,
      top: 12,
      right: 378,
      bottom: 832,
      width: 40,
      height: 820,
      toJSON: () => ({}),
    })
    const pill = screen.getByRole('button', {
      name: 'Restore Olumi. Demand → Sustainable profit needs attention.',
    })
    expect(screen.getByTestId('floating-olumi-recovery-attention')).toHaveTextContent('Attention')
    expect(screen.queryByTestId('edge-strength-recovery-notice')).not.toBeInTheDocument()
    pill.focus()
    expect(pill).toHaveFocus()
    await user.keyboard('{Enter}')

    expect(screen.queryByTestId('floating-olumi-panel-pill')).not.toBeInTheDocument()
    expect(within(screen.getByTestId('ai-panel-footer-stack')).getByTestId('edge-strength-recovery-notice')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Check shared model' })).toBeVisible()
  })

  it('dock collapsed + floating closed: the rail signals attention and keyboard activation opens the recovery owner', async () => {
    const user = userEvent.setup()
    await mountRecoveryTopology({ dockOpen: false, floating: 'closed' })

    const attentionRoute = screen.getByRole('button', {
      name: 'Open Olumi — relationship changes need attention',
    })
    expect(screen.getByTestId('outputs-dock-recovery-attention')).toBeVisible()
    expect(screen.queryByTestId('edge-strength-recovery-notice')).not.toBeInTheDocument()
    attentionRoute.focus()
    expect(attentionRoute).toHaveFocus()
    await user.keyboard('{Enter}')

    expect(screen.getByTestId('ai-panel-footer-stack')).toBeVisible()
    expect(screen.getByTestId('edge-strength-recovery-notice')).toBeVisible()
    expect(screen.queryByTestId('outputs-dock-recovery-attention')).not.toBeInTheDocument()
  })

  it('dock collapsed + render-null first-use floating: the rail remains an explicit recovery route', async () => {
    await mountRecoveryTopology({
      dockOpen: false,
      floating: 'full',
      floatingSource: 'system-first-use',
      graphPresent: false,
    })

    expect(screen.queryByTestId('floating-olumi-panel')).not.toBeInTheDocument()
    expect(screen.getByRole('button', {
      name: 'Open Olumi — relationship changes need attention',
    })).toBeVisible()
    expect(screen.getByTestId('outputs-dock-recovery-attention')).toBeVisible()
  })
})
