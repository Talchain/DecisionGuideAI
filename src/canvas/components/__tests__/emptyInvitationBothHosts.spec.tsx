/**
 * The empty Olumi conversation says the same thing on BOTH of its hosts.
 *
 * ⚠ THE DEFECT THIS PINS WAS SHIPPED, AND IT WAS SHIPPED AS A FIX. On 20 Sep
 * 2026 the invitation was added so an empty Olumi surface would stop asking a
 * user with a full canvas to describe their decision. It was written inside
 * `OlumiTabBody`, where the defect had been photographed, and
 * `useEmptyConversationInvitation` ended up with exactly ONE consumer. The
 * conversation it describes has TWO hosts. Measured side by side in one browser
 * run — same seeded canvas, same empty conversation
 * (`e2e/geometry/floatingComposerLook.measure.ts`) — the docked tab rendered
 * the sentence and the floating panel rendered a 400×550 white void above its
 * composer.
 *
 * So these assertions are about the PAIR, like the ones in
 * `hooks/__tests__/emptyConversationInvitation.spec.tsx` that pin the
 * invitation against the placeholder. A host may choose where to put the line
 * and what to call it; it may not choose what it says, and it may not choose
 * not to have one.
 *
 * ⚠ AND THE PREDICATE IS PART OF THE PAIR. "Empty" means no non-synthetic
 * messages. Two hosts answering that separately is how the invitation would
 * come back on one surface and not the other, so the test below feeds the SAME
 * message shapes to both and requires the same answer.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  EmptyConversationInvitation,
  INVITATION_TESTID_DOCKED,
  INVITATION_TESTID_FLOATING,
  conversationIsEmpty,
} from '../EmptyConversationInvitation'

const INVITATION = 'Your model is on the canvas. Ask Olumi about any part of it.'

vi.mock('../../hooks/useConversationStage', () => ({
  useEmptyConversationInvitation: () => INVITATION,
}))

describe('the invitation is one sentence with two hosts', () => {
  it('renders the SAME producer sentence under the docked testid', () => {
    render(<EmptyConversationInvitation testId={INVITATION_TESTID_DOCKED} />)
    expect(screen.getByTestId(INVITATION_TESTID_DOCKED)).toHaveTextContent(INVITATION)
  })

  it('renders the SAME producer sentence under the floating testid', () => {
    render(<EmptyConversationInvitation testId={INVITATION_TESTID_FLOATING} />)
    expect(screen.getByTestId(INVITATION_TESTID_FLOATING)).toHaveTextContent(INVITATION)
  })

  /**
   * The two hosts can be mounted at once (the floating panel and the docked tab
   * both live under `FloatingOlumiPanelHost`), so one name for both would make
   * every probe ambiguous — the same hazard `THREAD_TESTID_DOCKED` /
   * `THREAD_TESTID_FLOATING` exist for.
   */
  it('gives the two hosts DIFFERENT testids, because both can be mounted at once', () => {
    expect(INVITATION_TESTID_DOCKED).not.toBe(INVITATION_TESTID_FLOATING)
  })

  it('renders both at once without either name resolving twice', () => {
    render(
      <>
        <EmptyConversationInvitation testId={INVITATION_TESTID_DOCKED} />
        <EmptyConversationInvitation testId={INVITATION_TESTID_FLOATING} />
      </>,
    )
    expect(screen.getAllByTestId(INVITATION_TESTID_DOCKED)).toHaveLength(1)
    expect(screen.getAllByTestId(INVITATION_TESTID_FLOATING)).toHaveLength(1)
  })
})

describe('one emptiness predicate, so the hosts cannot disagree', () => {
  it('calls a conversation with no messages empty', () => {
    expect(conversationIsEmpty([])).toBe(true)
  })

  it('calls a conversation of ONLY synthetic messages empty', () => {
    expect(conversationIsEmpty([{ synthetic: true }, { synthetic: true }])).toBe(true)
  })

  it('calls a conversation with one real message NOT empty', () => {
    expect(conversationIsEmpty([{ synthetic: true }, {}])).toBe(false)
  })

  /**
   * Positive control: the assertions above can fail. A predicate that ignored
   * `synthetic` would call the second case NOT empty, and the invitation would
   * vanish the moment the product posted a status line to itself.
   */
  it('positive control — ignoring `synthetic` changes the answer', () => {
    const naive = (m: ReadonlyArray<unknown>) => m.length === 0
    const onlySynthetic = [{ synthetic: true }]
    expect(conversationIsEmpty(onlySynthetic)).toBe(true)
    expect(naive(onlySynthetic)).toBe(false)
  })

  it('treats a message with `synthetic: false` as real', () => {
    expect(conversationIsEmpty([{ synthetic: false }])).toBe(false)
  })
})
