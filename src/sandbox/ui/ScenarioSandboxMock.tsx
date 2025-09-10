import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as Y from 'yjs'
import { toast } from '@/components/ui/use-toast'
import { useBoardState, getOptionHandleId } from '@/sandbox/state/boardState'
import { useRealtimeDoc } from '@/realtime/provider'
import { listSnapshots, saveSnapshot, loadSnapshot, deleteSnapshot, fromB64, type SnapshotMeta } from '@/sandbox/state/snapshots'
import { evenSplit, normalize } from '@/sandbox/probabilities/math'
import { model_segment_changed } from '@/lib/analytics'
import { useTelemetry } from '@/lib/useTelemetry'
import { TelemetryInspector } from '@/sandbox/dev/TelemetryInspector'
import { useFlags } from '@/lib/flags'
import { buildProjection } from '@/sandbox/lib/projection'
import { notifyRecompute, subscribeRecompute } from '@/sandbox/state/recompute'
import { getCollisions as getReapplyCollisions, clearCollisions as clearReapplyCollisions, getLastClearedVersion, markClearedVersion } from '@/sandbox/state/reapply'
import { delta as deltaConf, clampConfidence } from '@/sandbox/probabilities/confidence'
import { getConfidence as getConfStore, setConfidence as setConfStore } from '@/sandbox/probabilities/store'
import { expandGroup, collapseGroup, isGroupExpanded } from '@/sandbox/state/grouping'
import {
  HelpCircle,
  Save,
  Undo2,
  Pointer,
  Square,
  Type,
  MessageSquareText,
  MoreVertical,
  Play,
  RotateCcw
} from 'lucide-react'

// Status types for the Scenario tile
export type ScenarioStatus = 'empty' | 'generating' | 'partial' | 'complete' | 'error'

type ProbabilityRow = { id: string; label: string; value: number; conf: number; updatedAt: number }

type OptionsRow = { id: string; label: string; note?: string }

// Utility for ids
const uid = () => Math.random().toString(36).slice(2)

// Canvas mock + right panel
export const ScenarioSandboxMock: React.FC<{ decisionId?: string; onExpandDecision?: (id: string) => void; onCollapseDecision?: (id: string) => void }> = ({ decisionId, onExpandDecision, onCollapseDecision }) => {
  return (
    <ScenarioSandboxInner decisionId={decisionId} onExpandDecision={onExpandDecision} onCollapseDecision={onCollapseDecision} />
  )
}

const ScenarioSandboxInner: React.FC<{ decisionId?: string; onExpandDecision?: (id: string) => void; onCollapseDecision?: (id: string) => void }> = ({ decisionId, onExpandDecision, onCollapseDecision }) => {
  
  const did = decisionId || 'sandbox-default'
  const flags = useFlags()
  const { track: t } = useTelemetry()
  const snapshotsEnabled = flags.scenarioSnapshots
  // Board doc (Yjs) via BoardState to leverage getUpdate/applyUpdate
  const realDoc = useRealtimeDoc()
  const {
    board,
    getUpdate: getBoardUpdate,
    replaceWithUpdate: replaceBoardWithUpdate,
    getCurrentDocument,
    getDecisionOptions: getBoardDecisionOptions,
  } = useBoardState(did, realDoc)
  const docRef = useRef<Y.Doc | null>(null)
  // Canvas/tile
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const tileRef = useRef<HTMLDivElement | null>(null)
  const [tilePos, setTilePos] = useState<{ x: number; y: number }>({ x: 160, y: 120 })
  const [dragging, setDragging] = useState(false)
  const dragOffset = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 })
  const [selected, setSelected] = useState(false)
  // Temporary instrumentation: initial debug line only — DEV only
  const renderCountRef = useRef(0)
  renderCountRef.current += 1
  if (import.meta.env.DEV && renderCountRef.current === 1) {
    try { console.warn('[SandboxMock] render start') } catch {}
  }

  // Tile data
  const [title, setTitle] = useState('Scenario A')
  const [status, setStatus] = useState<ScenarioStatus>('empty')
  const [unreadComments, setUnreadComments] = useState(true)

  // Right panel
  const [panelOpen, setPanelOpen] = useState(true)
  const [modelSection, setModelSection] = useState<'options' | 'probabilities'>('options')
  // Segmented control (radiogroup) state & handlers
  const segmentOptions: Array<'options' | 'probabilities'> = ['options', 'probabilities']
  const segmentRefs = useRef<Array<HTMLButtonElement | null>>([])
  const [segFocusIndex, setSegFocusIndex] = useState<number>(() => segmentOptions.indexOf('options'))
  const onSelectSegment = (seg: 'options' | 'probabilities', _via?: 'keyboard' | 'mouse') => {
    setModelSection(seg)
    model_segment_changed(seg === 'options' ? 'Options' : 'Probabilities')
  }
  const onSegmentKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault()
      const delta = e.key === 'ArrowRight' ? 1 : -1
      const next = (segFocusIndex + delta + segmentOptions.length) % segmentOptions.length
      setSegFocusIndex(next)
      const seg = segmentOptions[next]
      onSelectSegment(seg, 'keyboard')
      window.setTimeout(() => segmentRefs.current[next]?.focus?.(), 0)
    } else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      const seg = segmentOptions[segFocusIndex]
      onSelectSegment(seg, 'keyboard')
    }
  }
  useEffect(() => {
    setSegFocusIndex(segmentOptions.indexOf(modelSection))
  }, [modelSection])

  // Group expand/collapse (mock)
  const [expanded, setExpanded] = useState<boolean>(() => {
    try { return isGroupExpanded(did) } catch { return false }
  })
  const onToggleExpand = (e?: React.MouseEvent) => {
    if (e) { e.stopPropagation() }
    if (expanded) {
      collapseGroup(did)
      setExpanded(false)
      t('sandbox_panel', { op: 'group_toggle', decisionId: did, action: 'collapse', ts: Date.now() })
      if (onCollapseDecision) onCollapseDecision(did)
    } else {
      expandGroup(did)
      setExpanded(true)
      t('sandbox_panel', { op: 'group_toggle', decisionId: did, action: 'expand', ts: Date.now() })
      if (onExpandDecision) onExpandDecision(did)
    }
  }

  // Options & Criteria
  const [options, setOptions] = useState<OptionsRow[]>([
    { id: uid(), label: 'Option 1' },
    { id: uid(), label: 'Option 2' },
    { id: uid(), label: 'Option 3' },
  ])

  // Probabilities
  const [probRows, setProbRows] = useState<ProbabilityRow[]>([
    { id: uid(), label: 'Outcome A', value: 0.5, conf: 1, updatedAt: Date.now() },
    { id: uid(), label: 'Outcome B', value: 0.5, conf: 1, updatedAt: Date.now() },
  ])
  const probTotal = useMemo(() =>
    probRows.reduce((sum, r) => sum + (isNaN(r.value) ? 0 : r.value), 0),
    [probRows]
  )
  const totalDisplay = useMemo(() => probTotal.toFixed(2), [probTotal])
  // Projection for Guidance v1: simple increasing score weights
  const proj = useMemo(() => buildProjection(probRows.map((r, i) => ({ id: r.id, probability: r.value, score: i + 1 }))), [probRows])

  // Canonical graph option IDs for handles
  const boardOptionIds = useMemo(() => {
    try {
      return getBoardDecisionOptions ? getBoardDecisionOptions(did) : []
    } catch {
      return []
    }
  }, [board, getBoardDecisionOptions, did])
  const handleOptions = useMemo(() => {
    if (boardOptionIds && boardOptionIds.length > 0) {
      return boardOptionIds.map(id => ({ id, label: options.find(o => o.id === id)?.label || id }))
    }
    return options
  }, [boardOptionIds, options])

  // Feature flag: gate option handles
  const optionHandlesEnabled = flags.optionHandles

  // Rival edit indicator state
  type Collision = { id: string; field: string }
  const [collisions, setCollisions] = useState<Collision[]>([])
  useEffect(() => {
    // Initialize collisions from shared store
    try { setCollisions(getReapplyCollisions(did) as any) } catch {}
    // Clear chips only when recompute version strictly increases beyond last cleared
    const unsub = subscribeRecompute(did, (s) => {
      try {
        const lastCleared = getLastClearedVersion(did)
        if (typeof s.version === 'number' && s.version > lastCleared) {
          clearReapplyCollisions(did)
          markClearedVersion(did, s.version)
          setCollisions([])
        }
      } catch {}
    })
    // Update on reapply completion
    const onReapply = (ev: any) => {
      if (ev?.detail?.decisionId === did) {
        try { setCollisions(getReapplyCollisions(did) as any) } catch {}
      }
    }
    try { window.addEventListener('sandbox:reapply-done', onReapply as any) } catch {}
    return () => { unsub(); try { window.removeEventListener('sandbox:reapply-done', onReapply as any) } catch {} }
  }, [did])

  // Comments preview (minimal)
  const comments = [
    { id: uid(), user: 'Alex', text: 'Consider supply volatility.' },
    { id: uid(), user: 'Sam', text: 'Add sensitivity analysis.' },
  ]

  // --- Yjs mock state wiring ---
  const ensureYState = (doc: Y.Doc) => {
    const mock = doc.getMap('sandboxMock') as Y.Map<unknown>
    if (!mock.get('initialized')) {
      // Initialize Y state from current React defaults
      mock.set('initialized', true)
      mock.set('title', title)
      mock.set('status', status)
      const tile = new Y.Map<unknown>()
      tile.set('x', tilePos.x)
      tile.set('y', tilePos.y)
      mock.set('tilePos', tile)
      const yOptions = new Y.Array<Y.Map<unknown>>()
      options.forEach(o => {
        const m = new Y.Map<unknown>()
        m.set('id', o.id); m.set('label', o.label)
        yOptions.push([m])
      })
      mock.set('options', yOptions)
      const yProbs = new Y.Array<Y.Map<unknown>>()
      probRows.forEach(p => {
        const m = new Y.Map<unknown>()
        m.set('id', p.id); m.set('label', p.label); m.set('value', p.value); m.set('conf', p.conf); m.set('updatedAt', p.updatedAt)
        yProbs.push([m])
      })
      mock.set('probRows', yProbs)
    }
  }
  const onDeleteSnapshot = (snapId: string) => {
    try {
      deleteSnapshot(did, snapId)
      setSnapshotList(listSnapshots(did))
      toast({ title: 'Snapshot deleted' })
    } catch (e) {
      toast({ title: 'Failed to delete snapshot', type: 'destructive' })
    }
  }

  const readYStateToReact = (doc: Y.Doc) => {
    const mock = doc.getMap('sandboxMock') as Y.Map<unknown>
    const t = (mock.get('title') as string) || 'Scenario A'
    const s = (mock.get('status') as ScenarioStatus) || 'empty'
    const tp = (mock.get('tilePos') as Y.Map<unknown>)
    const nx = (tp?.get?.('x') as number) ?? tilePos.x
    const ny = (tp?.get?.('y') as number) ?? tilePos.y
    const yOpts = (mock.get('options') as Y.Array<Y.Map<unknown>>)
    const yProbs = (mock.get('probRows') as Y.Array<Y.Map<unknown>>)
    if (yOpts && Array.isArray(yOpts.toArray())) {
      const nextOptions = yOpts.toArray().map(m => ({ id: String(m.get('id')), label: String(m.get('label')) }))
      setOptions(prev => {
        if (prev.length === nextOptions.length && prev.every((p, i) => p.id === nextOptions[i].id && p.label === nextOptions[i].label)) return prev
        return nextOptions
      })
    }
    if (yProbs && Array.isArray(yProbs.toArray())) {
      const nextProbs = yProbs.toArray().map(m => ({
        id: String(m.get('id')),
        label: String(m.get('label')),
        value: Number(m.get('value')) || 0,
        conf: Number(m.get('conf')) || 1,
        updatedAt: Number(m.get('updatedAt')) || Date.now(),
      })) as ProbabilityRow[]
      setProbRows(prev => {
        if (
          prev.length === nextProbs.length &&
          prev.every((p, i) => p.id === nextProbs[i].id && p.label === nextProbs[i].label && p.value === nextProbs[i].value && p.conf === nextProbs[i].conf && p.updatedAt === nextProbs[i].updatedAt)
        ) return prev
        return nextProbs
      })
    }
    setTitle(prev => (prev === t ? prev : t))
    setStatus(prev => (prev === s ? prev : s))
    setTilePos(prev => (prev.x === nx && prev.y === ny ? prev : { x: nx, y: ny }))
  }

  useEffect(() => {
    const d = getCurrentDocument?.()
    if (!d) return
    if (docRef.current === d) return
    docRef.current = d
    ensureYState(d)
    let raf = 0
    const apply = () => { readYStateToReact(d); raf = 0 }
    const onUpdate = () => {
      if (raf) cancelAnimationFrame(raf)
      raf = requestAnimationFrame(apply)
    }
    // initial sync
    onUpdate()
    d.on('update', onUpdate)
    return () => { if (raf) cancelAnimationFrame(raf); d.off('update', onUpdate) }
  }, [getCurrentDocument, did])

  // --- Dragging handlers ---
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging) return
      setTilePos(() => ({ x: e.clientX - dragOffset.current.dx, y: e.clientY - dragOffset.current.dy }))
      // write to Y
      const d = docRef.current; if (d) {
        const mock = d.getMap('sandboxMock') as Y.Map<unknown>
        const tp = (mock.get('tilePos') as Y.Map<unknown>) || new Y.Map<unknown>()
        tp.set('x', e.clientX - dragOffset.current.dx)
        tp.set('y', e.clientY - dragOffset.current.dy)
        mock.set('tilePos', tp)
      }
    }
    const onUp = () => setDragging(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragging])

  const startDrag = (e: React.MouseEvent) => {
    if (!canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    dragOffset.current = { dx: e.clientX - (rect.left + tilePos.x), dy: e.clientY - (rect.top + tilePos.y) }
    setDragging(true)
  }

  const onGenerate = () => {
    try {
      // Build minimal projection and track
      const opts = probRows.map(p => ({ id: p.id, probability: p.value, score: 0 }))
      void buildProjection(opts)
      const now = Date.now()
      t('sandbox_model', { op: 'generate', decisionId: did, optionsCount: opts.length, total: probTotal, ts: now })
    } catch (e) {
      toast({ title: 'Failed to generate projection', type: 'destructive' })
    }
    setStatus('generating')
    // Simulate partial then complete
    window.setTimeout(() => setStatus('partial'), 900)
    window.setTimeout(() => setStatus('complete'), 1600)
  }

  const [restoreOpen, setRestoreOpen] = useState(false)
  const [showInspector, setShowInspector] = useState(false)
  const [snapshotList, setSnapshotList] = useState<SnapshotMeta[]>([])
  const onSaveSnapshot = () => {
    try {
      if (!snapshotsEnabled) return
      const upd = getBoardUpdate?.() || new Uint8Array()
      const meta = saveSnapshot(did, upd, { note: `Snapshot ${new Date().toLocaleTimeString()}`, probTotal })
      t('sandbox_snapshot', { action: 'save', decisionId: did, snapshotId: meta.id, ts: Date.now() })
      toast({ title: 'Snapshot saved' })
    } catch (e) {
      toast({ title: 'Failed to save snapshot', type: 'destructive' })
    }
  }
  const onRestore = () => {
    if (!snapshotsEnabled) return
    setRestoreOpen(o => !o)
    if (!restoreOpen) setSnapshotList(listSnapshots(did))
  }
  const onPickSnapshot = (snapId: string) => {
    try {
      const payload = loadSnapshot(did, snapId)
      if (!payload) {
        toast({ title: 'Snapshot incompatible', type: 'destructive' })
        return
      }
      const bytes = fromB64(payload.ydoc)
      replaceBoardWithUpdate?.(bytes)
    // Optional Delta Reapply v2 stub (non-blocking)
    try {
      if (flags.deltaReapplyV2) {
        import('@/sandbox/state/reapply').then(mod => {
          const res = mod.reapply(decisionId || did)
          try { setCollisions(res.collisions as any) } catch {}
          if (res.invalid.length > 0) {
            toast({ title: `Dropped ${res.invalid.length} ops as invalid`, description: res.invalid.map((i: { reason: string }) => i.reason).join(', '), type: 'destructive' as any })
          }
        }).catch(() => {})
      }
    } catch {}
      t('sandbox_snapshot', { action: 'restore', decisionId: did, snapshotId: snapId, ts: Date.now() })
      toast({ title: 'Snapshot restored' })
      setRestoreOpen(false)
    } catch (e) {
      toast({ title: 'Failed to restore snapshot', type: 'destructive' })
    }
  }
  const onHelp = () => {
    toast({ title: 'Open help docs (placeholder)' })
  }

  const openPanel = () => {
    setPanelOpen(true)
    setUnreadComments(false)
  }

  // Mini-map calc
  const miniMapRect = {
    width: 120,
    height: 80,
  }
  const canvasSize = { width: 800, height: 520 }
  const miniTile = {
    x: Math.max(0, Math.min(miniMapRect.width - 24, (tilePos.x / canvasSize.width) * miniMapRect.width)),
    y: Math.max(0, Math.min(miniMapRect.height - 14, (tilePos.y / canvasSize.height) * miniMapRect.height)),
  }

  // Probabilities actions
  const updateProbLabel = (id: string, label: string) => {
    setProbRows(prev => prev.map(r => r.id === id ? { ...r, label } : r))
    const d = docRef.current; if (d) {
      const yProbs = d.getMap('sandboxMock').get('probRows') as Y.Array<Y.Map<unknown>>
      const idx = yProbs.toArray().findIndex(m => m.get('id') === id)
      if (idx >= 0) yProbs.get(idx).set('label', label)
    }
  }
  const updateProbValue = (id: string, valueStr: string) => {
    const v = Number(valueStr)
    const now = Date.now()
    let nextRows: ProbabilityRow[] = []
    setProbRows(prev => {
      nextRows = prev.map(r => r.id === id ? { ...r, value: isNaN(v) ? r.value : v, updatedAt: now } : r)
      return nextRows
    })
    // Write through to Y if present
    const d = docRef.current; if (d && !isNaN(v)) {
      const yProbs = d.getMap('sandboxMock').get('probRows') as Y.Array<Y.Map<unknown>>
      const idx = yProbs.toArray().findIndex(m => m.get('id') === id)
      if (idx >= 0) { yProbs.get(idx).set('value', v); yProbs.get(idx).set('updatedAt', now) }
    }
    // Trigger recompute (engine)
    if (!isNaN(v)) {
      const opts = nextRows.map(r => ({ id: r.id, p: r.value, c: r.conf, lastUpdatedMs: r.updatedAt }))
      notifyRecompute(did, 'prob_edit', opts, now)
    }
  }

  const updateConfValue = (id: string, valueStr: string) => {
    const raw = Number(valueStr)
    const now = Date.now()
    const nextC = clampConfidence(raw)
    const d = docRef.current
    const prev = getConfStore(did, id, { doc: d }) || { conf: probRows.find(r => r.id === id)?.conf ?? 1, updatedAt: now }
    // Update UI state
    setProbRows(prevRows => prevRows.map(r => r.id === id ? { ...r, conf: isNaN(raw) ? r.conf : nextC, updatedAt: now } : r))
    // Persist via store (Yjs if available, else local)
    if (!Number.isNaN(raw)) setConfStore(did, id, nextC, now, { doc: d })
    // Trigger recompute + telemetry
    if (!Number.isNaN(raw)) {
      const opts = (probRows.map(r => r.id === id ? { ...r, conf: nextC, updatedAt: now } : r))
        .map(r => ({ id: r.id, p: r.value, c: r.conf, lastUpdatedMs: r.updatedAt }))
      notifyRecompute(did, 'conf_edit', opts, now)
      t('sandbox_model', { op: 'set_confidence', decisionId: did, count: opts.length, delta: deltaConf(prev.conf, nextC), ts: now })
    }
  }
  const addProbability = () => {
    const row = { id: uid(), label: `Outcome ${String.fromCharCode(65 + probRows.length)}`, value: 0, conf: 1, updatedAt: Date.now() }
    setProbRows(prev => [...prev, row])
    const d = docRef.current; if (d) {
      const yProbs = d.getMap('sandboxMock').get('probRows') as Y.Array<Y.Map<unknown>>
      const m = new Y.Map<unknown>(); m.set('id', row.id); m.set('label', row.label); m.set('value', row.value); m.set('conf', row.conf); m.set('updatedAt', row.updatedAt)
      yProbs.push([m])
    }
  }
  const removeProbability = (id: string) => {
    setProbRows(prev => prev.filter(r => r.id !== id))
    const d = docRef.current; if (d) {
      const yProbs = d.getMap('sandboxMock').get('probRows') as Y.Array<Y.Map<unknown>>
      const arr = yProbs.toArray();
      const idx = arr.findIndex(m => m.get('id') === id)
      if (idx >= 0) yProbs.delete(idx, 1)
    }
  }

  const updateOption = (id: string, label: string) => {
    setOptions(prev => prev.map(o => o.id === id ? { ...o, label } : o))
    const d = docRef.current; if (d) {
      const yOptions = d.getMap('sandboxMock').get('options') as Y.Array<Y.Map<unknown>>
      const idx = yOptions.toArray().findIndex(m => m.get('id') === id)
      if (idx >= 0) yOptions.get(idx).set('label', label)
    }
  }

  // Keyboard handlers for tile movement and interactions
  const TILE_W = 320
  const TILE_H = 170
  const moveTile = (dx: number, dy: number) => {
    setTilePos(pos => {
      const nx = Math.max(0, Math.min(canvasSize.width - TILE_W, pos.x + dx))
      const ny = Math.max(0, Math.min(canvasSize.height - TILE_H, pos.y + dy))
      return { x: nx, y: ny }
    })
  }

  const onTileKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 24 : 8
    if (e.key === 'Enter') {
      e.preventDefault()
      openPanel()
      return
    }
    if (e.key === 'ArrowLeft') { e.preventDefault(); moveTile(-step, 0) }
    if (e.key === 'ArrowRight') { e.preventDefault(); moveTile(step, 0) }
    if (e.key === 'ArrowUp') { e.preventDefault(); moveTile(0, -step) }
    if (e.key === 'ArrowDown') { e.preventDefault(); moveTile(0, step) }
  }

  // Close panel on Escape and return focus to tile
  useEffect(() => {
    if (!panelOpen) return
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPanelOpen(false)
        setTimeout(() => tileRef.current?.focus(), 0)
      }
    }
    window.addEventListener('keydown', onEsc)
    return () => window.removeEventListener('keydown', onEsc)
  }, [panelOpen])

  const statusText = (() => {
    switch (status) {
      case 'generating': return 'Generating…'
      case 'partial': return 'Partial generated'
      case 'complete': return 'Complete'
      case 'error': return 'Error'
      default: return ''
    }
  })()

  return (
    <>
    <div className="h-[75vh] md:h-[80vh] lg:h-[82vh] bg-white rounded-lg border shadow-sm overflow-hidden flex">
      {/* Canvas area */}
      <div ref={canvasRef} className="flex-1 relative bg-gray-50" aria-label="Canvas Area">
        {/* Top bar */}
        <div className="absolute top-2 left-2 right-2 flex items-center gap-2">
          <button aria-label="Save snapshot" onClick={onSaveSnapshot} className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border bg-white hover:bg-gray-50 focus:outline-none focus-visible:ring"><Save className="h-3 w-3"/> Save</button>
          <button aria-label="Restore snapshot" onClick={onRestore} className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border bg-white hover:bg-gray-50 focus:outline-none focus-visible:ring"><Undo2 className="h-3 w-3"/> Restore…</button>
          <button aria-label="Help" onClick={onHelp} className="ml-auto inline-flex items-center gap-1 px-2 py-1 text-xs rounded border bg-white hover:bg-gray-50 focus:outline-none focus-visible:ring"><HelpCircle className="h-3 w-3"/> Help</button>
          {(flags.sandbox && flags.projections) && (
            <button aria-label="Telemetry" onClick={() => setShowInspector(s => !s)} className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border bg-white hover:bg-gray-50 focus:outline-none focus-visible:ring">Telemetry</button>
          )}
        </div>

        {/* Left toolbar (non-functional) */}
        <div className="absolute top-14 left-2 flex flex-col gap-2" role="toolbar" aria-label="Canvas tools">
          <button aria-label="Pointer" title="Pointer" className="p-1 rounded border bg-white hover:bg-gray-50 focus:outline-none focus-visible:ring"><Pointer className="h-4 w-4"/></button>
          <button aria-label="Rectangle" title="Rectangle" className="p-1 rounded border bg-white hover:bg-gray-50 focus:outline-none focus-visible:ring"><Square className="h-4 w-4"/></button>
          <button aria-label="Text" title="Text" className="p-1 rounded border bg-white hover:bg-gray-50 focus:outline-none focus-visible:ring"><Type className="h-4 w-4"/></button>
        </div>

        {/* Snapshot list popover */}
        {restoreOpen && (
          <div aria-label="Snapshot list" className="absolute top-10 left-2 z-10 w-64 rounded border bg-white shadow p-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium">Recent snapshots</span>
              <button
                aria-label="Close snapshots"
                onClick={() => setRestoreOpen(false)}
                className="text-xs px-2 py-0.5 rounded border bg-white hover:bg-gray-50 focus:outline-none focus-visible:ring"
              >Close</button>
            </div>
            {/* Intentionally no "Clear all" here; SnapshotTray is the canonical entry point for Clear All */}
            {snapshotList.length === 0 ? (
              <div className="text-xs text-gray-500">No snapshots</div>
            ) : (
              <ul className="space-y-1">
                {snapshotList.map(s => (
                  <li key={s.id} className="flex items-center justify-between gap-2">
                    <button
                      aria-label={`Restore ${s.id}`}
                      onClick={() => onPickSnapshot(s.id)}
                      className="flex-1 text-left text-xs px-2 py-1 rounded hover:bg-gray-50 focus:outline-none focus-visible:ring"
                    >
                      <div className="truncate">
                        <span className="font-medium">{new Date(s.createdAt).toLocaleTimeString()}</span>
                        {s.note ? <span className="text-gray-500"> – {s.note}</span> : null}
                      </div>
                    </button>
                    <button
                      aria-label={`Delete ${s.id}`}
                      onClick={() => onDeleteSnapshot(s.id)}
                      className="text-[10px] px-2 py-1 rounded border bg-white hover:bg-gray-50 focus:outline-none focus-visible:ring"
                    >Delete</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Scenario Tile */}
        <div
          aria-label="Scenario Tile"
          role="group"
          tabIndex={0}
          ref={tileRef}
          data-testid="scenario-tile"
          aria-busy={status === 'generating'}
          onFocus={() => setSelected(true)}
          onBlur={() => setSelected(false)}
          onMouseDown={startDrag}
          onClick={() => setSelected(true)}
          onKeyDown={onTileKeyDown}
          className={`absolute select-none w-[320px] h-[170px] bg-white border rounded shadow hover:shadow-md ${selected ? 'ring-2 ring-indigo-400' : ''}`}
          style={{ transform: `translate(${tilePos.x}px, ${tilePos.y}px)` }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-3 py-2 border-b bg-gray-50"
            data-testid="tile-header"
            onMouseDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => { e.stopPropagation(); openPanel() }}
          >
            <input
              aria-label="Scenario title"
              className="text-sm font-medium bg-transparent outline-none focus:ring-1 focus:ring-indigo-400 rounded px-1"
              value={title}
              onChange={e => {
                setTitle(e.target.value)
                const d = docRef.current; if (d) d.getMap('sandboxMock').set('title', e.target.value)
              }}
            />
            <div className="flex items-center gap-2">
              <span aria-label={`Status: ${status}`} className={`text-[10px] px-1.5 py-0.5 rounded ${statusChipClass(status)}`}>{status}</span>
              <button aria-label="Tile menu" className="p-1 rounded hover:bg-gray-100 focus:outline-none focus-visible:ring" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}><MoreVertical className="h-4 w-4"/></button>
            </div>
          </div>
          {/* Body */}
          <div className="p-3 text-xs text-gray-700 space-y-2">
            <div className="flex items-center gap-1">
              <button aria-label="Open" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); openPanel() }} className="inline-flex items-center gap-1 px-2 py-1 rounded border bg-white hover:bg-gray-50 focus:outline-none focus-visible:ring">Open</button>
              <button aria-label="Generate" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onGenerate() }} className="inline-flex items-center gap-1 px-2 py-1 rounded border bg-white hover:bg-gray-50 focus:outline-none focus-visible:ring"><Play className="h-3 w-3"/> Generate</button>
              <button aria-label={expanded ? 'Collapse group' : 'Expand group'} onMouseDown={(e) => e.stopPropagation()} onClick={onToggleExpand} className="inline-flex items-center gap-1 px-2 py-1 rounded border bg-white hover:bg-gray-50 focus:outline-none focus-visible:ring">{expanded ? 'Collapse' : 'Expand'}</button>
              <button aria-label="Comments" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); openPanel() }} className="relative inline-flex items-center gap-1 px-2 py-1 rounded border bg-white hover:bg-gray-50 focus:outline-none focus-visible:ring">
                <MessageSquareText className="h-3 w-3"/> Comments
                {unreadComments && <span aria-label="Unread comments" className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500" />}
              </button>
            </div>
            <p>Drag this tile around. Use the right panel to edit details.</p>
          </div>

          {/* Option handles (right side) */}
          {optionHandlesEnabled && (
            <div className="absolute -right-2 top-12 flex flex-col gap-1" aria-label="Option handles">
              {handleOptions.map((o, idx) => {
                const handleId = getOptionHandleId(o.id)
                return (
                  <button
                    key={o.id}
                    data-handle-id={handleId}
                    data-option-id={o.id}
                    aria-label={`Handle for ${o.label}`}
                    title={o.label}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); t('sandbox_handle_click', { decisionId: did, handleId, optionId: o.id, index: idx }) }}
                    className="h-3 w-3 rounded-full border bg-white hover:bg-indigo-50 focus:outline-none focus-visible:ring"
                  />
                )
              })}
            </div>
          )}

          {/* Status overlays */}
          {status === 'generating' && (
            <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center">
              <div className="flex items-center gap-2 text-gray-700"><span className="h-4 w-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin"/> Generating…</div>
            </div>
          )}
          {status === 'error' && (
            <div role="alert" className="absolute inset-x-0 bottom-0 m-2 rounded border border-red-200 bg-red-50 text-red-700 text-xs px-2 py-1">Error generating. Try again.</div>
          )}
        </div>

        {/* Live status announcer for SRs */}
        <div role="status" aria-live="polite" data-testid="status-announcer" className="sr-only">
          {statusText}
        </div>

        {/* Minimap */}
        <div className="absolute right-2 bottom-2 border rounded bg-white p-1" style={{ width: miniMapRect.width + 8, height: miniMapRect.height + 8 }}>
          <div className="relative bg-gray-100" style={{ width: miniMapRect.width, height: miniMapRect.height }}>
            <div className="absolute bg-indigo-400/60" style={{ left: miniTile.x, top: miniTile.y, width: 24, height: 14 }} aria-label="Mini map indicator" />
          </div>
        </div>
      </div>

      {/* Right Panel */}
      {panelOpen && (
        <aside className="w-[360px] border-l bg-white overflow-auto" data-testid="panel" onKeyDown={(e) => { if (e.key === 'Escape') { setPanelOpen(false); setTimeout(() => tileRef.current?.focus(), 0) } }}>
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="text-sm font-semibold">Model</h3>
            <div className="flex items-center gap-1">
              <button
                aria-label="Re-generate"
                onClick={() => onGenerate()}
                className="inline-flex items-center gap-1 px-2 py-1 rounded border bg-white hover:bg-gray-50 focus:outline-none focus-visible:ring text-xs"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Re-generate
              </button>
              <button
                aria-label="Generate"
                onClick={() => onGenerate()}
                className="inline-flex items-center gap-1 px-2 py-1 rounded border bg-white hover:bg-gray-50 focus:outline-none focus-visible:ring text-xs"
              >
                <Play className="h-3.5 w-3.5"/> Generate
              </button>
              <button
                aria-label="Close"
                onClick={() => { setPanelOpen(false); setTimeout(() => tileRef.current?.focus(), 0) }}
                className="inline-flex items-center gap-1 px-2 py-1 rounded border bg-white hover:bg-gray-50 focus:outline-none focus-visible:ring text-xs"
              >
                Close
              </button>
            </div>
          </div>

          {/* Segmented control (radiogroup) */}
          <div className="p-3 border-b">
            <div
              role="radiogroup"
              aria-label="Model view"
              className="inline-flex rounded border overflow-hidden"
              onKeyDown={onSegmentKeyDown}
            >
              <button
                id="segment-options"
                role="radio"
                aria-checked={modelSection === 'options'}
                tabIndex={modelSection === 'options' ? 0 : -1}
                ref={el => { segmentRefs.current[0] = el }}
                onClick={() => onSelectSegment('options', 'mouse')}
                className={`px-3 py-1 text-xs ${modelSection === 'options' ? 'bg-indigo-50 text-indigo-700' : 'bg-white'} border-r focus:outline-none focus-visible:ring`}
              >Options</button>
              <button
                id="segment-probabilities"
                role="radio"
                aria-checked={modelSection === 'probabilities'}
                tabIndex={modelSection === 'probabilities' ? 0 : -1}
                ref={el => { segmentRefs.current[1] = el }}
                onClick={() => onSelectSegment('probabilities', 'mouse')}
                className={`px-3 py-1 text-xs ${modelSection === 'probabilities' ? 'bg-indigo-50 text-indigo-700' : 'bg-white'} focus:outline-none focus-visible:ring`}
              >Probabilities</button>
            </div>
          </div>

          {/* Options panel */}
          {modelSection === 'options' && (
            <div id="panel-options" role="region" aria-labelledby="segment-options" className="p-4 border-b">
              <div className="mt-2 space-y-2">
                {options.map(o => (
                  <div key={o.id} className="flex items-center gap-2">
                    <input aria-label={`Option ${o.id}`} value={o.label} onChange={e => updateOption(o.id, e.target.value)} className="flex-1 rounded border px-2 py-1 text-sm focus:outline-none focus-visible:ring" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Probabilities panel */}
          {modelSection === 'probabilities' && (
            <div id="panel-probabilities" role="region" aria-labelledby="segment-probabilities" className="p-4 border-b">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Probabilities</h3>
                <div className="text-xs text-gray-600">Total: <span aria-label="Total Probability" data-testid="probabilities-total">{totalDisplay}</span></div>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <button aria-label="Distribute evenly" onClick={() => {
                  const vals = evenSplit(probRows.length)
                  const next = probRows.map((r, i) => ({ ...r, value: vals[i], updatedAt: Date.now() }))
                  setProbRows(next)
                  const d = docRef.current; if (d) {
                    const yProbs = d.getMap('sandboxMock').get('probRows') as Y.Array<Y.Map<unknown>>
                    next.forEach((r, i) => { yProbs.get(i).set('value', r.value); yProbs.get(i).set('updatedAt', r.updatedAt) })
                  }
                  t('sandbox_model', { op: 'even_split', decisionId: did, count: probRows.length, ts: Date.now() })
                }} className="text-xs px-2 py-1 rounded border bg-white hover:bg-gray-50 focus:outline-none focus-visible:ring">Distribute evenly</button>
                <button aria-label="Normalize" onClick={() => {
                  const vals = normalize(probRows.map(r => r.value))
                  const next = probRows.map((r, i) => ({ ...r, value: vals[i], updatedAt: Date.now() }))
                  setProbRows(next)
                  const d = docRef.current; if (d) {
                    const yProbs = d.getMap('sandboxMock').get('probRows') as Y.Array<Y.Map<unknown>>
                    next.forEach((r, i) => { yProbs.get(i).set('value', r.value); yProbs.get(i).set('updatedAt', r.updatedAt) })
                  }
                  t('sandbox_model', { op: 'normalize', decisionId: did, count: probRows.length, ts: Date.now() })
                }} className="text-xs px-2 py-1 rounded border bg-white hover:bg-gray-50 focus:outline-none focus-visible:ring">Normalize</button>
              </div>
              {probTotal !== 1 && (
                <div role="note" className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">Warning: total should sum to 1.00</div>
              )}
              <div className="mt-3 space-y-2">
                {probRows.map(r => (
                  <div key={r.id} className="flex items-center gap-2">
                    <input aria-label={`Probability Label ${r.id}`} value={r.label} onChange={e => updateProbLabel(r.id, e.target.value)} className="flex-1 rounded border px-2 py-1 text-sm focus:outline-none focus-visible:ring" />
                    {(() => {
                      const invalid = r.value < 0 || r.value > 1
                      const hintId = `prob-hint-${r.id}`
                      return (
                        <>
                          <input
                            aria-label={`Probability Value ${r.id}`}
                            type="number"
                            min={0}
                            max={1}
                            step={0.01}
                            value={r.value}
                            aria-invalid={invalid}
                            aria-describedby={invalid ? hintId : undefined}
                            onChange={e => updateProbValue(r.id, e.target.value)}
                            className={`w-24 rounded border px-2 py-1 text-sm focus:outline-none focus-visible:ring ${invalid ? 'border-red-400' : ''}`}
                          />
                          {collisions.some((c: Collision) => c.id === r.id && (c.field === 'prob' || c.field === 'value' || c.field === 'probability')) && (
                            <span data-testid={`rival-${r.id}`} className="inline-flex items-center px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[10px] font-medium">edit collision</span>
                          )}
                          <span id={hintId} className="text-[10px] text-gray-500">Enter 0–1</span>
                          <label className="ml-2 text-[10px] text-gray-600" htmlFor={`conf-${r.id}`}>Confidence</label>
                          <input
                            id={`conf-${r.id}`}
                            aria-label={`Confidence ${r.id}`}
                            type="range"
                            min={0}
                            max={1}
                            step={0.01}
                            value={r.conf}
                            onChange={e => updateConfValue(r.id, e.target.value)}
                            className="w-24"
                          />
                          <span className="text-[10px] text-gray-500">{r.conf.toFixed(2)}</span>
                        </>
                      )
                    })()}
                    <button aria-label={`Remove Probability ${r.id}`} onClick={() => removeProbability(r.id)} className="text-xs px-2 py-1 rounded border bg-white hover:bg-gray-50 focus:outline-none focus-visible:ring">Remove</button>
                  </div>
                ))}
              </div>
              <button aria-label="Add probability" onClick={addProbability} className="mt-3 text-xs px-2 py-1 rounded border bg-white hover:bg-gray-50 focus:outline-none focus-visible:ring">Add probability</button>

              {/* Guidance v1 */}
              <div className="mt-4 p-2 rounded border bg-gray-50">
                <div className="text-xs font-medium mb-1">Guidance</div>
                <div className="text-xs text-gray-700">Expected value (mock weights): <span data-testid="guidance-ev">{proj.expectedValue.toFixed(2)}</span></div>
                <div className="mt-1">
                  <div className="text-[11px] text-gray-600 mb-1">Normalized distribution:</div>
                  <ul className="grid grid-cols-2 gap-x-3 text-[11px] text-gray-700">
                    {probRows.map((r, i) => (
                      <li key={r.id}><span className="text-gray-500">{r.label}:</span> {proj.normalized[i]?.toFixed(2) ?? '0.00'}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Activity (kept minimal) */}
          <div className="p-4">
            <h3 className="text-sm font-semibold">Activity</h3>
            <ul className="mt-2 space-y-2">
              {comments.map(c => (
                <li key={c.id} className="text-sm text-gray-700">
                  <span className="font-medium">{c.user}:</span> {c.text}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      )}
    </div>

    {/* Dev/Test: Telemetry Inspector */}
    {(flags.sandbox && flags.projections) && showInspector && (
      <div className="absolute top-2 right-2 z-20 w-[360px] max-h-[70vh] overflow-auto border rounded bg-white shadow">
        <div className="flex items-center justify-between p-2 border-b">
          <span className="text-xs font-medium">Telemetry Inspector</span>
          <button className="text-xs px-2 py-1 rounded border bg-white hover:bg-gray-50" onClick={() => setShowInspector(false)}>Close</button>
        </div>
        <div className="p-2 text-xs">
          <TelemetryInspector />
        </div>
      </div>
    )}
  </>
)
}

function statusChipClass(status: ScenarioStatus): string {
  switch (status) {
    case 'empty': return 'bg-gray-100 text-gray-700'
    case 'generating': return 'bg-blue-100 text-blue-700'
    case 'partial': return 'bg-amber-100 text-amber-800'
    case 'complete': return 'bg-emerald-100 text-emerald-700'
    case 'error': return 'bg-red-100 text-red-700'
    default: return 'bg-gray-100 text-gray-700'
  }
}

