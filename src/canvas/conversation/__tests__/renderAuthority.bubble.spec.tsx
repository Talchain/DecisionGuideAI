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



})

describe('the collector is fed only what the turn ACTUALLY renders', () => {
  const APPLIED = 'Added constraint: budget at most £250,000.'
  const PROPOSED = 'Proposing to add a constraint.'

  function patchBlock(): ConversationBlock {
    return {
      type: 'graph_patch',
      patch_id: 'p1',
      operations: [],
      summary: PROPOSED,
      applied_summary: APPLIED,
      auto_apply: false,
    } as unknown as ConversationBlock
  }

  it('A2 — a PROPOSED patch does not suppress prose against its applied_summary', () => {
    // The card shows the proposed text; `applied_summary` is never on screen,
    // so prose matching it must survive. Suppressing here would delete a
    // sentence against text the user cannot see.
    render(
      <MessageBubble
        message={makeMsg({ content: `Intro.\n${APPLIED}`, blocks: [patchBlock()] })}
        onChipClick={noop}
      />,
    )
    expect(screen.getByTestId('message-body-text').textContent).toContain(APPLIED)
  })

  it('A3 — in structured mode, blocks are not suppressed against the unrendered free text', () => {
    // AnswerBody OWNS the body when a shape is present, so `content` is never
    // rendered. A commentary repeating it must therefore still show.
    const UNRENDERED = 'This free-text body is replaced by the structured answer.'
    render(
      <MessageBubble
        message={makeMsg({
          content: UNRENDERED,
          answerShape: { headline: 'A headline.', bullets: [], detail: 'Some detail.' },
          blocks: [{ type: 'commentary', text: UNRENDERED } as ConversationBlock],
        })}
        onChipClick={noop}
      />,
    )
    expect(screen.getByTestId('block-container').textContent).toContain(UNRENDERED)
  })


})

describe('duplicate sentence inside one disclosure (L-16, item 7)', () => {
  const ONLY_ONE_RUN =
    'There is only one analysis run so far, so there is nothing to compare yet.'



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
