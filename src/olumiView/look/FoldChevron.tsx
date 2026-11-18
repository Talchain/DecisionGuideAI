/**
 * The one fold affordance (18 Nov audit compare-model-03, analysis-why-toggle-not-a-control): a chevron that turns when the fold is open,
 * the Model tab's own mark. A button-driven fold passes `open`; a native `<details>` leaves it out, puts the chevron as the summary's first child and
 * `FOLD_SUMMARY` on its summary (the browser's own triangle is hidden), and the chevron turns with the details' `open`.
 */
import { OkIcon } from './icons'

/** Turns only with its OWN details (the summary's parent), never with an open details further out: `group-open:` matched any open ancestor, so the
 *  closed folds inside an open "Compare versions" showed open chevrons (review of dd8283b4). The chevron is the summary's direct child. */
export const DETAILS_TURN = '[details[open]>summary>&]:rotate-90'

export function FoldChevron({ open, className }: { open?: boolean; className?: string }): JSX.Element {
  const turn = open === undefined ? DETAILS_TURN : open ? 'rotate-90' : ''
  return (
    <span data-fold-chevron={open === undefined ? 'details' : open ? 'open' : 'closed'}
      className={`inline-flex flex-none transition-transform motion-reduce:transition-none ${turn}${className ? ` ${className}` : ''}`}>
      <OkIcon id="fold-chevron" size={14} inherit decorative />
    </span>
  )
}

/** A details' summary row: the chevron leads, the browser's own marker is gone. */
export const FOLD_SUMMARY = 'flex list-none items-center gap-1 [&::-webkit-details-marker]:hidden'
