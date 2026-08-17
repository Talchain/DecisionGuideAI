/**
 * ActOnItSection — "What to act on next", a DESIGNED SECTION of the one
 * analysis cockpit.
 *
 * ## What this replaces
 *
 * Two things that were the same idea shipped twice:
 *
 * 1. `analysisHeroV17/HeroInputRows` — the per-factor act-on-it model (a row
 *    names a factor, says why it matters, and carries the actions that resolve
 *    it). Good idea; it lived on the analysis fork's dark arm, which no
 *    deployment ever mounted, so no user saw it. Both are now deleted.
 *
 * 2. `TriageActionCardsBody`, wedged into the live arm as a CHROMELESS
 *    `<div className="space-y-3 empty:hidden">` sibling of the hero panel. Its
 *    own call-site comment conceded the point: "No card chrome is invented
 *    here: what this surface should look like framed is a design decision, not
 *    a wiring one." This section is that design decision, taken.
 *
 * Both now render INSIDE the hero panel's chrome, under one heading, in
 * priority order: the rows first (what to do), then the evidence queue (the
 * factors whose estimates you can confirm or correct in place).
 *
 * ## Ownership split (no double-render)
 *
 * The rows deliberately carry NO evidence-gap category — the queue owns those,
 * because the queue's card is the only host of P4's "Confirm AI estimate" and
 * inline value editor. See `rankActOnItRows.ts` for the full argument and
 * `analysisCockpit.mountPath.spec.tsx` §2a for the pin in both directions.
 *
 * ## Presentational
 *
 * No store reads. The rows, the dispatcher and the queue node all arrive as
 * props, so the panel that hosts this stays prop-driven (the module's
 * standing contract, enforced by `__tests__/inertness.spec.ts`).
 */

import { useState, type ReactNode } from 'react'
import { Clock } from 'lucide-react'
import { typography } from '@/styles/typography'
import { HERO_COPY } from '../heroCopy'
import { ROW_TINT_CLASS, CATEGORY_DOT_CLASS } from './tokens'
import { ActOnItActionRow } from './ActOnItActionRow'
import type { ActOnItRow, RowActionDispatcher } from './types'

export interface ActOnItSectionProps {
  /** Rows shown immediately (already sliced by `splitActOnItRows`). */
  rows: ActOnItRow[]
  /** Rows behind the "+N" disclosure. */
  hiddenRows: ActOnItRow[]
  dispatchRowAction: RowActionDispatcher
  /**
   * False when no chat wire is registered: chat-dependent row actions are
   * hidden rather than rendered dead. Edit/Confirm are unaffected.
   */
  chatAvailable: boolean
  /**
   * The evidence-gap queue + its contextual blocks (`TriageActionCardsBody`),
   * passed as a node so this module stays free of the results data type and of
   * the queue's six write handlers. Absent = nothing to host.
   */
  queueSlot?: ReactNode
}

export function ActOnItSection({
  rows,
  hiddenRows,
  dispatchRowAction,
  chatAvailable,
  queueSlot,
}: ActOnItSectionProps) {
  const [expanded, setExpanded] = useState(false)
  const hasRows = rows.length > 0 || hiddenRows.length > 0
  // Nothing to host at all ⇒ render nothing. Never an empty heading and never
  // a stray divider: the section's chrome is drawn only when the rows exist,
  // and the queue keeps its own `empty:hidden` wrapper for the runs where it
  // resolves to nothing.
  if (!hasRows && queueSlot == null) return null

  return (
    <section
      data-testid="hero-act-on-it"
      aria-label={HERO_COPY.actOnIt.aria}
      className="space-y-2"
    >
      {hasRows && (
        <>
          <div className="flex items-center justify-between gap-2 border-t border-panel-border pt-2">
            <strong className={`${typography.panelHeader} text-text-header`}>
              {HERO_COPY.actOnIt.heading}
            </strong>
            {hiddenRows.length > 0 && (
              <button
                type="button"
                onClick={() => setExpanded(e => !e)}
                aria-expanded={expanded}
                className={`${typography.panelMeta} text-text-light hover:text-info`}
                data-testid="hero-act-on-it-toggle"
              >
                {expanded
                  ? HERO_COPY.actOnIt.hide
                  : HERO_COPY.actOnIt.more(hiddenRows.length)}
              </button>
            )}
          </div>
          <div className="flex flex-col rounded border border-panel-border overflow-hidden">
            {rows.map(row => (
              <Row
                key={row.key}
                row={row}
                dispatchRowAction={dispatchRowAction}
                chatAvailable={chatAvailable}
              />
            ))}
            {expanded &&
              hiddenRows.map(row => (
                <Row
                  key={row.key}
                  row={row}
                  dispatchRowAction={dispatchRowAction}
                  chatAvailable={chatAvailable}
                />
              ))}
          </div>
        </>
      )}
      {/* The evidence queue. `empty:hidden` because its root is a Fragment: a
          run with no gaps, flip risk, conditional winners or result checks
          renders a genuinely empty div, which would otherwise consume one
          `space-y` step. */}
      {queueSlot != null && (
        <div className="space-y-3 empty:hidden" data-testid="hero-arm-triage-actions">
          {queueSlot}
        </div>
      )}
    </section>
  )
}

/**
 * The producer's effort estimate, in ONE leaf so the testid and the classes
 * cannot drift between the two slots that render it (with steps, and alone).
 * `V7BiasSection` factored it out for the same reason; kept.
 */
function MinutesBadge({ minutes }: { minutes: number }) {
  return (
    <span
      data-testid="hero-act-on-it-row-minutes"
      className={`inline-flex items-center gap-1 ${typography.panelMeta} text-text-light`}
    >
      <Clock aria-hidden="true" className="h-3 w-3 flex-none" />
      {HERO_COPY.actOnIt.minutes(minutes)}
    </span>
  )
}

/**
 * ── RE-HOMED FROM `V7BiasSection` (deleted; preserved at `ca8cb0c1`) ─────────
 *
 * The producer's `micro_intervention`: the concrete numbered steps that say
 * what to DO about a bias finding, and roughly how long it takes. v7's bias
 * section was the ONLY surface in the product that rendered either; the reflect
 * rows that replaced it showed the bias type and description alone, so both
 * were lost. The structure below is v7's, deliberately: the steps list is an
 * ordered list, the minutes ride INSIDE the steps header when there are steps,
 * and stand alone when there are not.
 *
 * ⚠ ABSENT MUST READ AS ABSENT — this is the whole honesty contract of the
 * component, and it is why the two null branches below are separate rather than
 * merged into one truthy check:
 *   · no steps AND no estimate  → renders NOTHING (not an empty list, not a
 *     "Try this" heading with nothing under it);
 *   · steps but no estimate     → the list, with NO invented duration;
 *   · an estimate but no steps  → the estimate alone, as v7 did, because the
 *     producer did say how long it takes even though it did not say how.
 * There is no default minute count anywhere in this file, and there must never
 * be one: a fabricated "About 5 min" is indistinguishable, on screen, from a
 * real producer estimate.
 */
function MicroIntervention({
  steps,
  estimatedMinutes,
}: {
  steps: string[]
  estimatedMinutes: number | null
}) {
  const hasSteps = steps.length > 0
  if (!hasSteps && estimatedMinutes == null) return null

  if (!hasSteps) {
    // Estimate with no steps — surfaced honestly, exactly as v7 did.
    return <MinutesBadge minutes={estimatedMinutes as number} />
  }

  return (
    <div className="space-y-1" data-testid="hero-act-on-it-row-steps">
      <div className="flex items-center gap-2">
        {/* DS v5 §2.4: no raw font-weight in panel scope. panelMeta carries no
            weight step, so the label reads as a label via text-text-header
            against the list items' text-text-body below. */}
        <span className={`${typography.panelMeta} text-text-header`}>
          {HERO_COPY.actOnIt.stepsLabel}
        </span>
        {estimatedMinutes != null && <MinutesBadge minutes={estimatedMinutes} />}
      </div>
      <ol className="space-y-0.5">
        {steps.map((step, i) => (
          <li key={i} className={`${typography.panelMeta} text-text-body break-words`}>
            {i + 1}. {step}
          </li>
        ))}
      </ol>
    </div>
  )
}

function Row({
  row,
  dispatchRowAction,
  chatAvailable,
}: {
  row: ActOnItRow
  dispatchRowAction: RowActionDispatcher
  chatAvailable: boolean
}) {
  return (
    <article
      className={`px-2.5 py-2 border-b border-panel-border last:border-b-0 ${ROW_TINT_CLASS[row.category]}`}
      data-testid={`hero-act-on-it-row-${row.category}`}
    >
      <div className="flex items-start gap-3 justify-between">
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={`w-2 h-2 rounded-full flex-shrink-0 ${CATEGORY_DOT_CLASS[row.category]}`}
              aria-hidden="true"
            />
            {/* Row order communicates priority; the band is never printed. */}
            <p
              className={`${typography.panelHeader} text-text-header line-clamp-2 break-words min-w-0 flex-1`}
              title={row.title}
              data-testid="hero-act-on-it-row-title"
            >
              {row.title}
            </p>
          </div>
          <p
            className={`${typography.panelBody} text-text-body line-clamp-2 break-words`}
            data-testid="hero-act-on-it-row-reason"
          >
            {row.reason}
          </p>
          <MicroIntervention steps={row.steps} estimatedMinutes={row.estimatedMinutes} />
        </div>
        <ActOnItActionRow
          actions={row.actions}
          chatPrompt={row.chatPrompt}
          targetNodeId={row.targetNodeId}
          dispatchAction={dispatchRowAction}
          chatAvailable={chatAvailable}
        />
      </div>
    </article>
  )
}
