/**
 * The elicitation surface: names ONE assumed relationship and offers to ask
 * Olumi to set its strength. There is no user-facing edge editor to route to —
 * see "THE ACTION ASKS OLUMI" below for why the destination changed.
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
 * still unconfirmed.
 *
 * ── THE ACTION ASKS OLUMI, AND WRITES NOTHING LOCALLY ──────────────────────
 * The button calls `openAskOlumi`, which opens the Ask-Olumi drawer with an
 * EDITABLE prefilled instruction naming both endpoints and a value. Nothing is
 * sent until the user clicks Send: opening the drawer dispatches nothing, and
 * neither does Enter, Cmd-Enter, Ctrl-Enter or blur.
 *
 * ⚠⚠ IT USED TO CALL `openEdgeStrengthEditor`, AND THE REASON RECORDED FOR THE
 * RE-POINT IS NO LONGER TRUE. That seam selects the edge, stands the dock down,
 * centres the canvas and raises the Inspector, and this paragraph said the
 * Inspector "is read-only, because `InspectorRouter` wraps every panel in an
 * unconditional `<fieldset disabled>`". Re-derived at the tip: the wrap is
 * CONDITIONAL on `AUTHORITY_OWNING_PANELS` (`InspectorRouter.tsx:441`,
 * `:541-551`), and the EDGE branch never reaches it — it early-returns at
 * `:192` with no blanket fence, `EdgePanel` self-fencing per edge instead.
 * (The old text also leaned on the `EDGE_SETTER_AUTHORITY` manifest in
 * `inspector-v2/useInspectorMutations.ts`; deleted 27 Aug 2026, PR #886, as an
 * unenforced mirror — so BOTH of its authorities are now gone.)
 *
 * ⭐ THE DESTINATION STANDS, ON THE PREDICATE THAT ACTUALLY DECIDES IT.
 * `EdgePanel.tsx:699` disables the strength control on `!strengthReachesTheModel`
 * — `edgeStrengthEditIsAssertable`, which returns false for an edge with no
 * server-stated `expected` tuple. That is exactly this card's `'missing'`
 * population, so for those edges the Inspector still has nothing to offer.
 * For the `'ai_inferred'` half it now does; re-pointing on that split is a
 * design decision with its own blast radius and is NOT taken here. See
 * `assumedStrengthCopy`'s note for the evidence whoever takes it will need.
 *
 * But OLUMI can change an edge: `update_edge` is a first-class op in the
 * model-facing tool schema and CEE applies it through the canonical commit path.
 * So the honest act is to ask. The label promises the ASK and never the outcome
 * — a live trial showed the router elects this path, which is existence, not
 * reliability.
 *
 * It still writes NO graph state from here. The canonical writer of
 * `weight`/`weightSource` is unchanged; a write on this surface would be a
 * second writer of that field.
 *
 * ── TYPOGRAPHY: THE SANCTIONED SCALE, NOT RAW UTILITIES ─────────────────────
 * This card first shipped with raw Tailwind size and weight utilities, which
 * DS v5 §2.4 bans in panel scope (`src/styles/typography.ts:47-54` declares the
 * strict set for src/components/results/: panelHeader / panelBody /
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
  ASSUMED_STRENGTH_REFUSAL_COPY,
  ASSUMED_STRENGTH_TITLE,
  assumedStrengthAsk,
  assumedStrengthLead,
  assumedStrengthOthers,
  assumedStrengthWhy,
} from './assumedStrengthCopy'
import type { AssumedStrengthDecision, AssumedStrengthSelection } from './selectAssumedStrengthToResolve'
import { typography } from '../../../styles/typography'

export interface AssumedStrengthCardProps {
  decision: AssumedStrengthDecision
  /**
   * Act on the selected assumed strength. Receives the WHOLE selection, not
   * just an edge id, because the act now composes a request that names both
   * endpoints verbatim — and a handler given only an id would have to look the
   * labels up again, which is a second authority for the same fact.
   *
   * Injected so the card stays presentational and the test can assert the
   * ARGUMENT rather than a side effect. Absent ⇒ the card still names the
   * assumption but renders no button, rather than a button that does nothing.
   */
  onResolve?: (selection: AssumedStrengthSelection) => void
  /**
   * True when the run withheld its ranking (`rankingWasWithheld`, the Reasoning
   * tab's own predicate). The "why" sentence names an option that was "the
   * stronger option" in some runs, which presupposes the ranking this run
   * withheld, so it is omitted. The lead and the ask stay: setting a strength is
   * the act that can lift the withholding (AI Quality #69 5827943157, leak 1).
   */
  rankingWithheld?: boolean
}

function AssumedStrengthCardImpl({ decision, onResolve, rankingWithheld = false }: AssumedStrengthCardProps) {
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
      {rankingWithheld ? null : (
        <p className={`${typography.panelBody} text-text-body`} data-testid="assumed-strength-why">
          {assumedStrengthWhy(selected)}
        </p>
      )}
      <p className={`${typography.panelBody} text-text-body`} data-testid="assumed-strength-ask">
        {assumedStrengthAsk(selected)}
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
          onClick={() => onResolve(selected)}
        >
          {ASSUMED_STRENGTH_ACTION}
        </button>
      )}
    </section>
  )
}

export const AssumedStrengthCard = memo(AssumedStrengthCardImpl)
