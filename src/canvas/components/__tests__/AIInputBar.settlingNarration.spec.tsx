/**
 * The composer's wait narration across the STREAMED draft's two phases
 * (ROADMAP 2.122).
 *
 * ── WHY THIS SPEC EXISTS ─────────────────────────────────────────────────
 * `AIInputBar` is the ONLY live narration surface on the V5 draft path
 * (complete manifest in `PHASE0-EVIDENCE-2026-07-28/m1l2-consumer.md` F0-3;
 * `DraftChat`'s `DraftLoadingAnimation` hangs off `useCEEDraft`, the legacy
 * `/bff/cee/draft-graph` hook the orchestrator path returns before reaching).
 *
 * Its gate was `isThinking && nodeCount === 0`. On the streamed path the graph
 * lands at ~36 s and the turn runs on to ~61 s — so that gate goes FALSE while
 * `isThinking` stays true, and the composer would sit frozen with no status
 * line for ~25 s. The streamed render CREATES that silence, so the widened gate
 * is part of the feature, not decoration, and it needs a pin: without one, a
 * mutant that reverts the gate is invisible.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'

import {
  PROGRESSIVE_STAGES,
  SETTLING_STAGES,
  SETTLING_AFTER_COACHING_STAGES,
} from '../DraftLoadingAnimation'

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

/**
 * ROADMAP 2.134: the composer now reads the phase THROUGH `draftStreamPhaseFor`
 * (review F2 — scoped to the open scenario) instead of the raw store field, so
 * these two mock states carry the scenario id the real helper compares. The
 * narration cases below all model a draft owned by the scenario that is open,
 * which is the state they always meant.
 */
const SCENARIO = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'

const canvasMockState: { nodes: Array<{ id: string }>; currentScenarioId: string | null } = {
  nodes: [],
  currentScenarioId: SCENARIO,
}
vi.mock('../../store', () => ({
  useCanvasStore: (selector: (s: unknown) => unknown) => selector(canvasMockState),
}))

const draftMockState: {
  draftStreamPhase: string
  draftStreamScenarioId: string | null
  draftStreamCoachingLanded: boolean
} = {
  draftStreamPhase: 'idle',
  draftStreamScenarioId: SCENARIO,
  draftStreamCoachingLanded: false,
}
/**
 * Only the HOOK is stubbed — `importOriginal` keeps every other export real.
 *
 * The previous factory listed `useDraftStore` alone, which REPLACES the module:
 * the moment the component imported a second symbol from it, the spec died at
 * render with "No draftStreamPhaseFor export is defined on the mock". That is
 * trap 12 in a `vi.mock` factory, the same shape that once killed 51 tests here.
 * Spreading the original also means the derived ownership rule under test is the
 * one the component ships with, not a copy.
 */
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
        retryLast,
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

const DRAFTING_LINE = PROGRESSIVE_STAGES[0].message
const SETTLING_LINE = SETTLING_STAGES[0].message
const COACHED_LINE = SETTLING_AFTER_COACHING_STAGES[0].message

beforeEach(() => {
  canvasMockState.nodes = []
  canvasMockState.currentScenarioId = SCENARIO
  draftMockState.draftStreamPhase = 'idle'
  draftMockState.draftStreamScenarioId = SCENARIO
  draftMockState.draftStreamCoachingLanded = false
  conversationMockState.isThinking = false
  conversationMockState.messages = []
})

function renderBar() {
  render(<AIInputBar variant="first-use" hideChevron testId="gen" onCogClick={() => {}} />, {
    wrapper: Wrapper,
  })
}

describe('phase 1 — before GRAPH_READY (empty canvas)', () => {
  it('shows the elapsed-time line', () => {
    conversationMockState.isThinking = true
    draftMockState.draftStreamPhase = 'drafting'
    renderBar()
    expect(screen.getByText(DRAFTING_LINE)).toBeInTheDocument()
    expect(screen.queryByText(SETTLING_LINE)).toBeNull()
  })
})

describe('phase 2 — after GRAPH_READY, graph on canvas, turn still running', () => {
  it('KEEPS narrating, and switches to the frame-licensed line', () => {
    // This is the regression the streamed render would otherwise introduce:
    // nodes exist, so the old gate is false, and the frozen composer would
    // explain nothing for ~25 s.
    conversationMockState.isThinking = true
    canvasMockState.nodes = [{ id: 'g1' }, { id: 'opt_a' }]
    draftMockState.draftStreamPhase = 'settling'
    renderBar()
    expect(screen.getByText(SETTLING_LINE)).toBeInTheDocument()
    // And it must NOT still be claiming a draft is being built — the client now
    // holds a frame saying the graph exists.
    expect(screen.queryByText(DRAFTING_LINE)).toBeNull()
  })

  it('freezes the composer for the whole turn, not just the first phase', () => {
    conversationMockState.isThinking = true
    canvasMockState.nodes = [{ id: 'g1' }]
    draftMockState.draftStreamPhase = 'settling'
    renderBar()
    expect(screen.getByTestId('gen').querySelector('textarea')).toBeDisabled()
  })
})

describe('phase 3 — after COACHING_READY, coaching pass landed, values still to come (F1)', () => {
  it('stops claiming coaching is outstanding once the frame has landed', () => {
    // The 8 Aug measured journey sat post-COACHING_READY for ~28 s while the
    // copy still read "waiting on the values and coaching" about a pass that
    // had already run. Once the frame is held, the line drops the coaching
    // claim — and ONLY the coaching claim: no wording asserts the coaching
    // content arrived, because the enum ('failed_degraded' included) does not
    // license that.
    conversationMockState.isThinking = true
    canvasMockState.nodes = [{ id: 'g1' }, { id: 'opt_a' }]
    draftMockState.draftStreamPhase = 'settling'
    draftMockState.draftStreamCoachingLanded = true
    renderBar()
    expect(screen.getByText(COACHED_LINE)).toBeInTheDocument()
    expect(screen.queryByText(SETTLING_LINE)).toBeNull()
    expect(screen.queryByText(DRAFTING_LINE)).toBeNull()
  })

  it('does NOT use the coached line while the coaching frame has not landed', () => {
    // Discriminating twin (trap 19's pair rule at the fixture level): same
    // state, only the flag differs, and the line must differ with it.
    conversationMockState.isThinking = true
    canvasMockState.nodes = [{ id: 'g1' }, { id: 'opt_a' }]
    draftMockState.draftStreamPhase = 'settling'
    draftMockState.draftStreamCoachingLanded = false
    renderBar()
    expect(screen.getByText(SETTLING_LINE)).toBeInTheDocument()
    expect(screen.queryByText(COACHED_LINE)).toBeNull()
  })

  it('a landed coaching flag WITHOUT the settling phase narrates nothing new', () => {
    // The flag is read as a conjunct of `isSettling`, never bare — a stale
    // flag on an idle store must not put any wait line up.
    canvasMockState.nodes = [{ id: 'g1' }]
    draftMockState.draftStreamPhase = 'idle'
    draftMockState.draftStreamCoachingLanded = true
    conversationMockState.isThinking = true
    renderBar()
    expect(screen.queryByText(COACHED_LINE)).toBeNull()
    expect(screen.queryByText(SETTLING_LINE)).toBeNull()
  })
})

describe('the gate stays shut everywhere else', () => {
  it('says nothing once the turn ends', () => {
    canvasMockState.nodes = [{ id: 'g1' }]
    draftMockState.draftStreamPhase = 'idle'
    conversationMockState.isThinking = false
    renderBar()
    expect(screen.queryByText(SETTLING_LINE)).toBeNull()
    expect(screen.queryByText(DRAFTING_LINE)).toBeNull()
  })

  it('says nothing on an ordinary continuation turn over a populated canvas', () => {
    // NEGATIVE CONTROL on the widening: a normal follow-up question on a
    // non-empty canvas must not start narrating a draft. If the widened gate
    // had been `isThinking` alone, this would fail.
    canvasMockState.nodes = [{ id: 'g1' }]
    draftMockState.draftStreamPhase = 'idle'
    conversationMockState.isThinking = true
    renderBar()
    expect(screen.queryByText(SETTLING_LINE)).toBeNull()
    expect(screen.queryByText(DRAFTING_LINE)).toBeNull()
  })
})
