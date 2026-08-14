/**
 * NotAnalysedOptionCard — the option that was NOT in the analysis.
 *
 * ⭐ NO-RANK RULING (Paul, 14 Aug 2026): an unanalysable/placeholder option must
 * NOT be included in comparative ranking or probabilities. It stays visible as
 * a proposed/unanalysed alternative with a clear reason and an action to
 * resolve it.
 *
 * ## Why this is a SEPARATE COMPONENT and not eight `&& !notAnalysed` guards
 *
 * `OptionCard` renders a rank swatch, a stable "Option N", a win percentage, a
 * coloured fill bar, goal stat bars, a range bar and a downside block — seven
 * places a number or an ordinal can appear. Adding a conjunct to each would
 * make the ruling a HAND-MAINTAINED LIST: every future stat row added to that
 * card would have to remember the eighth guard, and forgetting one is silent
 * (CLAUDE.md trap 12 — the mirror that drifts always reads green). Forking at
 * the top means a marked option CANNOT reach the ranked chrome at all, and the
 * mutant that proves it is a single deletion.
 *
 * ## What it deliberately does NOT render
 *
 * No rank marker · no ordinal · no win percentage · no expected value · no fill
 * bar · no goal bar · no range bar. Not "rendered as zero", not "rendered as
 * '—'": absent. A dash in a ranked column still asserts membership in the
 * ranking, and this option is not in it.
 *
 * ## The resolve affordance uses the SAME route as the sibling cards
 *
 * `openAskOlumi` prefills the drawer with an editable draft rather than
 * auto-sending — the established pattern on this surface (Codex finding 6), so
 * the ruling's "action to resolve it" arrives by the route the product already
 * has rather than a second one built beside it. The draft itself is CEE's own
 * documented sentence; see `utils/notAnalysedCopy.ts`.
 */

import { typography } from '../../styles/typography'
import { openAskOlumi } from './coaching/askOlumiStore'
import {
  NOT_ANALYSED_BADGE,
  notAnalysedActionLabel,
  notAnalysedReasonCopy,
  resolveOptionPrompt,
} from './utils/notAnalysedCopy'
import type { OptionResult } from './types'

export interface NotAnalysedOptionCardProps {
  /** Must carry `notAnalysed === true`; the caller owns that fork. */
  option: OptionResult
  /** Focus this option's node on the canvas, when the host offers it. */
  onFocusNode?: (nodeId: string) => void
}

export function NotAnalysedOptionCard({ option, onFocusNode }: NotAnalysedOptionCardProps) {
  // Absent reason ⇒ the conservative arm. `not_returned` prescribes no step,
  // so an unrecognised state cannot invent a configure action for an option we
  // cannot prove is unconfigured.
  const reason = option.notAnalysedReason ?? 'not_returned'
  const actionLabel = notAnalysedActionLabel(reason)

  return (
    <div
      className="bg-panel p-3 border border-dashed border-panel-border rounded-lg space-y-2"
      data-testid={`option-card-not-analysed-${option.id}`}
      data-option-id={option.id}
    >
      <div className="flex items-center gap-2">
        {/* No rank swatch and no "Option N" — the two ordinals the ranked card
            renders in this slot. The gap is the point. */}
        <span className={`${typography.panelHeader} text-text-header`}>{option.label}</span>
        <span
          className={`${typography.panelMeta} inline-flex items-center px-2 py-0.5 rounded-full bg-transparent border border-panel-border text-text-light flex-shrink-0`}
          data-testid={`not-analysed-badge-${option.id}`}
        >
          {NOT_ANALYSED_BADGE}
        </span>
      </div>

      <p
        className={`${typography.panelBody} text-text-light`}
        data-testid={`not-analysed-reason-${option.id}`}
      >
        {notAnalysedReasonCopy(reason)}
      </p>

      {(actionLabel != null || onFocusNode) && (
        <div className="flex items-center gap-1 pt-1.5">
          {actionLabel != null && (
            <button
              type="button"
              data-testid={`not-analysed-resolve-${option.id}`}
              onClick={(e) => {
                e.stopPropagation()
                openAskOlumi({
                  context: `About "${option.label}"`,
                  draft: resolveOptionPrompt(option.label),
                  label: actionLabel,
                })
              }}
              className={`${typography.panelMeta} text-info border border-info/30 rounded-full px-2.5 py-1 bg-transparent hover:bg-panel-hover cursor-pointer`}
            >
              {actionLabel}
            </button>
          )}
          {onFocusNode && (
            <button
              type="button"
              data-testid={`not-analysed-focus-${option.id}`}
              onClick={(e) => {
                e.stopPropagation()
                onFocusNode(option.id)
              }}
              className={`${typography.panelMeta} text-info border border-info/30 rounded-full px-2.5 py-1 bg-transparent hover:bg-panel-hover cursor-pointer`}
            >
              Show on canvas
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default NotAnalysedOptionCard
