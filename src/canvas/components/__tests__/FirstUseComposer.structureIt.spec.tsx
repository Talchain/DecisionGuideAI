/**
 * "Structure it" on the first-use hero: four labelled fields compose into ONE labelled brief that goes out through
 * the single box's own send path, and the wait shows the user's own four fields as "Your brief, as Olumi read it".
 * Mounting setup copied from `FirstUseComposer.briefReading.spec.tsx` (the mounted hero surface).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import type { ReactNode } from 'react'

const spies = vi.hoisted(() => ({ sendMessage: vi.fn() }))

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

const thinkingMockState: { isThinking: boolean } = { isThinking: false }

vi.mock('../../conversation/useConversation', async () => {
  const { useState } = await import('react')
  return {
    useConversation: () => {
      const [sendSystemEvent] = useState(() => vi.fn())
      const [sendChip] = useState(() => vi.fn())
      const [retryLast] = useState(() => vi.fn())
      const [setPatchBlockState] = useState(() => vi.fn())
      const [setPatchRejection] = useState(() => vi.fn())
      return {
        messages: [],
        isThinking: thinkingMockState.isThinking,
        longRunningHint: null,
        lastSendFailure: null,
        sendMessage: spies.sendMessage,
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
import { GENERATE_MODEL_SEND } from '../AIInputBar'
import { useFloatingPanelState } from '../../hooks/useFloatingPanelState'
import { useDraftStore } from '../../stores/draftStore'

function Wrapper({ children }: { children: ReactNode }) {
  return <ConversationProvider>{children}</ConversationProvider>
}

beforeEach(() => {
  useFloatingPanelState.getState().reset()
  useFloatingPanelState.getState().open('system-first-use')
  canvasMockState.nodes = []
  canvasMockState.currentScenarioId = 'scn-1'
  thinkingMockState.isThinking = false
  spies.sendMessage.mockReset()
  useDraftStore.getState().resetDraft()
})

const CONTEXT = 'B2B SaaS, 400 customers, Pro plan at £49 per month'
const GOAL = 'reach £100k MRR within 6 months'
const OPTIONS = 'raise the Pro price to £59, or spend more on advertising'
const CONSIDER = '£20k budget; churn must stay under 4%'

const toggle = () => fireEvent.click(screen.getByTestId('first-use-brief-mode-toggle'))
const type = (slot: string, value: string) =>
  fireEvent.change(screen.getByTestId(`structured-brief-${slot}`), { target: { value } })
const box = () => screen.getByTestId('first-use-input-bar-textarea') as HTMLTextAreaElement

describe('FirstUseComposer — "Structure it"', () => {
  it('"Upload a document" is an icon inside the brief box, with its feedback under it (ROADMAP 3.8)', () => {
    render(<FirstUseComposer />, { wrapper: Wrapper })
    const box = screen.getByTestId('first-use-input-bar')
    const trigger = screen.getByTestId('brief-document-trigger')
    expect(box.contains(trigger)).toBe(true)
    expect(box.contains(screen.getByTestId('brief-document-upload'))).toBe(false)
    expect(screen.getByLabelText('Upload a document')).toBeTruthy()
  })

  it('the single box is the default; "Structure it" swaps in the four labelled fields', () => {
    render(<FirstUseComposer />, { wrapper: Wrapper })
    expect(box()).toBeTruthy()
    expect(screen.queryByTestId('structured-brief')).toBeNull()
    expect(screen.getByTestId('first-use-brief-mode-toggle').textContent).toBe('Structure it')
    toggle()
    const form = screen.getByTestId('structured-brief')
    for (const label of ['Context', 'Goal', 'What success looks like, and by when', 'Options', 'Things to consider', 'Limits, risks']) {
      expect(within(form).getByText(label)).toBeTruthy()
    }
    expect(screen.queryByTestId('first-use-input-bar-textarea')).toBeNull()
  })

  it('RED: the four fields compose into ONE labelled brief, sent through the single box\'s own send path', () => {
    render(<FirstUseComposer />, { wrapper: Wrapper })
    // The single box's send, for the identity of the path.
    fireEvent.change(box(), { target: { value: 'a plain brief' } })
    fireEvent.click(screen.getByTestId('first-use-input-bar-send'))
    expect(spies.sendMessage).toHaveBeenCalledTimes(1)
    const [, boxOpts] = spies.sendMessage.mock.calls[0]

    toggle()
    type('context', CONTEXT)
    type('goal', GOAL)
    type('options', OPTIONS)
    type('considerations', CONSIDER)
    fireEvent.click(screen.getByTestId('structured-brief-send'))
    expect(spies.sendMessage).toHaveBeenCalledTimes(2)
    const [text, opts] = spies.sendMessage.mock.calls[1]
    expect(text).toBe(`Context: ${CONTEXT}\nGoal: ${GOAL}\nOptions: ${OPTIONS}\nThings to consider: ${CONSIDER}`)
    expect(opts).toBe(GENERATE_MODEL_SEND)
    expect(opts).toBe(boxOpts)
    expect(opts).toEqual({ turnType: 'explicit_generate', debugSource: 'generate_model', debugSourceSurface: 'ai_panel' })
  })

  it('empty fields are left out of the brief; all empty → nothing to send', () => {
    render(<FirstUseComposer />, { wrapper: Wrapper })
    toggle()
    expect((screen.getByTestId('structured-brief-send') as HTMLButtonElement).disabled).toBe(true)
    type('goal', GOAL)
    type('options', `  ${OPTIONS}  `)
    type('context', '   ')
    fireEvent.click(screen.getByTestId('structured-brief-send'))
    expect(spies.sendMessage).toHaveBeenCalledTimes(1)
    expect(spies.sendMessage.mock.calls[0][0]).toBe(`Goal: ${GOAL}\nOptions: ${OPTIONS}`)
  })

  it('switching back to one box keeps the text, and switching again restores the fields', () => {
    render(<FirstUseComposer />, { wrapper: Wrapper })
    toggle()
    type('goal', GOAL)
    type('considerations', `${CONSIDER}\nand a second line`)
    toggle()
    expect(screen.getByTestId('first-use-brief-mode-toggle').textContent).toBe('Structure it')
    expect(box().value).toBe(`Goal: ${GOAL}\nThings to consider: ${CONSIDER}\nand a second line`)
    toggle()
    expect((screen.getByTestId('structured-brief-goal') as HTMLTextAreaElement).value).toBe(GOAL)
    expect((screen.getByTestId('structured-brief-considerations') as HTMLTextAreaElement).value).toBe(`${CONSIDER}\nand a second line`)
    expect((screen.getByTestId('structured-brief-context') as HTMLTextAreaElement).value).toBe('')
  })

  it('free text typed in the box is kept whole under Context, never split by guesswork', () => {
    render(<FirstUseComposer />, { wrapper: Wrapper })
    fireEvent.change(box(), { target: { value: `My goal is to ${GOAL}. Options: price or ads.` } })
    toggle()
    expect((screen.getByTestId('structured-brief-context') as HTMLTextAreaElement).value).toBe(`My goal is to ${GOAL}. Options: price or ads.`)
    expect((screen.getByTestId('structured-brief-goal') as HTMLTextAreaElement).value).toBe('')
  })
})

describe('FirstUseComposer — "Your brief, as Olumi read it" from the user\'s own fields', () => {
  it('RED: while generating, each filled slot shows the user\'s words; an empty slot reads "Not stated yet"', () => {
    const { rerender } = render(<FirstUseComposer />, { wrapper: Wrapper })
    toggle()
    type('context', CONTEXT)
    type('goal', GOAL)
    type('options', OPTIONS)
    fireEvent.click(screen.getByTestId('structured-brief-send'))
    thinkingMockState.isThinking = true
    rerender(<FirstUseComposer />)
    const card = screen.getByTestId('brief-reading')
    // Paul 1 Oct 2026 redesign: one header, and ONE "in your words" note for the whole reading.
    expect(within(card).getByText('Your brief')).toBeTruthy()
    expect(within(card).getAllByTestId('brief-reading-your-words')).toHaveLength(1)
    for (const [slot, words] of [['context', CONTEXT], ['goal', GOAL], ['options', OPTIONS]] as const) {
      const el = screen.getByTestId(`brief-reading-${slot}`)
      expect(within(el).getByText(`“${words}”`)).toBeTruthy()
      expect(within(el).queryByTestId('brief-reading-not-mentioned')).toBeNull()
    }
    const empty = screen.getByTestId('brief-reading-considerations')
    expect(within(empty).getByTestId('brief-reading-not-mentioned').textContent).toBe('Not stated yet')
    expect(empty.textContent).not.toContain('“')
    // The fields make way for the frozen box and its thinking indicator while the brief is drafted.
    expect(screen.queryByTestId('structured-brief')).toBeNull()
    expect(screen.getByTestId('first-use-thinking')).toBeTruthy()
    expect(screen.queryByTestId('first-use-brief-mode-toggle')).toBeNull()
  })

  it('the user\'s own fields win over CEE\'s spans once sent from "Structure it"', () => {
    const { rerender } = render(<FirstUseComposer />, { wrapper: Wrapper })
    toggle()
    type('goal', GOAL)
    fireEvent.click(screen.getByTestId('structured-brief-send'))
    useDraftStore.getState().setDraftStreamPhase('drafting', 't1', 'scn-1')
    useDraftStore.getState().markDraftStreamBriefRead('t1', { goal: 'reach £100k MRR', options: ['a CEE span'], limits: [] })
    thinkingMockState.isThinking = true
    rerender(<FirstUseComposer />)
    expect(within(screen.getByTestId('brief-reading-goal')).getByText(`“${GOAL}”`)).toBeTruthy()
    expect(screen.queryByText('“a CEE span”')).toBeNull()
  })

  it('CONTRAST: no "assumed" item renders when CEE sends none — only the user\'s words and "Not stated yet"', () => {
    thinkingMockState.isThinking = true
    useDraftStore.getState().setDraftStreamPhase('drafting', 't1', 'scn-1')
    useDraftStore.getState().markDraftStreamBriefRead('t1', { goal: GOAL, options: [OPTIONS], limits: [] })
    render(<FirstUseComposer />, { wrapper: Wrapper })
    const card = screen.getByTestId('brief-reading')
    expect(card.textContent).not.toMatch(/assum/i)
    expect(card.querySelector('[data-testid*="assumed"]')).toBeNull()
    // CONTRAST CONTROL: the same card DOES render the user's words and an empty slot, so the absence above is about
    // "assumed" items and not an empty card.
    expect(within(card).getAllByTestId('brief-reading-your-words')).toHaveLength(1)
    expect(card.textContent).toContain(`“${GOAL}”`)
    expect(within(card).getAllByTestId('brief-reading-not-mentioned')).toHaveLength(1)
  })
})
