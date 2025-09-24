import { useEffect, useRef, useState } from 'react'
import { isSseEnabled, isRunReportEnabled, isConfidenceChipsEnabled, isHintsEnabled, isParamsEnabled, isHistoryEnabled, isExportEnabled } from '../flags'
import { isMarkdownPreviewEnabled, isShortcutsEnabled, isCopyCodeEnabled } from '../flags'
import { openStream, type StreamHandle } from '../lib/sseClient'
import RunReportDrawer from './RunReportDrawer'
import { fetchRunReport, type RunReport } from '../lib/runReport'
import { getDefaults } from '../lib/session'
import { track } from '../lib/telemetry'
import RunHistoryDrawer from './RunHistoryDrawer'
import type { RunMeta } from '../lib/history'
import { record } from '../lib/history'
import { buildPlainText, buildJson, triggerDownload, type TokenRec as ExportTokenRec } from '../lib/export'
import { renderMarkdownSafe } from '../lib/markdown'

type Status = 'idle' | 'streaming' | 'done' | 'cancelled' | 'limited' | 'aborted' | 'error'

function formatGBP(v?: number): string {
  if (typeof v !== 'number' || Number.isNaN(v)) return '£0.00'
  return `£${v.toFixed(2)}`
}

export default function SandboxStreamPanel() {
  // Flag-gated: OFF by default
  if (!isSseEnabled()) return null

  const [status, setStatus] = useState<Status>('idle')
  const [output, setOutput] = useState('')
  const [cost, setCost] = useState<number | undefined>(undefined)
  const [reconnecting, setReconnecting] = useState(false)
  const [started, setStarted] = useState(false)
  const handleRef = useRef<StreamHandle | null>(null)
  const statusRef = useRef<HTMLDivElement | null>(null)
  const acceptTokensRef = useRef<boolean>(true)
  const stopAtRef = useRef<number | null>(null)
  const [reportOpen, setReportOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [reportParams, setReportParams] = useState<{ seed?: string | number; budget?: number; model?: string } | null>(null)
  const reportBtnRef = useRef<HTMLButtonElement | null>(null)
  const historyBtnRef = useRef<HTMLButtonElement | null>(null)
  const reportFlag = isRunReportEnabled()
  const chipsFlag = isConfidenceChipsEnabled()
  const hintsFlag = isHintsEnabled()
  const paramsFlag = isParamsEnabled()
  const historyFlag = isHistoryEnabled()
  const exportFlag = isExportEnabled()
  const mdFlag = isMarkdownPreviewEnabled()
  const shortcutsFlag = isShortcutsEnabled()
  const copyFlag = isCopyCodeEnabled()
  const [reportData, setReportData] = useState<RunReport | null>(null)
  const [mdHtml, setMdHtml] = useState<string>('')
  const [sheetOpen, setSheetOpen] = useState<boolean>(false)
  const mdPreviewRef = useRef<HTMLDivElement | null>(null)
  const [copyOverlays, setCopyOverlays] = useState<Array<{ id: number; top: number; left: number; code: string; lang?: string }>>([])
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [failedId, setFailedId] = useState<number | null>(null)
  const [ariaCopyMsg, setAriaCopyMsg] = useState<string>('')

  // Track timing and last in-flight cost for history metadata
  const startedAtRef = useRef<number | null>(null)
  const costRef = useRef<number | undefined>(undefined)
  const tokensRef = useRef<ExportTokenRec[]>([])
  const textRef = useRef<string>('')

  // Optional, tiny frame buffer for smoother token appends
  const bufferEnabled: boolean = (() => {
    try {
      const env = (import.meta as any)?.env?.VITE_STREAM_BUFFER
      if (env === '0' || env === 0 || env === false) return false
      if (env === '1' || env === 1 || env === true) return true
    } catch {}
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem('feature.streamBuffer')
        if (raw === '0' || raw === 'false') return false
        if (raw && raw !== '0' && raw !== 'false') return true
      }
    } catch {}
    return true // default ON
  })()
  const frameBufRef = useRef<string[]>([])
  const rafIdRef = useRef<number | null>(null)

  // Scenario params state (persisted). Enabled only when paramsFlag is true.
  const [seed, setSeed] = useState<string>(() => {
    try { return window.localStorage.getItem('sandbox.seed') || '' } catch { return '' }
  })
  const [budget, setBudget] = useState<string>(() => {
    try { return window.localStorage.getItem('sandbox.budget') || '' } catch { return '' }
  })
  const [model, setModel] = useState<string>(() => {
    try { return window.localStorage.getItem('sandbox.model') || '' } catch { return '' }
  })
  const persistParams = (s: string, b: string, m: string) => {
    try {
      window.localStorage.setItem('sandbox.seed', s)
      window.localStorage.setItem('sandbox.budget', b)
      window.localStorage.setItem('sandbox.model', m)
    } catch {}
  }

  const flushFrame = () => {
    rafIdRef.current = null
    if (!acceptTokensRef.current) {
      frameBufRef.current = []
      return
    }
    if (frameBufRef.current.length > 0) {
      const chunk = frameBufRef.current.join('')
      frameBufRef.current = []
      setOutput((prev) => prev + chunk)
      textRef.current += chunk
      if (mdFlag) setMdHtml(renderMarkdownSafe(textRef.current))
    }
  }

  // Compute overlay positions for copy buttons on fenced code blocks
  useEffect(() => {
    if (!mdFlag || !copyFlag) { setCopyOverlays([]); return }
    const container = mdPreviewRef.current
    if (!container) { setCopyOverlays([]); return }
    // Measure after DOM commit
    const contRect = container.getBoundingClientRect()
    const nodes = Array.from(container.querySelectorAll('pre.md-code')) as HTMLElement[]
    const list = nodes.map((pre, idx) => {
      const r = pre.getBoundingClientRect()
      const codeEl = pre.querySelector('code') as HTMLElement | null
      const code = (codeEl?.textContent ?? '')
      const cls = codeEl?.className || ''
      const m = cls.match(/language-([A-Za-z0-9#+\-_.]+)/)
      const lang = m ? m[1] : undefined
      // Position near top-right corner of the pre element
      const top = Math.max(0, r.top - contRect.top + 6)
      const left = Math.max(0, r.right - contRect.left - 6)
      return { id: idx, top, left, code, lang }
    })
    setCopyOverlays(list)
    // Recompute on resize as a best effort (no perf risk in Sandbox)
    const onResize = () => {
      try {
        const contR = container.getBoundingClientRect()
        const nodes2 = Array.from(container.querySelectorAll('pre.md-code')) as HTMLElement[]
        const list2 = nodes2.map((pre, idx) => {
          const r = pre.getBoundingClientRect()
          const codeEl = pre.querySelector('code') as HTMLElement | null
          const code = (codeEl?.textContent ?? '')
          const cls = codeEl?.className || ''
          const m = cls.match(/language-([A-Za-z0-9#+\-_.]+)/)
          const lang = m ? m[1] : undefined
          const top = Math.max(0, r.top - contR.top + 6)
          const left = Math.max(0, r.right - contR.left - 6)
          return { id: idx, top, left, code, lang }
        })
        setCopyOverlays(list2)
      } catch {}
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [mdHtml, mdFlag, copyFlag])

  const handleCopy = async (id: number, text: string) => {
    try {
      await (globalThis as any)?.navigator?.clipboard?.writeText?.(text)
      setCopiedId(id)
      setAriaCopyMsg('Copied')
      setTimeout(() => { setCopiedId(null); setAriaCopyMsg('') }, 1200)
    } catch {
      setFailedId(id)
      setAriaCopyMsg('Copy failed')
      setTimeout(() => { setFailedId(null); setAriaCopyMsg('') }, 1200)
    }
  }
  const scheduleFlush = () => {
    if (rafIdRef.current != null) return
    const raf: any = (globalThis as any).requestAnimationFrame
    if (typeof raf === 'function') {
      rafIdRef.current = raf(() => flushFrame())
    } else {
      // Microtask fallback ensures deterministic behavior in tests
      rafIdRef.current = -1 as any
      Promise.resolve().then(() => flushFrame())
    }
  }
  const cancelFlush = () => {
    if (rafIdRef.current != null) {
      try { (globalThis as any).cancelAnimationFrame?.(rafIdRef.current as any) } catch {}
      try { clearTimeout(rafIdRef.current as any) } catch {}
      rafIdRef.current = null
    }
  }
  const flushNow = () => {
    cancelFlush()
    if (frameBufRef.current.length > 0) {
      const chunk = frameBufRef.current.join('')
      frameBufRef.current = []
      setOutput((prev) => prev + chunk)
      textRef.current += chunk
      if (mdFlag) setMdHtml(renderMarkdownSafe(textRef.current))
    }
  }

  // Ensure tidy cleanup on unmount
  useEffect(() => {
    return () => {
      handleRef.current?.close()
      handleRef.current = null
    }
  }, [])

  const begin = (over?: { seed?: string | number; budget?: number; model?: string }) => {
    if (started) return
    setStarted(true)
    setStatus('streaming')
    setOutput('')
    if (mdFlag) setMdHtml('')
    setCost(undefined)
    costRef.current = undefined
    setReconnecting(false)
    acceptTokensRef.current = true
    stopAtRef.current = null
    setReportData(null)
    tokensRef.current = []
    textRef.current = ''
    track('edge.stream.start')

    // Determine params for this run (override → state)
    const seedUse = over?.seed != null ? String(over.seed) : seed
    const budgetUseStr = over?.budget != null ? String(over.budget) : budget
    const modelUse = over?.model != null ? String(over.model) : model
    // Persist and update UI states if overrides are provided
    if (over) {
      setSeed(seedUse)
      setBudget(budgetUseStr)
      setModel(modelUse)
      persistParams(seedUse, budgetUseStr, modelUse)
    }

    const { sessionId, org } = getDefaults()
    startedAtRef.current = Date.now()

    const seedArg = over ? (seedUse ? seedUse : undefined) : (paramsFlag && seedUse ? seedUse : undefined)
    const budgetArg = over ? (budgetUseStr !== '' && !Number.isNaN(Number(budgetUseStr)) ? Number(budgetUseStr) : undefined) : (paramsFlag && budgetUseStr !== '' && !Number.isNaN(Number(budgetUseStr)) ? Number(budgetUseStr) : undefined)
    const modelArg = over ? (modelUse ? modelUse : undefined) : (paramsFlag && modelUse ? modelUse : undefined)

    const h = openStream({
      route: 'critique',
      sessionId,
      org,
      seed: seedArg,
      budget: budgetArg,
      model: modelArg,
      onHello: () => {
        // Clear any transient reconnect hint
        setReconnecting(false)
      },
      onToken: (t) => {
        if (!acceptTokensRef.current) return
        // Capture token deterministically for export
        const id = String(tokensRef.current.length + 1)
        tokensRef.current.push({ id, text: t })
        if (bufferEnabled) {
          frameBufRef.current.push(t)
          scheduleFlush()
        } else {
          setOutput((prev) => prev + t)
          textRef.current += t
        }
        track('edge.stream.token')
      },
      onCost: (usd) => {
        // Display as GBP per spec (format only)
        setCost(usd)
        costRef.current = usd
      },
      onDone: () => {
        flushNow()
        setStatus('done')
        setStarted(false)
        setReconnecting(false)
        if (mdFlag) setMdHtml(renderMarkdownSafe(textRef.current))
        // Move focus to status chip for clarity
        setTimeout(() => statusRef.current?.focus(), 0)
        track('edge.stream.done')
        if (historyFlag) {
          const durationMs = startedAtRef.current ? Math.max(0, Date.now() - startedAtRef.current) : undefined
          record({
            id: `${Date.now()}-${seed || 'na'}`,
            ts: Date.now(),
            status: 'done',
            durationMs,
            estCost: costRef.current,
            seed: paramsFlag && seed ? seed : undefined,
            budget: paramsFlag && budget !== '' && !Number.isNaN(Number(budget)) ? Number(budget) : undefined,
            model: paramsFlag && model ? model : undefined,
            route: 'critique',
            sessionId,
            org,
          })
        }
        if (chipsFlag) {
          void fetchRunReport({
            sessionId,
            org,
            seed: paramsFlag && seed ? seed : undefined,
            budget: paramsFlag && budget !== '' && !Number.isNaN(Number(budget)) ? Number(budget) : undefined,
            model: paramsFlag && model ? model : undefined,
          }).then(setReportData).catch(() => {})
        }
      },
      onCancelled: () => {
        flushNow()
        setStatus('cancelled')
        setStarted(false)
        setReconnecting(false)
        if (mdFlag) setMdHtml(renderMarkdownSafe(textRef.current))
        setTimeout(() => statusRef.current?.focus(), 0)
        track('edge.stream.cancelled')
      },
      onError: (err?: any) => {
        // Show a subtle reconnect hint only when a retry will occur
        if (err && err.willRetry) {
          setReconnecting(true)
        } else {
          // Terminal error
          flushNow()
          setStatus('error')
          setStarted(false)
          setReconnecting(false)
          if (mdFlag) setMdHtml(renderMarkdownSafe(textRef.current))
          setTimeout(() => statusRef.current?.focus(), 0)
          track('edge.stream.error')
          if (historyFlag) {
            const durationMs = startedAtRef.current ? Math.max(0, Date.now() - startedAtRef.current) : undefined
            record({
              id: `${Date.now()}-${seed || 'na'}`,
              ts: Date.now(),
              status: 'error',
              durationMs,
              estCost: costRef.current,
              seed: paramsFlag && seed ? seed : undefined,
              budget: paramsFlag && budget !== '' && !Number.isNaN(Number(budget)) ? Number(budget) : undefined,
              model: paramsFlag && model ? model : undefined,
              route: 'critique',
              sessionId,
              org,
            })
          }
          if (chipsFlag) {
            void fetchRunReport({
              sessionId,
              org,
              seed: paramsFlag && seed ? seed : undefined,
              budget: paramsFlag && budget !== '' && !Number.isNaN(Number(budget)) ? Number(budget) : undefined,
              model: paramsFlag && model ? model : undefined,
            }).then(setReportData).catch(() => {})
          }
        }
      },
      onAborted: () => {
        flushNow()
        setStatus('aborted')
        setStarted(false)
        setReconnecting(false)
        if (mdFlag) setMdHtml(renderMarkdownSafe(textRef.current))
        // Dev log: cancel latency from Stop to Aborted
        try {
          const dev = (import.meta as any)?.env?.DEV
          if (dev && stopAtRef.current) {
            const dt = Date.now() - stopAtRef.current
            // No PII: timestamp delta only
            console.debug('[SandboxStreamPanel] Cancel latency (ms):', dt)
          }
        } catch {}
        setTimeout(() => statusRef.current?.focus(), 0)
        if (historyFlag) {
          const durationMs = startedAtRef.current ? Math.max(0, Date.now() - startedAtRef.current) : undefined
          const { sessionId, org } = getDefaults()
          record({
            id: `${Date.now()}-${seed || 'na'}`,
            ts: Date.now(),
            status: 'aborted',
            durationMs,
            estCost: costRef.current,
            seed: paramsFlag && seed ? seed : undefined,
            budget: paramsFlag && budget !== '' && !Number.isNaN(Number(budget)) ? Number(budget) : undefined,
            model: paramsFlag && model ? model : undefined,
            route: 'critique',
            sessionId,
            org,
          })
        }
        if (chipsFlag) {
          const { sessionId, org } = getDefaults()
          void fetchRunReport({
            sessionId,
            org,
            seed: paramsFlag && seed ? seed : undefined,
            budget: paramsFlag && budget !== '' && !Number.isNaN(Number(budget)) ? Number(budget) : undefined,
            model: paramsFlag && model ? model : undefined,
          }).then(setReportData).catch(() => {})
        }
      },
      onLimit: () => {
        flushNow()
        setStatus('limited')
        setStarted(false)
        setReconnecting(false)
        if (mdFlag) setMdHtml(renderMarkdownSafe(textRef.current))
        setTimeout(() => statusRef.current?.focus(), 0)
        track('edge.stream.limited')
        if (historyFlag) {
          const durationMs = startedAtRef.current ? Math.max(0, Date.now() - startedAtRef.current) : undefined
          record({
            id: `${Date.now()}-${seed || 'na'}`,
            ts: Date.now(),
            status: 'limited',
            durationMs,
            estCost: costRef.current,
            seed: paramsFlag && seed ? seed : undefined,
            budget: paramsFlag && budget !== '' && !Number.isNaN(Number(budget)) ? Number(budget) : undefined,
            model: paramsFlag && model ? model : undefined,
            route: 'critique',
            sessionId,
            org,
          })
        }
        if (chipsFlag) {
          void fetchRunReport({
            sessionId,
            org,
            seed: paramsFlag && seed ? seed : undefined,
            budget: paramsFlag && budget !== '' && !Number.isNaN(Number(budget)) ? Number(budget) : undefined,
            model: paramsFlag && model ? model : undefined,
          }).then(setReportData).catch(() => {})
        }
      },
    })
    handleRef.current = h
  }

  const stop = () => {
    if (!started) return
    flushNow()
    setStatus('cancelled') // Instant and tidy UX
    setStarted(false)
    setReconnecting(false)
    acceptTokensRef.current = false
    stopAtRef.current = Date.now()
    setTimeout(() => statusRef.current?.focus(), 0)
    // Do NOT close immediately; allow 'aborted' to arrive. Gate tokens locally.
    const h = handleRef.current
    h?.cancel().catch(() => {})
    handleRef.current = null
  }

  const terminalLabel =
    status === 'done' ? 'Done' :
    status === 'aborted' ? 'Aborted' :
    status === 'limited' ? 'Limited by budget' :
    status === 'error' ? 'Error' :
    status === 'cancelled' ? 'Cancelled' :
    status === 'streaming' ? 'Streaming' : 'Idle'

  const canViewReport = reportFlag && (status === 'done' || status === 'aborted' || status === 'error' || status === 'limited')
  const canExport = exportFlag && (status === 'done' || status === 'aborted' || status === 'error' || status === 'limited')

  // Optional terminal status hint title
  const hintTitle = hintsFlag && (status === 'done' || status === 'aborted' || status === 'limited' || status === 'error')
    ? (
      status === 'done' ? 'Completed successfully.' :
      status === 'aborted' ? 'Stopped by you.' :
      status === 'limited' ? 'Run hit the budget limit.' :
      'Something went wrong during streaming.'
    )
    : undefined

  // Keyboard shortcuts (flag-gated) — placed after canViewReport is computed
  useEffect(() => {
    if (!shortcutsFlag) return
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const tag = (target?.tagName || '').toLowerCase()
      const editable = !!(target as any)?.isContentEditable
      const typing = tag === 'input' || tag === 'textarea' || tag === 'select' || editable

      // Cheat sheet open/close has priority
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        if (!typing) { e.preventDefault(); setSheetOpen((v) => !v) }
        return
      }
      if (sheetOpen && e.key === 'Escape') {
        e.preventDefault(); setSheetOpen(false); return
      }

      // Start (Cmd/Ctrl+Enter)
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        if (!typing && !started) { e.preventDefault(); begin() }
        return
      }
      // Stop (Esc)
      if (e.key === 'Escape') {
        if (!typing && started) { e.preventDefault(); stop() }
        return
      }
      // Open report (r)
      if ((e.key === 'r' || e.key === 'R')) {
        if (!typing && canViewReport) {
          e.preventDefault()
          setReportParams({
            seed: paramsFlag && seed ? seed : undefined,
            budget: paramsFlag && budget !== '' && !Number.isNaN(Number(budget)) ? Number(budget) : undefined,
            model: paramsFlag && model ? model : undefined,
          })
          setReportOpen(true)
        }
        return
      }
      // Open history (h)
      if ((e.key === 'h' || e.key === 'H') && historyFlag) {
        if (!typing && !historyOpen) { e.preventDefault(); setHistoryOpen(true) }
        return
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [shortcutsFlag, started, canViewReport, historyFlag, historyOpen, seed, budget, model, paramsFlag, sheetOpen])

  return (
    <div className="p-3 rounded-md border border-gray-200 bg-white text-sm">
      <div className="flex items-center gap-2 mb-2">
        <button
          type="button"
          data-testid="start-btn"
          onClick={() => begin()}
          className="px-2 py-1 rounded bg-blue-600 text-white disabled:opacity-50"
          disabled={started}
        >
          Start
        </button>
        <button
          type="button"
          data-testid="stop-btn"
          onClick={stop}
          className="px-2 py-1 rounded bg-gray-200 text-gray-900 disabled:opacity-50"
          disabled={!started}
        >
          Stop
        </button>

        {paramsFlag && (
          <div className="flex items-center gap-2 text-xs ml-2">
            <label className="flex items-center gap-1 text-gray-700">
              <span>Seed</span>
              <input
                data-testid="param-seed"
                type="text"
                className="w-20 px-1 py-0.5 border rounded"
                value={seed}
                onChange={(e) => { const v = e.target.value; setSeed(v); persistParams(v, budget, model) }}
              />
            </label>
            <label className="flex items-center gap-1 text-gray-700">
              <span>Budget</span>
              <input
                data-testid="param-budget"
                type="number"
                step="0.01"
                className="w-24 px-1 py-0.5 border rounded"
                value={budget}
                onChange={(e) => { const v = e.target.value; setBudget(v); persistParams(seed, v, model) }}
              />
            </label>
            <label className="flex items-center gap-1 text-gray-700">
              <span>Model</span>
              <select
                data-testid="param-model"
                className="px-1 py-0.5 border rounded"
                value={model}
                onChange={(e) => { const v = e.target.value; setModel(v); persistParams(seed, budget, v) }}
              >
                <option value="">(default)</option>
                <option value="gpt-4o-mini">gpt-4o-mini</option>
                <option value="claude-haiku">claude-haiku</option>
                <option value="local-sim">local-sim</option>
              </select>
            </label>
          </div>
        )}

      {shortcutsFlag && sheetOpen && (
        <div
          data-testid="shortcuts-sheet"
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 bg-black/20 flex items-center justify-center z-50"
        >
          <div className="bg-white rounded shadow p-4 w-[22rem] text-sm">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold">Keyboard shortcuts</h2>
              <button className="text-xs border rounded px-2 py-0.5" onClick={() => setSheetOpen(false)}>Close</button>
            </div>
            <ul className="list-disc ml-5 space-y-1">
              <li><kbd className="px-1 border rounded">Cmd/Ctrl</kbd> + <kbd className="px-1 border rounded">Enter</kbd> — Start</li>
              <li><kbd className="px-1 border rounded">Esc</kbd> — Stop</li>
              <li><kbd className="px-1 border rounded">R</kbd> — View report (after terminal)</li>
              <li><kbd className="px-1 border rounded">H</kbd> — History</li>
              <li><kbd className="px-1 border rounded">?</kbd> — Toggle this sheet</li>
            </ul>
          </div>
        </div>
      )}

      

        <div
          ref={statusRef}
          data-testid="status-chip"
          tabIndex={-1}
          className="ml-auto text-xs px-2 py-1 rounded-full border border-gray-300"
          aria-live="polite"
          aria-label={`Run status: ${terminalLabel}`}
          title={hintTitle}
        >
          {terminalLabel}
        </div>

        {reportFlag && (
          <button
            type="button"
            data-testid="view-report-btn"
            ref={reportBtnRef}
            onClick={() => {
            // manual open uses current params (if any)
            setReportParams({
              seed: paramsFlag && seed ? seed : undefined,
              budget: paramsFlag && budget !== '' && !Number.isNaN(Number(budget)) ? Number(budget) : undefined,
              model: paramsFlag && model ? model : undefined,
            })
            setReportOpen(true)
          }}
            className="text-xs px-2 py-1 rounded border border-gray-300 disabled:opacity-50"
            title="Open report"
            disabled={!canViewReport}
          >
            View report
          </button>
        )}

        {historyFlag && (
          <button
            type="button"
            data-testid="history-btn"
            ref={historyBtnRef}
            aria-controls="history-drawer"
            title="Open history"
            onClick={() => setHistoryOpen(true)}
            className="text-xs px-2 py-1 rounded border border-gray-300"
            disabled={historyOpen}
          >
            History
          </button>
        )}

        {canExport && (
          <>
            <button
              type="button"
              data-testid="export-txt"
              className="text-xs px-2 py-1 rounded border border-gray-300"
              onClick={() => {
                const { sessionId, org } = getDefaults()
                const finishedAt = Date.now()
                const meta = {
                  status: status as any,
                  startedAt: startedAtRef.current ?? finishedAt,
                  finishedAt,
                  durationMs: startedAtRef.current ? Math.max(0, finishedAt - startedAtRef.current) : undefined,
                  estCost: costRef.current,
                  seed: paramsFlag && seed ? seed : undefined,
                  budget: paramsFlag && budget !== '' && !Number.isNaN(Number(budget)) ? Number(budget) : undefined,
                  model: paramsFlag && model ? model : undefined,
                  route: 'critique' as const,
                  sessionId,
                  org,
                }
                const txt = buildPlainText(meta, textRef.current)
                triggerDownload(`run-${meta.finishedAt}-${meta.status}.txt`, 'text/plain', txt)
              }}
            >
              Export .txt
            </button>
            <button
              type="button"
              data-testid="export-json"
              className="text-xs px-2 py-1 rounded border border-gray-300"
              onClick={() => {
                const { sessionId, org } = getDefaults()
                const finishedAt = Date.now()
                const meta = {
                  status: status as any,
                  startedAt: startedAtRef.current ?? finishedAt,
                  finishedAt,
                  durationMs: startedAtRef.current ? Math.max(0, finishedAt - startedAtRef.current) : undefined,
                  estCost: costRef.current,
                  seed: paramsFlag && seed ? seed : undefined,
                  budget: paramsFlag && budget !== '' && !Number.isNaN(Number(budget)) ? Number(budget) : undefined,
                  model: paramsFlag && model ? model : undefined,
                  route: 'critique' as const,
                  sessionId,
                  org,
                }
                const json = buildJson(meta, tokensRef.current, textRef.current)
                triggerDownload(`run-${meta.finishedAt}-${meta.status}.json`, 'application/json', json)
              }}
            >
              Export .json
            </button>
          </>
        )}

        {hintsFlag && status === 'limited' && (
          <p data-testid="limited-tip" className="text-xs text-gray-500 mt-1">
            Tip: Increase your budget or reduce the scope, then try again.
          </p>
        )}

        {chipsFlag && (status === 'done' || status === 'aborted' || status === 'error' || status === 'limited') && (
          <div className="flex items-center gap-1 ml-2">
            {reportData?.confidence?.identifiability != null && (
              <span
                data-testid="chip-identifiability"
                tabIndex={0}
                title="Identifiability: how uniquely key entities are recognized."
                className="text-xs px-2 py-1 rounded-full border border-gray-300 bg-gray-50"
                aria-label={`Identifiability: ${String(reportData.confidence.identifiability)}`}
              >
                Identifiability: {String(reportData.confidence.identifiability)}
              </span>
            )}
            {reportData?.confidence?.linearity != null && (
              <span
                data-testid="chip-linearity"
                tabIndex={0}
                title="Linearity: consistency as inputs change."
                className="text-xs px-2 py-1 rounded-full border border-gray-300 bg-gray-50"
                aria-label={`Linearity: ${String(reportData.confidence.linearity)}`}
              >
                Linearity: {String(reportData.confidence.linearity)}
              </span>
            )}
            {reportData?.confidence?.calibration != null && (
              <span
                data-testid="chip-calibration"
                tabIndex={0}
                title="Calibration: alignment of confidence with outcomes."
                className="text-xs px-2 py-1 rounded-full border border-gray-300 bg-gray-50"
                aria-label={`Calibration: ${String(reportData.confidence.calibration)}`}
              >
                Calibration: {String(reportData.confidence.calibration)}
              </span>
            )}
            {reportData?.confidence?.diversity != null && (
              <span
                data-testid="chip-diversity"
                tabIndex={0}
                title="Diversity: variety in explored approaches."
                className="text-xs px-2 py-1 rounded-full border border-gray-300 bg-gray-50"
                aria-label={`Diversity: ${String(reportData.confidence.diversity)}`}
              >
                Diversity: {String(reportData.confidence.diversity)}
              </span>
            )}
          </div>
        )}

        {typeof cost === 'number' && (
          <div
            data-testid="cost-badge"
            className="text-xs px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200"
            title="Estimated in-flight cost. Final cost appears on ‘Done’."
          >
            {formatGBP(cost)}
          </div>
        )}
      </div>

      {reconnecting && (
        <div data-testid="reconnect-hint" className="text-xs text-amber-600 mb-1">Reconnecting…</div>
      )}

      <div
        data-testid="stream-output"
        className="min-h-[6rem] whitespace-pre-wrap font-mono text-sm p-2 rounded border bg-gray-50"
        aria-live="polite"
        aria-busy={status === 'streaming' ? 'true' : 'false'}
      >
        {status === 'idle' && (
          <div
            data-testid="idle-hint"
            aria-hidden="true"
            className="text-gray-500 italic text-xs"
          >
            Press Start to begin a draft critique.
          </div>
        )}
        {output}
      </div>

      {mdFlag && (
        <div
          data-testid="md-preview"
          ref={mdPreviewRef}
          className="prose prose-sm max-w-none p-2 mt-2 border rounded bg-white relative"
          aria-hidden="true"
        >
          {mdHtml ? <div dangerouslySetInnerHTML={{ __html: mdHtml }} /> : null}
          {copyFlag && copyOverlays.map((o) => (
            <button
              key={o.id}
              type="button"
              data-testid="copy-code-btn"
              title="Copy code"
              aria-label={o.lang ? `Copy ${o.lang} code` : 'Copy code'}
              data-copied={copiedId === o.id ? 'true' : undefined}
              data-failed={failedId === o.id ? 'true' : undefined}
              className="absolute text-[11px] px-2 py-0.5 rounded border bg-white shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{ top: `${o.top}px`, left: `${o.left}px`, transform: 'translate(-100%, 0)' }}
              onClick={() => handleCopy(o.id, o.code)}
            >
              {copiedId === o.id ? 'Copied' : 'Copy'}
            </button>
          ))}
        </div>
      )}

      {/* ARIA live copy status outside preview (not aria-hidden) */}
      {copyFlag && (
        <div role="status" aria-live="polite" className="sr-only" data-testid="copy-aria-status">{ariaCopyMsg}</div>
      )}

      {reportFlag && (
        <RunReportDrawer
          open={reportOpen}
          sessionId={getDefaults().sessionId}
          org={getDefaults().org}
          seed={reportParams?.seed}
          budget={reportParams?.budget}
          model={reportParams?.model}
          onClose={() => {
            setReportOpen(false)
            // Return focus to trigger
            setTimeout(() => reportBtnRef.current?.focus(), 0)
          }}
        />
      )}

      {historyFlag && (
        <RunHistoryDrawer
          open={historyOpen}
          triggerRef={historyBtnRef}
          onClose={() => {
            setHistoryOpen(false)
            setTimeout(() => historyBtnRef.current?.focus(), 0)
          }}
          onRerun={(m: RunMeta) => {
            setHistoryOpen(false)
            const s = m.seed != null ? String(m.seed) : ''
            const b = m.budget != null ? String(m.budget) : ''
            const mo = m.model ?? ''
            setSeed(s); setBudget(b); setModel(mo)
            persistParams(s, b, mo)
            begin({ seed: m.seed, budget: m.budget, model: m.model })
          }}
          onOpenReport={(m: RunMeta) => {
            setHistoryOpen(false)
            setReportParams({ seed: m.seed, budget: m.budget, model: m.model })
            setReportOpen(true)
            setTimeout(() => reportBtnRef.current?.focus(), 0)
          }}
        />
      )}
    </div>
  )
}

