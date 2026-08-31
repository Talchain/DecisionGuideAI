/**
 * Analysis (New) — the one progressive-disclosure primitive every section uses.
 *
 * Three levels, per the brief §12:
 *   L1 scan     — headline + one implication sentence. Always visible.
 *   L2 understand — detail, grounding, and the row's own reasoning intervention.
 *   L3 inspect  — provenance/calculation rows, nested inside L2.
 *
 * ⚠ ACCESSIBILITY IS NOT OPTIONAL HERE AND PROGRESSIVE DISCLOSURE IS WHERE IT
 * USUALLY BREAKS. The whole L1 row is ONE button (so the target is large and
 * the keyboard reaches it once, not three times), it carries `aria-expanded`
 * and `aria-controls`, and the region it controls carries the matching id. A
 * collapsed region is UNMOUNTED rather than CSS-hidden, so a screen reader
 * never walks content the sighted user cannot see.
 *
 * ⚠ NO CARD INSIDE A CARD (§10). This renders a row with a hairline separator,
 * not a container. Depth is expressed with typography and space.
 */

import { useId, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { typography } from '../../../styles/typography'
import { ANALYSIS_NEW_COPY as COPY } from './analysisNewCopy'
import type { AnalysisNewFinding } from './analysisNewTypes'

const MARKER_LABEL: Record<NonNullable<AnalysisNewFinding['marker']>, string> = {
  provisional: COPY.markers.provisional,
  stale: COPY.markers.stale,
  not_assessed: COPY.markers.notAssessed,
}

export interface DisclosureRowProps {
  finding: AnalysisNewFinding
  /** Canvas focus. Absent when the producer named no target. */
  onFocusTarget?: (targetId: string) => void
  /** Runs the row's reasoning intervention through an EXISTING action route. */
  onRunIntervention?: (recommendationId: string) => void
  /** Stable prefix so two sections cannot mint the same testid. */
  testIdPrefix: string
}

export function DisclosureRow({
  finding,
  onFocusTarget,
  onRunIntervention,
  testIdPrefix,
}: DisclosureRowProps) {
  const [open, setOpen] = useState(false)
  const [inspectOpen, setInspectOpen] = useState(false)
  const regionId = useId()
  const inspectId = useId()

  const hasLevel2 =
    Boolean(finding.detail) || Boolean(finding.intervention) || finding.inspect.length > 0
  const marker = finding.marker ? MARKER_LABEL[finding.marker] : null

  return (
    <div
      className="border-b border-panel-border last:border-b-0 py-2.5"
      data-testid={`${testIdPrefix}-row`}
      data-finding-id={finding.id}
    >
      <button
        type="button"
        // A row with nothing beneath it is not a disclosure control. It stays a
        // plain block so the keyboard is not offered an expander that expands
        // nothing — an affordance that does nothing is the same class of lie as
        // a claim nobody measured.
        onClick={hasLevel2 ? () => setOpen((v) => !v) : undefined}
        disabled={!hasLevel2}
        aria-expanded={hasLevel2 ? open : undefined}
        aria-controls={hasLevel2 && open ? regionId : undefined}
        className={`w-full text-left flex items-start gap-2 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-info ${
          hasLevel2 ? 'hover:opacity-80' : 'cursor-default'
        }`}
        data-testid={`${testIdPrefix}-toggle`}
      >
        {hasLevel2 ? (
          open ? (
            <ChevronDown className="w-3.5 h-3.5 mt-0.5 shrink-0 text-text-light" aria-hidden="true" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 mt-0.5 shrink-0 text-text-light" aria-hidden="true" />
          )
        ) : (
          <span className="w-3.5 shrink-0" aria-hidden="true" />
        )}
        <span className="min-w-0 flex-1">
          <span className={`${typography.panelHeader} text-text-header block`}>
            {finding.headline}
            {marker ? (
              <span
                className={`${typography.panelMeta} text-text-light ml-2`}
                data-testid={`${testIdPrefix}-marker`}
              >
                {marker}
              </span>
            ) : null}
          </span>
          {finding.implication ? (
            <span className={`${typography.panelBody} text-text-body block mt-0.5`}>
              {finding.implication}
            </span>
          ) : null}
        </span>
      </button>

      {hasLevel2 && open ? (
        <div id={regionId} className="pl-6 mt-2 space-y-2" data-testid={`${testIdPrefix}-detail`}>
          {finding.detail ? (
            <p className={`${typography.panelBody} text-text-body`}>{finding.detail}</p>
          ) : null}

          {/* The grounding line. Every row can say what put it here. */}
          <p className={`${typography.panelMeta} text-text-light`} data-testid={`${testIdPrefix}-grounding`}>
            {COPY.disclosure.groundedIn} {finding.groundedIn}.
          </p>

          <div className="flex flex-wrap gap-3">
            {finding.targetId && onFocusTarget ? (
              <button
                type="button"
                onClick={() => onFocusTarget(finding.targetId!)}
                className={`${typography.panelMeta} text-info underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
                data-testid={`${testIdPrefix}-focus`}
              >
                Show on canvas
              </button>
            ) : null}

            {/* ⚠ CONTEXTUAL INTERVENTION — stays visibly attached to the finding
                that triggered it (§3B). It is never a generic tip: it exists
                only because the strengthen ENGINE emitted a recommendation for
                THIS row's target id. */}
            {finding.intervention && onRunIntervention ? (
              <button
                type="button"
                onClick={() => onRunIntervention(finding.intervention!.recommendationId)}
                className={`${typography.panelMeta} text-info underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
                data-testid={`${testIdPrefix}-intervention`}
                data-recommendation-id={finding.intervention.recommendationId}
              >
                {finding.intervention.label} →
              </button>
            ) : null}
          </div>

          {finding.inspect.length > 0 ? (
            <div>
              <button
                type="button"
                onClick={() => setInspectOpen((v) => !v)}
                aria-expanded={inspectOpen}
                aria-controls={inspectOpen ? inspectId : undefined}
                className={`${typography.panelMeta} text-text-light underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
                data-testid={`${testIdPrefix}-inspect-toggle`}
              >
                {COPY.disclosure.inspect}
              </button>
              {inspectOpen ? (
                <dl
                  id={inspectId}
                  className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1"
                  data-testid={`${testIdPrefix}-inspect`}
                >
                  {finding.inspect.map((r) => (
                    <div key={r.label} className="contents">
                      {/* ⚠ MIRRORS `DeeperAnalysis.tsx:110-111`, WHICH ALREADY HAD THIS
                          AND THIS FILE DID NOT. Both render producer-supplied node
                          labels and values, which are unbounded and may contain a
                          token with no break opportunity — and an unbreakable token
                          in a 278px column gives the whole tab a horizontal
                          scrollbar. Same content, same risk, one guard: an
                          asymmetry, not a decision. */}
                      <dt className={`${typography.panelMeta} text-text-light break-words`}>{r.label}</dt>
                      <dd className={`${typography.panelMeta} text-text-body break-words min-w-0`}>{r.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
