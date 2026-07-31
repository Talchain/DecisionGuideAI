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

/**
 * ROADMAP 2.204-R3 — a recorder, not a counter.
 *
 * The residual is not "was a scroll requested" (one always is) but "WHICH
 * element, with WHICH alignment, and was the tab still `hidden` when it was
 * asked". Recording the receiver and the wrapper's state at call time is what
 * separates the pre-existing no-op from the fix; a bare `toHaveBeenCalled()`
 * would have passed against the defect.
 */
interface RecordedScroll {
  target: Element
  opts: ScrollIntoViewOptions | boolean | undefined
  wrapperHidden: boolean
}

function recordScrollIntoView(): { calls: RecordedScroll[]; restore: () => void } {
  const proto = Element.prototype as unknown as {
    scrollIntoView?: (arg?: ScrollIntoViewOptions | boolean) => void
  }
  const previous = proto.scrollIntoView
  const calls: RecordedScroll[] = []
  proto.scrollIntoView = function (this: Element, opts?: ScrollIntoViewOptions | boolean) {
    const wrapper = document.querySelector('[data-testid="olumi-tab-wrapper"]')
    calls.push({
      target: this,
      opts,
      wrapperHidden: wrapper ? wrapper.classList.contains('hidden') : true,
    })
  }
  return {
    calls,
    restore: () => {
      proto.scrollIntoView = previous
    },
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

/**
 * ROADMAP 2.204-R3 — the return must land ON the card, not 2,248 px above it.
 *
 * ## The residual, live-measured
 * `probe-2204-pixel-walk.md` §7: the return fires (2/2 passive runs), the card
 * renders (`area` 0 → ~300,000 px²) — and the thread is left `scrollTop 843`,
 * `distFromBottom 2248`, byte-stable for 60 s, with the card's top 47.5 px below
 * the `chat-thread` fold and all five 2.154 prose fields at 0 clipped-visible
 * area. `new-messages-pill` reads FALSE, so nothing signals content below.
 *
 * ## The cause — the walk's recorded lead is REFUTED
 * The lead was "the result arrives as `blocks[]` on an EXISTING message, so
 * `messageCount` never changes and the scroll effect never fires". False on the
 * live path: `useConversation.ts:4717` calls `addMessage` with the turn's blocks
 * attached — a NEW message. (Blocks-onto-an-existing-message is the STREAMING
 * route, `useConversation.ts:5247`, which the walk's single non-streaming
 * `POST /proxy/v5/turn` per leg did not take.)
 *
 * The real cause is ORDERING. React runs child effects before parent effects, so
 * `ChatThread`'s smart-scroll effect fires in the commit that lands the message —
 * while the thread is still inside the Olumi wrapper's `hidden` (`display: none`)
 * subtree, where an element has no layout box and `scrollIntoView` is a no-op.
 * `OutputsDock`'s 2.204 return un-hides the tab in a LATER commit, and nothing
 * re-issues the scroll. Measured directly by the first test below.
 *
 * ## What these tests pin, and what they CANNOT
 * jsdom implements no layout (platform trap 3), so nothing here claims a pixel.
 * They pin the STATE that decides the pixels: which element the scroll targets,
 * with which alignment, and whether the tab was fronted when it was asked. The
 * pixel proof rides the post-deploy walk leg.
 */
describe('ROADMAP 2.204-R3 — the return lands on the arriving card', () => {
  beforeEach(() => {
    ensureMatchMedia()
    ensureScrollIntoView()
    convState.messages = []
    try { sessionStorage.clear() } catch { /* private mode */ }
    try { localStorage.clear() } catch { /* private mode */ }
    useFloatingPanelState.getState().reset()
    useCanvasStore.getState().resetCanvas()
    useCanvasStore.getState().addNode(undefined, 'decision')
    useCanvasStore.setState({ results: { status: 'idle', progress: 0 } })
    useUIStore.setState({ activeOutputTab: 'results', activeOutputTabVersion: 0 })
  })

  it('THE CAUSE: the thread\'s own scroll-to-bottom is issued while the tab is STILL hidden', () => {
    // The diagnosis, pinned as a test rather than left in a document — this is
    // the input that makes the fix necessary, and a future change to
    // useSmartScroll that invalidates it SHOULD force this file to be re-read.
    seedDockOnOlumi()
    const { rerender } = render(
      <Wrapper>
        <OutputsDock />
      </Wrapper>,
    )
    startRun()

    const probe = recordScrollIntoView()
    try {
      landAnalysisTurn(rerender)

      // useSmartScroll took its scrollToBottom branch: the listEndRef sentinel
      // (ChatThread.tsx:213), `{ behavior: 'smooth' }`, no `block`.
      const bottomPin = probe.calls.find(
        (c) =>
          c.target.getAttribute('data-testid') === null &&
          typeof c.opts === 'object' &&
          c.opts !== null &&
          (c.opts as ScrollIntoViewOptions).block === undefined,
      )
      expect(bottomPin).toBeDefined()
      // …and it was asked for while the wrapper still carried `hidden`. In a
      // real browser that subtree has no layout box, so this call does nothing.
      expect(bottomPin?.wrapperHidden).toBe(true)
      // The tab is fronted only AFTERWARDS, by the 2.204 return.
      expect(olumiTabIsFronted()).toBe(true)
    } finally {
      probe.restore()
    }
  })

  it('THE RESIDUAL: the arriving card\'s TOP is scrolled into view, after the tab is fronted', () => {
    seedDockOnOlumi()
    const { rerender } = render(
      <Wrapper>
        <OutputsDock />
      </Wrapper>,
    )
    startRun()
    expect(olumiTabIsFronted()).toBe(false)

    const probe = recordScrollIntoView()
    try {
      landAnalysisTurn(rerender)

      expect(olumiTabIsFronted()).toBe(true)
      const card = screen.getByTestId('v5-analysis-result')
      const cardScrolls = probe.calls.filter((c) => c.target === card)

      // The card itself is the target — not the thread's end sentinel, whose
      // bottom-pin would land the tester PAST a 1,218 px card in a 676 px
      // scrollport (measured geometry, pixel walk §7).
      expect(cardScrolls).toHaveLength(1)
      // `block: 'start'` — its TOP, which is where the five 2.154 prose fields
      // begin. Any other alignment leaves them below the fold again.
      expect(cardScrolls[0].opts).toMatchObject({ block: 'start' })
      // And it is asked for only once the wrapper has dropped `hidden`, so the
      // element has a layout box to scroll. This is the whole fix.
      expect(cardScrolls[0].wrapperHidden).toBe(false)
    } finally {
      probe.restore()
    }
  })

  it('NEVER YANK: a user interacting with the Analysis tab is neither returned NOR scrolled', () => {
    // The scroll inherits 2.204's interaction discipline wholesale rather than
    // carrying a second, drifting copy of it: same record, same gates. Without
    // this case the fix could over-fire on exactly the user 2.204 protects.
    seedDockOnOlumi()
    const { rerender } = render(
      <Wrapper>
        <OutputsDock />
      </Wrapper>,
    )
    startRun()
    act(() => {
      fireEvent.wheel(screen.getByTestId('outputs-dock-body'))
    })

    const probe = recordScrollIntoView()
    try {
      landAnalysisTurn(rerender)

      expect(olumiTabIsFronted()).toBe(false)
      // The card is in the DOM (inside the hidden wrapper) — so this absence is
      // an absence of SCROLLING, not an absence of the element (trap 13).
      const card = screen.getByTestId('v5-analysis-result')
      expect(card).toBeInTheDocument()
      expect(probe.calls.filter((c) => c.target === card)).toHaveLength(0)
    } finally {
      probe.restore()
    }
  })

  it('ONE SCROLL PER ARRIVAL: navigating away and back does not re-scroll the user onto the card', () => {
    // The scroll effect has to wait for `state.activeTab` to become 'olumi',
    // which is also what every manual tab click produces. Without a token that
    // is SPENT, each later return to the Olumi tab would drag the user back onto
    // the card and away from wherever they had scrolled — a yank, delivered by
    // the fix meant to prevent one.
    seedDockOnOlumi()
    const { rerender } = render(
      <Wrapper>
        <OutputsDock />
      </Wrapper>,
    )
    startRun()
    landAnalysisTurn(rerender)
    expect(olumiTabIsFronted()).toBe(true)

    const probe = recordScrollIntoView()
    try {
      const card = screen.getByTestId('v5-analysis-result')
      act(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Analysis' }))
      })
      expect(olumiTabIsFronted()).toBe(false)
      act(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Olumi' }))
      })
      expect(olumiTabIsFronted()).toBe(true)

      // The arrival's scroll already happened, before this recorder was
      // installed. Nothing new may be issued at the card.
      expect(probe.calls.filter((c) => c.target === card)).toHaveLength(0)
    } finally {
      probe.restore()
    }
  })

  it('RERUN: the SECOND analysis card is the one scrolled to, not the first', () => {
    // The scroll must follow the arrival, not the transcript: a rerun leaves the
    // previous run's card in the thread, and scrolling to that one would park the
    // tester on stale numbers. Pins that the target is derived from the DOM at
    // scroll time (last card), not from a remembered element.
    //
    // The previous run's card is SEEDED into the transcript rather than produced
    // by a second live run: `resultsComplete` leaves the store on 'complete', so
    // the merged auto-switch effect's `wasInactive` gate never re-arms within one
    // test and a second `startRun()` would switch nothing. Same construction, for
    // the same reason, as the 2.204 RERUN case above.
    convState.messages = [analysisTurnMessage('m-previous-run')]
    seedDockOnOlumi()
    const { rerender } = render(
      <Wrapper>
        <OutputsDock />
      </Wrapper>,
    )
    expect(olumiTabIsFronted()).toBe(true)

    startRun()
    expect(olumiTabIsFronted()).toBe(false)

    const probe = recordScrollIntoView()
    try {
      landAnalysisTurn(rerender, 'm-rerun')

      expect(olumiTabIsFronted()).toBe(true)
      const cards = screen.getAllByTestId('v5-analysis-result')
      expect(cards).toHaveLength(2)
      const scrolled = probe.calls.filter((c) => cards.includes(c.target as HTMLElement))
      expect(scrolled).toHaveLength(1)
      expect(scrolled[0].target).toBe(cards[1])
    } finally {
      probe.restore()
    }
  })
})
