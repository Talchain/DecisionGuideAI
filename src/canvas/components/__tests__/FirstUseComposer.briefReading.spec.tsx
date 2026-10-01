/**
 * ⭐ C6-2 — the first-use wait shows the user's OWN goal and options while the model is built (AIQ #70 5858767026).
 *
 * The first brief waits ~60 s on this screen. CEE's `BRIEF_READ` frame lands a few seconds in; the store holds it only
 * while this scenario's turn is still drafting. Shown as quotes in the "Structure it" slots (Goal · Options · Things to
 * consider): no leader, no ranking, never "the model". Setup copied from `FirstUseComposer.sendFailure.spec.tsx`.
 * The "Structure it" input and its own-fields reading are in `FirstUseComposer.structureIt.spec.tsx`.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
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
  results: { status: string }
  _internal: Record<string, unknown>
  selection: null
  currentScenarioId: string | null
} = { nodes: [], edges: [], results: { status: 'idle' }, _internal: {}, selection: null, currentScenarioId: 'scn-1' }
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
vi.mock('../../hooks/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: () => true,
}))
vi.mock('../../../adapters/plot', () => ({
  plot: {
    templates: () => new Promise(() => {}),
  },
}))

// Mutable mocked conversation state the tests reconfigure.
const messagesMockState: { messages: Array<{ id: string; role: string; synthetic?: boolean }> } = {
  messages: [],
}
const thinkingMockState: { isThinking: boolean } = { isThinking: false }
const failureMockState: {
  lastSendFailure: { kind: string; retryable: boolean; inputText: string } | null
} = { lastSendFailure: null }

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
        lastSendFailure: failureMockState.lastSendFailure,
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
import { FirstUseComposer } from '../FirstUseComposer'
import { useFloatingPanelState } from '../../hooks/useFloatingPanelState'
import { useDraftStore } from '../../stores/draftStore'

function Wrapper({ children }: { children: ReactNode }) {
  return <ConversationProvider>{children}</ConversationProvider>
}

beforeEach(() => {
  useFloatingPanelState.getState().reset()
  useFloatingPanelState.getState().open('system-first-use')
  canvasMockState.nodes = []
  messagesMockState.messages = []
  thinkingMockState.isThinking = false
  failureMockState.lastSendFailure = null
  canvasMockState.currentScenarioId = 'scn-1'
  useDraftStore.getState().resetDraft()
})


const GOAL = 'reach £100k MRR within 6 months'
const OPTIONS = [
  'develop new features and increase our Pro plan price from £49 to £59 per month in the next release',
  'invest in additional advertising',
]
const drafting = (reading: { goal: string | null; options: string[]; limits?: string[] }, scenarioId = 'scn-1') => {
  useDraftStore.getState().setDraftStreamPhase('drafting', 't1', scenarioId)
  useDraftStore.getState().markDraftStreamBriefRead('t1', { limits: [], ...reading })
}

describe('FirstUseComposer — the brief reading during the first-brief wait (C6-2)', () => {
  it('RED: while generating, the goal and the options are shown back as the user wrote them, in their slots', () => {
    thinkingMockState.isThinking = true
    messagesMockState.messages = [{ id: 'u1', role: 'user' }]
    drafting({ goal: GOAL, options: OPTIONS })
    render(<FirstUseComposer />, { wrapper: Wrapper })
    const card = screen.getByTestId('brief-reading')
    // Paul 1 Oct 2026 redesign: ONE header, ONE "in your words" note for the whole reading, options numbered.
    expect(within(card).getByText('Your brief')).toBeTruthy()
    expect(within(card).getByTestId('brief-reading-your-words').textContent).toBe('Quoted in your words')
    const goal = screen.getByTestId('brief-reading-goal')
    expect(within(goal).getByText(`\u201C${GOAL}\u201D`)).toBeTruthy()
    const options = screen.getByTestId('brief-reading-options')
    expect(within(options).getAllByRole('listitem').map((li) => li.textContent)).toEqual(OPTIONS.map((o, i) => `${i + 1}\u201C${o}\u201D`))
    expect(card.textContent, 'the reading never speaks of a model').not.toMatch(/\bmodel\b/i)
  })

  it('a goal-less brief reads "Not stated yet" under Goal; CEE sends no context span, so no Context slot is claimed', () => {
    thinkingMockState.isThinking = true
    drafting({ goal: null, options: ['increase the Pro plan price from £49 to £59 per month with the next Pro feature release'] })
    render(<FirstUseComposer />, { wrapper: Wrapper })
    const goal = screen.getByTestId('brief-reading-goal')
    expect(within(goal).getByTestId('brief-reading-not-mentioned').textContent).toBe('Not stated yet')
    // The empty slot carries no quote; the filled slot in the same card does.
    expect(goal.textContent).not.toContain('\u201C')
    expect(screen.getByTestId('brief-reading-options').textContent).toContain('\u201C')
    expect(screen.queryByTestId('brief-reading-context')).toBeNull()
  })

  it('v2: the limits the user set are shown as quotes under "Things to consider"; none held → "Not stated yet"', () => {
    thinkingMockState.isThinking = true
    drafting({ goal: GOAL, options: OPTIONS, limits: ['£20k budget', 'monthly churn under 4%'] })
    const { unmount } = render(<FirstUseComposer />, { wrapper: Wrapper })
    const considerations = screen.getByTestId('brief-reading-considerations')
    expect(considerations.textContent).toContain('Things to consider')
    expect(within(considerations).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['\u201C£20k budget\u201D', '\u201Cmonthly churn under 4%\u201D'])
    unmount()
    drafting({ goal: GOAL, options: OPTIONS })
    render(<FirstUseComposer />, { wrapper: Wrapper })
    expect(within(screen.getByTestId('brief-reading-considerations')).getByTestId('brief-reading-not-mentioned')).toBeTruthy()
  })

  it("another scenario's reading is never shown here", () => {
    thinkingMockState.isThinking = true
    drafting({ goal: GOAL, options: OPTIONS }, 'scn-other')
    render(<FirstUseComposer />, { wrapper: Wrapper })
    expect(screen.queryByTestId('brief-reading')).toBeNull()
  })

  it('CONTRAST: not generating (the model is drawn, or no turn in flight) → no card, even with a reading held', () => {
    drafting({ goal: GOAL, options: OPTIONS })
    thinkingMockState.isThinking = false
    const { unmount } = render(<FirstUseComposer />, { wrapper: Wrapper })
    expect(screen.queryByTestId('brief-reading')).toBeNull()
    unmount()
    thinkingMockState.isThinking = true
    canvasMockState.nodes = [{ id: 'goal_mrr' }]
    render(<FirstUseComposer />, { wrapper: Wrapper })
    expect(screen.queryByTestId('brief-reading')).toBeNull()
  })
})
