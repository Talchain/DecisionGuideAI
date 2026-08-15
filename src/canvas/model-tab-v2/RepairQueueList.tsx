/**
 * Model tab v2 — THE REPAIR QUEUE LIST, RENDER-ONLY (design §5.3).
 *
 * ⚠ UNMOUNTED, AND DELIBERATELY INERT. This renders the queue. It does not
 * apply anything, and it cannot: applying is a write, writes belong to Codex's
 * transactional-edit vertical, and that API is not frozen. Every Apply control
 * here is DISABLED and says why.
 *
 * ⚠ WHY NOT STUB THE APPLY. A stub that flipped a row to "applied" would
 * reproduce, inside the component written to kill it, the exact defect this
 * whole design exists to close: design §2 F6, where an edge strength, an
 * option's intervention and the goal target are local writes that never reach
 * the server while LOOKING identical to a factor-value edit that does. A queue
 * that reported eight successes it never had would be that defect multiplied by
 * eight and dressed as a productivity feature. A disabled affordance with an
 * honest label beats a fake one.
 *
 * ⚠ "APPLY ALL SHOWN" NEEDS THE BATCH CONTRACT, NOT A LOOP. Looping N single
 * proposals is N turns, N undo steps and N analysis invalidations for ONE user
 * gesture (`ModelEditAuthority.proposeBatch`, contracts.ts §1). So it is not
 * merely unwired — it is unbuildable until that operation exists, and the label
 * says so rather than implying the button is simply switched off.
 *
 * THE ORDER PROPERTY. The list renders EXACTLY the items it is given, in the
 * order it is given them — no sort, no filter, no dedup. The queue's producer
 * owns the order; a list that quietly re-sorted would disagree with the count on
 * the chip that opened it, and the estate has already shipped a badge whose
 * number and whose rows could not both be right.
 */

import { typography } from '../../styles/typography'
import type { RepairQueue, RepairQueueItem } from './types'

export interface RepairQueueListProps {
  queue: RepairQueue
  /** Rendered verbatim, in order. See the header. */
  items: readonly RepairQueueItem[]
  /** Focus the element on the canvas — read-only navigation, safe today. */
  onFocusOnCanvas?: (rowId: string) => void
}

const NO_AUTHORITY_ITEM =
  'Applying is not connected yet — this cannot be changed from here.'

const NO_AUTHORITY_BATCH =
  'Applying every row at once needs the batch operation that is still being built. ' +
  'Doing it one row at a time would re-run the analysis after each one.'

export function RepairQueueList({ queue, items, onFocusOnCanvas }: RepairQueueListProps) {
  return (
    <section data-testid={`repair-queue-v2-${queue.id}`} className="flex flex-col gap-2 p-2">
      <header>
        <h3 className={`${typography.h5} text-text-header`}>{queue.title}</h3>
        <p data-testid={`repair-queue-v2-${queue.id}-count`} className={`${typography.caption} text-text-light`}>
          {items.length === 1 ? '1 item' : `${items.length} items`}
        </p>
      </header>

      {items.length === 0 ? (
        <p
          data-testid={`repair-queue-v2-${queue.id}-empty`}
          className={`${typography.bodySmall} text-text-light`}
        >
          Nothing needs attention here.
        </p>
      ) : (
        <ul data-testid={`repair-queue-v2-${queue.id}-items`}>
          {items.map(item => (
            <li
              key={item.rowId}
              data-testid={`repair-queue-v2-${queue.id}-item-${item.rowId}`}
              data-row-id={item.rowId}
              className="flex items-center gap-2 py-1 border-b border-panel-border"
            >
              <button
                type="button"
                data-testid={`repair-queue-v2-${queue.id}-item-${item.rowId}-label`}
                onClick={() => onFocusOnCanvas?.(item.rowId)}
                className={`${typography.bodySmall} text-text-body text-left truncate`}
              >
                {item.label}
              </button>

              <span
                data-testid={`repair-queue-v2-${queue.id}-item-${item.rowId}-current`}
                className={`${typography.tabular} text-text-light`}
              >
                {item.currentValue ?? 'No value set'}
              </span>

              {item.suggestedValue !== null && (
                <span
                  data-testid={`repair-queue-v2-${queue.id}-item-${item.rowId}-suggested`}
                  className={`${typography.tabular} text-text-body`}
                >
                  {'→ '}
                  {item.suggestedValue}
                </span>
              )}

              {item.basis !== null && (
                <span
                  data-testid={`repair-queue-v2-${queue.id}-item-${item.rowId}-basis`}
                  className={`${typography.caption} text-text-light`}
                >
                  {item.basis}
                </span>
              )}

              <button
                type="button"
                data-testid={`repair-queue-v2-${queue.id}-item-${item.rowId}-apply`}
                disabled
                title={NO_AUTHORITY_ITEM}
                aria-label={`${item.label} — ${NO_AUTHORITY_ITEM}`}
                className={`${typography.buttonSmall} text-text-light cursor-not-allowed border border-panel-border rounded px-2 py-0.5`}
              >
                Apply
              </button>
            </li>
          ))}
        </ul>
      )}

      {queue.supportsApplyAll && items.length > 0 && (
        <button
          type="button"
          data-testid={`repair-queue-v2-${queue.id}-apply-all`}
          disabled
          title={NO_AUTHORITY_BATCH}
          aria-label={NO_AUTHORITY_BATCH}
          className={`${typography.button} text-text-light cursor-not-allowed border border-panel-border rounded px-2 py-1 self-end`}
        >
          Apply all shown
        </button>
      )}
    </section>
  )
}
