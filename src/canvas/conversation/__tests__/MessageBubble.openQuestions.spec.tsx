/**
 * The build's open questions are detail ON DEMAND, not the reply.
 *
 * Paul's goal (25 Sep): "a short conclusion, decisive caveat and one real next
 * action, with useful detail available on demand … verify the rendered reply
 * against the actual OpenAI route, not only authored fixtures."
 *
 * The inputs are the SERVED first-brief replies from the OpenAI route
 * (`fixtures/openai-route-construction-reply.served.json`, CEE e39f6e0 and
 * c673223). In each one, CEE's write-outcome line appended the questions the
 * build parked — about 110 of the reply's 243-269 words — after a fixed marker.
 *
 * Pinned here:
 *  - at rest the bubble shows the lead only; the questions sit behind a closed
 *    toggle and, when opened, render VERBATIM (nothing reworded or dropped);
 *  - FAILS OPEN: no marker, a marker that is not the reply's tail, a streaming
 *    turn, a user's own words, or a structured answer → today's render exactly.
 */
import { describe, it, expect } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MessageBubble } from '../MessageBubble'
import type { ConversationMessage } from '../types'
import {
  SERVER_OPEN_QUESTIONS_MARKER,
  splitServerOpenQuestions,
} from '../serverOpenQuestions'
import served from './fixtures/openai-route-construction-reply.served.json'

const noop = async () => {}
const BUILDS = Object.keys(served.replies) as Array<keyof typeof served.replies>
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length
const bare = (s: string) => s.replace(/^- /gm, '').replace(/—/g, '-').replace(/\s+/g, '')

function makeMsg(overrides: Partial<ConversationMessage> = {}): ConversationMessage {
  return {
    id: 'msg-open-questions',
    role: 'assistant',
    content: '',
    timestamp: new Date(),
    ...overrides,
  }
}

describe('splitServerOpenQuestions — on the served replies', () => {
  it('has two served builds to test against', () => {
    expect(BUILDS).toEqual(['e39f6e0', 'c673223'])
  })

  it.each(BUILDS)('%s: splits once at the marker and loses nothing', (build) => {
    const text = served.replies[build].assistant_text
    const split = splitServerOpenQuestions(text)
    expect(split).not.toBeNull()
    const { lead, questions } = split!
    // Verbatim: the parts and the marker rebuild the served reply exactly.
    expect(`${lead} ${SERVER_OPEN_QUESTIONS_MARKER} ${questions}`).toBe(text.trim())
    expect(lead.endsWith('The model was saved as version 1.')).toBe(true)
    expect(lead).not.toContain(SERVER_OPEN_QUESTIONS_MARKER)
    // The questions are the bulk the reply was carrying.
    expect(words(questions)).toBeGreaterThanOrEqual(80)
    expect(words(lead)).toBeLessThan(words(text) - 80)
  })

  it('fails open when the marker is absent, leading, repeated, mid-word or has nothing after it', () => {
    const M = SERVER_OPEN_QUESTIONS_MARKER
    expect(splitServerOpenQuestions('A reply with no marker.')).toBeNull()
    expect(splitServerOpenQuestions(`${M} Only questions.`)).toBeNull()
    expect(splitServerOpenQuestions(`Lead. ${M} One. ${M} Two.`)).toBeNull()
    expect(splitServerOpenQuestions(`Lead.${M} Glued on.`)).toBeNull()
    expect(splitServerOpenQuestions(`Lead. ${M}   `)).toBeNull()
  })
})

describe('MessageBubble — the served first reply at rest', () => {
  it.each(BUILDS)('%s: the body is the lead; the questions are closed behind a toggle', (build) => {
    const text = served.replies[build].assistant_text
    const { lead, questions } = splitServerOpenQuestions(text)!
    render(<MessageBubble message={makeMsg({ content: text })} onChipClick={noop} />)

    const body = screen.getByTestId('message-body-text')
    expect(body.textContent).not.toContain(SERVER_OPEN_QUESTIONS_MARKER)
    expect(body.textContent).not.toContain(questions.slice(0, 40))
    expect(body.textContent).toContain('The model was saved as version 1.')
    // Identity, not a count: the body renders the lead and nothing else. The
    // markdown list becomes <li>s, so compare with whitespace and "- " dropped (the
    // renderer also shows an em dash as a hyphen).
    expect(bare(body.textContent ?? '')).toBe(bare(lead))

    const toggle = screen.getByTestId('message-show-open-questions')
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(toggle.textContent).toContain('Questions this model does not answer yet')
    expect(screen.queryByTestId('message-open-questions')).toBeNull()

    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    // On demand, and verbatim: the producer's words, whole.
    expect(screen.getByTestId('message-open-questions').textContent).toBe(questions)
  })
})

describe('MessageBubble — fails open to today\'s render (controls)', () => {
  const served0 = served.replies.e39f6e0.assistant_text

  it('a reply without the marker renders whole, with no toggle', () => {
    const text = 'The analysis cannot put forward a pricing option: the comparison is a near tie.'
    render(<MessageBubble message={makeMsg({ content: text })} onChipClick={noop} />)
    expect(screen.getByTestId('message-body-text').textContent).toContain('near tie.')
    expect(screen.queryByTestId('message-show-open-questions')).toBeNull()
  })

  it('a streaming turn is never split, even with the marker', () => {
    render(<MessageBubble message={makeMsg({ content: served0, isStreaming: true })} onChipClick={noop} />)
    expect(screen.getByTestId('message-body-text').textContent).toContain(SERVER_OPEN_QUESTIONS_MARKER)
    expect(screen.queryByTestId('message-show-open-questions')).toBeNull()
  })

  it("the user's own words are never split", () => {
    render(<MessageBubble message={makeMsg({ role: 'user', content: served0 })} onChipClick={noop} />)
    expect(screen.getByTestId('message-user').textContent).toContain(SERVER_OPEN_QUESTIONS_MARKER)
    expect(screen.queryByTestId('message-show-open-questions')).toBeNull()
  })

  it('a structured answer owns its body, so no toggle is added', () => {
    render(
      <MessageBubble
        message={makeMsg({
          content: served0,
          answerShape: { headline: 'HEADLINE-TOKEN', bullets: ['BULLET-ONE'], detail: 'DETAIL-TOKEN' },
        })}
        onChipClick={noop}
       
      />,
    )
    expect(screen.getByTestId('message-answer-structured')).toBeTruthy()
    expect(screen.queryByTestId('message-show-open-questions')).toBeNull()
  })
})
