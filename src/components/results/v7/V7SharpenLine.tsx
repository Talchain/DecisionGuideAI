/**
 * V7SharpenLine — the "a few inputs would sharpen these results" line
 * (V7 Lane L4, spec row 2).
 *
 * Passthrough only. Two honest, store-backed parts:
 *   · The brief quote ← the user's own framing goal
 *     (`recommendation.goalText`, else `goalLabel`) — Paul's own wording,
 *     rendered verbatim in quotes.
 *   · The inputs to review (≤3 + "and N more") ← `confidence.topEvidenceGaps`
 *     (each carries `factorLabel` + a canvas focus target), the factors whose
 *     evidence is thin enough to be worth confirming.
 * Plus a static, honest model-limit caveat (not a data claim).
 *
 * SKIPPED (honest absence, reported): the prototype also renders a
 * conversation-aware *reframed question* ("Olumi reframed that as: …"). That
 * reinterpretation is model output with no results-store selector, so it is
 * NOT rendered — inventing it would breach the passthrough rule.
 *
 * Gate: the line renders only when there ARE inputs to sharpen
 * (`inputs.length > 0`) — otherwise the "a few inputs would sharpen…" claim
 * would be false, so it renders nothing. COMPLETE borders only (L1 guard).
 */

import { AlertTriangle } from 'lucide-react'
import { typography } from '@/styles/typography'

export interface V7SharpenInput {
  /** Display label — an evidence-gap factor label. */
  label: string
  /** Canvas focus target, when the gap maps to a node. */
  nodeId?: string
}

export interface V7SharpenLineProps {
  /** The user's own framing goal — `recommendation.goalText ?? goalLabel`. */
  briefWording?: string | null
  /** Inputs worth confirming — derived from `confidence.topEvidenceGaps`. */
  inputs: V7SharpenInput[]
  /** Focus the matching canvas element for an input. */
  onFocusNode?: (nodeId: string) => void
}

/** How many inputs show before collapsing into "and N more". */
const VISIBLE_INPUTS = 3

export function V7SharpenLine({ briefWording, inputs, onFocusNode }: V7SharpenLineProps) {
  // Honest absence — nothing to sharpen, so make no claim.
  if (inputs.length === 0) return null

  const shown = inputs.slice(0, VISIBLE_INPUTS)
  const moreCount = inputs.length - shown.length
  const quote = briefWording?.trim()

  return (
    <section
      data-testid="v7-sharpen-line"
      className="rounded-lg border border-panel-border bg-panel px-3 py-2.5"
    >
      <p className={`${typography.panelBody} text-text-header font-semibold`}>
        A few inputs would sharpen these results
      </p>
      {quote && (
        <p className={`${typography.panelBody} text-text-body mt-1`} data-testid="v7-sharpen-quote">
          You wrote: &ldquo;{quote}&rdquo;
        </p>
      )}
      <p className={`${typography.panelMeta} text-text-light mt-1`}>
        Olumi can point to what the model implies, but not guarantee the real world behaves the same.
        Confirm these before you lean on the result.
      </p>
      <ul className="mt-2 space-y-0.5">
        {shown.map((input, i) => {
          const canFocus = Boolean(input.nodeId && onFocusNode)
          const content = (
            <span className="inline-flex items-start gap-1.5">
              <AlertTriangle className="mt-[1px] h-3 w-3 flex-none text-warning" aria-hidden />
              <span>{input.label}</span>
            </span>
          )
          return (
            <li key={`${input.label}-${i}`} className={`${typography.panelMeta} text-text-body`}>
              {canFocus ? (
                <button
                  type="button"
                  onClick={() => onFocusNode?.(input.nodeId as string)}
                  className="text-left hover:text-text-header"
                >
                  {content}
                </button>
              ) : (
                content
              )}
            </li>
          )
        })}
      </ul>
      {moreCount > 0 && (
        <p className={`${typography.panelMeta} text-text-light mt-1`} data-testid="v7-sharpen-more">
          and {moreCount} more
        </p>
      )}
    </section>
  )
}

export default V7SharpenLine
