import { useEffect, useRef, useState } from 'react'
import * as Flags from '../flags'
import * as RunReportMod from '../lib/runReport'
import { formatDownloadName } from '../lib/filename'
import type { RunReport } from '../lib/runReport'

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
  const enabled = Flags.isRunReportEnabled()
  const copyFlag: boolean = (() => {
    try {
      const env = (import.meta as any)?.env?.VITE_FEATURE_REPORT_COPY
      if (env === '1' || env === 1 || env === true) return true
    } catch {}
    try {
      const raw = (globalThis as any)?.localStorage?.getItem?.('feature.reportCopy')
      if (raw && raw !== '0' && raw !== 'false') return true
    } catch {}
    return false
  })()
  const expandAllFlag: boolean = (() => {
    try {
      const env = (import.meta as any)?.env?.VITE_FEATURE_REPORT_EXPANDALL
      if (env === '1' || env === 1 || env === true) return true
    } catch {}
    try {
      const raw = (globalThis as any)?.localStorage?.getItem?.('feature.reportExpandAll')
      if (raw && raw !== '0' && raw !== 'false') return true
    } catch {}
    return false
  })()
  const prettyFlag: boolean = (() => {
    try {
      const env = (import.meta as any)?.env?.VITE_FEATURE_REPORT_PRETTY
      if (env === '1' || env === 1 || env === true) return true
    } catch {}
    try {
      const raw = (globalThis as any)?.localStorage?.getItem?.('feature.reportPretty')
      if (raw && raw !== '0' && raw !== 'false') return true
    } catch {}
    return false
  })()
  const downloadFlag: boolean = (() => {
    try {
      const env = (import.meta as any)?.env?.VITE_FEATURE_REPORT_DOWNLOAD
      if (env === '1' || env === 1 || env === true) return true
    } catch {}
    try {
      const raw = (globalThis as any)?.localStorage?.getItem?.('feature.reportDownload')
      if (raw && raw !== '0' && raw !== 'false') return true
    } catch {}
    return false
  })()
  const [report, setReport] = useState<RunReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fallback, setFallback] = useState<boolean>(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLElement | null>(null)
  const firstFocusRef = useRef<HTMLDivElement | null>(null)
  const [copied, setCopied] = useState<boolean>(false)
  const copyTimerRef = useRef<number | null>(null)
  const [downloaded, setDownloaded] = useState<boolean>(false)
  const dlTimerRef = useRef<number | null>(null)
  const [pretty, setPretty] = useState<boolean>(() => {
    try { return !!(globalThis as any)?.localStorage?.getItem?.('report.pretty') } catch { return false }
  })
  const [expanded, setExpanded] = useState<boolean>(true)

  useEffect(() => {
    if (!open || !enabled) return
    setLoading(true)
    setReport(null)
    setError(null)
    setFallback(false)
    let p: Promise<{ report: RunReport; fallback: boolean }>
    try {
      const fnEnhanced = (RunReportMod as any).fetchRunReportEnhanced as undefined | ((args: any) => Promise<{ report: RunReport; fallback: boolean }>)
      const fnLegacy = RunReportMod.fetchRunReport
      p = fnEnhanced
        ? fnEnhanced({ sessionId, org, seed, budget, model })
        : fnLegacy({ sessionId, org, seed, budget, model }).then((r) => ({ report: r, fallback: false }))
    } catch {
      const fnLegacy = RunReportMod.fetchRunReport
      p = fnLegacy({ sessionId, org, seed, budget, model }).then((r) => ({ report: r, fallback: false }))
    }
    p.then(({ report, fallback }) => { setReport(report); setFallback(fallback) })
      .catch(() => setError('Report not available yet.'))
      .finally(() => setLoading(false))
  }, [open, enabled, sessionId, org, seed, budget, model])

  useEffect(() => {
    if (open && enabled) {
      // Capture the currently focused element as the trigger and focus the drawer
      triggerRef.current = (document.activeElement as HTMLElement | null) || null
      setTimeout(() => containerRef.current?.focus(), 0)
    }
  }, [open, enabled])

  const handleClose = () => {
    onClose()
  }

  if (!enabled || !open) return null

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      e.preventDefault()
      handleClose()
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
            {copyFlag && report && (
              <button
                type="button"
                data-testid="report-copy-btn"
                className="ml-2 text-xs px-2 py-1 rounded border border-gray-300"
                onClick={async () => {
                  try {
                    const text = JSON.stringify(report, null, 2)
                    await (globalThis as any)?.navigator?.clipboard?.writeText?.(text)
                    setCopied(true)
                    if (copyTimerRef.current != null) {
                      try { clearTimeout(copyTimerRef.current) } catch {}
                    }
                    // @ts-ignore
                    copyTimerRef.current = setTimeout(() => setCopied(false), 1200)
                  } catch {}
                }}
                title="Copy JSON"
              >
                Copy JSON
              </button>
            )}
            {downloadFlag && report && (
              <button
                type="button"
                data-testid="report-download-btn"
                className="ml-2 text-xs px-2 py-1 rounded border border-gray-300"
                onClick={async () => {
                  try {
                    const text = JSON.stringify(report, null, 2)
                    const blob = new Blob([text], { type: 'application/json' })
                    const url = URL.createObjectURL(blob)
                    const base = 'report_v1'
                    const fname = formatDownloadName(base, { seed: (seed ?? report?.seed), model, ext: 'json' })
                    const a = document.createElement('a')
                    a.href = url
                    a.download = fname
                    a.style.display = 'none'
                    document.body.appendChild(a)
                    a.click()
                    try { document.body.removeChild(a) } catch {}
                    setDownloaded(true)
                    if (dlTimerRef.current != null) {
                      try { clearTimeout(dlTimerRef.current) } catch {}
                    }
                    // @ts-ignore
                    dlTimerRef.current = setTimeout(() => setDownloaded(false), 1200)
                    setTimeout(() => URL.revokeObjectURL(url), 0)
                  } catch {}
                }}
                title="Download JSON"
              >
                Download JSON
              </button>
            )}
            {expandAllFlag && report && (
              <button
                type="button"
                data-testid="report-expandall-btn"
                className="ml-2 text-xs px-2 py-1 rounded border border-gray-300"
                onClick={() => setExpanded((v) => !v)}
                title={expanded ? 'Collapse all' : 'Expand all'}
              >
                {expanded ? 'Collapse all' : 'Expand all'}
              </button>
            )}
            {report && (
              <>
                <span data-testid="report-seed" className="ml-auto text-xs px-2 py-1 rounded-full border">Seed: {report.seed}</span>
                <span data-testid="report-route" className="text-xs px-2 py-1 rounded-full border">Route: {report.route}</span>
                <span data-testid="report-duration" className="text-xs px-2 py-1 rounded-full border">Duration: {durationMs}ms</span>
                {fallback && (
                  <span className="text-xs text-gray-500">(from sample)</span>
                )}
              </>
            )}
          </div>
          {copyFlag && copied && (
            <div data-testid="report-copy-toast" aria-hidden="true" className="mt-2 text-xs text-emerald-700">
              Copied
            </div>
          )}
          {downloadFlag && downloaded && (
            <div data-testid="report-download-toast" aria-hidden="true" className="mt-2 text-xs text-emerald-700">
              Downloaded
            </div>
          )}
        </div>

        <div className="p-4 overflow-auto h-[calc(100%-56px)]">
          {fallback && (
            <p data-testid="report-note" className="text-xs text-gray-500 mt-2">
              Showing sample report due to a temporary issue.
            </p>
          )}
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
                    {expanded && (report.steps || []).map((s) => (
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

              {prettyFlag && (
                <div>
                  <label className="flex items-center gap-2 text-xs text-gray-700">
                    <input
                      data-testid="report-pretty-toggle"
                      type="checkbox"
                      checked={pretty}
                      onChange={(e) => {
                        const on = e.target.checked
                        setPretty(on)
                        try { (globalThis as any)?.localStorage?.setItem?.('report.pretty', on ? '1' : '') } catch {}
                      }}
                    />
                    <span>Pretty JSON</span>
                  </label>
                  <pre data-testid="report-json-view" className="mt-2 text-xs p-2 bg-gray-50 border rounded whitespace-pre-wrap">
                    {pretty ? JSON.stringify(report, null, 2) : JSON.stringify(report)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div tabIndex={0} onFocus={() => containerRef.current?.focus()} />
    </div>
  )
}
