/** Contract 3's one-row review (ViewChat ProposalReview), as the specs open and read it: a button row (aria-expanded) over a body that is
 *  `hidden` while closed. Opening is a press on the row, as the person does it. */
import { fireEvent } from '@testing-library/react'
export const rowOf = (review: Element): HTMLButtonElement => review.querySelector<HTMLButtonElement>('[data-testid="view-proposal-row"]')!
export const bodyOf = (review: Element): HTMLElement => review.querySelector<HTMLElement>('[data-review-body]')!
export const isOpen = (review: Element): boolean => review.getAttribute('data-open') === 'true'
export const setOpen = (review: Element, open: boolean): void => {
  // Review controls are reached through the quiet foot row first (Paul, 21 Nov).
  const chip = review.closest('[data-testid="view-chat"]')?.querySelector('[data-testid="view-chat-foot-proposal"]')
  if (chip?.getAttribute('aria-expanded') === 'false') fireEvent.click(chip)
  if (isOpen(review) !== open) fireEvent.click(rowOf(review))
}
