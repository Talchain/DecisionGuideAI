import { useEffect, useRef, useState } from 'react'
import { isRunReportEnabled } from '../flags'
import { fetchRunReport, type RunReport } from '../lib/runReport'

type Props = {
  open: boolean
  sessionId: string
  org: string
  onClose: () => void
  seed?: string | number
  budget?: number
  model?: string
}

export default function RunReportDrawer({ open, sessionId, org, onClose, seed, budget, model }: Props) {
  const enabled = isRunReportEnabled()
  const [report, setReport] = useState<RunReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const firstFocusRef = useRef<HTMLDivElement | null>(null)
  const lastFocusRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open || !enabled) return
    setLoading(true)
    setReport(null)
    setError(null)
    fetchRunReport({ sessionId, org, seed, budget, model })
      .then((r) => setReport(r))
      .catch(() => setError('Report not available yet.'))
      .finally(() => setLoading(false))
  }, [open, enabled, sessionId, org, seed, budget, model])

  useEffect(() => {
    if (open && enabled) {
      // Focus the drawer container on open
      setTimeout(() => containerRef.current?.focus(), 0)
    }
  }, [open, enabled])

  if (!enabled || !open) return null

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      e.preventDefault()
      onClose()
    }
  }

  const started = report?.startedAt ? new Date(report.startedAt).getTime() : 0
  const finished = report?.finishedAt ? new Date(report.finishedAt).getTime() : 0
  const durationMs = finished && started ? Math.max(0, finished - started) : 0

  return (
    <div
      data-testid="report-backdrop"
      className="fixed inset-0 z-40"
      aria-hidden="false"
    >
      {/* Focus sentinels for trapping */}
      <div tabIndex={0} ref={firstFocusRef} onFocus={() => containerRef.current?.focus()} />

      <div
        data-testid="report-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="run-report-title"
        aria-busy={loading ? 'true' : 'false'}
        ref={containerRef}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="fixed right-0 top-0 h-full w-[28rem] max-w-[90vw] bg-white border-l border-gray-200 shadow-lg z-50 outline-none"
      >
        <div className="p-4 border-b" id="run-report-title">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Run Report</span>
            {report && (
              <>
                <span data-testid="report-seed" className="ml-auto text-xs px-2 py-1 rounded-full border">Seed: {report.seed}</span>
                <span data-testid="report-route" className="text-xs px-2 py-1 rounded-full border">Route: {report.route}</span>
                <span data-testid="report-duration" className="text-xs px-2 py-1 rounded-full border">Duration: {durationMs}ms</span>
              </>
            )}
          </div>
        </div>

        <div className="p-4 overflow-auto h-[calc(100%-56px)]">
          {(loading || error) && (
            <div data-testid="report-skeleton" className="space-y-3">
              <div className="h-4 bg-gray-100 rounded" />
              <div className="h-4 bg-gray-100 rounded" />
              <div className="h-4 bg-gray-100 rounded" />
              {error && (
                <div data-testid="report-hint" className="text-xs text-gray-600">
                  {error}
                </div>
              )}
            </div>
          )}

          {!loading && report && (
            <div className="space-y-4">
              <div>
                <div className="text-xs font-medium mb-1">Totals</div>
                <div data-testid="report-totals" className="grid grid-cols-2 gap-2 text-xs">
                  {Object.entries(report.totals || {}).map(([k, v]) => (
                    <div key={k} className="flex justify-between border rounded px-2 py-1">
                      <span>{k}</span>
                      <span>{String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs font-medium mb-1">Steps</div>
                <table data-testid="report-steps" className="w-full text-xs border">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left p-1 border">id</th>
                      <th className="text-left p-1 border">type</th>
                      <th className="text-left p-1 border">status</th>
                      <th className="text-right p-1 border">attempts</th>
                      <th className="text-right p-1 border">durationMs</th>
                      <th className="text-left p-1 border">errorCode</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(report.steps || []).map((s) => (
                      <tr key={s.id}>
                        <td className="p-1 border">{s.id}</td>
                        <td className="p-1 border">{s.type}</td>
                        <td className="p-1 border">{s.status}</td>
                        <td className="p-1 border text-right">{s.attempts}</td>
                        <td className="p-1 border text-right">{s.durationMs}</td>
                        <td className="p-1 border">{s.errorCode ?? ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      <div tabIndex={0} ref={lastFocusRef} onFocus={() => containerRef.current?.focus()} />
    </div>
  )
}
