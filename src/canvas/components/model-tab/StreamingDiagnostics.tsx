/**
 * StreamingDiagnostics — debug panel shown via Shift+D.
 *
 * Displays: resumes, recovered events, buffer trim status, correlation ID.
 * Purely presentational — all data comes from props.
 */

import { typography } from '../../../styles/typography'

interface StreamingDiagnosticsProps {
  showDebug: boolean
  hasDiagnostics: boolean
  diagnostics: any
  hasTrim: boolean
  effectiveCorrelationId: string | null | undefined
  correlationMismatch: boolean
  correlationIdHeader: string | null | undefined
}

export function StreamingDiagnostics({
  showDebug,
  hasDiagnostics,
  diagnostics,
  hasTrim,
  effectiveCorrelationId,
  correlationMismatch,
  correlationIdHeader,
}: StreamingDiagnosticsProps) {
  if (!showDebug) {
    return (
      <p className={`${typography.panelMeta} text-text-light border-t border-panel-border pt-2`}>
        Press <kbd className={`px-1.5 py-0.5 bg-sand-100 rounded ${typography.panelMeta} font-mono`}>Shift+D</kbd> for streaming diagnostics
      </p>
    )
  }

  return (
    <div className="border-t border-panel-border pt-3 space-y-1" data-testid="model-streaming-diagnostics">
      <div className={`${typography.panelHeader} text-text-header mb-2`}>
        Streaming diagnostics
      </div>
      <div className="flex items-center justify-between">
        <span className={`${typography.panelBody} text-text-light`}>Resumes</span>
        <span className={`${typography.panelBody} text-text-header tabular-nums`} data-testid="diag-resumes">
          {hasDiagnostics ? diagnostics?.resumes ?? 0 : 0}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className={`${typography.panelBody} text-text-light`}>Recovered events</span>
        <span className={`${typography.panelBody} text-text-header tabular-nums`} data-testid="diag-recovered">
          {hasDiagnostics ? diagnostics?.recovered_events ?? 0 : 0}
        </span>
      </div>
      <div className="flex items-center justify-between" data-testid="diag-trims">
        <span className={`${typography.panelBody} text-text-light`}>Buffer trimmed</span>
        <span className={`${typography.panelMeta} inline-flex items-center px-1.5 py-0.5 rounded border`}>
          {hasTrim
            ? <span className="bg-sun-50 text-sun-800 border-sun-200 px-1.5 py-0.5 rounded">Yes</span>
            : <span className="text-text-light border-panel-border px-1.5 py-0.5 rounded">No</span>}
        </span>
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-panel-border">
        <span className={`${typography.panelBody} text-text-light`}>Correlation ID</span>
        <div className="flex items-center gap-2">
          <span
            className={`font-mono ${typography.code} text-text-header max-w-[10rem] truncate`}
            data-testid="diag-correlation-value"
          >
            {effectiveCorrelationId ?? '—'}
          </span>
          {effectiveCorrelationId && (
            <button
              type="button"
              onClick={() => {
                try { navigator.clipboard?.writeText(effectiveCorrelationId) } catch {}
              }}
              className={`inline-flex items-center px-1.5 py-0.5 rounded border border-panel-border ${typography.code} text-text-light hover:bg-sand-50`}
              data-testid="diag-correlation-copy"
            >
              Copy
            </button>
          )}
        </div>
      </div>
      {correlationMismatch && (
        <p className={`${typography.code} text-sun-700`} data-testid="diag-correlation-mismatch">
          Correlation ID in diagnostics ({diagnostics?.correlation_id}) does not match header ({correlationIdHeader}).
        </p>
      )}
      <p className={`${typography.code} text-text-light`}>
        For deeper engine instrumentation, use the on-canvas diagnostics overlay via
        <code className="mx-1">?diag=1</code>.
      </p>
    </div>
  )
}
