/**
 * V7BiasSection — "Challenge your assumptions" (V7 Lane L6, spec row 11).
 *
 * Bias-coaching cards built from the producer's bias findings (the untyped
 * `ceeReview(V1).bias_findings` passthrough seam — see buildV7Bias). Each card
 * shows the producer description plus the `micro_intervention.steps` and
 * `estimated_minutes` VISIBLE (spec row 11), verbatim.
 *
 * COMPLETE borders only. The prototype's `.coach-card` `border-left:3px` is
 * named a violation in V6-RESPEC §3.1 and is NOT reproduced: the card carries a
 * complete four-sided `border-panel-border`, and the bias KIND is conveyed by a
 * badge + icon tint, never an edge accent.
 *
 * PASSTHROUGH, additive, flagless. Honest absence: no findings → renders
 * nothing (never an empty coaching shell). Reads the canvas store with a STABLE
 * selector (`s.runMeta`); the source pick + mapping run in a memo, never in the
 * selector (inline-selector landmine).
 */

import { useMemo } from 'react'
import { Brain, Clock } from 'lucide-react'
import { typography } from '@/styles/typography'
import { useCanvasStore } from '../../../canvas/store'
import { buildV7BiasFindings, pickBiasFindingsSource, type V7BiasFinding } from './buildV7Bias'
import { V7_GUIDANCE_COPY } from './v7GuidanceCopy'

const B = V7_GUIDANCE_COPY.bias

function BiasCard({ finding }: { finding: V7BiasFinding }) {
  return (
    <div
      data-testid="v7-bias-card"
      className="rounded-lg border border-panel-border bg-panel p-3 space-y-1.5"
    >
      <div className="flex items-center gap-2">
        <Brain aria-hidden="true" className="h-3.5 w-3.5 flex-none text-info" />
        {/* Kind badge — outlined, complete border; conveys kind without an edge accent. */}
        <span
          data-testid="v7-bias-kind"
          className={`flex-none rounded-full border border-info/30 bg-transparent px-1.5 py-0 ${typography.panelMeta} text-text-body`}
        >
          {finding.kindLabel}
        </span>
      </div>

      {finding.description && (
        <p className={`${typography.panelBody} text-text-body`}>{finding.description}</p>
      )}

      {finding.steps.length > 0 && (
        <div className="space-y-1" data-testid="v7-bias-steps">
          <div className="flex items-center gap-2">
            <span className={`${typography.panelMeta} font-semibold text-text-header`}>
              {B.stepsLabel}
            </span>
            {finding.estimatedMinutes != null && (
              <span
                data-testid="v7-bias-minutes"
                className={`inline-flex items-center gap-1 ${typography.panelMeta} text-text-light`}
              >
                <Clock aria-hidden="true" className="h-3 w-3 flex-none" />
                {B.minutes(finding.estimatedMinutes)}
              </span>
            )}
          </div>
          <ol className="space-y-0.5">
            {finding.steps.map((step, i) => (
              <li key={i} className={`${typography.panelMeta} text-text-body`}>
                {i + 1}. {step}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Minutes with no steps still surfaces the estimate honestly. */}
      {finding.steps.length === 0 && finding.estimatedMinutes != null && (
        <span
          data-testid="v7-bias-minutes"
          className={`inline-flex items-center gap-1 ${typography.panelMeta} text-text-light`}
        >
          <Clock aria-hidden="true" className="h-3 w-3 flex-none" />
          {B.minutes(finding.estimatedMinutes)}
        </span>
      )}
    </div>
  )
}

export function V7BiasSection() {
  // STABLE selector — the runMeta object reference. Source pick + build run in
  // the memo, never in the selector.
  const runMeta = useCanvasStore((s) => s.runMeta)
  const findings = useMemo(() => buildV7BiasFindings(pickBiasFindingsSource(runMeta)), [runMeta])

  if (findings.length === 0) return null

  return (
    <section data-testid="v7-bias-section" className="space-y-2">
      <div>
        <h3 className={`${typography.panelHeader} text-text-header`}>{B.heading}</h3>
        <p className={`${typography.panelMeta} text-text-light`}>{B.subtitle}</p>
      </div>
      <div className="space-y-2">
        {findings.map((f) => (
          <BiasCard key={f.key} finding={f} />
        ))}
      </div>
    </section>
  )
}

export default V7BiasSection
