/**
 * 1.16i — visible processing for the whole analysis turn (Paul's extended
 * acceptance: the analysis panel must SHOW the run, not just disable
 * buttons). Rendered by OutputsDock while isRunning && a previous report is
 * still on screen — the skeleton covers the no-report case. DS v4: bg-panel,
 * semantic tokens, Lucide only. aria-live announces the state change.
 */
import { Loader2 } from 'lucide-react'

import { typography } from '../../styles/typography'

export function AnalysisRunningBanner() {
  return (
    <div
      className="mx-3 mb-2 flex items-center gap-2 rounded-md border border-panel-border bg-panel px-3 py-2"
      data-testid="analysis-running-banner"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-4 w-4 animate-spin text-info" aria-hidden="true" />
      <span className={`${typography.bodySmall} text-text-body`}>
        Running a fresh analysis — the results below update when it completes.
      </span>
    </div>
  )
}
