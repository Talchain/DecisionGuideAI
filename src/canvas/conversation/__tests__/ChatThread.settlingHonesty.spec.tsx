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
import {
  SETTLING_STAGES,
  SETTLING_AFTER_COACHING_STAGES,
} from '../../components/DraftLoadingAnimation'
import type { ConversationMessage } from '../types'

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

function renderThread() {
  return render(
    <ChatThread
      messages={messages}
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
