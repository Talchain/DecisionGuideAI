/**
 * ChatThread — settling-window status honesty (PX-B).
 *
 * DEFECT (Paul, 15 Aug: "an unexplained still-thinking state after the model
 * appears"). Nothing updates `longRunningHint` at GRAPH_READY, so across the
 * measured ~25 s settling window the thread rendered the PRE-graph hint —
 * "Building your decision model…" — about a model already on the canvas, while
 * the composer simultaneously said "Your model is on the canvas. Values and
 * coaching are still arriving…". Two surfaces contradicting each other in one
 * moment.
 *
 * These guards come in PAIRS: the settling label must appear IN the settling
 * phase, and the ordinary hint must survive OUTSIDE it. A one-directional
 * corpus here would let a fix silently replace every thinking label in the
 * product with draft-settling copy (platform trap 22b).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChatThread } from '../zones/ChatThread'
import { WAITING_LINES, waitingPhaseOf } from '../zones/ThinkingDots'
import {
  SETTLING_STAGES,
  SETTLING_AFTER_COACHING_STAGES,
} from '../../components/DraftLoadingAnimation'
import type { ConversationMessage } from '../types'

// ⭐ P44 S2: these display checks do not need a configured auth client.
vi.mock('../../../lib/supabase', () => ({
  supabase: {},
  isSupabaseAvailable: () => false,
}))

const canvasState = { currentScenarioId: 'sc_1', nodes: [{ id: 'n1' }] }
vi.mock('../../store', () => ({
  useCanvasStore: Object.assign(
    (selector: (s: unknown) => unknown) => selector(canvasState),
    { getState: () => canvasState },
  ),
}))

const draftState = {
  draftStreamPhase: 'idle' as string,
  draftStreamScenarioId: 'sc_1' as string | null,
  draftStreamCoachingLanded: false,
  draftStreamServerPhase: null as 'first_analysis' | 'writing' | null,
}
vi.mock('../../stores/draftStore', () => ({
  useDraftStore: Object.assign(
    (selector: (s: unknown) => unknown) => selector(draftState),
    { getState: () => draftState },
  ),
  // Mirrors the real ownership rule: a stream owned by another scenario does
  // not narrate over this one.
  draftStreamPhaseFor: (s: typeof draftState, scenarioId: string | null) =>
    s.draftStreamScenarioId === scenarioId ? s.draftStreamPhase : 'idle',
  draftStreamInFlight: (p: string) => p === 'drafting' || p === 'settling',
}))

/** A settled assistant message, so the thread renders the thread (not EmptyState). */
const messages: ConversationMessage[] = [
  { id: 'm1', role: 'assistant', content: 'Here is your model.', isStreaming: false } as ConversationMessage,
]

function renderThread(threadMessages = messages) {
  return render(
    <ChatThread
      messages={threadMessages}
      isThinking
      longRunningHint="Building your decision model... 45s"
      nodeCount={12}
      patchBlockStates={new Map()}
      patchRejections={new Map()}
      onChipClick={async () => {}}
      onPatchAccept={() => {}}
      onPatchDismiss={() => {}}
      onFeedback={() => {}}
      onRetry={() => {}}
    />,
  )
}

beforeEach(() => {
  // jsdom implements no layout: useSmartScroll calls scrollIntoView on commit.
  Element.prototype.scrollIntoView = vi.fn()
  draftState.draftStreamPhase = 'idle'
  draftState.draftStreamScenarioId = 'sc_1'
  draftState.draftStreamCoachingLanded = false
  draftState.draftStreamServerPhase = null
})

// ⭐ P44 S2: settling follows real server events, with the existing fallback.
describe('P44 S2 — server waiting phases', () => {
  it.each([
    [null, 'structuring'],
    ['first_analysis', 'running_analysis'],
    ['writing', 'preparing_explanation'],
  ] as const)('settling with %s maps to %s', (serverPhase, expected) => {
    expect(waitingPhaseOf({ settling: true, analysisRunning: false, nodeCount: 4, serverPhase })).toBe(expected)
  })

  // ⛔ P44 S2: server phases cannot narrate outside the owning settling window.
  it.each(['first_analysis', 'writing'] as const)('ignores %s when not settling', (serverPhase) => {
    expect(waitingPhaseOf({ settling: false, analysisRunning: true, nodeCount: 4, serverPhase })).toBe('running_analysis')
    expect(waitingPhaseOf({ settling: false, analysisRunning: false, nodeCount: 4, explaining: true, serverPhase })).toBe('preparing_explanation')
    expect(waitingPhaseOf({ settling: false, analysisRunning: false, nodeCount: 0, serverPhase })).toBe('reading_brief')
    expect(waitingPhaseOf({ settling: false, analysisRunning: false, nodeCount: 4, serverPhase })).toBeNull()
  })

  it.each([
    ['first_analysis', 'running_analysis'],
    ['writing', 'preparing_explanation'],
  ] as const)('renders the coach phase for %s on the first brief after the graph lands', (serverPhase, expected) => {
    draftState.draftStreamPhase = 'settling'
    draftState.draftStreamServerPhase = serverPhase
    renderThread([{ id: 'brief', role: 'user', content: 'Our strategic brief.' } as ConversationMessage])
    const line = screen.getByTestId('thinking-coaching-line')
    expect(line).toHaveAttribute('data-phase', expected)
    expect(line).toHaveTextContent(WAITING_LINES[expected][0])
    if (serverPhase === 'writing') {
      expect(screen.getByTestId('thinking-label')).toHaveTextContent('Preparing explanation…')
    }
  })

  it('keeps the structuring phase and settling label with no server phase', () => {
    draftState.draftStreamPhase = 'settling'
    renderThread()
    expect(screen.getByTestId('thinking-coaching-line')).toHaveAttribute('data-phase', 'structuring')
    expect(screen.getByTestId('thinking-label')).toHaveTextContent(SETTLING_STAGES[0].message)
  })

  it.each(['idle', 'drafting'])('keeps the ordinary hint when writing belongs to a %s stream', (phase) => {
    draftState.draftStreamPhase = phase
    draftState.draftStreamServerPhase = 'writing'
    renderThread()
    expect(screen.getByTestId('thinking-label')).toHaveTextContent('Building your decision model... 45s')
    expect(screen.queryByTestId('thinking-coaching-line')).not.toBeInTheDocument()
  })

  it('ignores writing from another scenario', () => {
    draftState.draftStreamPhase = 'settling'
    draftState.draftStreamScenarioId = 'sc_OTHER'
    draftState.draftStreamServerPhase = 'writing'
    renderThread()
    expect(screen.getByTestId('thinking-label')).toHaveTextContent('Building your decision model... 45s')
    expect(screen.queryByTestId('thinking-coaching-line')).not.toBeInTheDocument()
  })
})

describe('ChatThread — the settling window is explained, not narrated stale', () => {
  it('replaces the pre-graph hint with the settling line once the graph has landed', () => {
    draftState.draftStreamPhase = 'settling'
    renderThread()
    expect(screen.getByText(SETTLING_STAGES[0].message)).toBeInTheDocument()
    // The lie is gone — bound to the exact stale string, not to a substring.
    expect(screen.queryByText('Building your decision model... 45s')).not.toBeInTheDocument()
  })

  it('drops the outstanding-coaching claim once COACHING_READY has landed', () => {
    draftState.draftStreamPhase = 'settling'
    draftState.draftStreamCoachingLanded = true
    renderThread()
    expect(screen.getByText(SETTLING_AFTER_COACHING_STAGES[0].message)).toBeInTheDocument()
    expect(screen.queryByText(SETTLING_STAGES[0].message)).not.toBeInTheDocument()
  })

  // OPPOSITE-DIRECTION TWINS — outside the settling window nothing changes.
  it('keeps the ordinary hint while the draft is still DRAFTING', () => {
    draftState.draftStreamPhase = 'drafting'
    renderThread()
    expect(screen.getByText('Building your decision model... 45s')).toBeInTheDocument()
    expect(screen.queryByText(SETTLING_STAGES[0].message)).not.toBeInTheDocument()
  })

  it('keeps the ordinary hint on a non-draft turn (idle stream)', () => {
    draftState.draftStreamPhase = 'idle'
    renderThread()
    expect(screen.getByText('Building your decision model... 45s')).toBeInTheDocument()
    expect(screen.queryByText(SETTLING_STAGES[0].message)).not.toBeInTheDocument()
  })

  it('does not narrate settling for a stream owned by ANOTHER scenario', () => {
    // Scenario ownership is what stops a stale stream narrating over the tab
    // the user is actually looking at — read the same way AIInputBar reads it.
    draftState.draftStreamPhase = 'settling'
    draftState.draftStreamScenarioId = 'sc_OTHER'
    renderThread()
    expect(screen.queryByText(SETTLING_STAGES[0].message)).not.toBeInTheDocument()
    expect(screen.getByText('Building your decision model... 45s')).toBeInTheDocument()
  })

  it('the settling copy is the ratified table verbatim, not a second sentence', () => {
    // Binds the REUSE. If someone writes fresh copy here it diverges from the
    // composer again — which is the defect, one layer up.
    draftState.draftStreamPhase = 'settling'
    renderThread()
    expect(SETTLING_STAGES[0].message).toContain('on the canvas')
    expect(screen.getByText(SETTLING_STAGES[0].message)).toBeInTheDocument()
  })
})
