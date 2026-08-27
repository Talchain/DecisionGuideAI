/**
 * Analysis (New) — "Strengthen the reasoning".
 *
 * ⭐ THIS IS THE SECTION THE EXPERIMENT EXISTS TO TEST. It is second from the
 * top and it is the only section given a stronger visual treatment, because the
 * claim under test is that Olumi does not merely analyse a situation — it tells
 * a team how to improve the reasoning itself. In the existing Analysis tab the
 * same material sits roughly eleventh, below the option comparison.
 *
 * ⚠⚠ NOTHING HERE IS AUTHORED. Every row is a `Recommendation` emitted by
 * `buildRecommendations` — the existing, producer-grounded engine — and every
 * field rendered below is the engine's own: `title` (what), `signal` + `whyNow`
 * (why it fired), `tryThis` (the one practical instruction), `sourceLine` (the
 * named grounding, honest about producer-vs-UI basis). If this component ever
 * starts composing a sentence about the user's reasoning, the experiment has
 * become the fabrication it was built to avoid.
 *
 * ── ON THE ACTION ROUTE, STATED PLAINLY ─────────────────────────────────────
 * The engine's `RecAction.kind` spans five routes ('inline-edit', 'ai-dialogue',
 * 'canvas-focus', 'rerun', 'open-modal'), and `StrengthenContainer` owns the
 * dispatch machinery for all of them — including store writes and a degrade
 * path. This experimental surface deliberately offers only the two routes that
 * MUTATE NOTHING:
 *
 *   · "Show on canvas"  → `focusModelTarget` (existing, fail-closed helper)
 *   · the primary CTA   → `openAskOlumi` PREFILLED (existing drawer; the user
 *                          reads and sends, this surface never auto-sends)
 *
 * Everything else is presented as guidance, which the brief explicitly permits
 * ("it may be presented as guidance rather than inventing a new backend
 * behaviour"). The reason is not caution for its own sake: a presentation
 * experiment that also becomes a second dispatch authority would let the two
 * tabs diverge in what they DID as well as what they showed, and the comparison
 * would no longer be about information architecture.
 */

import { typography } from '../../../../styles/typography'
import { openAskOlumi } from '../../coaching/askOlumiStore'
import { focusModelTarget } from '../../../../canvas/utils/focusHelpers'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import type { Recommendation } from '../../strengthen/strengthenTypes'
import type { ScienceGrounding } from '../analysisNewTypes'

export interface StrengthenTheReasoningProps {
  interventions: Recommendation[]
  /**
   * Producer DSK attestation keyed by recommendation id. SPARSE BY DESIGN —
   * an absent key means the producer attested nothing for that intervention,
   * and the row then carries no grounding badge at all.
   */
  scienceGrounding?: Record<string, ScienceGrounding>
  testId?: string
}

/**
 * Human-readable strength, from the producer's CLOSED vocabulary.
 *
 * ⚠ ANYTHING OUTSIDE THE VOCABULARY RENDERS NOTHING. A pass-through would let
 * an unrecognised producer token become user-facing copy, which is precisely
 * how a fabricated-sounding scientific label gets on screen (§15).
 */
const STRENGTH_LABEL: Record<string, string> = {
  strong: 'Strong evidence',
  moderate: 'Moderate evidence',
  limited: 'Limited evidence',
  emerging: 'Emerging evidence',
}

export function StrengthenTheReasoning({
  interventions,
  scienceGrounding = {},
  testId = 'analysis-new-strengthen',
}: StrengthenTheReasoningProps) {
  return (
    <section className="space-y-2" data-testid={testId} aria-labelledby={`${testId}-heading`}>
      <h3 id={`${testId}-heading`} className={`${typography.panelHeader} text-text-header`}>
        {COPY.sections.strengthen}
      </h3>

      {interventions.length === 0 ? (
        // ⚠ STATES WHAT WAS NOT FOUND, NOT THAT NOTHING IS WRONG. "Your
        // reasoning looks solid" would be a claim nobody measured.
        <p className={`${typography.panelBody} text-text-light`} data-testid={`${testId}-empty`}>
          {COPY.empty.strengthen}
        </p>
      ) : (
        <ul className="space-y-2 list-none p-0 m-0">
          {interventions.map((rec) => (
            <li
              key={rec.id}
              // The one stronger container on the surface. A single hairline
              // border and a tinted panel — still not a card inside a card.
              className="rounded-lg border border-info/30 bg-panel px-3 py-2.5 space-y-1.5"
              data-testid={`${testId}-item`}
              data-recommendation-id={rec.id}
            >
              {/* WHAT — the engine's own title. */}
              <p className={`${typography.panelHeader} text-text-header`}>{rec.title}</p>

              {/* WHY — the signal that fired, then why it matters now. */}
              <p className={`${typography.panelBody} text-text-body`} data-testid={`${testId}-why`}>
                {rec.signal}
                {rec.whyNow ? ` ${rec.whyNow}` : ''}
              </p>

              {/* DO IT — the one practical instruction. */}
              {rec.tryThis ? (
                <p className={`${typography.panelBody} text-text-body`} data-testid={`${testId}-try`}>
                  {rec.tryThis}
                </p>
              ) : null}

              <div className="flex flex-wrap items-center gap-3 pt-0.5">
                <button
                  type="button"
                  onClick={() =>
                    openAskOlumi({
                      // The drawer's context line and prefilled draft are the
                      // ENGINE's strings, so what the user sends is what the
                      // engine recommended — not a paraphrase of it.
                      context: rec.whyNow || rec.signal,
                      draft: rec.action.prompt ?? rec.tryThis,
                      label: rec.action.label,
                      ...(rec.targetId ? { targetId: rec.targetId } : {}),
                      ...(rec.action.parameters ? { parameters: rec.action.parameters } : {}),
                    })
                  }
                  className={`${typography.panelBody} text-info underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
                  data-testid={`${testId}-action`}
                >
                  {rec.action.label} →
                </button>

                {rec.targetId ? (
                  <button
                    type="button"
                    onClick={() => focusModelTarget(rec.targetId!)}
                    className={`${typography.panelMeta} text-text-light underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
                    data-testid={`${testId}-focus`}
                  >
                    Show on canvas
                  </button>
                ) : null}
              </div>

              {/* The named grounding source, verbatim from the engine. This is
                  what makes the row auditable rather than merely plausible. */}
              {rec.sourceLine ? (
                <p
                  className={`${typography.panelMeta} text-text-light`}
                  data-testid={`${testId}-source`}
                >
                  {rec.sourceLine}
                </p>
              ) : null}

              {/* ⭐ SCIENCE GROUNDING (§15) — rendered ONLY when the producer
                  attested a DSK claim for THIS recommendation. Presence is the
                  attestation; there is no default and no inferred strength.
                  The claim/protocol IDS ride as `data-*` attributes and are
                  never user-facing copy — an id is provenance for an auditor,
                  not a sentence for a reader. An unrecognised strength token
                  renders nothing rather than being passed through. */}
              {scienceGrounding[rec.id] ? (
                <p
                  className={`${typography.panelMeta} text-text-light`}
                  data-testid={`${testId}-science-grounding`}
                  data-dsk-claim-id={scienceGrounding[rec.id].claimId}
                  {...(scienceGrounding[rec.id].protocolId
                    ? { 'data-dsk-protocol-id': scienceGrounding[rec.id].protocolId }
                    : {})}
                >
                  Grounded in the decision-science knowledge base
                  {scienceGrounding[rec.id].strength &&
                  STRENGTH_LABEL[scienceGrounding[rec.id].strength!]
                    ? ` · ${STRENGTH_LABEL[scienceGrounding[rec.id].strength!]}`
                    : ''}
                  .
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
