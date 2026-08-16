/**
 * ONE RENDER AUTHORITY, at the surface — MessageBubble (L-16 / NEW-9).
 *
 * NEW-9, verbatim from the 16 Aug scoreboard: "The plan is stated twice per
 * structural edit (prose + card), byte-identical." The card carries the consent
 * control, so the card wins and the prose repeat is withheld.
 *
 * Every assertion binds by IDENTITY — the card's own testid, the body's own
 * testid — never by "some element contains this string", which a different
 * element could satisfy (platform trap 19).
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MessageBubble } from '../MessageBubble'
import type { ConversationMessage, ConversationBlock } from '../types'
import type { AnswerShape } from '../answerShape'

const noop = async () => {}

const PLAN = 'Add option Hire 2 Mid-Level Engineers (Under £45k)'

function heldBlock(summary: string): ConversationBlock {
  return {
    type: 'v5_held_proposal',
    proposal_id: 'gmh_test',
    summary,
    mutation_class: 'structural',
    reason_code: 'STRUCTURAL_APPLY_HELD',
    confirm: { label: 'Confirm these changes', message: 'confirm gmh_test' },
  } as unknown as ConversationBlock
}

function makeMsg(overrides: Partial<ConversationMessage> = {}): ConversationMessage {
  return {
    id: 'msg-render-authority',
    role: 'assistant',
    content: 'placeholder',
    timestamp: new Date(),
    ...overrides,
  }
}

describe('prose vs consent card', () => {
  it('withholds the prose paragraph the consent card already states', () => {
    render(
      <MessageBubble
        message={makeMsg({
          content: `Here is what I would change.\n${PLAN}\nNothing moves until you confirm.`,
          blocks: [heldBlock(PLAN)],
        })}
        onChipClick={noop}
      />,
    )
    const body = screen.getByTestId('message-body-text')
    expect(body.textContent).toContain('Here is what I would change.')
    expect(body.textContent).toContain('Nothing moves until you confirm.')
    // The plan is stated ONCE, and it is stated on the control the user
    // consents through.
    expect(body.textContent).not.toContain(PLAN)
    expect(screen.getByTestId('v5-held-proposal-summary').textContent).toContain(PLAN)
    expect(body.getAttribute('data-body-segments-withheld')).toBe('1')
  })

  it('omits the body element entirely when the card already said all of it', () => {
    render(
      <MessageBubble
        message={makeMsg({ content: PLAN, blocks: [heldBlock(PLAN)] })}
        onChipClick={noop}
      />,
    )
    expect(screen.queryByTestId('message-body-text')).toBeNull()
    expect(screen.getByTestId('v5-held-proposal-summary').textContent).toContain(PLAN)
  })

  it('OPPOSITE TWIN — prose that does NOT repeat the card is untouched', () => {
    const prose = 'I have drafted a plan you should look over before confirming.'
    render(
      <MessageBubble
        message={makeMsg({ content: prose, blocks: [heldBlock(PLAN)] })}
        onChipClick={noop}
      />,
    )
    const body = screen.getByTestId('message-body-text')
    expect(body.textContent).toContain(prose)
    expect(body.getAttribute('data-body-segments-withheld')).toBeNull()
  })

  it('OPPOSITE TWIN — a USER bubble is never withheld against anything', () => {
    render(
      <MessageBubble
        message={makeMsg({ role: 'user', content: PLAN, blocks: [heldBlock(PLAN)] })}
        onChipClick={noop}
      />,
    )
    expect(screen.getByTestId('message-user').textContent).toContain(PLAN)
  })

  it('OPPOSITE TWIN — nothing is withheld while the turn is still streaming', () => {
    // "Already rendered" is not yet a true statement about a card that has not
    // arrived; suppressing on a partial turn would delete text permanently.
    render(
      <MessageBubble
        message={makeMsg({ content: PLAN, blocks: [heldBlock(PLAN)], isStreaming: true })}
        onChipClick={noop}
      />,
    )
    expect(screen.getByTestId('message-body-text').textContent).toContain(PLAN)
  })
})

describe('answer shape vs consent card', () => {
  const answer: AnswerShape = {
    headline: PLAN,
    bullets: ['A supporting point.'],
    detail: 'The long tail of the explanation.',
  }

  it('withholds an answer headline the consent card already states', () => {
    render(
      <MessageBubble
        message={makeMsg({ content: 'ignored', answerShape: answer, blocks: [heldBlock(PLAN)] })}
        onChipClick={noop}
      />,
    )
    expect(screen.queryByTestId('answer-headline')).toBeNull()
    expect(screen.getByTestId('answer-bullets').textContent).toContain('A supporting point.')
    expect(screen.getByTestId('v5-held-proposal-summary').textContent).toContain(PLAN)
  })

  it('OPPOSITE TWIN — an answer headline nothing else states still renders', () => {
    render(
      <MessageBubble
        message={makeMsg({
          content: 'ignored',
          answerShape: answer,
          blocks: [heldBlock('A completely different plan.')],
        })}
        onChipClick={noop}
      />,
    )
    expect(screen.getByTestId('answer-headline').textContent).toContain(PLAN)
  })
})

describe('duplicate sentence inside one disclosure (L-16, item 7)', () => {
  const ONLY_ONE_RUN =
    'There is only one analysis run so far, so there is nothing to compare yet.'

  it('renders a commentary paragraph once when the prose already said it', () => {
    render(
      <MessageBubble
        message={makeMsg({
          content: `${ONLY_ONE_RUN}\nRun the analysis again after a change.`,
          blocks: [
            {
              type: 'commentary',
              text: `${ONLY_ONE_RUN}\nHere is the extra context.`,
            } as ConversationBlock,
          ],
        })}
        onChipClick={noop}
      />,
    )
    const container = screen.getByTestId('block-container')
    expect(container.textContent).toContain('Here is the extra context.')
    expect(container.textContent).not.toContain(ONLY_ONE_RUN)
    // and the prose kept it — the higher tier is never the one withheld
    expect(screen.getByTestId('message-body-text').textContent).toContain(ONLY_ONE_RUN)
  })

  it('NEVER empties a block: a wholly-duplicate commentary keeps its own text', () => {
    // Suppression removes PART of a block, never the whole of it. An empty card
    // with a live toggle is a worse artefact than the duplicate, and deleting a
    // block would breach the composition's own no-drop guarantee.
    render(
      <MessageBubble
        message={makeMsg({
          content: ONLY_ONE_RUN,
          blocks: [{ type: 'commentary', text: ONLY_ONE_RUN } as ConversationBlock],
        })}
        onChipClick={noop}
      />,
    )
    expect(screen.getByTestId('block-container').textContent).toContain(ONLY_ONE_RUN)
  })
})
