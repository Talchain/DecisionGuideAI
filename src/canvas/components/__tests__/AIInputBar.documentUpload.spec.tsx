/**
 * #2145 the simple way: the panel-footer composer on an EXISTING model takes a document mid-conversation through the
 * same in-browser reader as the first brief. The text lands in the message box (the user's own next turn; no CEE change)
 * and the label says what was read. Mocks follow `aiPanelV2.polish.spec.tsx`.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'

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
const canvasMockState: { nodes: Array<{ id: string }> } = { nodes: [{ id: 'n1' }] }
vi.mock('../../store', () => ({
  useCanvasStore: (selector: (s: any) => any) => selector(canvasMockState),
  selectResultsStatus: () => undefined,
}))
vi.mock('../../hooks/useStageAwarePlaceholder', () => ({
  useStageAwarePlaceholder: () => 'Ask about this model…',
}))
vi.mock('../../hooks/useSelectionContext', () => ({
  useSelectionContext: () => null,
}))
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
        messages: [], isThinking: false, longRunningHint: null,
        sendMessage, sendSystemEvent, sendChip, retryLast,
        patchBlockStates: new Map(), setPatchBlockState, patchRejections: new Map(), setPatchRejection,
      }
    },
  }
})

import { ConversationProvider } from '../../conversation/ConversationContext'
import { AIInputBar } from '../AIInputBar'
import { BRIEF_UPLOAD_COPY } from '../BriefDocumentUpload'

const Wrapper = ({ children }: { children: ReactNode }) => <ConversationProvider>{children}</ConversationProvider>

beforeEach(() => { canvasMockState.nodes = [{ id: 'n1' }] })

describe('#2145 — a document mid-conversation, in the panel-footer composer', () => {
  it('the strip composer has the paperclip; a CSV\'s text goes into the message box and the label says what was read', async () => {
    render(<AIInputBar variant="strip" testId="strip" onChevronClick={() => {}} />, { wrapper: Wrapper })
    const actions = screen.getByTestId('strip-actions')
    expect(within(actions).getByTestId('brief-document-trigger')).toBeTruthy()
    // Nothing read yet: a footer composer carries no standing text (no privacy line, no status).
    expect(screen.queryByText(BRIEF_UPLOAD_COPY.privacy)).toBeNull()

    fireEvent.change(screen.getByLabelText(BRIEF_UPLOAD_COPY.label), {
      target: { files: [new File(['Starter price,£49\n'], 'prices.csv')] },
    })
    const box = screen.getByRole('textbox') as HTMLTextAreaElement
    await waitFor(() => expect(box.value).toBe('From prices.csv:\n[Sheet "prices"]\n[Sheet "prices" A1:B1] Starter price: £49'))
    expect(screen.getByTestId('brief-document-status').textContent)
      .toBe(`Olumi read 1 of 1 row. ${BRIEF_UPLOAD_COPY.checkInChat}`)
    expect(screen.getByText(BRIEF_UPLOAD_COPY.privacy)).toBeTruthy()
  })

  it('CONTRAST: the welcome (first-brief) box draws no paperclip of its own; its host passes one', () => {
    canvasMockState.nodes = []
    render(<AIInputBar variant="welcome" testId="welcome" />, { wrapper: Wrapper })
    expect(screen.queryByTestId('brief-document-trigger')).toBeNull()
  })

  it('23 Oct: the strip composer\'s row is the vision toolbar: paperclip, the four reasoning moves, then send', () => {
    render(<AIInputBar variant="strip" testId="strip" onChevronClick={() => {}} />, { wrapper: Wrapper })
    const actions = screen.getByTestId('strip-actions')
    const order = Array.from(actions.querySelectorAll('[data-testid]')).map((el) =>
      el.getAttribute('data-move') ?? el.getAttribute('data-testid'))
    expect(order.filter((id) => id !== 'strip-composer-moves')).toEqual([
      'brief-document-trigger', 'brief-document-input', 'challenge', 'opposite', 'evidence_against', 'outside_view', 'strip-chevron', 'strip-send',
    ])
    // CONTRAST: the welcome (first-brief) box has no model to reason about and draws no moves.
    canvasMockState.nodes = []
    render(<AIInputBar variant="welcome" testId="welcome" />, { wrapper: Wrapper })
    expect(within(screen.getByTestId('welcome')).queryAllByTestId('welcome-composer-tool')).toHaveLength(0)
  })
})
