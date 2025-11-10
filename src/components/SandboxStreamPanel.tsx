import { useEffect, useRef, useState, useMemo } from 'react'
import { isSseEnabled, isRunReportEnabled, isConfidenceChipsEnabled, isHintsEnabled, isParamsEnabled, isHistoryEnabled, isExportEnabled, isScenariosEnabled } from '../flags'
import * as Flags from '../flags'
import { isJobsProgressEnabled } from '../flags'
import { isMarkdownPreviewEnabled, isShortcutsEnabled, isCopyCodeEnabled } from '../flags'
import { isE2EEnabled } from '../flags'
import { isConfigDrawerEnabled } from '../flags'
import { isCanvasEnabled } from '../flags'
import { useStreamConnection, type StreamConfig } from '../streams/useStreamConnection'
import { simplifyEdges, srSummary, computeSimplifyThreshold } from '../lib/graph.simplify'
import { getSampleGraph } from '../lib/graph.sample'
import { bandEdgesByWeight } from '../lib/summary'
import { getDefaultEngineMode, toggleEngineMode, type EngineMode } from '../lib/engine.adapter'
import { fetchHealth } from '../lib/health'
import { mapErrorTypeToAdvice } from '../lib/errors'
import { isNarrowViewport, getMobileCaps } from '../lib/mobile'
import RunReportDrawer from './RunReportDrawer'
import ConfigDrawer from './ConfigDrawer'
import CanvasDrawer from './CanvasDrawer'
import type { CanvasAPI } from './CanvasDrawer'
import ScenarioDrawer from './ScenarioDrawer'
import HealthIndicator from './HealthIndicator'
import JobsProgressPanel from './JobsProgressPanel'
import { list as listSnapshots, save as saveSnapshot, type Snapshot } from '../lib/snapshots'
import { diff as diffItems } from '../lib/compare'
import { getDefaults } from '../lib/session'
import RunHistoryDrawer from './RunHistoryDrawer'
import type { RunMeta } from '../lib/history'
import { buildPlainText, buildJson, buildMarkdown, buildMarkdownFilename, triggerDownload, type TokenRec as ExportTokenRec } from '../lib/export'
import { formatDownloadName } from '../lib/filename'
import { formatUSD } from '../lib/currency'
import { tryDecodeScenarioParam, getRemember, getLastId, getScenarioById } from '../lib/scenarios'
import { encodeSnapshotToUrlParam, tryDecodeSnapshotParam } from '../lib/snapshotShare'
import { getSuggestions, createUndoStack, type SimpleState } from '../lib/guided'
import { byTarget as listCommentsByTarget, add as addComment, del as delComment, type Comment } from '../lib/comments'

export default function SandboxStreamPanel() {
  // Flag-gated: OFF by default. In E2E test-mode, always mount for determinism.
  if (!isSseEnabled() && !isE2EEnabled()) return null

  // Signal to E2E tests that the panel has mounted
  useEffect(() => {
    try { if (isE2EEnabled()) { (window as any).__PANEL_RENDERED = true } } catch {}
  }, [])

  // --- Step 2 flags and derived data (all OFF by default) ---
  const [simplifyFlag, setSimplifyFlag] = useState<boolean>(() => {
    try { const fn: any = (Flags as any).isCanvasSimplifyEnabled; return typeof fn === 'function' ? !!fn() : false } catch { return false }
  })
  const [listViewFlag, setListViewFlag] = useState<boolean>(() => {
    try { const fn: any = (Flags as any).isListViewEnabled; return typeof fn === 'function' ? !!fn() : false } catch { return false }
  })
  const [engineModeFlag, setEngineModeFlag] = useState<boolean>(() => {
    try { const fn: any = (Flags as any).isEngineModeEnabled; return typeof fn === 'function' ? !!fn() : false } catch { return false }
  })
  const [mobileGuardFlag, setMobileGuardFlag] = useState<boolean>(() => {
    try { const fn: any = (Flags as any).isMobileGuardrailsEnabled; return typeof fn === 'function' ? !!fn() : false } catch { return false }
  })
  const [summaryV2Flag, setSummaryV2Flag] = useState<boolean>(() => {
    try { const fn: any = (Flags as any).isSummaryV2Enabled; return typeof fn === 'function' ? !!fn() : false } catch { return false }
  })
  const [guidedFlag, setGuidedFlag] = useState<boolean>(() => {
    try { const fn: any = (Flags as any).isGuidedV1Enabled; return typeof fn === 'function' ? !!fn() : false } catch { return false }
  })
  const [commentsFlag, setCommentsFlag] = useState<boolean>(() => {
    try { const fn: any = (Flags as any).isCommentsEnabled; return typeof fn === 'function' ? !!fn() : false } catch { return false }
  })
  const [diagFlag, setDiagFlag] = useState<boolean>(() => {
    try { const fn: any = (Flags as any).isDiagnosticsEnabled; return typeof fn === 'function' ? !!fn() : false } catch { return false }
  })
  const [perfFlag, setPerfFlag] = useState<boolean>(() => {
    try { const fn: any = (Flags as any).isPerfProbesEnabled; return typeof fn === 'function' ? !!fn() : false } catch { return false }
  })
  const [scorecardFlag, setScorecardFlag] = useState<boolean>(() => {
    try { const fn: any = (Flags as any).isScorecardEnabled; return typeof fn === 'function' ? !!fn() : false } catch { return false }
  })
  const [errorBannersFlag, setErrorBannersFlag] = useState<boolean>(() => {
    try { const fn: any = (Flags as any).isErrorBannersEnabled; return typeof fn === 'function' ? !!fn() : false } catch { return false }
  })

  useEffect(() => {
    // Re-evaluate flags after mount and whenever localStorage changes (E2E sets flags post-navigation)
    const update = () => {
      try { const fn: any = (Flags as any).isCanvasSimplifyEnabled; setSimplifyFlag(typeof fn === 'function' ? !!fn() : false) } catch {}
      try { const fn: any = (Flags as any).isListViewEnabled; setListViewFlag(typeof fn === 'function' ? !!fn() : false) } catch {}
      try { const fn: any = (Flags as any).isEngineModeEnabled; setEngineModeFlag(typeof fn === 'function' ? !!fn() : false) } catch {}
      try { const fn: any = (Flags as any).isMobileGuardrailsEnabled; setMobileGuardFlag(typeof fn === 'function' ? !!fn() : false) } catch {}
      try { const fn: any = (Flags as any).isSnapshotsEnabled; setSnapshotsFlag(typeof fn === 'function' ? !!fn() : false) } catch {}
      try { const fn: any = (Flags as any).isCompareEnabled; setCompareFlag(typeof fn === 'function' ? !!fn() : false) } catch {}
      try { const fn: any = (Flags as any).isSummaryV2Enabled; setSummaryV2Flag(typeof fn === 'function' ? !!fn() : false) } catch {}
      try { const fn: any = (Flags as any).isGuidedV1Enabled; setGuidedFlag(typeof fn === 'function' ? !!fn() : false) } catch {}
      try { const fn: any = (Flags as any).isCommentsEnabled; setCommentsFlag(typeof fn === 'function' ? !!fn() : false) } catch {}
      try { const fn: any = (Flags as any).isDiagnosticsEnabled; setDiagFlag(typeof fn === 'function' ? !!fn() : false) } catch {}
      try { const fn: any = (Flags as any).isPerfProbesEnabled; setPerfFlag(typeof fn === 'function' ? !!fn() : false) } catch {}
      try { const fn: any = (Flags as any).isScorecardEnabled; setScorecardFlag(typeof fn === 'function' ? !!fn() : false) } catch {}
      try { const fn: any = (Flags as any).isErrorBannersEnabled; setErrorBannersFlag(typeof fn === 'function' ? !!fn() : false) } catch {}
    }
    update()
    // Grace period: catch LS writes made immediately after mount (same-tab writes don't fire 'storage')
    const t1 = setTimeout(update, 50)
    const t2 = setTimeout(update, 200)
    const t3 = setTimeout(update, 500)
    const iv = setInterval(update, 250)
    const tStop = setTimeout(() => clearInterval(iv), 2000)
    const onStorage = (e: StorageEvent) => {
      if (!e || typeof e.key !== 'string') { update(); return }
      if (e.key.startsWith('feature.')) update()
    }
    window.addEventListener('storage', onStorage)
    return () => { window.removeEventListener('storage', onStorage); clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(tStop); clearInterval(iv) }
  }, [])

  // If mobile guardrails flag flips ON after mount, default to list-first on narrow viewports
  useEffect(() => {
    if (mobileGuardFlag && isNarrowViewport()) {
      setListFirst(true)
    }
  }, [mobileGuardFlag])

  const graph = useMemo(() => getSampleGraph(), [])
  const [simplifyOn, setSimplifyOn] = useState<boolean>(false)
  // Compute dynamic simplify threshold per PRD rules
  const width = (() => { try { return (globalThis as any)?.innerWidth || 1024 } catch { return 1024 } })()
  const T = computeSimplifyThreshold({ nodeCount: graph.nodes.length, width, defaultT: 0.3 })
  const filteredEdges = useMemo(() => simplifyEdges(graph.edges, simplifyOn && simplifyFlag, T), [graph, simplifyOn, simplifyFlag, T])
  const nHidden = graph.edges.length - filteredEdges.length
  const bands = useMemo(() => bandEdgesByWeight(filteredEdges as any), [filteredEdges])

  useEffect(() => {
    if (!simplifyFlag) return
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'h' || e.key === 'H') && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        setSimplifyOn((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [simplifyFlag])

  const [engineMode, setEngineMode] = useState<EngineMode>(() => getDefaultEngineMode())
  const [healthTip, setHealthTip] = useState<string>('')
  const undoRef = useRef(createUndoStack<SimpleState>())
  const [commentTarget, setCommentTarget] = useState<string | null>(null)
  const [commentLabel, setCommentLabel] = useState<'Challenge' | 'Evidence'>('Challenge')
  const [commentText, setCommentText] = useState<string>('')
  const [ariaCommentMsg, setAriaCommentMsg] = useState<string>('')
  const [ariaGuidedMsg, setAriaGuidedMsg] = useState<string>('')

  const [listFirst, setListFirst] = useState<boolean>(() => mobileGuardFlag && isNarrowViewport())
  const caps = useMemo(() => mobileGuardFlag ? getMobileCaps(graph.nodes.length) : { warn: false, stop: false, message: null as string | null }, [mobileGuardFlag, graph.nodes.length])
  const listContainerRef = useRef<HTMLDivElement | null>(null)
  const onListKeyDown = (e: React.KeyboardEvent) => {
    const key = e.key
    if (key === 'ArrowDown' || key === 'ArrowUp') {
      e.preventDefault()
      const items = listContainerRef.current?.querySelectorAll<HTMLElement>('[data-testid^="list-node-"], [data-testid^="list-edge-"]')
      if (!items || items.length === 0) return
      const arr = Array.from(items)
      const idx = arr.indexOf(document.activeElement as HTMLElement)
      const next = key === 'ArrowDown' ? Math.min(arr.length - 1, (idx < 0 ? 0 : idx + 1)) : Math.max(0, (idx < 0 ? 0 : idx - 1))
      arr[next]?.focus()
    } else if (key === 'Enter') {
      const el = document.activeElement as HTMLElement | null
      el?.focus()
    } else if ((e.shiftKey && (key === '?' || key === '/'))) {
      // Simple keymap hint; non-blocking
      try { alert('Keys: Arrow to move, Enter to focus') } catch {}
    }
  }

  

  // Canvas-first shell (flag-gated)
  let canvasDefault = false
  try {
    const fn: any = (Flags as any).isCanvasDefaultEnabled
    canvasDefault = typeof fn === 'function' ? !!fn() : false
  } catch {}
  const [starter, setStarter] = useState<string | null>(() => {
    try { return window.localStorage.getItem('canvas.lastStarter') } catch { return null }
  })
  const [showPicker, setShowPicker] = useState<boolean>(() => !starter)
  const chooseStarter = (key: string) => {
    try { window.localStorage.setItem('canvas.lastStarter', key) } catch {}
    setStarter(key); setShowPicker(false)
  }

  if (canvasDefault) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3" data-testid="panel-split">
        <div className="min-h-[16rem] border rounded bg-white">
          <CanvasDrawer inline open onClose={() => {}} seed={(() => { try { return window.localStorage.getItem('sandbox.seed') || '' } catch { return '' } })()} model={(() => { try { return window.localStorage.getItem('sandbox.model') || '' } catch { return '' } })()} />
        </div>
      
      

      {(listViewFlag || (mobileGuardFlag && listFirst)) && (
        <div className="mt-3 border rounded p-2" ref={listContainerRef} onKeyDown={onListKeyDown}>
          <div className="text-xs font-medium mb-1">List View</div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-[11px] text-gray-500 mb-1">Nodes</div>
              <ul className="space-y-1">
                {graph.nodes.map((n) => (
                  <li key={n.id}><button type="button" className="text-xs w-full text-left px-2 py-2 border rounded min-h-[44px]" data-testid={`list-node-${n.id}`} tabIndex={0}>{n.title}</button></li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-[11px] text-gray-500 mb-1">Edges ({filteredEdges.length}/{graph.edges.length})</div>
              <ul className="space-y-1">
                {filteredEdges.map((e) => (
                  <li key={e.id}><button type="button" className="text-xs w-full text-left px-2 py-2 border rounded min-h-[44px]" data-testid={`list-edge-${e.id}`} tabIndex={0}>{e.from} → {e.to} ({e.weight.toFixed(2)})</button></li>
                ))}
              </ul>
            </div>
          </div>
          {mobileGuardFlag && caps.message && (
            <div className="mt-2 text-xs text-amber-700" data-testid="mobile-cap-msg">{caps.message}</div>
          )}

      {simplifyFlag && simplifyOn && (
        <div data-testid="simplify-indicator" aria-live="polite" className="sr-only">{srSummary(nHidden, T)}</div>
      )}
        </div>
      )}
        <div className="p-3 rounded-md border border-gray-200 bg-white text-sm" data-testid="panel-root">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold">Results Summary</h2>
          </div>
          {simplifyFlag && (
            <div className="mb-2 text-[11px] text-gray-600" data-testid="simplify-badge">Active threshold: {T.toFixed(1)}</div>
          )}
          {summaryV2Flag && (
            <div className="flex items-center gap-2 mb-2">
              <span data-testid="summary-chip-seed" className="text-[11px] px-2 py-1 rounded-full border">Seed: {(() => { try { return window.localStorage.getItem('sandbox.seed') || '—' } catch { return '—' } })()}</span>
              <span data-testid="summary-chip-model" className="text-[11px] px-2 py-1 rounded-full border">Model: {(() => { try { return window.localStorage.getItem('sandbox.model') || '—' } catch { return '—' } })()}</span>
              <span data-testid="summary-total-cost" className="ml-auto text-[11px] px-2 py-1 rounded-full border">Total: {formatUSD()}</span>
            </div>
          )}
          {summaryV2Flag && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div data-testid="summary-card-conservative" className="p-2 border rounded text-xs">Conservative: {bands.conservative}</div>
              <div data-testid="summary-card-likely" className="p-2 border rounded text-xs">Likely: {bands.likely}</div>
              <div data-testid="summary-card-optimistic" className="p-2 border rounded text-xs">Optimistic: {bands.optimistic}</div>
            </div>
          )}
          {showPicker && (
            <div data-testid="template-picker" className="border rounded p-3 bg-gray-50">
              <div className="font-medium text-sm mb-2">Start with a template</div>
              <div className="grid grid-cols-2 gap-2">
                <button data-testid="template-card-pricing-change" className="text-xs px-2 py-2 rounded border" onClick={() => chooseStarter('pricing-change')}>Pricing change</button>
                <button data-testid="template-card-feature-launch" className="text-xs px-2 py-2 rounded border" onClick={() => chooseStarter('feature-launch')}>Feature launch</button>
                <button data-testid="template-card-build-vs-buy" className="text-xs px-2 py-2 rounded border" onClick={() => chooseStarter('build-vs-buy')}>Build vs Buy</button>
                <button data-testid="template-card-scratch" className="text-xs px-2 py-2 rounded border" onClick={() => chooseStarter('scratch')}>Start from scratch</button>
              </div>
            </div>
          )}
      {simplifyFlag && simplifyOn && (
        <div data-testid="simplify-indicator" aria-live="polite" className="sr-only">{srSummary(nHidden, T)}</div>
      )}
          {!showPicker && (
            <div className="text-xs text-gray-600" data-testid="starter-chip">Starter: {starter}</div>
          )}
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div data-testid="summary-card-conservative" className="p-2 border rounded text-xs">Conservative: {summaryV2Flag ? bands.conservative : '—'}</div>
            <div data-testid="summary-card-likely" className="p-2 border rounded text-xs">Likely: {summaryV2Flag ? bands.likely : '—'}</div>
            <div data-testid="summary-card-optimistic" className="p-2 border rounded text-xs">Optimistic: {summaryV2Flag ? bands.optimistic : '—'}</div>
          </div>
          <div className="mt-3 text-xs text-gray-500" aria-hidden="true">This is a shell preview. Streaming controls will be added next.</div>
        </div>
      </div>
    )
  }

  const [reportOpen, setReportOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [reportParams, setReportParams] = useState<{ seed?: string | number; budget?: number; model?: string } | null>(null)
  const reportBtnRef = useRef<HTMLButtonElement | null>(null)
  const historyBtnRef = useRef<HTMLButtonElement | null>(null)
  const replayFlag: boolean = (() => {
    try {
      const env = (import.meta as any)?.env?.VITE_FEATURE_REPLAY
      if (env === '1' || env === 1 || env === true) return true
    } catch {}
    try {
      const raw = (globalThis as any)?.localStorage?.getItem?.('feature.replay')
      if (raw && raw !== '0' && raw !== 'false') return true
    } catch {}
    return false
  })()
  const lastArgsRef = useRef<{ seed?: string | number; budget?: number; model?: string } | null>(null)
  const [replayedFrom, setReplayedFrom] = useState<string | null>(null)
  const reportFlag = isRunReportEnabled()
  const chipsFlag = isConfidenceChipsEnabled()
  const hintsFlag = isHintsEnabled()
  const paramsFlag = isParamsEnabled()
  const historyFlag = isHistoryEnabled()
  const exportFlag = isExportEnabled()
  const mdFlag = isMarkdownPreviewEnabled()
  const shortcutsFlag = isShortcutsEnabled()
  const copyFlag = isCopyCodeEnabled()
  const scenariosFlag = isScenariosEnabled()

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

  const [mdHtml, setMdHtml] = useState<string>('')
  const statusRef = useRef<HTMLDivElement | null>(null)

  // Initialize stream connection hook
  const streamConfig: StreamConfig = {
    historyEnabled: historyFlag,
    chipsEnabled: chipsFlag,
    paramsEnabled: paramsFlag,
    mdEnabled: mdFlag,
    bufferEnabled,
    route: 'critique',
    onMdUpdate: setMdHtml,
    statusRef,
  }
  const { state: streamState, actions: streamActions } = useStreamConnection(streamConfig)

  // Aliases for stream state (for backward compatibility with existing code)
  const status = streamState.status
  const output = streamState.output
  const cost = streamState.metrics.cost
  const reconnecting = streamState.reconnecting
  const resumedOnce = streamState.resumedOnce
  const started = streamState.started
  const reportData = streamState.reportData
  const diagLastId = streamState.metrics.lastSseId
  const diagTokenCount = streamState.metrics.tokenCount
  const diagTtfbMs = streamState.metrics.ttfbMs
  const diagResumeCount = streamState.metrics.resumeCount

  // Sync textRef with hook's output for export/snapshot functionality
  useEffect(() => {
    textRef.current = output
  }, [output])

  // Sync tokensRef for export functionality (reconstruct from output changes)
  useEffect(() => {
    if (status === 'idle') {
      tokensRef.current = []
    } else if (output.length > 0) {
      // Reconstruct tokens array from output
      // Note: Individual token boundaries are lost, but text content is preserved
      tokensRef.current = [{ id: '1', text: output }]
    }
  }, [output, status])

  const [sheetOpen, setSheetOpen] = useState<boolean>(false)
  const mdPreviewRef = useRef<HTMLDivElement | null>(null)
  const [copyOverlays, setCopyOverlays] = useState<Array<{ id: number; top: number; left: number; code: string; lang?: string }>>([])
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [failedId, setFailedId] = useState<number | null>(null)
  const [ariaCopyMsg, setAriaCopyMsg] = useState<string>('')
  const configFlag = isConfigDrawerEnabled()
  const [cfgOpen, setCfgOpen] = useState(false)
  const configBtnRef = useRef<HTMLButtonElement | null>(null)
  const canvasFlag = isCanvasEnabled()
  const [canvasOpen, setCanvasOpen] = useState(false)
  const canvasBtnRef = useRef<HTMLButtonElement | null>(null)
  const canvasAPIRef = useRef<CanvasAPI | null>(null)
  const [scenariosOpen, setScenariosOpen] = useState(false)
  const scenariosBtnRef = useRef<HTMLButtonElement | null>(null)
  const [scenarioChipText, setScenarioChipText] = useState<string | null>(null)
  const [scenarioImportNote, setScenarioImportNote] = useState<boolean>(false)
  const [scenarioPreview, setScenarioPreview] = useState<{ v: 1; name: string; seed: string; budget: string; model: string } | null>(null)

  // Keep refs needed for export functionality (not managed by hook)
  const tokensRef = useRef<ExportTokenRec[]>([])
  const textRef = useRef<string>('')
  const startedAtRef = useRef<number | null>(null)
  const costRef = useRef<number | undefined>(undefined)

  // Track stream start time for duration calculation
  useEffect(() => {
    if (started && startedAtRef.current === null) {
      startedAtRef.current = Date.now()
    } else if (!started) {
      startedAtRef.current = null
    }
  }, [started])

  // Track final cost for export
  useEffect(() => {
    costRef.current = cost
  }, [cost])

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

  // Guided suggestions (flag-gated)
  const guidedSuggestions = useMemo(() => (
    guidedFlag ? getSuggestions({ seed, budget, model, simplify: simplifyOn }) : []
  ), [guidedFlag, seed, budget, model, simplifyOn])

  // Scenario import via URL (?scenario=...), flag-gated
  useEffect(() => {
    if (!scenariosFlag) return
    try {
      const href = String((globalThis as any)?.location?.href || '')
      const idx = href.indexOf('scenario=')
      if (idx >= 0) {
        const sub = href.slice(idx + 'scenario='.length)
        const end = sub.search(/[&#]/)
        const param = end >= 0 ? sub.slice(0, end) : sub
        const decoded = tryDecodeScenarioParam(param)
        let previewFlag = false
        try {
          const fn: any = (Flags as any).isScenarioImportPreviewEnabled
          previewFlag = typeof fn === 'function' ? !!fn() : false
        } catch {}
        if (decoded) {
          if (previewFlag) {
            setScenarioPreview({ v: 1, name: decoded.name, seed: String(decoded.seed || ''), budget: String(decoded.budget || ''), model: String(decoded.model || '') })
          } else {
            const s = String(decoded.seed || '')
            const b = String(decoded.budget || '')
            const m = String(decoded.model || '')
            setSeed(s); setBudget(b); setModel(m)
            persistParams(s, b, m)
            setScenarioChipText(`Loaded: ${decoded.name}`)
            setTimeout(() => {
              try {
                const chip = document.querySelector('[data-testid="scenario-chip"]') as HTMLElement | null
                if (chip) chip.title = 'Imported from link'
              } catch {}
            }, 0)
          }
        } else {
          setScenarioImportNote(true)
        }
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Remember-last: on mount, if enabled and we have a lastId, hydrate params
  useEffect(() => {
    if (!scenariosFlag || !paramsFlag) return
    try {
      if (getRemember()) {
        const id = getLastId()
        if (id) {
          const rec = getScenarioById(id)
          if (rec) {
            setSeed(rec.seed); setBudget(rec.budget); setModel(rec.model)
            persistParams(rec.seed, rec.budget, rec.model)
            setScenarioChipText(`Loaded: ${rec.name}`)
          }
        }
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Snapshots + Compare + Read-only share (flag-gated)
  const [snapshotsFlag, setSnapshotsFlag] = useState<boolean>(() => {
    try { const fn: any = (Flags as any).isSnapshotsEnabled; return typeof fn === 'function' ? !!fn() : false } catch { return false }
  })
  const [compareFlag, setCompareFlag] = useState<boolean>(() => {
    try { const fn: any = (Flags as any).isCompareEnabled; return typeof fn === 'function' ? !!fn() : false } catch { return false }
  })

  const [snapshots, setSnapshots] = useState<Snapshot[]>(() => (snapshotsFlag ? listSnapshots() : []))
  const [ariaSnapshotMsg, setAriaSnapshotMsg] = useState<string>('')
  const [readOnlySnap, setReadOnlySnap] = useState<{ seed: string; model: string; data: any } | null>(null)
  const [selA, setSelA] = useState<string>('')
  const [selB, setSelB] = useState<string>('')
  const [ariaCompareMsg, setAriaCompareMsg] = useState<string>('')
  const [shareNote, setShareNote] = useState<string>('')

  // Parse read-only snapshot from URL (?snap=...)
  useEffect(() => {
    try {
      const href = String((globalThis as any)?.location?.href || '')
      const idx = href.indexOf('snap=')
      if (idx >= 0) {
        const sub = href.slice(idx + 'snap='.length)
        const end = sub.search(/[&#]/)
        const param = end >= 0 ? sub.slice(0, end) : sub
        const decoded = tryDecodeSnapshotParam(param)
        if (decoded) setReadOnlySnap({ seed: decoded.seed, model: decoded.model, data: decoded.data })
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Refresh stored snapshots on mount if feature enabled
  useEffect(() => {
    if (!snapshotsFlag) return
    try { setSnapshots(listSnapshots()) } catch {}
  }, [snapshotsFlag])

  const changeLog = useMemo(() => {
    if (!snapshotsFlag || snapshots.length < 2) return null as null | { added: string[]; removed: string[]; changed: string[] }
    const latest = snapshots[0]
    const previous = snapshots[1]
    const a = (previous.data?.edges || []) as Array<{ id: string }>
    const b = (latest.data?.edges || []) as Array<{ id: string }>
    return diffItems(a, b)
  }, [snapshotsFlag, snapshots])

  const compareDiff = useMemo(() => {
    if (!compareFlag) return null as null | { added: string[]; removed: string[]; changed: string[] }
    const A = snapshots.find((s) => s.id === selA)
    const B = snapshots.find((s) => s.id === selB)
    if (!A || !B) return null
    const ea = (A.data?.edges || []) as Array<{ id: string }>
    const eb = (B.data?.edges || []) as Array<{ id: string }>
    return diffItems(ea, eb)
  }, [compareFlag, snapshots, selA, selB])

  useEffect(() => {
    if (compareDiff) {
      setAriaCompareMsg(`Comparison updated: ${compareDiff.added.length} added, ${compareDiff.removed.length} removed, ${compareDiff.changed.length} changed.`)
    }
  }, [compareDiff])

  const makeSnapshot = () => {
    if (!snapshotsFlag) return
    const id = String(Date.now())
    const s: Snapshot = { id, at: new Date().toISOString(), seed, model, data: { nodes: graph.nodes, edges: filteredEdges.map((e) => ({ ...e })) } as any }
    try { saveSnapshot(s) } catch {}
    try { setSnapshots(listSnapshots()) } catch {}
    setAriaSnapshotMsg(`Snapshot captured at ${new Date().toLocaleTimeString('en-GB')}`)
    setTimeout(() => setAriaSnapshotMsg(''), 1200)
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

  const begin = (over?: { seed?: string | number; budget?: number; model?: string }) => {
    if (started) return

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

    // Compute final args for stream
    const seedArg = over ? (seedUse ? seedUse : undefined) : (paramsFlag && seedUse ? seedUse : undefined)
    const budgetArg = over ? (budgetUseStr !== '' && !Number.isNaN(Number(budgetUseStr)) ? Number(budgetUseStr) : undefined) : (paramsFlag && budgetUseStr !== '' && !Number.isNaN(Number(budgetUseStr)) ? Number(budgetUseStr) : undefined)
    const modelArg = over ? (modelUse ? modelUse : undefined) : (paramsFlag && modelUse ? modelUse : undefined)

    // Capture last used args for potential replay and show chip only on replay path
    lastArgsRef.current = { seed: seedArg, budget: budgetArg, model: modelArg }
    setReplayedFrom(over && seedArg ? String(seedArg) : null)
    if (over && seedArg) {
      try { (globalThis as any).__REPLAY_TS = Date.now() } catch {}
    }

    // Start stream via hook
    streamActions.start({ seed: seedArg, budget: budgetArg, model: modelArg })
  }

  const stop = () => {
    if (!started) return
    // Stop stream via hook
    streamActions.stop()
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
    <div className="p-3 rounded-md border border-gray-200 bg-white text-sm" data-testid="panel-root">
      <div className="flex items-center gap-2 mb-2">
        {(configFlag || canvasFlag || scenariosFlag) && (
          <>
            {configFlag && <HealthIndicator pause={cfgOpen} />}
            {configFlag && (
            <button
              type="button"
              data-testid="config-btn"
              title="Open settings"
              className="px-2 py-1 rounded border border-gray-300"
              onClick={() => setCfgOpen(true)}
              ref={configBtnRef}
            >
              ⚙︎
            </button>
            )}
            {canvasFlag && (
            <button
              type="button"
              data-testid="canvas-btn"
              title="Open canvas"
              className="px-2 py-1 rounded border border-gray-300"
              onClick={() => setCanvasOpen(true)}
              ref={canvasBtnRef}
            >
              🧩
            </button>
            )}
            {scenariosFlag && (
            <button
              type="button"
              data-testid="scenarios-btn"
              title="Open scenarios"
              className="px-2 py-1 rounded border border-gray-300"
              onClick={() => setScenariosOpen(true)}
              ref={scenariosBtnRef}
            >
              Scenarios
            </button>
            )}
          </>
        )}
      </div>

      {summaryV2Flag && (
        <div className="flex items-center gap-2 mb-2">
          <span data-testid="summary-chip-seed" className="text-[11px] px-2 py-1 rounded-full border">Seed: {(() => { try { return window.localStorage.getItem('sandbox.seed') || '—' } catch { return '—' } })()}</span>
          <span data-testid="summary-chip-model" className="text-[11px] px-2 py-1 rounded-full border">Model: {(() => { try { return window.localStorage.getItem('sandbox.model') || '—' } catch { return '—' } })()}</span>
          <span data-testid="summary-total-cost" className="ml-auto text-[11px] px-2 py-1 rounded-full border">Total: {formatUSD()}</span>
        </div>
      )}
      {summaryV2Flag && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div data-testid="summary-card-conservative" className="p-2 border rounded text-xs">Conservative: {bands.conservative}</div>
          <div data-testid="summary-card-likely" className="p-2 border rounded text-xs">Likely: {bands.likely}</div>
          <div data-testid="summary-card-optimistic" className="p-2 border rounded text-xs">Optimistic: {bands.optimistic}</div>
        </div>
      )}

      {scenariosFlag && scenarioPreview && (
        <div data-testid="scenario-import-preview" className="ml-2 text-xs border border-amber-300 bg-amber-50 text-amber-800 rounded px-2 py-1 flex items-center gap-2">
          <span aria-hidden="true">Import template '{scenarioPreview.name}' (seed {scenarioPreview.seed || '—'}, budget {scenarioPreview.budget || '—'}, model {scenarioPreview.model || '—'})?</span>
          <div className="flex items-center gap-1">
              <button
                type="button"
                data-testid="scenario-import-confirm"
                className="px-2 py-0.5 rounded border border-amber-400 bg-white"
                onClick={() => {
                  const s = String(scenarioPreview.seed || '')
                  const b = String(scenarioPreview.budget || '')
                  const m = String(scenarioPreview.model || '')
                  setSeed(s); setBudget(b); setModel(m)
                  persistParams(s, b, m)
                  setScenarioPreview(null)
                  const ts = new Date().toLocaleString()
                  setScenarioChipText(`Imported as Draft • ${ts}`)
                }}
              >
                Import
              </button>
              <button
                type="button"
                data-testid="scenario-import-dismiss"
                className="px-2 py-0.5 rounded border border-amber-400 bg-white"
                onClick={() => setScenarioPreview(null)}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
        {replayFlag && status === 'done' && (
          <button
            type="button"
            data-testid="replay-btn"
            className="text-xs px-2 py-1 rounded border border-gray-300"
            onClick={() => {
              const args = lastArgsRef.current || {}
              begin({ seed: args.seed, budget: args.budget, model: args.model })
            }}
            title="Replay run"
          >
            Replay run
          </button>
        )}
        {engineModeFlag && (
          <>
            <button
              type="button"
              data-testid="engine-mode-chip"
              className="text-xs px-2 py-1 rounded border border-gray-300"
              onClick={() => setEngineMode((m) => toggleEngineMode(m))}
              onMouseEnter={async () => {
                try {
                  if (engineMode === 'live') {
                    const h = await fetchHealth('/health')
                    const v = h.version ? `, v${h.version}` : ''
                    const r = h as any
                    const replay = r?.replay?.lastStatus ? `, replay: ${r.replay.lastStatus}` : ''
                    setHealthTip(`status: ${h.status}, p95: ${h.p95_ms}ms${v}${replay}`)
                  } else {
                    setHealthTip('fixtures mode: offline')
                  }
                } catch {
                  setHealthTip('fixtures mode: offline')
                }
              }}
            >
              {engineMode === 'fixtures' ? 'Fixtures' : 'Live'}
            </button>
            <span data-testid="engine-health-tooltip" className="text-[11px] text-gray-500" aria-hidden="true">{healthTip}</span>
          </>
        )}

        {!readOnlySnap && (
        <button
          type="button"
          data-testid="start-btn"
          onClick={() => begin()}
          className="px-2 py-1 rounded bg-blue-600 text-white disabled:opacity-50"
          disabled={started || (mobileGuardFlag && caps.stop) || !!readOnlySnap}
          title="Start (⌘⏎)"
        >
          Start
        </button>
        )}
        <button
          type="button"
          data-testid="stop-btn"
          onClick={stop}
          className="px-2 py-1 rounded bg-gray-200 text-gray-900 disabled:opacity-50"
          disabled={!started || !!readOnlySnap}
        >
          Stop
        </button>

        {simplifyFlag && (
          <label className="flex items-center gap-1 text-xs ml-2 min-h-[44px]">
            <input type="checkbox" data-testid="simplify-toggle" checked={simplifyOn} onChange={(e) => setSimplifyOn(e.target.checked)} />
            <span>Hide weaker links (&lt;{T.toFixed(1)})</span>
          </label>
        )}
        {mobileGuardFlag && isNarrowViewport() && (
          <button type="button" className="text-xs px-2 py-1 rounded border border-gray-300 ml-2" onClick={() => setListFirst((v) => !v)}>
            {listFirst ? 'Show Canvas' : 'Show List'}
          </button>
        )}

        {paramsFlag && !readOnlySnap && (
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

        {guidedFlag && (
          <>
            <div className="mt-2 flex items-center gap-2 ml-2">
              {guidedSuggestions.map((s, idx) => (
                <button
                  key={s.id}
                  type="button"
                  data-testid={`guided-suggestion-${idx}`}
                  className="text-[11px] px-2 py-0.5 rounded border border-gray-300"
                  title={s.rationale}
                  onClick={() => {
                    try {
                      undoRef.current.push({ seed, budget, model, simplify: simplifyOn })
                      const next = s.apply({ seed, budget, model, simplify: simplifyOn })
                      if (next.model !== model) { setModel(next.model); persistParams(seed, budget, next.model) }
                      if (next.simplify !== simplifyOn) setSimplifyOn(next.simplify)
                      setAriaGuidedMsg('Suggestion applied. You can press Undo.')
                      setTimeout(() => setAriaGuidedMsg(''), 1200)
                    } catch {}
                  }}
                >
                  {s.title}
                </button>
              ))}
              {/* expose rationale in an SR-only tooltip for tests */}
              {guidedSuggestions.length > 0 && (
                <span data-testid="why-tooltip" aria-hidden="true" className="sr-only">{guidedSuggestions[0].rationale}</span>
              )}
              <button
                type="button"
                data-testid="guided-undo-btn"
                className="text-[11px] px-2 py-0.5 rounded border border-gray-300 disabled:opacity-50"
                disabled={undoRef.current.size === 0}
                onClick={() => {
                  const prev = undoRef.current.pop()
                  if (prev) {
                    try {
                      setSeed(prev.seed); setBudget(prev.budget); setModel(prev.model)
                      persistParams(prev.seed, prev.budget, prev.model)
                      setSimplifyOn(prev.simplify)
                      setAriaGuidedMsg('Undone.')
                      setTimeout(() => setAriaGuidedMsg(''), 1200)
                    } catch {}
                  }
                }}
              >
                Undo
              </button>
            </div>
            <div role="status" aria-live="polite" className="sr-only">{ariaGuidedMsg}</div>
          </>
        )}

        {(listViewFlag || (mobileGuardFlag && listFirst)) && (
          <div className="mt-3 border rounded p-2" ref={listContainerRef} onKeyDown={onListKeyDown}>
            <div className="text-xs font-medium mb-1">List View</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-[11px] text-gray-500 mb-1">Nodes</div>
                <ul className="space-y-1">
                  {graph.nodes.map((n) => (
                    <li key={n.id} className="flex items-center gap-2">
                      <button type="button" className="text-xs flex-1 text-left px-2 py-2 border rounded min-h-[44px]" data-testid={`list-node-${n.id}`} tabIndex={0}>{n.title}</button>
                      {commentsFlag && (
                        <button
                          type="button"
                          data-testid={`comment-btn-${n.id}`}
                          className="text-[11px] px-2 py-1 rounded border"
                          title="Add a comment"
                          onClick={() => setCommentTarget(n.id)}
                        >
                          💬
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="text-[11px] text-gray-500 mb-1">Edges ({filteredEdges.length}/{graph.edges.length})</div>
                <ul className="space-y-1">
                  {filteredEdges.map((e) => (
                    <li key={e.id} className="flex items-center gap-2">
                      <button type="button" className="text-xs flex-1 text-left px-2 py-2 border rounded min-h-[44px]" data-testid={`list-edge-${e.id}`} tabIndex={0}>{e.from} → {e.to} ({e.weight.toFixed(2)})</button>
                      {commentsFlag && (
                        <button
                          type="button"
                          data-testid={`comment-btn-${e.id}`}
                          className="text-[11px] px-2 py-1 rounded border"
                          title="Add a comment"
                          onClick={() => setCommentTarget(e.id)}
                        >
                          💬
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
          </div>
            {mobileGuardFlag && caps.message && (
              <div className="mt-2 text-xs text-amber-700" data-testid="mobile-cap-msg">{caps.message}</div>
            )}
            {commentsFlag && commentTarget && (
              <div data-testid="comments-panel" className="mt-3 p-2 border rounded bg-white">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] text-gray-500">Comments for {commentTarget}</div>
                  <button type="button" className="text-[11px] px-2 py-0.5 rounded border" onClick={() => setCommentTarget(null)}>Close</button>
                </div>
                <ul className="mt-2 space-y-1" data-testid={`comment-list-${commentTarget}`}>
                  {listCommentsByTarget(commentTarget).map((c) => (
                    <li key={c.id} className="text-xs flex items-center justify-between gap-2">
                      <span>
                        <span className="font-medium comment-label-badge">{c.label}:</span> {c.text}
                        <span className="text-[10px] text-gray-500 ml-1">{new Date(c.at).toLocaleString('en-GB')}</span>
                      </span>
                      <button
                        type="button"
                        className="text-[11px] px-2 py-0.5 rounded border"
                        onClick={() => {
                          try { delComment(c.id) } catch {}
                          setAriaCommentMsg('Comment deleted')
                          setTimeout(() => setAriaCommentMsg(''), 1200)
                        }}
                      >
                        Delete
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex items-center gap-2">
                  <label className="text-[11px] text-gray-700">
                    <span className="mr-1">Label</span>
                    <select className="px-1 py-0.5 border rounded" value={commentLabel} onChange={(e) => setCommentLabel(e.target.value as any)}>
                      <option value="Challenge">Challenge</option>
                      <option value="Evidence">Evidence</option>
                    </select>
                  </label>
                  <input
                    type="text"
                    className="flex-1 text-xs px-2 py-1 border rounded"
                    placeholder="Add a comment…"
                    data-testid="comment-input"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                  />
                  <button
                    type="button"
                    data-testid="comment-add-btn"
                    className="text-[11px] px-2 py-1 rounded border"
                    onClick={() => {
                      const txt = commentText.trim()
                      if (!txt) return
                      const c: Comment = { id: String(Date.now()), targetId: commentTarget, label: commentLabel, text: txt, at: new Date().toISOString() }
                      try { addComment(c) } catch {}
                      setCommentText('')
                      setAriaCommentMsg('Comment added')
                      setTimeout(() => setAriaCommentMsg(''), 1200)
                    }}
                  >
                    Add
                  </button>
                </div>
                <div role="status" aria-live="polite" className="sr-only">{ariaCommentMsg}</div>
              </div>
            )}
          </div>
        )}

        {simplifyFlag && simplifyOn && (
          <div data-testid="simplify-indicator" aria-live="polite" className="sr-only">{srSummary(nHidden, T)}</div>
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

      {isJobsProgressEnabled() && (
        <div className="mt-3">
          <JobsProgressPanel />
        </div>
      )}

        {hintsFlag && resumedOnce && (
          <p data-testid="resume-note" className="text-xs text-gray-500 ml-2" aria-hidden="true" title="Resumed after a brief network blip">
            Resumed after a brief network blip.
          </p>
        )}

        {configFlag && (
          <ConfigDrawer
            open={cfgOpen}
            onClose={() => setCfgOpen(false)}
            restoreFocusRef={configBtnRef}
            onApply={(vals) => {
              try {
                setSeed(vals.seed)
                setBudget(vals.budget)
                setModel(vals.model)
              } catch {}
            }}
          />
        )}

        {canvasFlag && (
          <CanvasDrawer
            open={canvasOpen}
            onClose={() => setCanvasOpen(false)}
            onReady={(api) => { canvasAPIRef.current = api }}
            seed={seed}
            model={model}
          />
        )}

        {scenariosFlag && (
          <ScenarioDrawer
            open={scenariosOpen}
            onClose={() => setScenariosOpen(false)}
            restoreFocusRef={scenariosBtnRef}
            seed={seed}
            budget={budget}
            model={model}
            onLoad={(s) => {
              try {
                setSeed(s.seed); setBudget(s.budget); setModel(s.model)
                persistParams(s.seed, s.budget, s.model)
                setScenarioChipText(`Loaded: ${s.name}`)
              } catch {}
            }}
          />
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

        {readOnlySnap && (
          <span
            data-testid="snapshot-readonly-badge"
            className="ml-2 text-xs px-2 py-1 rounded-full border border-gray-300 bg-gray-50 text-gray-700"
            aria-hidden="true"
          >
            Read-only snapshot
          </span>
        )}

        {replayedFrom && (
          <span
            data-testid="replayed-chip"
            className="ml-2 text-xs px-2 py-1 rounded-full border border-amber-300 text-amber-800"
            aria-hidden="true"
            title={`Replayed from ${new Date((globalThis as any).__REPLAY_TS || Date.now()).toLocaleString()}`}
          >
            Replayed from {replayedFrom}
          </span>
        )}

        {scenariosFlag && scenarioChipText && (
          <span
            data-testid="scenario-chip"
            className="ml-2 text-xs px-2 py-1 rounded-full border border-emerald-300 text-emerald-800"
            aria-hidden="true"
          >
            {scenarioChipText}
          </span>
        )}

        {scenariosFlag && scenarioImportNote && (
          <span data-testid="scenario-import-note" className="ml-2 text-xs text-gray-500" aria-hidden="true">Invalid scenario link</span>
        )}

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

        {canvasFlag && status === 'done' && (
          <button
            type="button"
            data-testid="canvas-send-btn"
            title="Send to canvas"
            className="text-xs px-2 py-1 rounded border border-gray-300"
            onClick={() => {
              // Ensure drawer is open
              if (!canvasOpen) setCanvasOpen(true)
              // Compose a simple note with run title and a short summary of output
              const ts = new Date().toLocaleString()
              const summary = textRef.current.slice(0, 300)
              const note = `Run: ${ts}\n\n${summary}`
              // Defer slightly until Drawer mounts and onReady provides API
              setTimeout(() => {
                try { canvasAPIRef.current?.addNote(note) } catch {}
              }, 0)
            }}
          >
            Send to Canvas
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
              title="Export .txt"
              aria-label="Export .txt"
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
                const fname = formatDownloadName('transcript', { seed: meta.seed, model: meta.model, ext: 'txt' })
                triggerDownload(fname, 'text/plain', txt)
              }}
            >
              Export .txt
            </button>
            <button
              type="button"
              data-testid="export-json"
              className="text-xs px-2 py-1 rounded border border-gray-300"
              title="Export .json"
              aria-label="Export .json"
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
                const fname = formatDownloadName('transcript', { seed: meta.seed, model: meta.model, ext: 'json' })
                triggerDownload(fname, 'application/json', json)
              }}
            >
              Export .json
            </button>
            <button
              type="button"
              data-testid="export-md-btn"
              className="text-xs px-2 py-1 rounded border border-gray-300"
              title="Export Markdown"
              aria-label="Export Markdown"
              onClick={() => {
                const { sessionId, org } = getDefaults()
                const nowISO = new Date().toISOString()
                const md = buildMarkdown({
                  status: (status as any),
                  dateISO: nowISO,
                  sessionId,
                  org,
                  seed: paramsFlag && seed ? seed : undefined,
                  budget: paramsFlag && budget !== '' && !Number.isNaN(Number(budget)) ? Number(budget) : undefined,
                  model: paramsFlag && model ? model : undefined,
                  costUSD: typeof costRef.current === 'number' ? costRef.current : undefined,
                  text: textRef.current,
                  tokens: tokensRef.current.map((t) => t.text),
                })
                const fname = buildMarkdownFilename(new Date())
                triggerDownload(fname, 'text/markdown', md)
              }}
            >
              Export .md
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
            {formatUSD(cost)}
          </div>
        )}

        {diagFlag && (
          <div data-testid="diagnostics-panel" className="mt-2 text-[11px] text-gray-600">
            <div className="font-medium text-gray-700">Diagnostics</div>
            <div data-testid="diag-last-event-id">SSE id: {diagLastId ?? '—'}</div>
            <div data-testid="diag-reconnects">Resumes: {diagResumeCount}</div>
            <div data-testid="diag-stream-state">State: {status}</div>
            <div>TTFB: {diagTtfbMs != null ? `${diagTtfbMs}ms` : '—'}</div>
            <div data-testid="diag-token-count">Tokens: {diagTokenCount}</div>
          </div>
        )}

        {perfFlag && (
          <div data-testid="perf-panel" className="mt-2 text-[11px] text-gray-600">
            <div className="font-medium text-gray-700">Performance</div>
            <div>Buffer: {bufferEnabled ? 'ON' : 'OFF'}</div>
            <div>Preview length: {mdFlag ? mdHtml.length : 0}</div>
            <div>Code blocks: {copyOverlays.length}</div>
          </div>
        )}

        {scorecardFlag && (
          <div data-testid="scorecard-panel" className="mt-2 p-2 border rounded bg-white">
            <div className="text-[11px] text-gray-500 mb-1">Scorecard</div>
            <div className="text-xs text-gray-600">Coming soon</div>
          </div>
        )}

        {snapshotsFlag && (
          <div className="mt-3">
            <div className="flex items-center gap-2">
              {!readOnlySnap && (
                <button type="button" data-testid="snapshot-btn" className="text-xs px-2 py-1 rounded border border-gray-300" onClick={makeSnapshot}>
                  Snapshot
                </button>
              )}
              {/* SR status for snapshot action */}
              <div role="status" aria-live="polite" className="sr-only">{ariaSnapshotMsg}</div>
            </div>
            <div className="mt-2">
              <div className="text-[11px] text-gray-500 mb-1">Snapshots</div>
              <ul data-testid="snapshot-list" className="space-y-1">
                {snapshots.map((s, idx) => (
                  <li key={s.id} data-testid={`snapshot-list-item-${s.id}`} className="flex items-center justify-between gap-2">
                    <span className="text-xs">{new Date(s.at).toLocaleString('en-GB')}</span>
                    {idx === 0 && (
                      <button
                        type="button"
                        data-testid="sharelink-copy"
                        className="text-[11px] px-2 py-0.5 rounded border"
                        onClick={async () => {
                          try {
                            const payload = { v: 1 as const, seed: s.seed, model: s.model, data: s.data }
                            const param = encodeSnapshotToUrlParam(payload)
                            const hasE2E = typeof location !== 'undefined' && String(location.search || '').includes('e2e=1')
                            const base = (globalThis as any)?.location?.origin || ''
                            const url = `${base}/${hasE2E ? '?e2e=1' : ''}#/sandbox?snap=${param}`
                            await (globalThis as any)?.navigator?.clipboard?.writeText?.(url)
                            setShareNote('')
                          } catch (e: any) {
                            try { setShareNote(String(e && e.message ? e.message : e)) } catch {}
                          }
                        }}
                      >
                        Copy share link
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {shareNote && (
                <div data-testid="share-cap-note" role="status" aria-live="polite" className="mt-2 text-[11px] text-amber-700">{shareNote}</div>
              )}
            </div>
            {changeLog && (
              <div data-testid="change-log" className="mt-2 p-2 border rounded bg-white">
                <div className="text-[11px] text-gray-500 mb-1">Change log</div>
                <ul className="list-disc ml-5 text-xs">
                  <li>Added {changeLog.added.length}</li>
                  <li>Removed {changeLog.removed.length}</li>
                  <li>Changed {changeLog.changed.length}</li>
                </ul>
                <div role="status" aria-live="polite" className="sr-only">Change log available since last snapshot.</div>
              </div>
            )}
          </div>
        )}

        {compareFlag && (
          <div className="mt-3">
            <div className="text-[11px] text-gray-500 mb-1">Compare Snapshots</div>
            <div className="flex items-center gap-2">
              <select data-testid="compare-select-a" className="text-xs px-2 py-1 border rounded" value={selA} onChange={(e) => setSelA(e.target.value)}>
                <option value="">(A)</option>
                {snapshots.map((s) => (
                  <option key={s.id} value={s.id}>{new Date(s.at).toLocaleString('en-GB')}</option>
                ))}
              </select>
              <span className="text-xs">vs</span>
              <select data-testid="compare-select-b" className="text-xs px-2 py-1 border rounded" value={selB} onChange={(e) => setSelB(e.target.value)}>
                <option value="">(B)</option>
                {snapshots.map((s) => (
                  <option key={s.id} value={s.id}>{new Date(s.at).toLocaleString('en-GB')}</option>
                ))}
              </select>
            </div>
            {/* SR announce comparison updates */}
            <div role="status" aria-live="polite" className="sr-only">{ariaCompareMsg}</div>
            <ul data-testid="compare-diff-list" className="mt-2 text-xs space-y-1">
              {compareDiff && compareDiff.added.map((id) => (
                <li key={`a-${id}`}>↑ {id}</li>
              ))}
              {compareDiff && compareDiff.removed.map((id) => (
                <li key={`r-${id}`}>↓ {id}</li>
              ))}
              {compareDiff && compareDiff.changed.map((id) => (
                <li key={`c-${id}`}>• {id}</li>
              ))}
            </ul>
          </div>
        )}

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
        try { reportBtnRef.current?.focus() } catch {}
      }}
    />
  )}
      {errorBannersFlag && status === 'error' && (
        (() => {
          let code: string | undefined
          try { code = (globalThis as any)?.localStorage?.getItem?.('sandbox.errorType') || undefined } catch {}
          const adv = mapErrorTypeToAdvice(code)
          return (
            <div data-testid="error-banner" role="status" aria-live="polite" className="mt-2 p-2 rounded border bg-amber-50 text-amber-800 text-xs flex items-center gap-2">
              <span data-testid="error-type-badge" className="px-2 py-0.5 rounded-full border border-amber-300 bg-white text-amber-700 font-medium">{code || 'UNKNOWN'}</span>
              <span className="flex-1">{adv.message}</span>
              <button type="button" className="text-[11px] px-2 py-0.5 rounded border border-amber-300 bg-white">{adv.primaryAction}</button>
            </div>
          )
        })()
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

