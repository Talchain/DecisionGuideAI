import { fireEvent, waitFor } from '@testing-library/react'
import { expect } from 'vitest'

/**
 * ⭐ WHERE THE OPTION CARD'S DETAIL LIVES NOW — ONE DEFINITION FOR THE SPECS
 * THAT READ IT.
 *
 * ── THE ROWS ARE BACK ON THE CARD (Paul, 25 Sep 2026) ──────────────────────
 * Paul ruled from live screenshots that the canvas must match the PROTOTYPE,
 * which shows one ROW per concrete change on the resting card. That supersedes
 * Experience Design's bounded anatomy (#63 5809278282), which had moved the
 * change rows, `+N more` and (after a run) the baseline meta into the option's
 * popover. So, in Standard view:
 *
 *   · the change rows and `+N more` render ONCE, in `option-change-rows-<id>`,
 *     in the CARD body (`optionCardRows`), in both phases;
 *   · the baseline meta is on the card in both phases;
 *   · the popover keeps only the computed differentiator's full sentence, in
 *     `option-preview-detail-<id>` — mounted only when that sentence renders.
 *
 * A query scoped to `optionCardRows` is bound to the card BY IDENTITY: it
 * refuses a rows block found inside a popover.
 *
 * ⚠ NOT A `.spec.` FILE, deliberately — the vitest include glob would collect it.
 */

/** Any popover region: the real portalled `NodePopover`, or a spec's pass-through mock. */
const POPOVER_SELECTOR = '[data-node-popover], [data-testid="node-popover"]'

/**
 * The option's change-rows block ON THE CARD (rows + `+N more`). Fails loudly
 * when the block is missing or sits inside a popover.
 */
export function optionCardRows(optionId: string): HTMLElement {
  const blocks = Array.from(
    document.querySelectorAll<HTMLElement>(`[data-testid="option-change-rows-${optionId}"]`),
  )
  expect(blocks.length, `the change rows for ${optionId} render exactly once`).toBe(1)
  expect(blocks[0].closest(POPOVER_SELECTOR), `the change rows for ${optionId} are on the card, not in a popover`).toBeNull()
  return blocks[0]
}

/** The popover's detail block (the differentiator's full sentence), or `null` — for pass-through `NodePopover` mocks. */
export function optionPreviewDetail(optionId: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-testid="option-preview-detail-${optionId}"]`)
}

/**
 * Open the preview the way a pointer does (the real `usePopoverHover` +
 * portalled `NodePopover`) and return the OPENED POPOVER — so a query scoped to
 * it is bound to the popover by identity, and a sentence the card suppresses
 * reads as absent rather than as a preview that never opened. `container` is the
 * render root, whose first element is the option's wrapper; the portal lands on
 * `document.body`, so `container` itself stays THE CARD.
 */
export async function openOptionPreview(container: HTMLElement, optionId: string): Promise<HTMLElement> {
  fireEvent.mouseEnter(container.firstElementChild as HTMLElement)
  let popover: HTMLElement | null = null
  await waitFor(() => {
    popover = document.querySelector<HTMLElement>('[data-node-popover]')
    expect(popover, `the option preview for ${optionId} did not open`).not.toBeNull()
    expect(container.contains(popover), 'the preview is portalled off the card').toBe(false)
  })
  return popover as unknown as HTMLElement
}
