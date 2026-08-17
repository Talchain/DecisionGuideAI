/**
 * The elicitation surface: names ONE assumed relationship and routes the user to
 * the existing edge-strength editor.
 *
 * This component AUTHORS NOTHING. Every sentence comes from `assumedStrengthCopy`
 * (templated from derived facts), and the only judgement it makes is
 * presence/absence. It renders no number of its own — the one percentage on
 * screen is the producer's measured `switch_probability`, formatted by the copy
 * module.
 *
 * ── WHY IT IS NOT INSIDE THE "Resolve next" CHIP ────────────────────────────
 * The obvious home would be the evidence disclosure's Resolve-next view, and it
 * is the wrong one. That view is gated on `factor_evppi`, and its host DROPS THE
 * CHIP ENTIRELY when the ranking is null (`HeroEvidenceDisclosure.tsx:107`) —
 * which, measured over the nine committed live captures, is the common case.
 * Nesting this inside it would make the elicitation invisible in exactly the
 * runs where it is the only thing we have to offer. It therefore sits as its own
 * block with its own presence rule, and the two never contend: one ranks
 * FACTORS by value of information, this one names an EDGE whose strength is a
 * placeholder.
 *
 * ── THE ACTION REACHES THE EDITOR, AND WRITES NOTHING ───────────────────────
 * The button calls `openEdgeStrengthEditor`, which selects the edge, stands the
 * dock down, centres the canvas and raises the inspector — so the control the
 * label promises is on screen when the click finishes.
 *
 * An earlier cut called `focusModelTarget`, which only selects the edge and
 * centres the camera. That left a button labelled "Set this strength" that
 * panned to the edge and stopped, with the user still having to find and click
 * it: the label promised a capability the wiring did not deliver. Reaching the
 * editor is the whole point of the interaction, so the wiring was fixed rather
 * than the label lowered.
 *
 * It still writes NO graph state. The strength is set in the panel this opens,
 * by `useEdgeMutations.setStrength`, which remains the single writer of
 * `weight`/`weightSource`. A write here would be a second writer of that field.
 *
 * ── TYPOGRAPHY: THE SANCTIONED SCALE, NOT RAW UTILITIES ─────────────────────
 * This card first shipped with raw Tailwind size and weight utilities, which
 * DS v5 §2.4 bans in panel scope (`src/styles/typography.ts:47-54` declares the
 * strict set for src/components/results/: heroDisplay / panelHeader / panelBody /
 * panelMeta). It now uses panelHeader for the title, panelBody for prose and the
 * action, and panelMeta for the tertiary "others" line — so the card sits on the
 * same three-size scale as every sibling. Do not reintroduce a raw size or weight
 * utility here: the DS guard now ENFORCES this class and will red the gate.
 *
 * Note the guard scans COMMENTS for this class on purpose — spelling a banned
 * utility in prose here would itself red the gate, because a utility named in a
 * comment is an instruction that gets copied into code.
 */

import { memo } from 'react'
import {
  ASSUMED_STRENGTH_ACTION,
  ASSUMED_STRENGTH_ASK,
  ASSUMED_STRENGTH_REFUSAL_COPY,
  ASSUMED_STRENGTH_TITLE,
  assumedStrengthLead,
  assumedStrengthOthers,
  assumedStrengthWhy,
} from './assumedStrengthCopy'
import type { AssumedStrengthDecision } from './selectAssumedStrengthToResolve'
import { typography } from '../../../styles/typography'

export interface AssumedStrengthCardProps {
  decision: AssumedStrengthDecision
  /**
   * Open the edge-strength editor for a canvas edge id. Injected so the card
   * stays presentational and the test can assert the ARGUMENT rather than a
   * side effect. Absent ⇒ the card still names the assumption but renders no
   * button, rather than a button that does nothing.
   */
  onResolve?: (edgeId: string) => void
}

function AssumedStrengthCardImpl({ decision, onResolve }: AssumedStrengthCardProps) {
  const { selected, refusalReason, assumedFragileCount } = decision

  if (selected === null) {
    const copy = refusalReason === null ? null : ASSUMED_STRENGTH_REFUSAL_COPY[refusalReason]
    // Two of the four refusals render nothing at all — an internal matching
    // failure is not a finding about the user's model, and "no analysis yet" is
    // not news on a surface that has no analysis on it.
    if (copy === null) return null
    return (
      <div className="border-t border-panel-border pt-2" data-testid="assumed-strength-refusal">
        <p className={`${typography.panelBody} text-text-body`}>{copy}</p>
      </div>
    )
  }

  const others = assumedStrengthOthers(assumedFragileCount)

  return (
    <section
      className="space-y-1.5 border-t border-panel-border pt-2"
      data-testid="assumed-strength-card"
      // The edge this card is ABOUT, exposed so a test binds by IDENTITY rather
      // than by matching a label another row could carry.
      data-edge-id={selected.edgeId}
      aria-label={ASSUMED_STRENGTH_TITLE}
    >
      <h4 className={`${typography.panelHeader} text-text-heading`} data-testid="assumed-strength-title">
        {ASSUMED_STRENGTH_TITLE}
      </h4>
      <p className={`${typography.panelBody} text-text-body`} data-testid="assumed-strength-lead">
        {assumedStrengthLead(selected)}
      </p>
      <p className={`${typography.panelBody} text-text-body`} data-testid="assumed-strength-why">
        {assumedStrengthWhy(selected)}
      </p>
      <p className={`${typography.panelBody} text-text-body`} data-testid="assumed-strength-ask">
        {ASSUMED_STRENGTH_ASK}
      </p>
      {others !== null && (
        <p className={`${typography.panelMeta} text-text-muted`} data-testid="assumed-strength-others">
          {others}
        </p>
      )}
      {onResolve !== undefined && (
        <button
          type="button"
          className={`${typography.panelBody} text-accent underline underline-offset-2`}
          data-testid="assumed-strength-action"
          onClick={() => onResolve(selected.edgeId)}
        >
          {ASSUMED_STRENGTH_ACTION}
        </button>
      )}
    </section>
  )
}

export const AssumedStrengthCard = memo(AssumedStrengthCardImpl)
