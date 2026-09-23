/**
 * ⭐⭐ WHAT TO THINK ABOUT NEXT — the engine's top recommendation, as a card.
 *
 * ⚠⚠ IT LIVES IN "ALSO WORTH DOING", NOT IN THE ANSWER. It rendered inside
 * `AtAGlance` until 18 Sep 2026, which put a NEXT ACTION inside the zone that
 * holds the answer — and cost that zone 90px including its gap. Its own heading
 * in the old location said so: "WHAT TO THINK ABOUT NEXT".
 *
 * ⭐ WHY IT MOVED, MEASURED. At 1440×860 (fold 729) the answer zone exceeded the
 * viewport and the options comparison fell 89px below it, so the panel could not
 * show "what matters most" and "how the options compare" together. Every
 * information-preserving spacing trim combined saved 63px — still 26 short. This
 * move saves 90px on its own and costs nothing, because the card is not deleted:
 * it is rendered where the panel already puts things to do.
 *
 * ⛔ THE CARD IS A POINTER, NOT A REPRINT. It names the item it points at and
 * the action it runs; the paragraph, severity, grounding, source line and the
 * "I disagree" / "Not relevant" controls are rendered once, in the Strengthen
 * row. See `theFocusCardReferencesRatherThanReprints.spec.tsx`.
 */
import { MessageCircle, ChevronRight } from 'lucide-react'
import { typography } from '../../../../styles/typography'
import { methodForRecommendation } from '../recommendationMethod'
import { PANEL_INSET_ACTION, action, icon } from '../panelSurfaces'

export interface PrimaryInterventionProps {
  /**
   * ⚠ THE SHAPE IS THE CALLER'S, COPIED RATHER THAN NARROWED. `title` is read
   * by the header and `signal` by the catalogue path, so both stay required-or-
   * optional exactly as the body composes them. Narrowing here would make the
   * component reject a field the composition legitimately sends.
   */
  primaryIntervention?: {
    id: string
    label: string
    title?: string
    signal?: string
    signalCode?: string
    biasCode?: string
  } | null
  onRunIntervention?: (recommendationId: string) => void
  testId?: string
}

export function PrimaryIntervention({
  primaryIntervention,
  onRunIntervention,
  testId = 'analysis-new-glance',
}: PrimaryInterventionProps) {
  /**
   * ⚠ THE SAME GUARD IT CARRIED IN THE GLANCE, and it stays a conjunction: a
   * recommendation with no handler is a card that cannot act, which is the
   * dead-affordance shape this panel polices. No handler ⇒ no card.
   */
  if (!primaryIntervention || !onRunIntervention) return null
        // PHASE-3 producer findings vs the UI's own catalogue. The id prefix is
        // minted in one place and is identity, not similarity.
        const isProducerFinding = primaryIntervention.id.startsWith('strengthen:phase3:')
        /**
         * ⭐ HOISTED OUT OF ITS OWN IIFE so the action line can compare
         * against it. It was scoped inside the chip's closure, which is exactly
         * why a duplicate was invisible from the place that renders it.
         */
        const method = methodForRecommendation(
          primaryIntervention.id,
          primaryIntervention.signalCode,
          primaryIntervention.biasCode,
        )
        const methodTitle = method?.title ?? null
        return (
        <button
          type="button"
          onClick={() => onRunIntervention(primaryIntervention.id)}
          className={`w-full flex items-start gap-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-info ${PANEL_INSET_ACTION}`}
          data-testid={`${testId}-primary-intervention`}
          data-recommendation-id={primaryIntervention.id}
        >
          {/* ⭐ `MessageCircle`, NOT `Sparkles` — RULED 23 Sep 2026 (R3). This
              card RUNS a reasoning move with Olumi: an ACT. `Sparkles` is
              reserved for content Olumi ORIGINATED (the AI-estimate status,
              an option Olumi proposed), and every hand-to-Olumi act in the
              panel is the speech bubble. */}
          <MessageCircle className={`${icon('row')} mt-0.5 shrink-0 text-info`} aria-hidden="true" />
          <span className="min-w-0 flex-1">
            {/* ⭐ GATED ON PROVENANCE, NOT ON SIMILARITY. A text comparison
                between the header and the action would fire on whatever
                happened to look alike; the id says which KIND of
                recommendation this is, which is the actual discriminator.
                `strengthen:phase3:` is minted in exactly one place
                (`buildRecommendations.ts:348`). */}
            <span
              className={`${typography.panelHeader} text-text-header block`}
              data-testid={`${testId}-primary-title`}
            >
              {isProducerFinding ? primaryIntervention.title : primaryIntervention.label}
            </span>
            {/* ⭐ THE MOST PROMINENT COACHING CARD NAMES ITS TECHNIQUE. This is
                the one move a reader meets without opening anything, so if any
                card should say WHICH science-grounded method it is, it is this
                one. Rendered as a label rather than a control: the card is
                already a button, and a nested button is invalid markup — the
                card's own click runs the intervention, which is the same
                destination the chip would have offered.

                `null` for most findings by design (`recommendationMethod.ts`);
                nothing renders then, never a default technique. */}
            {(() => {
              return method ? (
                <span
                  className={`${typography.panelMeta} inline-flex items-center ${action('secondary')} mt-1`}
                  data-testid={`${testId}-primary-method`}
                  data-method-id={method.id}
                >
                  {method.title}
                </span>
              ) : null
            })()}
            {/* ⭐ THE ACTION, NOT THE FINDING. This line carried
                `Recommendation.signal` — the paragraph the Strengthen row also
                prints — while the header above carried `action.label`. The two
                are swapped: the header names the finding, this names what
                pressing the card does.

                ⚠ SCOPED, because the old header was not always boilerplate.
                On the seven UI catalogue recommendations `action.label` is
                specific copy ("Define success"). On the PHASE-3 producer
                findings — the kind in the 6 Sep capture — it is
                `item.actionLabel ?? 'Work through with Olumi'`, so a producer
                sending no label bought a heading of boilerplate above a body
                that repeated the row. Derived at the eight `recs.push` sites in
                `buildRecommendations.ts`, 7 Sep 2026.

                Still conditional. `action.label` is `item.actionLabel ?? '…'`
                and `??` passes an empty string through, so a producer sending
                `""` would otherwise buy a blank muted line. */}
            {(() => {
              // On a producer finding the header names the finding, so this
              // names the ACTION. On a catalogue rec the header IS the action,
              // so this carries the SENTENCE — which is that card's only
              // information and what the unscoped version deleted.
              const second = isProducerFinding ? primaryIntervention.label : primaryIntervention.signal
              /**
               * ⛔⛔ SAY IT ONCE. This line and the method chip above are
               * sourced INDEPENDENTLY — one from the producer's `label`, one
               * from `methodForRecommendation` — and on some recommendations
               * they resolve to the SAME STRING. Measured on deployed
               * `18628c08`: this card rendered “Run a pre-mortem” TWICE, once
               * as the chip and once here, inside one button, for 17px.
               *
               * ⚠ A COLLISION, NOT A BUG, which is why this is a comparison
               * and not a deletion: where the two genuinely differ — the
               * catalogue recommendations, where this carries the SENTENCE —
               * both still render, and that sentence is the card's only
               * information. Deleting the line unconditionally is the mistake
               * an earlier unscoped version of it already made.
               */
              return second && second !== methodTitle ? (
                <span
                  className={`${typography.panelMeta} text-text-light block mt-0.5`}
                  data-testid={`${testId}-primary-action`}
                >
                  {second}
                </span>
              ) : null
            })()}
          </span>
          <ChevronRight className={`${icon('row')} mt-0.5 shrink-0 text-text-light`} aria-hidden="true" />
        </button>
        )
}
