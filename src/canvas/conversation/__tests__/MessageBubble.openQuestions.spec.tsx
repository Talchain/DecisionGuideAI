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
 *  - at rest the bubble shows everything EXCEPT the questions: the lead, and any
 *    producer sentence that follows them (e39f6e0's "held it as fixed context
 *    … tell me if one of the options should change it" is a caveat plus the
 *    user's next action, not a question — #1987 review 5825639597);
 *  - the questions sit behind a closed toggle and, when opened, render VERBATIM;
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
const M = SERVER_OPEN_QUESTIONS_MARKER
/** Rebuilds the reply from its parts, exactly as the producer joins them. */
const rebuild = (s: { lead: string; questions: string; after: string }) =>
  `${s.lead} ${M} ${s.questions}${s.after ? ` ${s.after}` : ''}`

/** e39f6e0's `contextFactorsLine`, verbatim from the served reply. */
const HELD_AS_CONTEXT =
  'No option changes Feature-release value, so I held it as fixed context rather than a lever — tell me if one of the options should change it.'

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
    // Verbatim: the parts and the marker rebuild the served reply exactly.
    expect(rebuild(split!)).toBe(text.trim())
    expect(split!.lead.endsWith('The model was saved as version 1.')).toBe(true)
    expect(split!.atRest).not.toContain(M)
    // The questions are the bulk the reply was carrying.
    expect(words(split!.questions)).toBeGreaterThanOrEqual(80)
    expect(words(split!.atRest)).toBeLessThan(words(text) - 80)
  })

  it('e39f6e0: the held-as-context caveat and its ask stay at rest; they are not a question', () => {
    const split = splitServerOpenQuestions(served.replies.e39f6e0.assistant_text)!
    expect(served.replies.e39f6e0.assistant_text).toContain(HELD_AS_CONTEXT) // present control
    expect(split.questions).not.toContain('fixed context')
    expect(split.after).toBe(HELD_AS_CONTEXT)
    expect(split.atRest).toBe(`${split.lead} ${HELD_AS_CONTEXT}`)
  })

  it('c673223: nothing follows the questions', () => {
    const split = splitServerOpenQuestions(served.replies.c673223.assistant_text)!
    expect(split.after).toBe('')
    expect(split.atRest).toBe(split.lead)
  })
})

/**
 * What else the producer can put after the questions, composed from its own format
 * strings at CEE e39f6e0 (`src/orchestrator-v5/agent-lane/write-outcome.ts`):
 * `contextFactorsLine` (:122-126), a later write's `statusLine` (:139-177, joined
 * with ' ' at :224-226) and `notAdoptedLine` (:240-264, joined after the status in
 * `agent-v1-turn.ts:1627-1628`).
 */
describe('splitServerOpenQuestions — every producer sentence that can follow the questions stays at rest', () => {
  const LEAD = 'The model was saved as version 1.'
  const QS = 'Current churn is not supplied. What is the price elasticity? (and 2 more)'
  const TAILS = [
    'No option changes Pro subscribers or Churn, so I held them as fixed context rather than levers — tell me if one of the options should change them.',
    'Saved as version 2.',
    'Saved. No version number was recorded for it.',
    'Saved 6 of 6 starting values as version 2. Not saved: 0 of 2 option levels (none of it was applied).',
    'Not saved: the model changed after this was proposed, so it was not applied — ask me to propose it again.',
    'Partly saved: only part of it was saved.',
    'That change was already saved (version 2); nothing was written again.',
    'Not included in this proposal: Churn risk. Only a factor can hold a starting value, so it was left out — approving adds nothing for it.',
  ]

  it.each(TAILS)('keeps "%s" in the body', (tail) => {
    const text = `${LEAD} ${M} ${QS} ${tail}`
    const split = splitServerOpenQuestions(text)!
    expect(split.questions).toBe(QS)
    expect(split.after).toBe(tail)
    expect(rebuild(split)).toBe(text)
  })

  it('cuts at the FIRST producer sentence, so a chain of them all stays at rest', () => {
    const tail = `${TAILS[0]} ${TAILS[1]} ${TAILS[7]}`
    const split = splitServerOpenQuestions(`${LEAD} ${M} ${QS} ${tail}`)!
    expect(split.questions).toBe(QS)
    expect(split.after).toBe(tail)
  })

  it('a producer phrase mid-sentence is not a boundary — only a sentence start is', () => {
    const qs = 'How much is saved per seat if churn falls? Do customers on Saved Plus churn less than Pro?'
    const split = splitServerOpenQuestions(`${LEAD} ${M} ${qs}`)!
    expect(split.questions).toBe(qs)
    expect(split.after).toBe('')
  })

  it('errs toward SHOWING: a question that opens like a status line is cut early and stays visible', () => {
    const qs = 'Is churn under 4% today? Saved revenue from annual plans is not modelled.'
    const split = splitServerOpenQuestions(`${LEAD} ${M} ${qs}`)!
    expect(split.questions).toBe('Is churn under 4% today?')
    expect(split.atRest).toContain('Saved revenue from annual plans is not modelled.')
  })
})

describe('splitServerOpenQuestions — fails open', () => {
  it('when the marker is absent, leading, repeated, mid-word or has no question after it', () => {
    expect(splitServerOpenQuestions('A reply with no marker.')).toBeNull()
    expect(splitServerOpenQuestions(`${M} Only questions.`)).toBeNull()
    expect(splitServerOpenQuestions(`Lead. ${M} One. ${M} Two.`)).toBeNull()
    expect(splitServerOpenQuestions(`Lead.${M} Glued on.`)).toBeNull()
    expect(splitServerOpenQuestions(`Lead. ${M}   `)).toBeNull()
    expect(splitServerOpenQuestions(`Lead. ${M} Saved as version 2.`)).toBeNull()
  })
})

describe('MessageBubble — the served first reply at rest', () => {
  it.each(BUILDS)('%s: the body is everything but the questions; they are closed behind a toggle', (build) => {
    const text = served.replies[build].assistant_text
    const split = splitServerOpenQuestions(text)!
    render(<MessageBubble message={makeMsg({ content: text })} onChipClick={noop} />)

    const body = screen.getByTestId('message-body-text')
    expect(body.textContent).not.toContain(M)
    expect(body.textContent).not.toContain(split.questions.slice(0, 40))
    expect(body.textContent).toContain('The model was saved as version 1.')
    // Identity, not a count: the body renders exactly what stays at rest. The
    // markdown list becomes <li>s, so compare with whitespace and "- " dropped (the
    // renderer also shows an em dash as a hyphen).
    expect(bare(body.textContent ?? '')).toBe(bare(split.atRest))

    const toggle = screen.getByTestId('message-show-open-questions')
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(toggle.textContent).toContain('Questions this model does not answer yet')
    expect(screen.queryByTestId('message-open-questions')).toBeNull()

    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    // On demand, and verbatim: the producer's words, whole.
    expect(screen.getByTestId('message-open-questions').textContent).toBe(split.questions)
  })

  it('e39f6e0: the caveat and its ask are on the face of the reply, not under the toggle', () => {
    render(<MessageBubble message={makeMsg({ content: served.replies.e39f6e0.assistant_text })} onChipClick={noop} />)
    expect(bare(screen.getByTestId('message-body-text').textContent ?? '')).toContain(bare(HELD_AS_CONTEXT))
    fireEvent.click(screen.getByTestId('message-show-open-questions'))
    expect(screen.getByTestId('message-open-questions').textContent).not.toContain('fixed context')
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
    expect(screen.getByTestId('message-body-text').textContent).toContain(M)
    expect(screen.queryByTestId('message-show-open-questions')).toBeNull()
  })

  it("the user's own words are never split", () => {
    render(<MessageBubble message={makeMsg({ role: 'user', content: served0 })} onChipClick={noop} />)
    expect(screen.getByTestId('message-user').textContent).toContain(M)
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
