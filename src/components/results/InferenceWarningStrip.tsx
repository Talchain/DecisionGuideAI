/**
 * InferenceWarningStrip — compact honest-caveat strip for warning-severity
 * producer `inference_warnings` on the Analysis tab (roadmap 1.12; tagged
 * provisional_doctrine_v0).
 *
 * Contract:
 *   - Renders ONLY entries whose producer `severity` is exactly 'warning'.
 *     Info-severity entries stay hidden here (they remain available to the
 *     Advanced/Confidence surfaces and the debug bundle). Entries with no
 *     severity are NOT promoted — the UI never invents a severity.
 *   - Copy is HUMANISED via the same `humaniseCritique` path every other
 *     critique surface uses (ConfidenceSection, useResultsSectionData) — the
 *     UI keys off producer `code`, never renders the raw `message` in JSX
 *     (V14.3 no-message-render guard). Unmapped codes fall through to
 *     humaniseCritique's safe generic copy rather than the raw string; an
 *     entry without a usable message renders nothing (fail-closed; no
 *     fabricated copy from `code` alone).
 *   - Display-only: never blocks analysis, never mutates state.
 *
 * Visual idiom mirrors AnalysisFreshnessNotice (the strip mounts directly
 * below it in ResultsBody): bg-panel card, border via opacity token,
 * lucide icon, panelBody typography.
 */
import { AlertTriangle } from 'lucide-react'
import { typography } from '@/styles/typography'
import { humaniseCritique } from './utils/humaniseCritique'
import type { InferenceWarning, UncertaintyItem } from './types'

export interface InferenceWarningStripProps {
  /** Producer inference warnings (all severities); the strip filters. */
  warnings?: InferenceWarning[]
  className?: string
}

/** Entries the strip will show: severity === 'warning' AND a non-empty producer message. */
export function selectWarningSeverityEntries(
  warnings: InferenceWarning[] | undefined,
): InferenceWarning[] {
  return (warnings ?? []).filter(
    (w) => w.severity === 'warning' && typeof w.message === 'string' && w.message.trim().length > 0,
  )
}

/** Node-label map for humaniseCritique's factor-label resolution, built from
 *  the entry's own already-resolved `affected_labels` (never parsed from
 *  `message`). Returns undefined when no labels are available — humaniseCritique
 *  falls back to its own ID-derived label in that case. */
function buildNodeLabelMap(w: InferenceWarning): Map<string, string> | undefined {
  if (!w.affected_labels || w.affected_labels.length === 0) return undefined
  const map = new Map<string, string>()
  w.affected_nodes.forEach((nodeId, i) => {
    const label = w.affected_labels?.[i]
    if (label) map.set(nodeId, label)
  })
  return map.size > 0 ? map : undefined
}

/** Humanised, user-safe headline for an inference warning — same
 *  code-keyed template path every other critique surface uses. */
function humaniseWarningTitle(w: InferenceWarning): string {
  const item: UncertaintyItem = {
    code: w.code,
    message: w.message ?? '',
    affectedNodes: w.affected_nodes,
  }
  return humaniseCritique(item, buildNodeLabelMap(w)).title
}

export function InferenceWarningStrip({ warnings, className = '' }: InferenceWarningStripProps) {
  const visible = selectWarningSeverityEntries(warnings)
  if (visible.length === 0) return null

  return (
    <div
      data-testid="inference-warning-strip"
      className={`flex flex-col gap-1 ${className}`.trim()}
      aria-label="Analysis caveats"
    >
      {visible.map((w, i) => (
        <div
          key={`${w.code}-${i}`}
          data-testid="inference-warning-strip-entry"
          data-warning-code={w.code}
          data-warning-severity={w.severity}
          className="flex items-center gap-2 rounded-md border px-3 py-2 bg-panel border-warning/30"
        >
          <AlertTriangle size={14} className="flex-none text-warning" aria-hidden="true" />
          {/* Humanised copy — never the producer's raw message (V14.3 guard). */}
          <span className={`${typography.panelBody} text-text-body`}>{humaniseWarningTitle(w)}</span>
        </div>
      ))}
    </div>
  )
}

export default InferenceWarningStrip
