/**
 * The Stop control on the LIVE composer (ROADMAP 2.134).
 *
 * ── WHY THIS SPEC EXISTS ─────────────────────────────────────────────────
 * #525 shipped a correct, three-times-reviewed, mutation-pinned abort path for
 * the streamed draft: abort after GRAPH_READY keeps the structure, marks the
 * phase `unsettled`, holds the run gate shut and renders `STOPPED_DRAFT_NOTICE`.
 * Nothing on the live path could trigger it.
 *
 * The final measurement proved the gap with a positive control
 * (`PHASE0-EVIDENCE-2026-07-28/M1L2-FINAL-MEASUREMENT-2026-07-30.md` §5): zero
 * stop/cancel/abort/halt controls at eight stages of the journey, an injected
 * synthetic one found by the same scanner. The mount trace
 * (`PHASE0-EVIDENCE-2026-07-28/fix-2134-stop.md` §1) then established why: the
 * only `stop-button` in the codebase lives in `ChatComposer`, whose sole host
 * (`DraftChat`) is unmounted whenever AI Panel v2 is on — and `netlify.toml:50`
 * forces it on for the deployed staging build.
 *
 * `AIInputBar` is the composer that DOES render (strip · floating · first-use ·
 * welcome · docked-tab), so the affordance belongs here — one edit, every live
 * surface.
 *
 * ── WHAT THIS SPEC CAN AND CANNOT PROVE ──────────────────────────────────
 * jsdom proves PRESENCE and WIRING. It cannot prove VISIBILITY — not layout, not
 * stacking, not that the control is above the fold on a real viewport. The live
 * proof is a post-deploy browser capture, and no claim of visibility is made
 * here (trap 3).
 *
 * ── THE ABSENCE ASSERTIONS ARE NOT VACUOUS (trap 13) ─────────────────────
 * Every negative case below uses `queryStop()` — the SAME query the positive
 * cases use to FIND the control. A query that could not see a present Stop would
 * fail the first three tests in this file, so the absence tests cannot pass by
 * testing nothing.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { ReactNode } from 'react'

const { cancelTurnSpy } = vi.hoisted(() => ({ cancelTurnSpy: vi.fn() }))

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }) }),
  },
  isSupabaseAvailable: () => false,
}))
vi.mock('dompurify', () => ({ default: { sanitize: (s: string) => s } }))
vi.mock('../../utils/markdown', () => ({
  renderMarkdown: (s: string) => s,
  sanitiseMarkdown: (s: string) => s,
}))

const SCENARIO_A = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'
const SCENARIO_B = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb'

const canvasMockState: { nodes: Array<{ id: string }>; currentScenarioId: string | null } = {
  nodes: [],
  currentScenarioId: SCENARIO_A,
}
vi.mock('../../store', () => ({
  useCanvasStore: (selector: (s: unknown) => unknown) => selector(canvasMockState),
}))

/**
 * The store HOOK is mocked; the derived helpers (`draftStreamPhaseFor`,
 * `draftStreamInFlight`) are the REAL ones, via `importOriginal` spread.
 *
 * This matters twice over. (a) A `vi.mock` factory REPLACES the module, so a
 * hand-listed factory silently drops every other export — the exact trap-12
 * defect that once killed 51 tests in this repo. (b) If the helpers were stubbed
 * here, this spec would be testing a copy of the ownership rule rather than the
 * one the component ships with.
 */
const draftMockState: {
  draftStreamPhase: string
  draftStreamScenarioId: string | null
  draftStreamTurnId: string | null
} = { draftStreamPhase: 'idle', draftStreamScenarioId: null, draftStreamTurnId: null }
vi.mock('../../stores/draftStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../stores/draftStore')>()
  return {
    ...actual,
    useDraftStore: (selector: (s: unknown) => unknown) => selector(draftMockState),
  }
})

vi.mock('../../hooks/useStageAwarePlaceholder', () => ({
  useStageAwarePlaceholder: () => 'Ask about this model…',
}))
vi.mock('../../hooks/useSelectionContext', () => ({ useSelectionContext: () => null }))

const conversationMockState = { messages: [] as unknown[], isThinking: false }
vi.mock('../../conversation/useConversation', async () => {
  const { useState } = await import('react')
  return {
    useConversation: () => {
      const [sendMessage] = useState(() => vi.fn())
      const [sendSystemEvent] = useState(() => vi.fn())
      const [sendChip] = useState(() => vi.fn())
      const [dispatchAction] = useState(() => vi.fn())
      const [retryLast] = useState(() => vi.fn())
      const [setPatchBlockState] = useState(() => vi.fn())
      const [setPatchRejection] = useState(() => vi.fn())
      return {
        messages: conversationMockState.messages,
        isThinking: conversationMockState.isThinking,
        longRunningHint: null,
        sendMessage,
        sendSystemEvent,
        sendChip,
        dispatchAction,
        retryLast,
        cancelTurn: cancelTurnSpy,
        patchBlockStates: new Map(),
        setPatchBlockState,
        patchRejections: new Map(),
        setPatchRejection,
      }
    },
  }
})

import { ConversationProvider } from '../../conversation/ConversationContext'
import { AIInputBar } from '../AIInputBar'

function Wrapper({ children }: { children: ReactNode }) {
  return <ConversationProvider>{children}</ConversationProvider>
}

beforeEach(() => {
  canvasMockState.nodes = []
  canvasMockState.currentScenarioId = SCENARIO_A
  draftMockState.draftStreamPhase = 'idle'
  draftMockState.draftStreamScenarioId = null
  draftMockState.draftStreamTurnId = null
  conversationMockState.isThinking = false
  conversationMockState.messages = []
  cancelTurnSpy.mockClear()
})

/** The ONE query. Presence tests prove it is not blind; absence tests reuse it. */
function queryStop(): HTMLElement | null {
  return screen.queryByTestId('gen-stop')
}

function renderBar() {
  render(<AIInputBar variant="first-use" hideChevron testId="gen" onCogClick={() => {}} />, {
    wrapper: Wrapper,
  })
}

/** Put the component in "a streamed draft owned by the open scenario is live". */
function draftInFlight(phase: 'drafting' | 'settling', owner: string | null = SCENARIO_A) {
  conversationMockState.isThinking = true
  draftMockState.draftStreamPhase = phase
  draftMockState.draftStreamScenarioId = owner
  draftMockState.draftStreamTurnId = 'turn-1'
}

describe('AIInputBar — Stop is REACHABLE while a streamed draft is in flight', () => {
  it('renders a Stop control before GRAPH_READY (phase `drafting`)', () => {
    draftInFlight('drafting')
    renderBar()
    const stop = queryStop()
    expect(stop).not.toBeNull()
    expect(stop).toBeEnabled()
    // The scanner in the live measurement matched on /stop/i over innerText,
    // aria-label, data-testid and className. Keep the accessible name in that
    // set so the same detector finds this one post-deploy.
    expect(stop).toHaveAttribute('aria-label', expect.stringMatching(/stop/i))
  })

  it('renders it through SETTLING — the ~25 s window after the graph lands', () => {
    // The state a tester is MOST likely to reach for Stop in: the model is on
    // the canvas at ~36 s and the spinner reads as vestigial, while the turn
    // runs on to ~61 s. It is also the only window in which the abort has
    // anything to mark.
    draftInFlight('settling')
    renderBar()
    expect(queryStop()).not.toBeNull()
  })

  it('clicking it calls cancelTurn exactly once — the SAME path #525 pinned', () => {
    // `cancelTurn` aborts `abortRef`, which is the controller
    // `runStreamedDraftTurn` was handed (useConversation.ts:4194). Everything
    // downstream — `unsettled`, structure kept + marked, gate shut,
    // STOPPED_DRAFT_NOTICE — is #525's machinery, unchanged by this slice.
    draftInFlight('settling')
    renderBar()
    fireEvent.click(queryStop()!)
    expect(cancelTurnSpy).toHaveBeenCalledTimes(1)
  })

  it('takes the Send slot rather than sitting beside it', () => {
    // Mirrors ChatComposer's own `isThinking ? <stop> : <send>` swap. Send is
    // disabled throughout this window anyway, so nothing is lost, and two
    // circular buttons in one corner cannot be confused for one another.
    draftInFlight('drafting')
    renderBar()
    expect(queryStop()).not.toBeNull()
    expect(screen.queryByTestId('gen-send')).toBeNull()
  })
})

describe('AIInputBar — Stop is ABSENT everywhere the abort semantics do not apply', () => {
  it('is absent when nothing is in flight', () => {
    renderBar()
    expect(queryStop()).toBeNull()
    expect(screen.queryByTestId('gen-send')).not.toBeNull()
  })

  it('is absent during a non-draft turn on a populated canvas (chat / analysis run)', () => {
    // `isThinking` is true for EVERY turn — a Run dispatch included. Gating on
    // it alone would hand the user a Stop over an analysis, whose abort has none
    // of #525's semantics and nothing to mark. The phase conjunct is what makes
    // this control draft-specific.
    conversationMockState.isThinking = true
    canvasMockState.nodes = [{ id: 'n1' }, { id: 'n2' }]
    draftMockState.draftStreamPhase = 'idle'
    renderBar()
    expect(queryStop()).toBeNull()
  })

  it('is absent in the terminal `unsettled` phase', () => {
    // Drafting has already ENDED here (this is the state a Stop click produces).
    // A Stop control over it would be a control that stops nothing.
    conversationMockState.isThinking = true
    draftMockState.draftStreamPhase = 'unsettled'
    draftMockState.draftStreamScenarioId = SCENARIO_A
    renderBar()
    expect(queryStop()).toBeNull()
  })

  it('is absent when the in-flight draft belongs to ANOTHER scenario (review F2)', () => {
    // The phase is a per-scenario fact. Showing Stop on scenario B for a draft
    // owned by scenario A is the same class of error F2 found in the run gate —
    // one scenario's state asserted over every other.
    draftInFlight('settling', SCENARIO_B)
    canvasMockState.currentScenarioId = SCENARIO_A
    renderBar()
    expect(queryStop()).toBeNull()
  })
})
