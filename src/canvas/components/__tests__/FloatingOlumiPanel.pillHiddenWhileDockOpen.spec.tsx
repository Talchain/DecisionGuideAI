/**
 * ⭐ NO FLOATING "Olumi" PILL OVER THE CANVAS WHILE THE DOCK IS OPEN
 * (contract v3.1 DESIGN-GAP #29, 26 Sep 2026).
 *
 * MEASURED at base `6256a41f`, every starter at 1280x800 with the dock open
 * ('expanded'): the minimised floating panel's restore pill sat at
 * (752,756) 68x25 over the canvas, overlapping ghost "What else…" doors. v3.1
 * draws no such chrome. With the dock open the conversation is one tab away
 * (the dock's own Olumi tab), so the pill is redundant there; with the dock
 * collapsed or absent it is the way back and must stay.
 *
 * Harness: `FloatingOlumiPanel.dockInset.spec.tsx`'s (stubbed store with one
 * node, stub dock <aside>); the dock's open state is the persisted record the
 * panel already reads (`readPersistedDockOpen`).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render } from '@testing-library/react'
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
import { OUTPUTS_DOCK_STORAGE_KEY } from '../OutputsDock'

function Wrapper({ children }: { children: ReactNode }) {
  return <ConversationProvider>{children}</ConversationProvider>
}

const PILL = '[data-testid="floating-olumi-panel-pill"]'

function mountStubDock(width: number) {
  const el = document.createElement('aside')
  el.setAttribute('aria-label', 'Outputs dock')
  document.body.appendChild(el)
  el.getBoundingClientRect = () => {
    const left = window.innerWidth - width - 12
    return { left, top: 63, right: window.innerWidth - 12, bottom: window.innerHeight - 12, width, height: 700, x: left, y: 63, toJSON: () => ({}) } as DOMRect
  }
  return el
}

function persistDock(isOpen: boolean | null) {
  if (isOpen === null) sessionStorage.removeItem(OUTPUTS_DOCK_STORAGE_KEY)
  else sessionStorage.setItem(OUTPUTS_DOCK_STORAGE_KEY, JSON.stringify({ isOpen, activeTab: 'diagnostics' }))
}

function minimised() {
  useFloatingPanelState.setState({
    isOpen: true,
    source: 'user',
    isMinimised: true,
    position: { x: 100, y: 100 },
    size: { width: 400, height: 550 },
  } as never)
}

beforeEach(() => {
  Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true })
  Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true })
  useFloatingPanelState.getState().reset()
  canvasMockState.nodes = [{ id: 'n1' }]
})

afterEach(() => {
  document.body.querySelectorAll('aside[aria-label="Outputs dock"]').forEach((el) => el.remove())
  sessionStorage.removeItem(OUTPUTS_DOCK_STORAGE_KEY)
})

describe('the minimised Olumi pill and the open dock (v3.1 DESIGN-GAP #29)', () => {
  it('⛔ dock OPEN (persisted), on a Model tab: no pill over the canvas', () => {
    mountStubDock(416)
    persistDock(true)
    minimised()
    render(<FloatingOlumiPanel onDock={() => {}} />, { wrapper: Wrapper })
    expect(document.querySelector(PILL)).toBeNull()
  })

  it('⛔ dock OPEN by default (nothing persisted yet — the dock opens by default): no pill', () => {
    mountStubDock(416)
    persistDock(null)
    minimised()
    render(<FloatingOlumiPanel onDock={() => {}} />, { wrapper: Wrapper })
    expect(document.querySelector(PILL)).toBeNull()
  })

  it('CONTRAST: dock COLLAPSED — the pill is the way back, and it is there', () => {
    mountStubDock(40)
    persistDock(false)
    minimised()
    render(<FloatingOlumiPanel onDock={() => {}} />, { wrapper: Wrapper })
    const pill = document.querySelector(PILL)
    expect(pill).not.toBeNull()
    expect(pill).toHaveAttribute('aria-label', 'Restore Olumi')
  })

  it('CONTRAST: NO dock on the page at all — nothing else can host Olumi, the pill shows', () => {
    persistDock(true)
    minimised()
    render(<FloatingOlumiPanel onDock={() => {}} />, { wrapper: Wrapper })
    expect(document.querySelector(PILL)).not.toBeNull()
  })

  it('CONTRAST: an EMPTY canvas (no dock body to host Olumi) keeps the pill', () => {
    canvasMockState.nodes = []
    persistDock(true)
    minimised()
    render(<FloatingOlumiPanel onDock={() => {}} />, { wrapper: Wrapper })
    expect(document.querySelector(PILL)).not.toBeNull()
  })
})

describe('the dock’s RENDERED composition outranks the persisted record', () => {
  it('a dock rendered COLLAPSED shows the pill even while the stored record still says open', () => {
    // The collapse frame: the dock has re-rendered as the rail, and its
    // persisted record has not been written yet.
    const dock = mountStubDock(40)
    dock.setAttribute('data-panel-composition', 'collapsed')
    persistDock(true)
    minimised()
    render(<FloatingOlumiPanel onDock={() => {}} />, { wrapper: Wrapper })
    expect(document.querySelector(PILL)).not.toBeNull()
  })

  it('a dock rendered EXPANDED hides the pill even while the stored record still says closed', () => {
    const dock = mountStubDock(416)
    dock.setAttribute('data-panel-composition', 'expanded')
    persistDock(false)
    minimised()
    render(<FloatingOlumiPanel onDock={() => {}} />, { wrapper: Wrapper })
    expect(document.querySelector(PILL)).toBeNull()
  })
})
