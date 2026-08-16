/**
 * EdgeReviewDisagreement — the contested-edge surface, in user language (L-38).
 *
 * WHAT IT REPLACED, and why each part was wrong:
 *
 *   `validation.contested_reasons.join(', ')`
 *       printed RAW ENUM TOKENS at rest — "existence_boundary_crossing",
 *       "sign_flip" — to a user who has never seen the wire contract.
 *
 *   `{validation.pass2.basis}`
 *       same defect, one line down: "domain_prior".
 *
 *   "Pass 1 (current)" / "Pass 2 (review)" + Strength / Std / Exists
 *       the internal name for the two-pass validation pipeline, presented as
 *       the PRIMARY explanation of a disagreement the user is being asked to
 *       settle. "Std" is not a word in this product's vocabulary.
 *
 * The translations are IMPORTED from `model-tab/strengthBands.ts`, which
 * already owns them and already ships the good S18 copy ("Our reviews disagree
 * on whether this effect is positive or negative"). Re-typing them here would
 * create a second label for the same enum — the hand-maintained-mirror defect
 * that gave this estate two `generateGraphHash` twins.
 *
 * The numbers are not deleted; they move behind a progressive-disclosure
 * control, named for what they mean rather than for the field they came from.
 * Raw tokens remain available to expert mode only.
 */

import { useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react'

import { typography } from '../../../../styles/typography'
import type { ValidationMetadata, ContestedReason, EstimateBasis } from '../../../domain/validation'
import {
  getContestedReasonLabel,
  getBasisLabel,
} from '../../../components/model-tab/strengthBands'
import { EDGE_COPY, EDGE_REVIEW_COPY } from '../inspectorStrings'

interface EdgeReviewDisagreementProps {
  validation: ValidationMetadata
  techMode: boolean
}

/**
 * Translate one reason. An UNKNOWN token (a producer adding a reason we have
 * no copy for) degrades to the honest generic sentence — never to the token
 * itself. A raw enum leaking through a fallback is exactly how this defect
 * shipped in the first place.
 */
function reasonSentence(reason: string): string {
  const known = getContestedReasonLabel(reason as ContestedReason)
  return known ?? EDGE_REVIEW_COPY.heading
}

function basisSentence(basis: string | undefined): string | null {
  if (!basis) return null
  return getBasisLabel(basis as EstimateBasis) ?? null
}

export function EdgeReviewDisagreement({ validation, techMode }: EdgeReviewDisagreementProps) {
  const [showNumbers, setShowNumbers] = useState(false)

  const reasons = Array.from(
    new Set((validation.contested_reasons ?? []).map(reasonSentence)),
  )
  const basisLabel = basisSentence(validation.pass2?.basis)

  return (
    <div className="bg-panel border border-warning/30 rounded-lg p-2.5">
      <div className={`${typography.panelBody} font-medium text-warning flex items-center gap-1`}>
        <AlertTriangle size={13} className="text-warning" />
        {EDGE_COPY.needsYourJudgement}
      </div>

      {reasons.length > 0 && (
        <ul className={`${typography.panelMeta} text-text-light mt-1 space-y-0.5`}>
          {reasons.map(sentence => (
            <li key={sentence}>{sentence}</li>
          ))}
        </ul>
      )}

      {validation.pass2?.reasoning && (
        <p className={`${typography.panelMeta} text-text-light mt-2 italic`}>
          &ldquo;{validation.pass2.reasoning}&rdquo;
        </p>
      )}

      {basisLabel && (
        <span className={`${typography.panelMeta} inline-block mt-1 px-1.5 py-0.5 rounded-full bg-transparent border border-info/30 text-text-body`}>
          {basisLabel}
        </span>
      )}

      {/* Progressive disclosure: the two estimates, named for what they mean. */}
      <div className="mt-2" data-testid="edge-review-detail">
        <button
          type="button"
          data-testid="edge-review-detail-toggle"
          onClick={() => setShowNumbers(v => !v)}
          aria-expanded={showNumbers}
          className={`${typography.panelMeta} bg-transparent border-none cursor-pointer text-info flex items-center gap-1 p-0 hover:underline`}
        >
          {showNumbers
            ? <ChevronDown size={12} className="text-info" aria-hidden="true" />
            : <ChevronRight size={12} className="text-info" aria-hidden="true" />}
          {showNumbers ? EDGE_REVIEW_COPY.hideDetail : EDGE_REVIEW_COPY.showDetail}
        </button>

        {showNumbers && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="bg-panel border border-panel-border rounded p-2">
              <div className={`${typography.panelMeta} text-text-light mb-1`}>
                {EDGE_REVIEW_COPY.currentEstimate}
              </div>
              <div className={typography.panelMeta}>
                {EDGE_REVIEW_COPY.strength}: {validation.pass1.strength_mean.toFixed(2)}
              </div>
              <div className={typography.panelMeta}>
                {EDGE_REVIEW_COPY.uncertainty}: {validation.pass1.strength_std.toFixed(2)}
              </div>
              <div className={typography.panelMeta}>
                {EDGE_REVIEW_COPY.existence}: {Math.round(validation.pass1.exists_probability * 100)}%
              </div>
            </div>
            <div className="bg-panel border border-panel-border rounded p-2">
              <div className={`${typography.panelMeta} text-text-light mb-1`}>
                {EDGE_REVIEW_COPY.reviewEstimate}
              </div>
              <div className={typography.panelMeta}>
                {EDGE_REVIEW_COPY.strength}: {validation.pass2.strength_mean.toFixed(2)}
              </div>
              <div className={typography.panelMeta}>
                {EDGE_REVIEW_COPY.uncertainty}: {validation.pass2.strength_std.toFixed(2)}
              </div>
              <div className={typography.panelMeta}>
                {EDGE_REVIEW_COPY.existence}: {Math.round(validation.pass2.exists_probability * 100)}%
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Expert mode only: the wire's own tokens, for anyone debugging a
          producer. Moved here rather than deleted — the placement was the
          defect, not the data. */}
      {techMode && (
        <div
          data-testid="edge-review-raw"
          className={`${typography.panelMeta} text-text-light mt-2 space-y-0.5`}
        >
          <div>System: contested_reasons: {(validation.contested_reasons ?? []).join(', ')}</div>
          {validation.pass2?.basis && <div>System: basis: {validation.pass2.basis}</div>}
        </div>
      )}
    </div>
  )
}
