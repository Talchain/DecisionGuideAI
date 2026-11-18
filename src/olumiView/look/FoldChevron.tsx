/**
 * The one fold affordance (18 Nov audit compare-model-03, analysis-why-toggle-not-a-control): a chevron that turns when the fold is open,
 * the Model tab's own mark. A button-driven fold passes `open`; a native `<details>` leaves it out, puts `group` on the details and
 * `FOLD_SUMMARY` on its summary (the browser's own triangle is hidden), and the chevron turns with the details' `open`.
 */
import { ChevronRight } from 'lucide-react'

export function FoldChevron({ open }: { open?: boolean }): JSX.Element {
  const turn = open === undefined ? 'group-open:rotate-90' : open ? 'rotate-90' : ''
  return <ChevronRight aria-hidden="true" strokeWidth={1.75} data-fold-chevron={open === undefined ? 'details' : open ? 'open' : 'closed'}
    className={`h-3.5 w-3.5 flex-none text-text-light transition-transform motion-reduce:transition-none ${turn}`} />
}

/** A details' summary row: the chevron leads, the browser's own marker is gone. */
export const FOLD_SUMMARY = 'flex list-none items-center gap-1 [&::-webkit-details-marker]:hidden'
