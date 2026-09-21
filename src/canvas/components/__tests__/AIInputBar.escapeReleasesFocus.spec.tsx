/**
 * Escape hands the keyboard back to the canvas.
 *
 * ⚠ THE DEFECT, MEASURED RATHER THAN REASONED. `useKeyboardShortcuts.ts`
 * records the historic "Escape was needed" workaround: the composer is a
 * `<textarea>`, it keeps focus once it has it, and single-key canvas shortcuts
 * are deliberately suppressed inside text fields, so `V`/`H` go inert. The
 * recorded remedy — release focus when the user engages the canvas — works: a
 * pointer-down on the graph pane revives the keys.
 *
 * But it was the ONLY route, and not the one anyone reaches for. Measured in a
 * real browser on 21 Sep 2026 at 1440x900:
 *
 *   on load        focus first-use-input-bar-textarea   (it AUTOFOCUSES)
 *   press H        mode select                          <- inert
 *   press Escape   focus STILL the textarea             <- no handler existed
 *   press H        mode select                          <- still inert
 *   click the pane focus BODY
 *   press H        mode HAND                            <- works
 *
 * So the shortcuts were dead from the first moment of every session, and the
 * one gesture users try did nothing. Escape now blurs, on every surface this
 * composer serves.
 *
 * ⚠ IT CLAIMS THE FOCUS, NOT THE KEY. No `preventDefault`, no
 * `stopPropagation` — a modal or popover above that also treats Escape as
 * dismiss still sees it. And no LETTER gains a canvas meaning inside the box,
 * which is the rule the suppression exists to keep: typing "have" must never
 * flip the canvas into hand mode.
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

function renderBar() {
  render(<AIInputBar variant="first-use" hideChevron testId="gen" />, { wrapper: Wrapper })
}

describe('AIInputBar — Escape releases the composer so canvas shortcuts revive', () => {
  it('blurs the textarea on Escape', () => {
    renderBar()
    const ta = screen.getByTestId('gen-textarea') as HTMLTextAreaElement
    ta.focus()
    expect(document.activeElement).toBe(ta)
    fireEvent.keyDown(ta, { key: 'Escape' })
    expect(document.activeElement).not.toBe(ta)
  })

  /**
   * Positive control — the assertion above can fail. A key this handler does
   * NOT claim must leave focus exactly where it was, so "blurred" is a real
   * observation and not a side effect of the test environment.
   */
  it('positive control — an ordinary key does NOT blur', () => {
    renderBar()
    const ta = screen.getByTestId('gen-textarea') as HTMLTextAreaElement
    ta.focus()
    fireEvent.keyDown(ta, { key: 'h' })
    expect(document.activeElement).toBe(ta)
  })

  /**
   * The suppression rule this must not break: a letter is still just a letter
   * inside the box. If Escape handling had been written as a broad "any
   * non-Enter key hands back the canvas", typing would flip the mode.
   */
  it('leaves Shift+Enter alone (newline, not send, not blur)', () => {
    renderBar()
    const ta = screen.getByTestId('gen-textarea') as HTMLTextAreaElement
    ta.focus()
    fireEvent.keyDown(ta, { key: 'Enter', shiftKey: true })
    expect(document.activeElement).toBe(ta)
  })

  /**
   * Escape is not consumed: it keeps bubbling so anything above that treats it
   * as dismiss still receives it. `defaultPrevented` false is the observable.
   */
  it('does not preventDefault — Escape still reaches whatever is above', () => {
    renderBar()
    const ta = screen.getByTestId('gen-textarea') as HTMLTextAreaElement
    ta.focus()
    const notCancelled = fireEvent.keyDown(ta, { key: 'Escape' })
    expect(notCancelled).toBe(true)
  })
})
