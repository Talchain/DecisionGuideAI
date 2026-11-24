/** Look up the heading and use the Review chip to open or close the change list. */
import { fireEvent } from '@testing-library/react'
export const rowOf = (review: Element): HTMLElement => review.querySelector<HTMLElement>('[data-testid="view-proposal-row"]')!
export const reviewToggleOf = (review: Element): HTMLButtonElement => review.querySelector<HTMLButtonElement>('[data-testid="view-proposal-review-toggle"]')!
export const bodyOf = (review: Element): HTMLElement => review.querySelector<HTMLElement>('[data-review-body]')!
export const isOpen = (review: Element): boolean => review.getAttribute('data-open') === 'true'
export const setOpen = (review: Element, open: boolean): void => {
  // Review controls are reached through the quiet foot row first (Paul, 21 Nov).
  const chip = review.closest('[data-testid="view-chat"]')?.querySelector('[data-testid="view-chat-foot-proposal"]')
  if (chip?.getAttribute('aria-expanded') === 'false') fireEvent.click(chip)
  if (isOpen(review) !== open) fireEvent.click(reviewToggleOf(review))
}
