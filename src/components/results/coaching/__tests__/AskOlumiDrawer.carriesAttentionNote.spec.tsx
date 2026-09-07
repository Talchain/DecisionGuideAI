/**
 * THE EXPLANATION MUST TRAVEL WITH THE USER TO THE CANVAS.
 *
 * "Focus on canvas" in the Ask-Olumi drawer moved the camera and then said so
 * in a TOAST. A toast is a transient message in a corner about something that
 * happened somewhere else: the user arrives at the element with the reason for
 * being there left behind in the drawer they just navigated away from.
 *
 * The machinery to do better already exists and is mounted —
 * `focusModelTarget(targetId, note?)` holds the element under attention and
 * anchors the note beside it (`OlumiAttentionCard`, PR #991). Its docblock says
 * the note is optional precisely so that "a caller that HAS something to say"
 * passes one. The drawer HAS something to say: `context` is the why-line, and
 * for Strengthen recommendations that line is the producer's finding verbatim.
 * It simply had no channel to carry it.
 *
 * ⚠ THE NOTE IS NEVER COMPOSED HERE, AND THAT IS THE WHOLE DESIGN. A note needs
 * a `move` from the closed four-move grammar, and the drawer does not receive
 * `helpType`, so it CANNOT derive one honestly. Inventing a move would be the
 * UI putting words in the producer's mouth — the exact thing
 * `attentionNoteForRecommendation`'s own comment refuses. So the note is built
 * by the opener, where the producer data lives, and the drawer only carries it.
 *
 * WHY THE TOAST STAYS. `requestOlumiAttention` is FAIL-CLOSED: if the targets
 * have gone stale it writes nothing and no card appears, while
 * `focusModelTarget` still returns true. So "a note was passed" does NOT imply
 * "a card is on screen", and suppressing the toast on that assumption would
 * trade a redundant message for total silence. Redundancy is the cheaper
 * failure, so the toast is unchanged.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const focusModelTarget = vi.fn(() => true)
vi.mock('../../../../canvas/utils/focusHelpers', () => ({
  focusModelTarget: (...args: unknown[]) => focusModelTarget(...(args as [])),
}))

import { AskOlumiDrawer } from '../AskOlumiDrawer'
import { useAskOlumiStore, openAskOlumi } from '../askOlumiStore'

const NOTE = {
  move: 'calibrate' as const,
  title: 'Price sensitivity is doing a lot of work',
  body: 'This factor moves the ranking more than any other, and its value is an Olumi estimate.',
}

describe('AskOlumiDrawer — the reason travels to the canvas', () => {
  beforeEach(() => {
    focusModelTarget.mockClear()
    useAskOlumiStore.setState({ isOpen: false, attentionNote: null, targetId: null })
  })

  it('carries the opener\'s note through to the canvas focus', () => {
    openAskOlumi({
      context: NOTE.body,
      draft: 'Help me think about this',
      label: NOTE.title,
      targetId: 'fac_price',
      attentionNote: NOTE,
    })
    render(<AskOlumiDrawer />)
    fireEvent.click(screen.getByRole('button', { name: /focus on canvas/i }))

    expect(focusModelTarget).toHaveBeenCalledTimes(1)
    // Bound by IDENTITY, not by "some truthy second argument": a different
    // note, or a note the drawer composed itself, must fail this.
    expect(focusModelTarget).toHaveBeenCalledWith('fac_price', NOTE)
  })

  it('CONTRAST — an opener with nothing to say still gets the plain camera move', () => {
    // The great majority of openers, which hold no `Recommendation`. Absence
    // must stay absence: a drawer that manufactured a note here would be
    // inventing a producer claim. (No count is quoted — the set is open and
    // the two figures this comment carried before were both wrong.)
    openAskOlumi({
      context: 'some context',
      draft: 'a draft',
      label: 'a label',
      targetId: 'fac_price',
    })
    render(<AskOlumiDrawer />)
    fireEvent.click(screen.getByRole('button', { name: /focus on canvas/i }))

    expect(focusModelTarget).toHaveBeenCalledTimes(1)
    const [, note] = focusModelTarget.mock.calls[0] as unknown as [string, unknown]
    expect(note ?? null).toBeNull()
  })

  it('still tells the user what happened, because attention can be dropped', () => {
    // requestOlumiAttention is fail-closed, so a passed note does not
    // guarantee a rendered card. The toast is the floor.
    openAskOlumi({
      context: NOTE.body,
      draft: 'd',
      label: 'l',
      targetId: 'fac_price',
      attentionNote: NOTE,
    })
    render(<AskOlumiDrawer />)
    fireEvent.click(screen.getByRole('button', { name: /focus on canvas/i }))

    expect(screen.getByText(/focused the relevant model elements/i)).toBeInTheDocument()
  })
})
