import React, { useEffect, useMemo, useRef } from 'react'
import { listRuns, type RunMeta } from '../lib/history'
import { isHistoryRerunEnabled } from '../flags'

export default function RunHistoryDrawer({ open, onClose, onOpenReport, onRerun, triggerRef }: {
  open: boolean
  onClose: () => void
  onOpenReport: (meta: RunMeta) => void
  onRerun?: (meta: RunMeta) => void
  triggerRef?: React.RefObject<HTMLButtonElement>
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const firstFocusRef = useRef<HTMLDivElement | null>(null)
  const lastFocusRef = useRef<HTMLDivElement | null>(null)

  const runs = useMemo(() => (open ? listRuns() : []), [open])
  const rerunFlag = isHistoryRerunEnabled()

  useEffect(() => {
    if (open) setTimeout(() => containerRef.current?.focus(), 0)
  }, [open])

  if (!open) return null

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      onClose()
      setTimeout(() => triggerRef?.current?.focus(), 0)
    }
  }

  const formatWhen = (ts: number) => {
    try {
      const diff = Date.now() - ts
      if (diff < 5000) return 'just now'
      const d = new Date(ts)
      return d.toLocaleTimeString()
    } catch {
      return String(ts)
    }
  }

  const statusLabel = (s: RunMeta['status']) => (
    s === 'done' ? 'Done' : s === 'aborted' ? 'Aborted' : s === 'limited' ? 'Limited by budget' : 'Error'
  )

  return (
    <div data-testid="history-backdrop" className="fixed inset-0 z-40" aria-hidden="false">
      <div tabIndex={0} ref={firstFocusRef} onFocus={() => containerRef.current?.focus()} />
      <div
        id="history-drawer"
        data-testid="history-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-title"
        ref={containerRef}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="fixed right-0 top-0 h-full w-[26rem] max-w-[90vw] bg-white border-l border-gray-200 shadow-lg z-50 outline-none"
      >
        <div className="p-4 border-b" id="history-title">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Run History</span>
            <button
              type="button"
              className="ml-auto text-xs px-2 py-1 rounded border"
              onClick={onClose}
              data-testid="history-close"
            >Close</button>
          </div>
        </div>

        <div className="p-4 overflow-auto h-[calc(100%-56px)] text-sm">
          {runs.length === 0 ? (
            <div data-testid="history-empty" className="text-gray-500 text-xs">No runs yet.</div>
          ) : (
            <ul className="space-y-2" data-testid="history-list">
              {runs.map((m) => (
                <li key={m.id} className="border rounded p-2 flex items-center gap-2">
                  <span className="text-xs text-gray-500" data-testid="history-when">{formatWhen(m.ts)}</span>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full border border-gray-300"
                    data-testid="history-status"
                    title={statusLabel(m.status)}
                  >{statusLabel(m.status)}</span>
                  {m.seed && <span className="text-xs border rounded px-1" data-testid="history-seed">seed: {m.seed}</span>}
                  {m.model && <span className="text-xs border rounded px-1" data-testid="history-model">model: {m.model}</span>}
                  {typeof m.estCost === 'number' && <span className="text-xs border rounded px-1" data-testid="history-cost">£{m.estCost.toFixed(2)}</span>}
                  {typeof m.durationMs === 'number' && <span className="text-xs border rounded px-1" data-testid="history-duration">{m.durationMs}ms</span>}
                  {rerunFlag && onRerun && (
                    <button
                      type="button"
                      className="ml-auto text-xs px-2 py-1 rounded border"
                      data-testid="rerun-btn"
                      onClick={() => onRerun(m)}
                    >Re-run</button>
                  )}
                  <button
                    type="button"
                    className="text-xs px-2 py-1 rounded border ml-auto"
                    data-testid="open-report-btn"
                    onClick={() => onOpenReport(m)}
                  >Open report</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div tabIndex={0} ref={lastFocusRef} onFocus={() => containerRef.current?.focus()} />
    </div>
  )
}
