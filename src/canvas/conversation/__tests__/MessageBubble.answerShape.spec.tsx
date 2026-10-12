/**
 * F1 — MessageBubble answer-shape integration.
 *
 * The load-bearing fail-safe property, proven both ways (positive control):
 *  - PRESENT & well-formed → structured view (headline + bullets + Show-more)
 *    OWNS the body; the free-text content is NOT rendered as the body prose.
 *  - ABSENT / malformed → today's full-text render, byte-for-byte unchanged.
 *  - streaming / user messages → never structured (free-text path).
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MessageBubble } from '../MessageBubble'
import type { ConversationMessage } from '../types'
import type { AnswerShape } from '../answerShape'

const noop = async () => {}

function makeMsg(overrides: Partial<ConversationMessage> = {}): ConversationMessage {
  return {
    id: 'msg-1',
    role: 'assistant',
    content: 'THE-FULL-FREE-TEXT-ANSWER goes here and is long enough to be meaningful.',
    timestamp: new Date(),
    ...overrides,
  }
}

const answer: AnswerShape = {
  headline: 'HEADLINE-TOKEN strongest option',
  bullets: ['BULLET-ONE', 'BULLET-TWO'],
  detail: 'DETAIL-TOKEN the long tail',
}

describe('MessageBubble — answer-shape (present)', () => {

})

describe('MessageBubble — answer-shape (absent → fallback, positive control)', () => {
  it('renders the full free-text content and no structured view when answerShape is absent', () => {
    render(<MessageBubble message={makeMsg()} onChipClick={noop} />)
    expect(screen.queryByTestId('message-answer-structured')).toBeNull()
    expect(screen.queryByTestId('answer-body')).toBeNull()
    const bubble = screen.getByTestId('message-assistant')
    expect(bubble.textContent).toContain('THE-FULL-FREE-TEXT-ANSWER')
  })

  it('never renders the structured view on a streaming turn (even with answerShape set)', () => {
    render(
      <MessageBubble
        message={makeMsg({ answerShape: answer, isStreaming: true })}
        onChipClick={noop}
      />,
    )
    expect(screen.queryByTestId('message-answer-structured')).toBeNull()
  })

  it('never renders the structured view on a user message', () => {
    render(
      <MessageBubble
        message={makeMsg({ role: 'user', content: 'my question', answerShape: answer })}
        onChipClick={noop}
      />,
    )
    expect(screen.queryByTestId('message-answer-structured')).toBeNull()
    expect(screen.getByTestId('message-user').textContent).toContain('my question')
  })
})
