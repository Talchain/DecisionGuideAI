/**
 * ROADMAP 2.204 — *Run analysis* must not strand its own output in a hidden tab.
 *
 * ## The defect, live-proven 31 Jul in a real browser
 * Clicking **Run analysis** switches the dock to the **Analysis** tab
 * (useConversation.ts:4041 `resultsAnalysing()` → OutputsDock's merged
 * auto-switch effect). The turn's own output — the decision-review card the
 * 2.154 work rescued — lands in the **Olumi** tab, whose wrapper then carries
 * `hidden` + `aria-hidden`. With the analysis complete the probe polled for
 * **180 s** and the container stayed at 0 px²; a single click on the Olumi tab
 * took it to 268,862 px².
 * (`PHASE0-EVIDENCE-2026-07-28/probe-2154-visibility.md` §4 Q1 CAVEAT;
 * `probe-premortem-live.md` §4 Q2.) A tester who clicks Run and stays where the
 * UI put them never sees it.
 *
 * ## What this file pins, and what it CANNOT
 * jsdom cannot prove visibility (platform trap 3), so nothing here claims a
 * pixel. What it pins is the STATE that decides visibility — the dock's active
 * tab, and the `hidden` class + `aria-hidden` the wrapper derives from it. That
 * is exactly the attribute the live probe measured resolving to `display: none`.
 * The pixel proof rides the post-deploy walk on staging.
 *
 * ## Why every "never yank" case is here
 * The fix's whole risk is over-firing: moving a user who chose where to be is a
 * worse defect than the one being fixed. Cases 2-5 are the load-bearing half —
 * a fix that passed only case 1 would be a fix that yanks everybody.
 */

import '@testing-library/jest-dom/vitest'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { ConversationMessage } from '../../conversation/types'
import type { ReportV1 } from '../../../adapters/plot/types'

// ---------------------------------------------------------------------------
// Heavy-import stubs — must precede any OutputsDock evaluation. Layout mirrors
// OutputsDock.conversationSingleton.spec.tsx (the established dock harness).
// ---------------------------------------------------------------------------
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
vi.mock('../../hooks/useV2Run', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hooks/useV2Run')>()
  return { ...actual, useV2Run: () => ({ runV2Analysis: vi.fn(), cancelRun: vi.fn() }) }
})
vi.mock('../pre-analysis', () => ({ PreAnalysisPanel: () => null }))
vi.mock('../../hooks/useGraphReadiness', () => ({
  useGraphReadiness: () => ({ readiness: { state: 'ready' } }),
}))
vi.mock('../../hooks/useStageAwarePlaceholder', () => ({
  useStageAwarePlaceholder: () => 'Describe your decision…',
}))

// Flags: spread the REAL module so a flag added later arrives with its real
// implementation (trap 12 — a hand-listed factory REPLACES the module and
// silently drops everything it forgot). `aiPanelV2` is left at its production
// default (ON, flags.ts:390) because the Olumi tab only exists under it — that
// default is part of what is under test. Only the noisy adjacent surfaces are
// forced off.
vi.mock('../../../flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../flags')>()
  return {
    ...actual,
    isTelemetryEnabled: () => false,
    isCompareTabEnabled: () => false,
    isJourneyTabEnabled: () => false,
    isOrchestratorV2Enabled: () => false,
    isLegacyDirectRunEnabled: () => true,
    isV5CanonicalAnalysisEnabled: () => false,
  }
})

// THE controllable conversation. ConversationProvider calls useConversation(),
// so swapping `convState.messages` and re-rendering delivers a new message list
// to the dock exactly as a live turn does.
const convState: { messages: ConversationMessage[] } = { messages: [] }
const conversationBase = {
  isThinking: false,
  longRunningHint: null as unknown,
  sendMessage: vi.fn(),
  sendSystemEvent: vi.fn(),
  sendChip: vi.fn(),
  retryLast: vi.fn(),
  patchBlockStates: new Map(),
  setPatchBlockState: vi.fn(),
  patchRejections: new Map(),
  setPatchRejection: vi.fn(),
}
// importOriginal, not a hand-listed factory: the module also exports pure
// helpers the render path calls (`isNonConversationalContent` in
// MessageBubble.tsx:193, among others). A factory that lists only the hook
// REPLACES the module and throws at first render — trap 12, and this spec hit
// it on its first run.
vi.mock('../../conversation/useConversation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../conversation/useConversation')>()
  return {
    ...actual,
    useConversation: () => ({ ...conversationBase, messages: convState.messages }),
  }
})

import { ConversationProvider } from '../../conversation/ConversationContext'
import { OutputsDock, OUTPUTS_DOCK_STORAGE_KEY } from '../OutputsDock'
import { useCanvasStore } from '../../store'
import { useUIStore } from '../../../stores/uiStore'
import { useFloatingPanelState } from '../../hooks/useFloatingPanelState'

function Wrapper({ children }: { children: ReactNode }) {
  return <ConversationProvider>{children}</ConversationProvider>
}

const RESPONSE_HASH = 'sha256:2204-run-return'

function minimalReport(): ReportV1 {
  return { summary: 'Option A currently leads.', options: [] } as unknown as ReportV1
}

/**
 * The turn's assistant message carrying the block that renders the
 * decision-review card. `type: 'v5_analysis_result'` is what mapV5Blocks.ts:62
 * emits for an `analysis_result` wire block and what InlineBlocks.tsx:412
 * dispatches to <V5AnalysisResultBlock>.
 */
function analysisTurnMessage(id: string): ConversationMessage {
  return {
    id,
    role: 'assistant',
    content: 'Here is what the analysis found.',
    timestamp: new Date(),
    blocks: [
      {
        type: 'v5_analysis_result',
        summary: 'Option A currently leads.',
        leading_option_id: 'opt-a',
        enrichment: { decision_review: { narrative_summary: 'Because…' } },
      },
    ],
  } as ConversationMessage
}

/** jsdom implements no layout, so ChatThread's smart-scroll effect
 *  (useSmartScroll.ts:33) has no `scrollIntoView` to call. */
function ensureScrollIntoView() {
  if (typeof Element.prototype.scrollIntoView !== 'function') {
    Element.prototype.scrollIntoView = vi.fn()
  }
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

/** The dock's own derivation of "the Olumi tab is showing": the wrapper drops
 *  its `hidden` class and flips `aria-hidden` (OutputsDock.tsx:2646-2648). */
function olumiTabIsFronted(): boolean {
  const wrapper = screen.getByTestId('olumi-tab-wrapper')
  return !wrapper.classList.contains('hidden') && wrapper.getAttribute('aria-hidden') === 'false'
}

/** Start on the Olumi tab with a populated canvas — the state the probes
 *  measured a tester in when they pressed Run (conversing, graph drafted). */
function seedDockOnOlumi() {
  sessionStorage.setItem(
    OUTPUTS_DOCK_STORAGE_KEY,
    JSON.stringify({ isOpen: true, activeTab: 'olumi' }),
  )
  useUIStore.setState({ activeOutputTab: 'olumi', activeOutputTabVersion: 0 })
}

function seedDockOnAnalysis() {
  sessionStorage.setItem(
    OUTPUTS_DOCK_STORAGE_KEY,
    JSON.stringify({ isOpen: true, activeTab: 'results' }),
  )
  useUIStore.setState({ activeOutputTab: 'results', activeOutputTabVersion: 0 })
}

/** The run STARTS: exactly the live shape — `resultsAnalysing`, never
 *  `resultsStart` (useConversation.ts:4041, and the store spec's own note). */
function startRun() {
  act(() => {
    useCanvasStore.getState().resultsAnalysing()
  })
}

/** The turn RETURNS: the analysis block lands in the conversation and the
 *  results store completes off the same turn (applyV5State.ts:1058-1064). */
function landAnalysisTurn(rerender: (ui: React.ReactElement) => void, id = 'm-analysis') {
  convState.messages = [...convState.messages, analysisTurnMessage(id)]
  act(() => {
    useCanvasStore.getState().resultsComplete({
      report: minimalReport(),
      hash: `${RESPONSE_HASH}-${id}`,
      resultsSource: 'conversation',
    })
  })
  act(() => {
    rerender(
      <Wrapper>
        <OutputsDock />
      </Wrapper>,
    )
  })
}

describe('ROADMAP 2.204 — the run returns the user to the surface it produced', () => {
  beforeEach(() => {
    ensureMatchMedia()
    ensureScrollIntoView()
    convState.messages = []
    try { sessionStorage.clear() } catch { /* private mode */ }
    try { localStorage.clear() } catch { /* private mode */ }
    useFloatingPanelState.getState().reset()
    useCanvasStore.getState().resetCanvas()
    // A populated canvas: without it the dock is forced to its 40px first-use
    // rail and hosts no tabs at all.
    useCanvasStore.getState().addNode(undefined, 'decision')
    useCanvasStore.setState({ results: { status: 'idle', progress: 0 } })
    useUIStore.setState({ activeOutputTab: 'results', activeOutputTabVersion: 0 })
  })

  it('THE DEFECT: Run navigates away from Olumi, and the completed analysis brings the user back', () => {
    seedDockOnOlumi()
    const { rerender } = render(
      <Wrapper>
        <OutputsDock />
      </Wrapper>,
    )

    // Precondition — the tester is reading the conversation.
    expect(olumiTabIsFronted()).toBe(true)

    // Half one of the defect, pinned so the fix cannot be mistaken for a
    // removal of the auto-switch: pressing Run DOES move them to Analysis.
    startRun()
    expect(olumiTabIsFronted()).toBe(false)
    expect(screen.getByTestId('olumi-tab-wrapper')).toHaveClass('hidden')

    // Half two — the defect itself. The analysis completes and its output
    // lands in the tab that is now hidden. BEFORE the fix the wrapper stays
    // `hidden` here forever (the probe polled 180 s); AFTER, the dock returns.
    landAnalysisTurn(rerender)

    expect(olumiTabIsFronted()).toBe(true)
    expect(screen.getByTestId('olumi-tab-wrapper')).not.toHaveClass('hidden')
    expect(useUIStore.getState().activeOutputTab).toBe('olumi')
  })

  it('NEVER YANK: a user who navigated to Analysis themselves is left there', () => {
    seedDockOnOlumi()
    const { rerender } = render(
      <Wrapper>
        <OutputsDock />
      </Wrapper>,
    )
    startRun()

    // The user makes their own choice mid-run: they click the Analysis tab.
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Analysis' }))
    })

    landAnalysisTurn(rerender)

    expect(olumiTabIsFronted()).toBe(false)
    expect(screen.getByTestId('olumi-tab-wrapper')).toHaveClass('hidden')
  })

  it('NEVER YANK: a user already on Analysis when they pressed Run is left there', () => {
    // Nothing auto-switched, so there is no one to return.
    seedDockOnAnalysis()
    const { rerender } = render(
      <Wrapper>
        <OutputsDock />
      </Wrapper>,
    )
    expect(olumiTabIsFronted()).toBe(false)

    startRun()
    landAnalysisTurn(rerender)

    expect(olumiTabIsFronted()).toBe(false)
    expect(screen.getByTestId('olumi-tab-wrapper')).toHaveClass('hidden')
  })

  it('NEVER YANK: a user interacting with the Analysis tab during the run is left there', () => {
    seedDockOnOlumi()
    const { rerender } = render(
      <Wrapper>
        <OutputsDock />
      </Wrapper>,
    )
    startRun()
    expect(olumiTabIsFronted()).toBe(false)

    // Deliberate engagement anywhere inside the dock while the run is in
    // flight — the honest "I am busy here" signal, derived from a real event
    // rather than an enumerated list of controls.
    act(() => {
      fireEvent.pointerDown(screen.getByTestId('outputs-dock'))
    })

    landAnalysisTurn(rerender)

    expect(olumiTabIsFronted()).toBe(false)
    expect(screen.getByTestId('olumi-tab-wrapper')).toHaveClass('hidden')
  })

  it('NEVER YANK: a user SCROLL-READING the Analysis tab during the run is left there', () => {
    // AMENDMENT A1. A pointerdown/keydown pair cannot see a trackpad or wheel
    // scroll, and the dock body is `overflow-y-auto` — so the most likely
    // waiting behaviour of all (scroll-reading the Analysis tab while the run
    // finishes) read as "passive" and got yanked mid-read when the block landed.
    //
    // ⚠ The fix is `onWheelCapture`, NOT `onScrollCapture`: ChatThread's
    // useSmartScroll calls `scrollIntoView` programmatically
    // (useSmartScroll.ts:33), which emits a `scroll` event with no user behind
    // it — listening for `scroll` would suppress the return for exactly the
    // passive tester this whole row exists to serve.
    seedDockOnOlumi()
    const { rerender } = render(
      <Wrapper>
        <OutputsDock />
      </Wrapper>,
    )
    startRun()
    expect(olumiTabIsFronted()).toBe(false)

    // Fired on the dock BODY, not the root: the scrollable region the user
    // actually reads in, which also proves the capture reaches a descendant.
    act(() => {
      fireEvent.wheel(screen.getByTestId('outputs-dock-body'))
    })

    landAnalysisTurn(rerender)

    expect(olumiTabIsFronted()).toBe(false)
    expect(screen.getByTestId('olumi-tab-wrapper')).toHaveClass('hidden')
  })

  it('NEVER YANK: a run that landed nothing must not arm the NEXT run\'s return', async () => {
    // AMENDMENT A2. The auto-switch record was only ever SET true, never
    // cleared, so it survived a run that produced no block (error / cancel /
    // the useV2Run path). The user then sat on Analysis, ran again FROM
    // Analysis — a run that switched nothing and therefore earns no return —
    // and was yanked on the new arrival by run ONE's stale record. That
    // contradicts runReturnSignal.ts's own stated invariant.
    //
    // Reachability is exact, not hypothetical: `resultsSettle` acts only from
    // 'preparing' and, with no report to restore, lands on **'idle'**
    // (store.ts:3343-3365). 'idle' is what makes the SECOND run's
    // `wasInactive` true, so the record site is genuinely re-entered.
    seedDockOnOlumi()
    const { rerender } = render(
      <Wrapper>
        <OutputsDock />
      </Wrapper>,
    )

    // Run 1 — moves them to Analysis (record armed), then settles with no
    // report: the failure/cancel shape.
    startRun()
    expect(olumiTabIsFronted()).toBe(false)
    act(() => {
      useCanvasStore.getState().resultsSettle()
    })
    expect(useCanvasStore.getState().results.status).toBe('idle')

    // The merged effect debounces re-entry within 50ms (its React #185 fix),
    // so a second run dispatched in the same millisecond would never reach the
    // record at all and this test would pass by testing nothing. The wait is
    // what makes it exercise the line it names.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 60))
    })

    // Run 2 — dispatched while they are ALREADY on Analysis (e.g. the canvas
    // toolbar / palette, outside the dock, so no interaction event fires).
    // This run switches nothing, so it must NOT earn a return.
    startRun()
    landAnalysisTurn(rerender)

    expect(olumiTabIsFronted()).toBe(false)
    expect(screen.getByTestId('olumi-tab-wrapper')).toHaveClass('hidden')
  })

  it('RERUN: the return waits for the NEW analysis, and does not fire on the old one', () => {
    // ⚠ This test exists because a mutant SURVIVED without it. Changing the
    // trigger from "a new analysis-result block ARRIVED"
    // (`reviewBlockCount > previousCount`) to "one EXISTS"
    // (`reviewBlockCount > 0`) left every other test green — the reload test
    // below is gated by the auto-switch record, not by the arrival check, so
    // it could not see the difference. On a RERUN the two come apart: the
    // transcript already holds the previous run's block, so a presence check
    // would return the user the instant they pressed Rerun, mid-analysis,
    // before anything new had landed.
    convState.messages = [analysisTurnMessage('m-previous-run')]
    seedDockOnOlumi()
    const { rerender } = render(
      <Wrapper>
        <OutputsDock />
      </Wrapper>,
    )
    expect(olumiTabIsFronted()).toBe(true)

    // Rerun pressed: the dock moves to Analysis, and the previous run's block
    // is still sitting in the transcript.
    startRun()
    expect(olumiTabIsFronted()).toBe(false)

    // Mid-run re-render with NOTHING new: the user must stay on the numbers
    // they are waiting for.
    act(() => {
      rerender(
        <Wrapper>
          <OutputsDock />
        </Wrapper>,
      )
    })
    expect(olumiTabIsFronted()).toBe(false)
    expect(screen.getByTestId('olumi-tab-wrapper')).toHaveClass('hidden')

    // The NEW analysis lands — now the return fires.
    landAnalysisTurn(rerender, 'm-rerun')
    expect(olumiTabIsFronted()).toBe(true)
  })

  it('NEVER YANK: a returning session whose transcript already holds an analysis is not moved', () => {
    // A page reload with a completed analysis in the conversation must not
    // fire the return. Honest note on what guards this: no run happened, so
    // the auto-switch record is false and the conjunction fails there — the
    // arrival check is NOT what this case exercises (see the rerun test
    // above, which is the one that isolates it).
    convState.messages = [analysisTurnMessage('m-historical')]
    seedDockOnAnalysis()
    const { rerender } = render(
      <Wrapper>
        <OutputsDock />
      </Wrapper>,
    )

    act(() => {
      rerender(
        <Wrapper>
          <OutputsDock />
        </Wrapper>,
      )
    })

    expect(olumiTabIsFronted()).toBe(false)
    expect(screen.getByTestId('olumi-tab-wrapper')).toHaveClass('hidden')
  })
})
