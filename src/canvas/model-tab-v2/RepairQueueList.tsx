/**
 * Model tab v2 — THE REPAIR QUEUE LIST, RENDER-ONLY (design §5.3).
 *
 * ⚠⚠ NO LONGER WHOLLY INERT, AND NO LONGER UNMOUNTED (18 Aug 2026, the
 * REHOME → DELETE lane). Two of the four carriers this file was waiting for
 * now exist: #777 gave `useModelEditAuthority` `proposeFactorConfirmation`
 * and `proposeOptionIntervention`. So the CONFIRM-ESTIMATES queue is mounted
 * and its Confirm resolves, through the SAME authority call as the outline
 * row's Confirm chip — one edit, one path, two entry points. `proposeBatch`
 * and `proposeDeferral` still do not exist, so Apply-all, Defer and Resume
 * remain disabled and still say why. The paragraph below is the ORIGINAL
 * statement, kept because its reasoning is what governs the parts that are
 * still inert.
 *
 * ⚠ DELIBERATELY INERT (as shipped 16 Aug 2026, and still true of every
 * control whose carrier is missing;
 * which mounted the outline + detail region only). This renders the queue. It
 * does not apply anything, and it cannot: applying needs write operations the
 * canonical wire does not carry yet (`proposeOptionIntervention`,
 * `proposeFactorConfirmation`, `proposeBatch`, `proposeDeferral` — contracts.ts
 * §1). Every Apply, Defer and Resume control here is DISABLED and says why.
 * Mounting an actionless queue would add noise, not capability, so the queues
 * wait for their carriers.
 *
 * ⚠ WHY NOT STUB THE APPLY. A stub that flipped a row to "applied" would
 * reproduce, inside the component written to kill it, the exact defect this
 * whole design exists to close: design §2 F6, where an edge strength, an
 * option's intervention and the goal target are local writes that never reach
 * the server while LOOKING identical to a factor-value edit that does. A queue
 * that reported eight successes it never had would be that defect multiplied by
 * eight and dressed as a productivity feature.
 *
 * ⚠ "APPLY ALL SHOWN" NEEDS THE BATCH CONTRACT, NOT A LOOP. Looping N single
 * proposals is N turns, N undo steps and N analysis invalidations for ONE user
 * gesture (`ModelEditAuthority.proposeBatch`, contracts.ts §1).
 *
 * ── DEFERRAL (Paul's ruling, 16 Aug 2026) ───────────────────────────────────
 *
 * Every item carries **Leave unresolved** alongside its resolving action. A
 * queue offering only the resolving action is not respecting the user's
 * judgement, it is insisting they agree with it.
 *
 * ⚠ THE TWO PROPERTIES THAT SEPARATE THIS FROM THE DISMISS BUTTON THE DESIGN
 * JUST CUT — a Defer missing either one IS that button under a better name:
 *
 *   1. A DEFERRED ITEM NEVER LEAVES THE RENDERED QUEUE. It moves to the
 *      de-emphasised "Left unresolved" group BELOW the active list — same
 *      component, same surface, same `-item-<rowId>` identity. It is never
 *      filtered out. `RepairQueueDeferral.spec` pins this by identity.
 *   2. IT CARRIES PROVENANCE — who deferred it and when, printed, every time.
 *
 * ⚠ AND DEFERRED ITEMS ARE EXCLUDED FROM "APPLY ALL SHOWN". A batch that swept
 * them back in would silently overrule a recorded human decision, which is the
 * one thing a repair queue must never do. They are shown; they are not
 * shown-and-pending.
 *
 * Deferral is itself a WRITE — persisted model state carrying a person and a
 * timestamp (§9.1 C15) — so it waits for the same frozen API as every edit. The
 * design would rather offer nothing than record a choice it cannot persist.
 *
 * THE ORDER PROPERTY. Within each group the list renders EXACTLY the items it is
 * given, in the order it is given them — no sort, no dedup. The queue's producer
 * owns the order.
 */

import { typography } from '../../styles/typography'
import { deferralLabel } from './rowPresentation'
import type { RepairQueue, RepairQueueItem } from './types'

export interface RepairQueueListProps {
  queue: RepairQueue
  /** Rendered verbatim, in order, active first then deferred. See the header. */
  items: readonly RepairQueueItem[]
  /** Focus the element on the canvas — read-only navigation, safe today. */
  onFocusOnCanvas?: (rowId: string) => void
  /**
   * Resolve ONE item, through the caller's write authority.
   *
   * ⚠ OPTIONAL, AND ITS ABSENCE IS THE HONEST DEFAULT. A queue whose carrier
   * does not exist yet passes nothing and every Apply stays DISABLED with the
   * reason on it — the state this component shipped in. A queue whose carrier
   * DOES exist passes it, and only that queue's button comes alive. So
   * "connected" is a per-queue fact the type system carries, not a flag someone
   * has to remember to keep true.
   *
   * ⚠ THIS COMPONENT STILL WRITES NOTHING. It calls back; the mount host owns
   * the authority. Wiring a store setter in here would make the queue a second
   * writer of the same edit — the defect the whole consolidation removes.
   */
  onApply?: (rowId: string) => void
  /**
   * What resolving means IN THIS QUEUE. "Apply" is right for a suggested value;
   * "Confirm" is right for ratifying an estimate that is already in the model,
   * where "Apply" would imply a change that does not happen.
   */
  applyLabel?: string
}

const NO_AUTHORITY_ITEM =
  'Applying is not connected yet — this cannot be changed from here.'

/**
 * ⚠ A DIFFERENT REFUSAL FROM `NO_AUTHORITY_ITEM`, AND IT MUST READ THAT WAY.
 * "Not connected yet" is about the product; this is about THIS ROW. Telling a
 * user their row is awaiting a carrier when in fact it has no value to act on
 * sends them to wait for something that will not help them.
 */
const NO_REFERENT_ITEM =
  'There is no value here to act on yet — set one first.'

const NO_AUTHORITY_DEFER =
  'Recording this decision is not connected yet — leaving it unresolved cannot be saved from here.'

const NO_AUTHORITY_RESUME =
  'Recording this decision is not connected yet — this cannot be reopened from here.'

const NO_AUTHORITY_BATCH =
  'Applying every row at once needs the batch operation that is still being built. ' +
  'Doing it one row at a time would re-run the analysis after each one. ' +
  'Items left unresolved are never included.'

/**
 * The resolving control — ONE button, and never a third state that pretends.
 *
 * ⚠⚠ IT IS FAIL-CLOSED ON THE ITEM AS WELL AS ON THE CARRIER (F2). An item with
 * NEITHER a current value nor a suggested one has nothing for Apply to refer
 * to: the authority fails closed on it, writes nothing, and returns an outcome
 * both call sites discard — so the user pressed a live button and the model did
 * not move, with no feedback. That is preamble P8, and it is precisely what the
 * outline's row chip already refuses (`ModelRowView.tsx:134-136`).
 *
 * ⚠ THIS IS NOT A SECOND ANSWER TO THE PRODUCER'S QUESTION (trap 21). The
 * producer answers *"which elements belong in THIS queue?"* — a per-queue
 * membership rule. This answers *"does this item carry anything to act on?"* — a
 * universal property of a queue row, true whichever producer built it. Note the
 * predicate is deliberately the WEAKER, general one: `set-option-values` items
 * legitimately have `currentValue === null` and carry a `suggestedValue`, so a
 * gate copied from the confirm queue's membership rule would have silently
 * disabled Queue A before it was ever mounted.
 */
function ApplyControl({
  queueId,
  item,
  onApply,
  applyLabel,
}: {
  queueId: string
  item: RepairQueueItem
  onApply?: (rowId: string) => void
  applyLabel: string
}) {
  const hasReferent = item.currentValue !== null || item.suggestedValue !== null
  const enabled = onApply !== undefined && hasReferent
  const reason = onApply === undefined ? NO_AUTHORITY_ITEM : NO_REFERENT_ITEM
  return (
    <button
      type="button"
      data-testid={`repair-queue-v2-${queueId}-item-${item.rowId}-apply`}
      disabled={!enabled}
      onClick={enabled ? () => onApply!(item.rowId) : undefined}
      title={enabled ? undefined : reason}
      aria-label={enabled ? `${applyLabel} ${item.label}` : `${item.label} — ${reason}`}
      className={`${typography.buttonSmall} border border-panel-border rounded px-2 py-0.5 ${
        enabled ? 'text-text-header hover:bg-panel-hover' : 'text-text-light cursor-not-allowed'
      }`}
    >
      {enabled ? applyLabel : 'Apply'}
    </button>
  )
}

/** The label/value cells, identical in both groups so one item reads one way. */
function ItemCells({
  queueId,
  item,
  onFocusOnCanvas,
}: {
  queueId: string
  item: RepairQueueItem
  onFocusOnCanvas?: (rowId: string) => void
}) {
  const base = `repair-queue-v2-${queueId}-item-${item.rowId}`
  return (
    <>
      <button
        type="button"
        data-testid={`${base}-label`}
        onClick={() => onFocusOnCanvas?.(item.rowId)}
        className={`${typography.bodySmall} text-text-body text-left truncate`}
      >
        {item.label}
      </button>

      <span data-testid={`${base}-current`} className={`${typography.tabular} text-text-light`}>
        {item.currentValue ?? 'No value set'}
      </span>

      {item.suggestedValue !== null && (
        <span data-testid={`${base}-suggested`} className={`${typography.tabular} text-text-body`}>
          {'→ '}
          {item.suggestedValue}
        </span>
      )}

      {item.basis !== null && (
        <span data-testid={`${base}-basis`} className={`${typography.caption} text-text-light`}>
          {item.basis}
        </span>
      )}
    </>
  )
}

export function RepairQueueList({
  queue,
  items,
  onFocusOnCanvas,
  onApply,
  applyLabel = 'Apply',
}: RepairQueueListProps) {
  // Partition, preserving the caller's order within each group.
  const activeItems = items.filter(i => i.deferred === undefined)
  const deferredItems = items.filter(i => i.deferred !== undefined)
  const q = queue.id

  return (
    <section data-testid={`repair-queue-v2-${q}`} className="flex flex-col gap-2 p-2">
      <header>
        <h3 className={`${typography.panelHeader} text-text-header`}>{queue.title}</h3>
        {/*
          The two counts are reported SEPARATELY and deliberately. Deferring does
          not reduce the number of real gaps in the model — only the number
          awaiting a decision — so a single count that fell when somebody
          deferred would be quietly lying about the model's state.
        */}
        <p
          data-testid={`repair-queue-v2-${q}-count`}
          className={`${typography.caption} text-text-light`}
        >
          {items.length === 1 ? '1 item' : `${items.length} items`}
          {deferredItems.length > 0 && ` · ${deferredItems.length} left unresolved`}
        </p>
      </header>

      {items.length === 0 ? (
        <p
          data-testid={`repair-queue-v2-${q}-empty`}
          className={`${typography.bodySmall} text-text-light`}
        >
          Nothing needs attention here.
        </p>
      ) : activeItems.length === 0 ? (
        <p
          data-testid={`repair-queue-v2-${q}-all-deferred`}
          className={`${typography.bodySmall} text-text-light`}
        >
          Everything here has been left unresolved.
        </p>
      ) : (
        <ul data-testid={`repair-queue-v2-${q}-items`}>
          {activeItems.map(item => (
            <li
              key={item.rowId}
              data-testid={`repair-queue-v2-${q}-item-${item.rowId}`}
              data-row-id={item.rowId}
              data-deferred="false"
              className="flex items-center gap-2 py-1 border-b border-panel-border"
            >
              <ItemCells queueId={q} item={item} onFocusOnCanvas={onFocusOnCanvas} />

              {/*
                ⚠ THIS COMMENT PREVIOUSLY CLAIMED "it never renders
                enabled-but-inert". THAT WAS FALSE when written: it gated on the
                carrier alone, so an item with no value rendered an ENABLED
                Confirm that wrote nothing. The claim is now true, and it is true
                because `ApplyControl` gates on the ITEM as well — see its header.
              */}
              <ApplyControl
                queueId={q}
                item={item}
                onApply={onApply}
                applyLabel={applyLabel}
              />

              {/*
                The user's other legitimate answer. It sits beside Apply, not
                behind a menu: "I have seen this and it can wait" is a first-class
                outcome, not an escape hatch.
              */}
              <button
                type="button"
                data-testid={`repair-queue-v2-${q}-item-${item.rowId}-defer`}
                disabled
                title={NO_AUTHORITY_DEFER}
                aria-label={`${item.label} — ${NO_AUTHORITY_DEFER}`}
                className={`${typography.buttonSmall} text-text-light cursor-not-allowed border border-panel-border rounded px-2 py-0.5`}
              >
                Leave unresolved
              </button>
            </li>
          ))}
        </ul>
      )}

      {/*
        ⚠ THE DEFERRED GROUP IS PART OF THE QUEUE, NOT A DIFFERENT SCREEN. Same
        component, same `-item-<rowId>` identity, still on screen. De-emphasised,
        never removed — that distinction is the entire ruling.
      */}
      {deferredItems.length > 0 && (
        <section data-testid={`repair-queue-v2-${q}-deferred-group`} className="opacity-70">
          <h4
            data-testid={`repair-queue-v2-${q}-deferred-heading`}
            className={`${typography.label} text-text-light`}
          >
            Left unresolved ({deferredItems.length})
          </h4>
          <ul data-testid={`repair-queue-v2-${q}-deferred-items`}>
            {deferredItems.map(item => (
              <li
                key={item.rowId}
                data-testid={`repair-queue-v2-${q}-item-${item.rowId}`}
                data-row-id={item.rowId}
                data-deferred="true"
                className="flex items-center gap-2 py-1 border-b border-panel-border"
              >
                <ItemCells queueId={q} item={item} onFocusOnCanvas={onFocusOnCanvas} />

                {/*
                  The provenance. Printed, always — an anonymous or undated
                  deferral cannot be told apart from a row a bug dropped, and the
                  honest state ("a human chose this") would decay into "this was
                  never a gap".
                */}
                <span
                  data-testid={`repair-queue-v2-${q}-item-${item.rowId}-deferral`}
                  className={`${typography.caption} text-text-light`}
                >
                  {deferralLabel(item.deferred!)}
                </span>

                {/* A choice you cannot revisit is a trap, not agency. */}
                <button
                  type="button"
                  data-testid={`repair-queue-v2-${q}-item-${item.rowId}-resume`}
                  disabled
                  title={NO_AUTHORITY_RESUME}
                  aria-label={`${item.label} — ${NO_AUTHORITY_RESUME}`}
                  className={`${typography.buttonSmall} text-text-light cursor-not-allowed border border-panel-border rounded px-2 py-0.5`}
                >
                  Resume
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {queue.supportsApplyAll && activeItems.length > 0 && (
        <button
          type="button"
          data-testid={`repair-queue-v2-${q}-apply-all`}
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
