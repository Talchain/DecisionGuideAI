/**
 * ContestedSettle — settle a two-pass disagreement from the inspector.
 *
 * THE GAP. `EdgePanel` already renders `EdgeReviewDisagreement` whenever
 * `validation.status === 'contested'`: the user opens a link, is told two drafting passes
 * disagreed about it, and — until this component — had no way to answer. That is the same
 * defect the pre-analysis panel carried, on the surface where a user actually inspects one
 * edge, which is where they are most likely to want to settle it.
 *
 * ⭐ ONE IMPLEMENTATION, TWO SURFACES. The emit, the fail-closed rules and the retire write
 * live in `useSettleContestedEdge`; the offerable verdicts live in `contestedVerdict`. This
 * component owns PRESENTATION only. Nothing about the act is spelled a second time here —
 * two copies of a judgement path would drift on exactly the fields that carry the user's
 * judgement (CLAUDE.md trap 12).
 *
 * ⚠ THE COPY IS IMPORTED FROM `CONTESTED_COPY`, AND THE IMPORT DIRECTION IS DELIBERATE. That
 * constant now serves two surfaces, and ONE SOURCE OF TRUTH FOR A USER-FACING SENTENCE beats
 * a tidier import graph: `signals/__tests__/registry.spec.ts` sweeps every string in that
 * object through the glossary banned-term matcher, so copy added there is gated. A private
 * second copy here would be ungated and would drift.
 *
 * ⛔ WHY THIS SURFACE NEEDS AN EXPLICIT SETTLED STATE AND THE PANEL LIST DID NOT. The
 * pre-analysis row RETIRES on settle — the parent recomputes its rows and the control
 * unmounts, which is what makes one turn per click hold there. The inspector does NOT close
 * when you settle: it stays open on the edge you are looking at. So this component tracks the
 * verdict it sent and renders the acknowledgement in place of the controls, which is both the
 * honest confirmation and what stops a second turn for the same intent.
 */

import { memo, useState } from 'react'

import { typography } from '../../../../styles/typography'
import { CONTESTED_COPY } from '../../../components/pre-analysis-v3/constants'
import {
  contestedVerdictOptions,
  type ContestedVerdict,
} from '../../../conversation/contestedVerdict'
import { useSettleContestedEdge } from '../../../conversation/useSettleContestedEdge'
import type { ValidationMetadata } from '../../../domain/validation'

const VERDICT_LABEL: Record<ContestedVerdict, string> = {
  accepted_pass1: CONTESTED_COPY.settlePass1,
  accepted_pass2: CONTESTED_COPY.settlePass2,
  dismissed: CONTESTED_COPY.settleUnsure,
}

export const ContestedSettle = memo(function ContestedSettle({
  edgeId,
  validation,
}: {
  edgeId: string
  validation: ValidationMetadata
}) {
  const { settle } = useSettleContestedEdge()
  const [sent, setSent] = useState(false)

  // Already settled on a previous turn — the server holds the judgement and the coaching has
  // stopped raising it, so the panel must not ask again.
  const alreadySettled = validation.user_action !== 'pending'
  if (alreadySettled || sent) {
    return (
      <p
        className={`${typography.panelMeta} mt-2 text-text-light`}
        role="status"
        data-testid={`inspector-contested-settled-${edgeId}`}
      >
        {CONTESTED_COPY.settledAck}
      </p>
    )
  }

  // FAIL-CLOSED. A verdict that cannot leave the browser must not be offered as if it could.
  if (settle === null) {
    return (
      <p
        className={`${typography.panelMeta} mt-2 text-text-light`}
        data-testid={`inspector-contested-settle-unavailable-${edgeId}`}
      >
        {CONTESTED_COPY.settleUnavailable}
      </p>
    )
  }

  // ⚠ THE RAW VALUES GO IN, UNFILTERED, AND THAT IS THE POINT. A local `finiteOrNull` sat here
  // first; a mutant that removed its `Number.isFinite` check left this suite GREEN, because
  // `contestedVerdictOptions` applies exactly that predicate itself. It was a second
  // derivation of one rule — the trap-12 mirror this component's header claims not to
  // contain — and the copy that would drift. Deleted: the builder owns the question.
  // (`?? null` is the type boundary only: `ValidationMetadata` declares both means required,
  // but this data arrives off the wire through a lenient path.)
  const options = contestedVerdictOptions({
    pass1Mean: validation.pass1?.strength_mean ?? null,
    pass2Mean: validation.pass2?.strength_mean ?? null,
  })

  return (
    <div className="mt-2">
      <p className={`${typography.panelMeta} text-text-light`} id={`inspector-settle-${edgeId}`}>
        {CONTESTED_COPY.settlePrompt}
      </p>
      <div
        className="mt-1 flex flex-wrap gap-1.5"
        role="group"
        aria-labelledby={`inspector-settle-${edgeId}`}
      >
        {options.map(option => (
          <button
            key={option.verdict}
            type="button"
            onClick={() => {
              settle(edgeId, option.verdict, option.resolvedMean)
              setSent(true)
            }}
            className="rounded border border-panel-border px-2 py-1 text-[11px] text-text-body outline-none transition-colors hover:bg-panel-hover focus-visible:ring-2 focus-visible:ring-info/40"
            data-testid={`inspector-contested-settle-${option.verdict}-${edgeId}`}
          >
            {VERDICT_LABEL[option.verdict]}
          </button>
        ))}
      </div>
    </div>
  )
})
