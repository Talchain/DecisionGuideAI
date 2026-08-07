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
  it('renders the structured view and does NOT render the free-text content as the body', () => {
    render(<MessageBubble message={makeMsg({ answerShape: answer })} onChipClick={noop} />)
    // structured body present
    expect(screen.getByTestId('message-answer-structured')).toBeTruthy()
    expect(screen.getByTestId('answer-headline').textContent).toContain('HEADLINE-TOKEN')
    expect(screen.getByTestId('answer-bullets').querySelectorAll('li')).toHaveLength(2)
    // detail collapsed
    expect(screen.queryByTestId('answer-detail')).toBeNull()
    expect(screen.getByTestId('answer-show-more')).toBeTruthy()
    // the free-text content string is NOT shown as the message body prose
    const bubble = screen.getByTestId('message-assistant')
    expect(bubble.textContent).not.toContain('THE-FULL-FREE-TEXT-ANSWER')
  })
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
