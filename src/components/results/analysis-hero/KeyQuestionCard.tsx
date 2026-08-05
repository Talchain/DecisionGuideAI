/**
 * KeyQuestionCard — the decision-quality key question + DSK grounding line on
 * the LIVE results surface (ROADMAP 2.466, P1).
 *
 * ## Why this exists
 *
 * Lane 1 built the DSK grounding badge on the V17 hero — which mounts only
 * when `analysisHeroPanel` is OFF, while staging deploys it ON; and its data
 * (`m2DecisionQualityPrompts` + `reviewStatus === 'complete'`) is written only
 * by the legacy V2-run/hydration paths, never by a live V5 turn. Net: every
 * analysis turn carries cited decision-quality prompts and the tester saw
 * none of them. This card re-hosts the surface where testers actually look
 * (the lens-hero arm of ResultsBody) and feeds it from the live turn state.
 *
 * ## Data path (live, not legacy)
 *
 * `applyV5State` → `runMeta.decisionReview030.decision_quality_prompts` (the
 * 2.466 verbatim carry) → `mapDecisionQualityPrompts` (the single mapping
 * site: sanitisation + id-gated provenance) → `deriveDskGrounding` (the one
 * home of lane 1's honest-absence rule). Gated on DATA PRESENCE only — never
 * on `runMeta.reviewStatus`, the legacy-only field that dark-shipped lane 1.
 * Store-direct read, same pattern ResultsBody itself uses for
 * engineDegradedCritique / optionNumbering / the B1 receipts.
 *
 * ## Honesty contract (lane 1's, verbatim)
 *
 *   - No attested `dsk_claim_id` ⇒ NO grounding line — never a default id,
 *     never an inferred strength. The question may still show: a question
 *     needs no citation to be honest.
 *   - Provenance follows the RENDERED prompt only — never borrowed from a
 *     sibling entry.
 *   - Every string reaches the DOM through the mapper's sanitisation; the
 *     question and the principle both pass the V17 glossary gate.
 *
 * Plain DOM text throughout (screen-reader readable, not colour-only); the
 * claim/protocol ids ride as data-* attributes, never as user copy — testids
 * and copy shape identical to lane 1's `HeroKeyQuestion` grounding line.
 */
import { useMemo } from 'react'
import { useCanvasStore } from '../../../canvas/store'
import { typography } from '@/styles/typography'
import {
  deriveDskGrounding,
  isGeneralGuidance,
  mapDecisionQualityPrompts,
} from '../utils/decisionQualityPrompts'
import { containsBannedTerm } from '../analysisHeroV17/glossaryCheck'

export function KeyQuestionCard() {
  const review030 = useCanvasStore(s => s.runMeta?.decisionReview030)

  const prompts = useMemo(() => {
    const raw = review030?.decision_quality_prompts
    return raw && raw.length > 0 ? mapDecisionQualityPrompts(raw) : []
  }, [review030])

  // First glossary-safe question wins (same selection rule as V17's
  // selectKeyQuestion). A banned-term question is skipped, not rewritten —
  // we never edit producer copy.
  const main = prompts.find(p => p.question !== '' && !containsBannedTerm(p.question))
  if (!main) return null

  const grounding = deriveDskGrounding(main)

  return (
    <section
      className="rounded-lg border border-panel-border bg-panel p-3 flex flex-col gap-1.5"
      aria-label="Key question"
      data-testid="key-question-card"
    >
      <h3 className={`${typography.panelMeta} text-text-light`}>Key question</h3>
      <p
        className={`${typography.panelHeader} text-text-header break-words`}
        data-testid="key-question-text"
      >
        {main.question}
      </p>
      {grounding && (
        <p
          className={`${typography.panelMeta} text-text-light break-words`}
          data-testid="dsk-grounding"
          data-dsk-claim-id={grounding.claimId}
          data-dsk-protocol-id={grounding.protocolId}
        >
          Grounded in: {grounding.principle}
          {grounding.strength ? ` · ${grounding.strength} evidence` : ''}
        </p>
      )}
      {/* 2.491: the badge's negative twin. Absence of a grounding line used to
          be SILENT, so an unattested prompt read exactly like an attested one.
          Rendered only on CEE's positive `general` verdict — never inferred
          from missing grounding (see isGeneralGuidance). */}
      {isGeneralGuidance(main) && (
        <p
          className={`${typography.panelMeta} text-text-light break-words`}
          data-testid="dsk-general-guidance"
        >
          General guidance — not drawn from our attested evidence base.
        </p>
      )}
    </section>
  )
}

export default KeyQuestionCard
