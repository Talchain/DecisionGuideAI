/**
 * CHAT FIRST ON INITIAL MODEL GENERATION.
 *
 * Paul, 10 Sep 2026: "on initial model generation, the AI chat panel should be
 * displayed first."
 *
 * ── WHAT WAS MEASURED, AND WHY THIS SPEC EXISTS ───────────────────────────
 *
 * Fresh guest on `https://staging--olumi.netlify.app`, served build `65ef96d0`,
 * viewport 1440x900, sampled across the 0 -> 18-node draft transition:
 *
 *   - the dock expanded to 416x872 at (1012, 12) with ANALYSIS active
 *     (`outputs-dock-tab-results`);
 *   - the Olumi chat tab was NEVER selected at any sample;
 *   - the only AI surface on screen was `floating-olumi-panel-pill`
 *     (aria-label "Restore Olumi"), 68x25 px = 0.13% of the viewport;
 *   - `chat-thread` / `chat-message-user` / `chat-message-assistant` were all
 *     PRESENT IN THE DOM WITH CORRECT CONTENT and all measured 0x0.
 *
 * The 0x0 is the load-bearing detail. `olumi-tab-wrapper` is mounted
 * unconditionally whenever `aiPanelV2On` and carries `hidden` +
 * `aria-hidden` while another tab is active (`OutputsDock.tsx`, the
 * `effectiveActiveTab === 'olumi' ? '' : 'hidden'` wrapper). So the chat was
 * never missing and never "shunted into a corner" — it was a mounted,
 * correctly-populated transcript held at zero height by an active-tab
 * mismatch, plus a minimised floating panel reduced to a restore pill.
 *
 * The cause was ONE line: `FirstUseComposer` forced `'results'` (the ANALYSIS
 * tab — see `shellContract.ts`, which maps `results` -> label 'Analysis') on
 * the 0 -> N+ draft transition.
 *
 * ── WHAT THIS SPEC PINS, STATED NARROWLY ──────────────────────────────────
 *
 * ⚠ THIS SPEC PINS BEHAVIOUR AND TAB SELECTION ONLY. IT DOES NOT AND CANNOT
 * PROVE VISIBILITY. jsdom performs NO LAYOUT, so no assertion here can show
 * the transcript has non-zero height (platform trap 3, which has shipped dark
 * features in this repo twice). What it proves is that the draft transition
 * REQUESTS the Olumi surface through the forced-activation path that actually
 * opens a collapsed dock and ends the first-use rail. The visibility half is
 * a live measurement on the deployed build, recorded in the PR.
 *
 * Every assertion binds to its object by IDENTITY — the exact tab id, or the
 * repo's own exported predicates (`dockHostsOlumi`, `forcedActivationEndsRail`)
 * — never by a value predicate another tab could satisfy (platform trap 19).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }) }),
  },
  isSupabaseAvailable: () => false,
}))

const canvasMockState: {
  nodes: Array<{ id: string }>
  edges: Array<unknown>
  results: { status: string; hash?: string; graphHash?: string }
  _internal: { graphHash?: string }
  selection: null
} = { nodes: [], edges: [], results: { status: 'idle' }, _internal: {}, selection: null }
vi.mock('../../store', () => {
  const useCanvasStore: any = (selector: (s: any) => any) => selector(canvasMockState)
  useCanvasStore.getState = () => canvasMockState
  return {
    useCanvasStore,
    selectResultsStatus: (s: any) => s.results?.status,
    selectReport: (s: any) => s.results?.report,
    selectError: (s: any) => s.results?.error,
    selectResultsSource: (s: any) => s.results?.source,
  }
})
vi.mock('../../hooks/useStageAwarePlaceholder', () => ({
  useStageAwarePlaceholder: () => 'Describe your decision…',
}))
vi.mock('../../hooks/useSelectionContext', () => ({
  useSelectionContext: () => null,
}))

const messagesMockState: { messages: Array<{ id: string; role: string; synthetic?: boolean }> } = {
  messages: [],
}
const thinkingMockState: { isThinking: boolean } = { isThinking: false }
vi.mock('../../conversation/useConversation', async () => {
  const { useState } = await import('react')
  return {
    useConversation: () => {
      const [sendMessage] = useState(() => vi.fn())
      const [sendSystemEvent] = useState(() => vi.fn())
      const [sendChip] = useState(() => vi.fn())
      const [retryLast] = useState(() => vi.fn())
      const [setPatchBlockState] = useState(() => vi.fn())
      const [setPatchRejection] = useState(() => vi.fn())
      return {
        messages: messagesMockState.messages,
        isThinking: thinkingMockState.isThinking,
        longRunningHint: null,
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

const reducedMotionState: { value: boolean } = { value: false }
const plotTemplatesSpy = vi.fn(() => new Promise(() => {}))
vi.mock('../../../adapters/plot', () => ({
  plot: {
    templates: () => plotTemplatesSpy(),
  },
}))
vi.mock('../../hooks/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: () => reducedMotionState.value,
}))

import { ConversationProvider } from '../../conversation/ConversationContext'
import { FirstUseComposer } from '../FirstUseComposer'
import { useFloatingPanelState } from '../../hooks/useFloatingPanelState'
import { useUIStore } from '../../../stores/uiStore'
import { useTransitionReceipt } from '../../hooks/useTransitionReceipt'
import { dockHostsOlumi } from '../olumiSurface'
import { forcedActivationEndsRail } from '../OutputsDock'
import { isAiPanelV2Enabled } from '../../../flags'

function Wrapper({ children }: { children: ReactNode }) {
  return <ConversationProvider>{children}</ConversationProvider>
}

beforeEach(() => {
  useFloatingPanelState.getState().reset()
  useTransitionReceipt.getState().clear()
  useUIStore.setState({ activeOutputTab: 'results', activeOutputTabVersion: 0 })
  canvasMockState.nodes = []
  messagesMockState.messages = []
  thinkingMockState.isThinking = false
  reducedMotionState.value = false
  vi.useRealTimers()
})

/** The legitimate first-use path: the user types and sends from the hero. */
function driveUserSubmittedViaFirstUse(): { rerender: (ui: React.ReactElement) => void } {
  const { rerender } = render(<FirstUseComposer />, { wrapper: Wrapper })
  expect(useFloatingPanelState.getState().isOpen).toBe(true)
  expect(useFloatingPanelState.getState().source).toBe('system-first-use')
  const textarea = screen.getByTestId('first-use-input-bar-textarea') as HTMLTextAreaElement
  act(() => {
    fireEvent.change(textarea, { target: { value: 'help me decide which option' } })
  })
  act(() => {
    fireEvent.keyDown(textarea, { key: 'Enter' })
  })
  return { rerender }
}

/** Drive 0 -> N+ and flush the 300ms slide trigger, rAF and owner-clear. */
function driveDraftTransition(rerender: (ui: React.ReactElement) => void): void {
  act(() => {
    canvasMockState.nodes = [{ id: 'n1' }, { id: 'n2' }]
  })
  rerender(<FirstUseComposer />)
  act(() => {
    vi.advanceTimersByTime(800)
  })
}

describe("Paul 10 Sep: the AI chat is the landing surface on initial model generation", () => {
  it('forces the OLUMI tab — not Analysis — on the 0 -> N+ draft transition', () => {
    vi.useFakeTimers()
    const { rerender } = driveUserSubmittedViaFirstUse()

    // ⭐ PRECONDITION PINNED IN-TEST. Without this the assertions below could
    // pass on a store that was already 'olumi' for some unrelated reason, and
    // the test would be agreeing with itself (platform trap 13b). 'results' is
    // the ANALYSIS tab, i.e. exactly the measured defect state.
    expect(useUIStore.getState().activeOutputTab).toBe('results')
    expect(useUIStore.getState().activeOutputTabVersion).toBe(0)

    driveDraftTransition(rerender)

    // THE REQUEST: the chat surface, bound to its exact tab id.
    expect(useUIStore.getState().activeOutputTab).toBe('olumi')

    // Bound through the estate's OWN single source of truth for "the dock is
    // hosting the chat" rather than a bare string comparison. `olumiSurface.ts`
    // is that SoT; re-deriving the rule here would be a second copy of it.
    expect(
      dockHostsOlumi({
        dockEffectiveOpen: true,
        dockTab: useUIStore.getState().activeOutputTab as 'olumi',
      }),
    ).toBe(true)

    // ⭐ THE PROPERTY THAT MAKES "DISPLAYED" TRUE RATHER THAN MERELY SELECTED.
    // `forcedActivationEndsRail` is scoped to 'olumi' DELIBERATELY (OutputsDock
    // documents why). It is what clears the first-use rail so the dock opens to
    // its full width instead of staying a 40px rail with the tab "selected"
    // behind it. With the old 'results' activation this predicate returns FALSE
    // — so this assertion is the one that distinguishes the fix from a cosmetic
    // tab swap, and it genuinely fires (the sibling spec pins
    // forcedActivationEndsRail(true, 'results') === false).
    expect(forcedActivationEndsRail(true, useUIStore.getState().activeOutputTab)).toBe(true)

    // The FORCED path specifically: the version counter is what syncs a dock
    // whose own persisted tab differs, and what opens a collapsed dock.
    expect(useUIStore.getState().activeOutputTabVersion).toBe(1)
  })

  it('does NOT land the user on the Analysis tab (Paul: Reasoning + Model only)', () => {
    vi.useFakeTimers()
    const { rerender } = driveUserSubmittedViaFirstUse()
    driveDraftTransition(rerender)

    // Stated as its own case because it is its own standing ruling, and
    // because it is the assertion that REDs if someone repoints the transition
    // at Analysis under another name.
    expect(useUIStore.getState().activeOutputTab).not.toBe('results')
  })

  it('lands on no OTHER tab either — the chat is the one requested surface', () => {
    vi.useFakeTimers()
    const { rerender } = driveUserSubmittedViaFirstUse()
    driveDraftTransition(rerender)

    // A single "not results" assertion would stay GREEN if the transition were
    // repointed at 'diagnostics' or 'compare'. Enumerating every other tab is
    // what makes the binding exclusive rather than merely non-Analysis.
    const landed = useUIStore.getState().activeOutputTab
    for (const other of ['results', 'diagnostics', 'compare', 'journey'] as const) {
      expect(landed, `must not land on ${other}`).not.toBe(other)
    }
    expect(landed).toBe('olumi')
  })

  it('the Olumi tab it requests is REACHABLE under the deployed flag posture', () => {
    // `OutputsDock`'s E1 sync resolves an 'olumi' request to 'results' when
    // aiPanelV2 is off, which would make this whole fix dark without a single
    // failing test anywhere (platform trap: reachability within one surface is
    // not reachability in the system). Asserting the flag here makes that
    // dependency LOUD — if the default is ever flipped, this REDs and names
    // the reason instead of the product silently reverting to Analysis.
    // netlify.toml:75 bakes VITE_FEATURE_AI_PANEL_V2 = "true" for staging.
    expect(isAiPanelV2Enabled()).toBe(true)
  })

  it('still does NOT claim the dock on the hydration/import path (no user send)', () => {
    // The unrelated-behaviour half of the discriminating pair: the guard that
    // distinguishes a real first-use draft from session hydration must be
    // untouched by this change. Nodes appear with NO user message, so nothing
    // should be forced at all.
    vi.useFakeTimers()
    const { rerender } = render(<FirstUseComposer />, { wrapper: Wrapper })
    driveDraftTransition(rerender)

    expect(useUIStore.getState().activeOutputTab).toBe('results')
    expect(useUIStore.getState().activeOutputTabVersion).toBe(0)
  })
})
