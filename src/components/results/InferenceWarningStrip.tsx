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
 *   - Copy is the producer `message` verbatim. The UI adds no interpretation,
 *     no rewording, no code-specific handling. An entry without a usable
 *     message renders nothing (fail-closed; no fabricated copy from `code`).
 *   - Display-only: never blocks analysis, never mutates state.
 *
 * Visual idiom mirrors AnalysisFreshnessNotice (the strip mounts directly
 * below it in ResultsBody): bg-panel card, border via opacity token,
 * lucide icon, panelBody typography.
 */
import { AlertTriangle } from 'lucide-react'
import { typography } from '@/styles/typography'
import type { InferenceWarning } from './types'

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
    (w) =>
      w.severity === 'warning' &&
      typeof w.message === 'string' &&
      w.message.trim().length > 0,
  )
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
          {/* Producer message verbatim — provisional_doctrine_v0: the UI adds no interpretation. */}
          <span className={`${typography.panelBody} text-text-body`}>{w.message}</span>
        </div>
      ))}
    </div>
  )
}

export default InferenceWarningStrip
