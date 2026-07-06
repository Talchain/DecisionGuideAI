/**
 * DOM-level dock-inset regression: the floating panel's layout effect must
 * read the real OutputsDock width (including any right-edge offset like
 * `right: 12px`) and clamp accordingly. Verifies both the initial layout
 * and re-clamping when the dock's width changes after the panel is open.
 *
 * jsdom does not run CSS layout, so we mount a stub <aside> and override
 * its getBoundingClientRect to simulate the real dock's placement.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, render } from '@testing-library/react'
import type { ReactNode } from 'react'

vi.mock('../../../lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }) }) },
  isSupabaseAvailable: () => false,
}))
vi.mock('dompurify', () => ({ default: { sanitize: (s: string) => s } }))
vi.mock('../../utils/markdown', () => ({
  renderMarkdown: (s: string) => s,
  sanitiseMarkdown: (s: string) => s,
}))

const canvasMockState = {
  nodes: [{ id: 'n1' }],
  edges: [] as Array<unknown>,
  results: { status: 'idle' as const },
  _internal: {} as Record<string, unknown>,
  selection: null as null | { id: string; label: string; kind: string },
  ceeAnalysisReady: null as any,
  graphHealth: null as any,
  runMeta: {} as any,
}
vi.mock('../../store', () => {
  const useCanvasStore: any = (selector: (s: any) => any) => selector(canvasMockState)
  useCanvasStore.getState = () => canvasMockState
  useCanvasStore.setState = (patch: any) => Object.assign(canvasMockState, patch)
  useCanvasStore.subscribe = () => () => {}
  return {
    useCanvasStore,
    selectResultsStatus: (s: any) => s.results?.status,
    selectReport: (s: any) => s.results?.report,
    selectError: (s: any) => s.results?.error,
    selectResultsSource: (s: any) => s.results?.source,
  }
})

// Stub ConversationPanel — its deep render is irrelevant for layout
// invariants and adds tens of transitive deps. We only need the outer
// FloatingOlumiPanel container to mount with its layout effect.
vi.mock('../../conversation/ConversationPanel', () => ({
  ConversationPanel: () => null,
}))
vi.mock('../../hooks/useStageAwarePlaceholder', () => ({
  useStageAwarePlaceholder: () => 'Ask',
}))
vi.mock('../../ui/inspector-v2/useStaleGuard', () => ({
  useStaleGuard: () => ({ analysisState: 'none', isStale: false }),
}))

vi.mock('../../conversation/useConversation', async () => {
  const { useState } = await import('react')
  return {
    useConversation: () => {
      const [sendMessage] = useState(() => vi.fn())
      return {
        // Empty messages: avoids pulling in ConversationPanel's bubble
        // rendering path (which transitively requires more exports).
        messages: [],
        isThinking: false,
        longRunningHint: null,
        lastFailedInput: null,
        sendMessage,
        sendSystemEvent: vi.fn(),
        sendChip: vi.fn(),
        retryLast: vi.fn(),
        patchBlockStates: new Map(),
        setPatchBlockState: vi.fn(),
        patchRejections: new Map(),
        setPatchRejection: vi.fn(),
      }
    },
    isNonConversationalContent: () => false,
  }
})

import { ConversationProvider } from '../../conversation/ConversationContext'
import { FloatingOlumiPanel } from '../FloatingOlumiPanel'
import { useFloatingPanelState } from '../../hooks/useFloatingPanelState'

function Wrapper({ children }: { children: ReactNode }) {
  return <ConversationProvider>{children}</ConversationProvider>
}

const VIEWPORT_W = 1440
const VIEWPORT_H = 900

/** Mount a stub OutputsDock <aside> with a mocked bounding rect. */
function mountStubDock(opts: { width: number; right: number }): {
  el: HTMLElement
  setWidth: (w: number) => void
  unmount: () => void
} {
  const el = document.createElement('aside')
  el.setAttribute('aria-label', 'Outputs dock')
  document.body.appendChild(el)
  const state = { ...opts }
  el.getBoundingClientRect = function () {
    const viewportW = window.innerWidth || VIEWPORT_W
    const viewportH = window.innerHeight || VIEWPORT_H
    const left = viewportW - state.width - state.right
    return {
      left,
      top: 60,
      right: viewportW - state.right,
      bottom: viewportH - 12,
      width: state.width,
      height: viewportH - 72,
      x: left,
      y: 60,
      toJSON: () => ({}),
    } as DOMRect
  }
  return {
    el,
    setWidth: (w: number) => { state.width = w },
    unmount: () => el.remove(),
  }
}

beforeEach(() => {
  // Pin viewport so the test is deterministic.
  Object.defineProperty(window, 'innerWidth', { value: VIEWPORT_W, configurable: true })
  Object.defineProperty(window, 'innerHeight', { value: VIEWPORT_H, configurable: true })
  useFloatingPanelState.getState().reset()
})

afterEach(() => {
  document.body.querySelectorAll('aside[aria-label="Outputs dock"]').forEach((el) => el.remove())
})

describe('FloatingOlumiPanel — dock-inset clamp (real DOM)', () => {
  it('respects the dock width AND its right-edge gap when laying out for the first time', () => {
    // Dock: 388px wide, 12px right offset → reserved area = 400.
    // Default panel is 400px wide. Without dock-aware clamp the centred
    // x would be (1440-400)/2 = 520; with inset=400 the max x becomes
    // 1440 - 400 - 16 - 400 = 624 (no constraint here) but the centred
    // default uses `vw - dockInset` so the panel centres in the visible
    // canvas instead — left = (1440-400-400)/2 = 320.
    const dock = mountStubDock({ width: 388, right: 12 })
    useFloatingPanelState.getState().open('user')
    render(<FloatingOlumiPanel onDock={() => {}} onCogClick={() => {}} />, { wrapper: Wrapper })
    const panel = document.querySelector('[data-testid="floating-olumi-panel"]') as HTMLElement
    expect(panel).toBeTruthy()
    const left = parseFloat(panel.style.left)
    const width = parseFloat(panel.style.width)
    // The right edge of the panel must clear the dock's left edge.
    const panelRight = left + width
    const dockLeft = VIEWPORT_W - 388 - 12
    expect(panelRight).toBeLessThanOrEqual(dockLeft)
    dock.unmount()
  })

  it('clamps a stored position that would land under the dock back into the visible canvas', () => {
    // Pre-place the panel at x=1200 (would overlap the dock).
    const dock = mountStubDock({ width: 388, right: 12 })
    useFloatingPanelState.setState({
      isOpen: true,
      source: 'user',
      userRepositioned: true,
      isMinimised: false,
      position: { x: 1200, y: 100 },
      size: { width: 400, height: 500 },
    } as any)
    render(<FloatingOlumiPanel onDock={() => {}} onCogClick={() => {}} />, { wrapper: Wrapper })
    const panel = document.querySelector('[data-testid="floating-olumi-panel"]') as HTMLElement
    const left = parseFloat(panel.style.left)
    const width = parseFloat(panel.style.width)
    const panelRight = left + width
    const dockLeft = VIEWPORT_W - 388 - 12
    expect(panelRight).toBeLessThanOrEqual(dockLeft)
    dock.unmount()
  })

  it('re-clamps when the dock width changes AFTER the panel is open (ResizeObserver path)', () => {
    // Start with the dock collapsed (rail = 40px + 12 right).
    const dock = mountStubDock({ width: 40, right: 12 })
    useFloatingPanelState.setState({
      isOpen: true,
      source: 'user',
      userRepositioned: true,
      isMinimised: false,
      // Park the panel at x=1000 — visible while dock is collapsed
      // (rail at left=1388), would overlap when dock expands.
      position: { x: 1000, y: 100 },
      size: { width: 400, height: 500 },
    } as any)
    render(<FloatingOlumiPanel onDock={() => {}} onCogClick={() => {}} />, { wrapper: Wrapper })
    const panel = document.querySelector('[data-testid="floating-olumi-panel"]') as HTMLElement
    // Initial layout with rail-width dock: panel right (1400) <= rail
    // left (1388)? Actually 1400 > 1388 — clamp moves panel left to
    // dockLeft - width − margin. Let's just assert the invariant.
    let left = parseFloat(panel.style.left)
    let width = parseFloat(panel.style.width)
    expect(left + width).toBeLessThanOrEqual(VIEWPORT_W - 40 - 12)

    // Now the dock expands (e.g. user clicked a tab → full 388px width).
    // Dispatch the dock-opened event the dock already emits; the
    // observer hook also re-runs on this. Even without ResizeObserver
    // support in jsdom, the event-driven recompute kicks in.
    act(() => {
      dock.setWidth(388)
      window.dispatchEvent(new Event('outputs-dock-opened'))
    })

    left = parseFloat(panel.style.left)
    width = parseFloat(panel.style.width)
    const dockLeftAfter = VIEWPORT_W - 388 - 12
    expect(left + width).toBeLessThanOrEqual(dockLeftAfter)
    dock.unmount()
  })

  it('auto-minimises to the pill when the dock leaves less than MIN_WIDTH × MIN_HEIGHT', () => {
    // 800x900 viewport with a 600px-wide dock + 12px gap → available
    // width = 800 - 32 - 612 = 156, well below MIN_WIDTH (320). The
    // layout effect must call minimise() instead of rendering a
    // too-narrow panel.
    Object.defineProperty(window, 'innerWidth', { value: 800, configurable: true })
    const dock = mountStubDock({ width: 600, right: 12 })
    dock.el.getBoundingClientRect = function () {
      const left = 800 - 600 - 12 // 188
      return { left, top: 60, right: 788, bottom: 888, width: 600, height: 828, x: left, y: 60, toJSON: () => ({}) } as DOMRect
    }
    useFloatingPanelState.setState({
      isOpen: true,
      source: 'user',
      userRepositioned: false,
      isMinimised: false,
      position: { x: 100, y: 100 },
      size: { width: 400, height: 500 },
    } as any)
    render(<FloatingOlumiPanel onDock={() => {}} onCogClick={() => {}} />, { wrapper: Wrapper })
    // After the layout effect runs, the store is minimised and the restore
    // pill is shown. Run-path convergence: the full panel now stays MOUNTED
    // but display:none while minimised (keeping ConversationPanel's
    // cross-surface run/ask registration alive), so instead of asserting it
    // is unmounted we assert it is present-but-hidden.
    expect(useFloatingPanelState.getState().isMinimised).toBe(true)
    expect(document.querySelector('[data-testid="floating-olumi-panel-pill"]')).toBeTruthy()
    const hiddenPanel = document.querySelector('[data-testid="floating-olumi-panel"]') as HTMLElement | null
    expect(hiddenPanel).toBeTruthy()
    expect(hiddenPanel?.style.display).toBe('none')
    dock.unmount()
    Object.defineProperty(window, 'innerWidth', { value: VIEWPORT_W, configurable: true })
  })

  it('first-open auto-minimise commits a safe pill anchor (no 50%/50% fallback under the dock)', () => {
    // Same narrow-viewport scenario as above, but with position=null
    // (first-open state). The bug: the pill's `position ? pos.x : '50%'`
    // fallback would render the pill at the centre, which lands under
    // the dock on narrow viewports. Fix: commit a top-left safe anchor
    // BEFORE calling minimise.
    Object.defineProperty(window, 'innerWidth', { value: 800, configurable: true })
    const dock = mountStubDock({ width: 600, right: 12 })
    dock.el.getBoundingClientRect = function () {
      const left = 800 - 600 - 12 // 188
      return { left, top: 60, right: 788, bottom: 888, width: 600, height: 828, x: left, y: 60, toJSON: () => ({}) } as DOMRect
    }
    // First-open: position is null in store.
    useFloatingPanelState.setState({
      isOpen: true,
      source: 'user',
      userRepositioned: false,
      isMinimised: false,
      position: null,
      size: { width: 400, height: 500 },
    } as any)
    render(<FloatingOlumiPanel onDock={() => {}} onCogClick={() => {}} />, { wrapper: Wrapper })
    expect(useFloatingPanelState.getState().isMinimised).toBe(true)
    const committed = useFloatingPanelState.getState().position
    // A safe anchor MUST have been committed — not null.
    expect(committed).not.toBeNull()
    // And it must be a real pixel position (not the 50% fallback). The
    // top-left margin (16, 16) is the canonical safe anchor.
    expect(committed!.x).toBe(16)
    expect(committed!.y).toBe(16)
    // Verify the pill's rendered style uses a numeric left/top, not 50%.
    const pill = document.querySelector('[data-testid="floating-olumi-panel-pill"]') as HTMLElement
    expect(pill).toBeTruthy()
    expect(pill.style.left).toBe('16px')
    expect(pill.style.top).toBe('16px')
    dock.unmount()
    Object.defineProperty(window, 'innerWidth', { value: VIEWPORT_W, configurable: true })
  })

  it('does NOT auto-minimise on a wide viewport (room remains for MIN_WIDTH)', () => {
    // 1440x900 with dock 400 + 12 → available = 1440 - 32 - 412 = 996
    // — comfortably above MIN_WIDTH. Panel must render normally.
    const dock = mountStubDock({ width: 400, right: 12 })
    useFloatingPanelState.setState({
      isOpen: true,
      source: 'user',
      userRepositioned: false,
      isMinimised: false,
      position: { x: 100, y: 100 },
      size: { width: 400, height: 500 },
    } as any)
    render(<FloatingOlumiPanel onDock={() => {}} onCogClick={() => {}} />, { wrapper: Wrapper })
    expect(useFloatingPanelState.getState().isMinimised).toBe(false)
    expect(document.querySelector('[data-testid="floating-olumi-panel"]')).toBeTruthy()
    dock.unmount()
  })

  it('reserves dock inset on a narrow viewport even when dock.left < vw/2', () => {
    // Narrow viewport: 900px. Dock 420px wide + 12 right gap → left=468,
    // which is > 450 (half of 900) on the nose. To exercise the
    // dock.left < vw/2 case we drop to 880x900: dock left=448 < 440.
    //
    // Crucially we also leave room above MIN_WIDTH (320): 880 - 32 - 432
    // = 416, well above MIN_WIDTH so the layout effect does NOT
    // auto-minimise — the panel renders and the left-clamp assertion
    // distinguishes the inset-applied path from the regression.
    Object.defineProperty(window, 'innerWidth', { value: 880, configurable: true })
    const dock = mountStubDock({ width: 420, right: 12 })
    dock.el.getBoundingClientRect = function () {
      const left = 880 - 420 - 12 // 448
      return { left, top: 60, right: 880 - 12, bottom: 900 - 12, width: 420, height: 800, x: left, y: 60, toJSON: () => ({}) } as DOMRect
    }
    useFloatingPanelState.setState({
      isOpen: true,
      source: 'user',
      userRepositioned: true,
      isMinimised: false,
      // Park at x=600 — under the dock if inset is dropped to 0,
      // clamped to the left margin (16) when inset is honoured.
      position: { x: 600, y: 100 },
      size: { width: 400, height: 500 },
    } as any)
    render(<FloatingOlumiPanel onDock={() => {}} onCogClick={() => {}} />, { wrapper: Wrapper })
    expect(useFloatingPanelState.getState().isMinimised).toBe(false)
    const panel = document.querySelector('[data-testid="floating-olumi-panel"]') as HTMLElement
    const left = parseFloat(panel.style.left)
    const width = parseFloat(panel.style.width)
    // Inset honoured → panel right edge must be ≤ dock left (448).
    expect(left + width).toBeLessThanOrEqual(448)
    dock.unmount()
    Object.defineProperty(window, 'innerWidth', { value: VIEWPORT_W, configurable: true })
  })

  // Note: the resize math is regression-tested as a pure function via
  // `computeResizeBudget` in FloatingOlumiPanel.clamp.spec — that's the
  // load-bearing assertion. The DOM-level drag plumbing isn't readily
  // testable in jsdom (no PointerEvent class, no layout-driven rect),
  // and exercising it here would only verify React's event delegation
  // (already covered by RTL's own tests).

  it('reclamps the minimised pill on viewport resize (no drift off-screen)', () => {
    // Start with the pill committed at x=1300 on a 1440px viewport
    // (where 1300 + 84-px pill + 16-px margin = 1400, still visible).
    useFloatingPanelState.setState({
      isOpen: true,
      source: 'user',
      userRepositioned: true,
      isMinimised: true,
      position: { x: 1300, y: 100 },
      size: { width: 400, height: 500 },
    } as any)
    render(<FloatingOlumiPanel onDock={() => {}} onCogClick={() => {}} />, { wrapper: Wrapper })
    expect(useFloatingPanelState.getState().position).toEqual({ x: 1300, y: 100 })

    // Shrink the viewport: 800px. The pill at x=1300 would now sit off-
    // screen. The resize handler must reclamp it back into view.
    Object.defineProperty(window, 'innerWidth', { value: 800, configurable: true })
    act(() => { window.dispatchEvent(new Event('resize')) })

    const after = useFloatingPanelState.getState().position
    // max pill x at 800 viewport = 800 - 84 - 16 = 700.
    expect(after).toBeTruthy()
    expect(after!.x).toBeLessThanOrEqual(700)
    // The automatic clamp is a geometry correction — it must NOT flip
    // userRepositioned. That flag is reserved for genuine user drags
    // (it gates auto-dock). If a future refactor swaps the direct
    // setState for `setPosition`, this assertion catches it.
    expect(useFloatingPanelState.getState().userRepositioned).toBe(true)
    Object.defineProperty(window, 'innerWidth', { value: VIEWPORT_W, configurable: true })
  })

  it('automatic minimised-pill clamp does NOT flip userRepositioned from false → true', () => {
    // System-opened panel (e.g. first-use), no user drag yet. The
    // automatic clamp on viewport resize must preserve userRepositioned
    // === false — otherwise the next 0→N node transition would skip
    // auto-dock (`canAutoDock` requires !userRepositioned).
    useFloatingPanelState.setState({
      isOpen: true,
      source: 'system-first-use',
      userRepositioned: false,
      isMinimised: true,
      position: { x: 1300, y: 100 },
      size: { width: 400, height: 500 },
    } as any)
    render(<FloatingOlumiPanel onDock={() => {}} onCogClick={() => {}} />, { wrapper: Wrapper })

    Object.defineProperty(window, 'innerWidth', { value: 800, configurable: true })
    act(() => { window.dispatchEvent(new Event('resize')) })

    const after = useFloatingPanelState.getState()
    // Position changed (clamped), but userRepositioned MUST stay false.
    expect(after.position!.x).toBeLessThanOrEqual(700)
    expect(after.userRepositioned).toBe(false)
    Object.defineProperty(window, 'innerWidth', { value: VIEWPORT_W, configurable: true })
  })

  it('1440 → 836 while minimised, then restore: shrinks width so the panel clears the dock', () => {
    // Reviewer-flagged smoke defect: at narrow viewport with dock open,
    // restoring the panel rendered at width 400 overlapping the dock.
    // Fix: layout effect now caps width at the available canvas
    // (vw - 2*margin - SIDE_TAB_WIDTH - dockInset), with MIN_WIDTH as
    // the floor. `fitsAtMinSize` guarantees the cap is ≥ MIN_WIDTH
    // (otherwise auto-minimise fires).
    //
    // Round-10 viewport bumped 800 → 836 (= 800 + SIDE_TAB_WIDTH) so the
    // same relative behaviour still has room for the side-tab inset.
    const dock = mountStubDock({ width: 416, right: 12 })
    useFloatingPanelState.setState({
      isOpen: true,
      source: 'user',
      userRepositioned: true,
      isMinimised: true,
      position: { x: 900, y: 100 },
      size: { width: 400, height: 500 },
    } as any)
    render(<FloatingOlumiPanel onDock={() => {}} onCogClick={() => {}} />, { wrapper: Wrapper })

    Object.defineProperty(window, 'innerWidth', { value: 836, configurable: true })
    act(() => { window.dispatchEvent(new Event('resize')) })
    act(() => { useFloatingPanelState.getState().restore() })

    // Available canvas: 836 - 32 - 36 (side tab) - 412 (dock from left edge)
    // = 356 (≥ MIN_WIDTH 320). The restored width must shrink to ≤ 356.
    const panel = document.querySelector('[data-testid="floating-olumi-panel"]') as HTMLElement
    expect(panel).toBeTruthy()
    const left = parseFloat(panel.style.left)
    const width = parseFloat(panel.style.width)
    expect(width).toBeLessThanOrEqual(356)
    expect(width).toBeGreaterThanOrEqual(320) // MIN_WIDTH preserved
    // Right edge must not overlap the dock (dock starts at 836 - 416 - 12 = 408).
    expect(left + width).toBeLessThanOrEqual(408)
    // userRepositioned preserved (geometry correction is not a user drag).
    expect(useFloatingPanelState.getState().userRepositioned).toBe(true)
    dock.unmount()
    Object.defineProperty(window, 'innerWidth', { value: VIEWPORT_W, configurable: true })
  })

  it('reclamps the minimised pill when the dock expands (no drift under dock)', () => {
    // Start with rail-width dock + pill at x=1300 on a 1440px viewport.
    const dock = mountStubDock({ width: 40, right: 12 })
    useFloatingPanelState.setState({
      isOpen: true,
      source: 'user',
      userRepositioned: true,
      isMinimised: true,
      position: { x: 1300, y: 100 },
      size: { width: 400, height: 500 },
    } as any)
    render(<FloatingOlumiPanel onDock={() => {}} onCogClick={() => {}} />, { wrapper: Wrapper })
    // At rail width the dock left = 1388; pill at x=1300 (right edge 1384) fits.
    expect(useFloatingPanelState.getState().position!.x).toBe(1300)

    // Dock expands to 388 + 12 → dock.left = 1040. Pill at x=1300 now
    // overlaps the dock. The dock-opened event fires (the dock dispatches
    // it on tab activation; we trigger directly here).
    act(() => {
      dock.setWidth(388)
      window.dispatchEvent(new Event('outputs-dock-opened'))
    })

    const after = useFloatingPanelState.getState().position
    // Pill width 84 + margin 16; dock at left=1040 → max pill x = 1040 - 84 - 16 = 940.
    expect(after).toBeTruthy()
    expect(after!.x).toBeLessThanOrEqual(940)
    dock.unmount()
  })

  it('treats an absent dock (FF-off, dock unmounted) as zero inset', () => {
    // No stub mounted. measureDockInset returns 0 → panel can extend to
    // the viewport's right margin minus default margin.
    useFloatingPanelState.setState({
      isOpen: true,
      source: 'user',
      userRepositioned: true,
      isMinimised: false,
      position: { x: 1000, y: 100 },
      size: { width: 400, height: 500 },
    } as any)
    render(<FloatingOlumiPanel onDock={() => {}} onCogClick={() => {}} />, { wrapper: Wrapper })
    const panel = document.querySelector('[data-testid="floating-olumi-panel"]') as HTMLElement
    const left = parseFloat(panel.style.left)
    const width = parseFloat(panel.style.width)
    // Max right edge = viewport - margin (16). Just assert no off-screen.
    expect(left + width).toBeLessThanOrEqual(VIEWPORT_W - 16)
  })
})
