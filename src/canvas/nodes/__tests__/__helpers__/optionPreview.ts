import { fireEvent, waitFor } from '@testing-library/react'
import { expect } from 'vitest'

/**
 * ⭐ WHERE THE OPTION CARD'S S3 DETAIL LIVES NOW — ONE DEFINITION FOR THE SPECS
 * RE-POINTED BY THE BOUNDED ANATOMY (Experience Design, #63 5809278282, 24 Sep
 * 2026: "The fuller S3 reasoning detail — change rows, driver wording … — can
 * move to the existing hover/focus popover and inspector rather than expanding
 * layout geometry").
 *
 * In Standard view the change rows, `+N more`, the differentiator and (after a
 * run) the baseline meta render inside ONE block, `option-preview-detail-<id>`,
 * and that block is mounted ONLY inside the option's `NodePopover`. So a query
 * scoped to it is bound to the popover BY IDENTITY: a spec can never be
 * satisfied by a same-id element that drifted back onto the card body.
 *
 * ⚠ NOT A `.spec.` FILE, deliberately — the vitest include glob would collect it.
 */

/** The moved-detail block, or `null` — for specs whose `NodePopover` is a pass-through mock. */
export function optionPreviewDetail(optionId: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-testid="option-preview-detail-${optionId}"]`)
}

/**
 * Open the preview the way a pointer does (the real `usePopoverHover` +
 * portalled `NodePopover`), and return the moved-detail block inside it.
 * `container` is the render root, whose first element is the option's wrapper;
 * the portal lands on `document.body`, so `container` itself stays THE CARD.
 */
export async function openOptionPreview(container: HTMLElement, optionId: string): Promise<HTMLElement> {
  fireEvent.mouseEnter(container.firstElementChild as HTMLElement)
  let block: HTMLElement | null = null
  await waitFor(() => {
    block = document.querySelector<HTMLElement>(
      `[data-node-popover] [data-testid="option-preview-detail-${optionId}"]`,
    )
    expect(block, `the option preview for ${optionId} did not open`).not.toBeNull()
  })
  return block as unknown as HTMLElement
}
