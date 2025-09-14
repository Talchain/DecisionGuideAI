import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Tldraw } from '@/whiteboard/tldraw'
import { ensureCanvasForDecision, loadCanvasDoc, saveCanvasDoc } from './persistence'
import { loadSeed } from './seed'
import { writeProjection } from './projection'
import { useTelemetry } from '@/lib/useTelemetry'
import { useFlags } from '@/lib/flags'
import { useGraphOptional } from '@/sandbox/state/graphStore'
import { createDomainMapping, type DomainMapping } from '@/whiteboard/domainMapping'
import { scoreGraph } from '@/domain/kr'
import { useAuth } from '@/contexts/AuthContext'
import { useOverrides } from '@/sandbox/state/overridesStore'
import { FocusOverlay } from '@/whiteboard/FocusOverlay'
import { WhatIfOverlay } from '@/whiteboard/WhatIfOverlay'

interface CanvasProps {
  decisionId: string
  onReady?: (info: { canvasId: string }) => void
  persistDelayMs?: number
  persistOnlyWithTldraw?: boolean
  hideBanner?: boolean
  hideFeedback?: boolean
  embedded?: boolean
  explainHighlightNodeId?: string | null
  onAPIReady?: (api: {
    saveNow: () => boolean
    restore: () => boolean
    reset: () => boolean
    setStyleOpen: (open: boolean) => void
    toggleStyle: () => void
    getRoot: () => HTMLElement | null
    editor: any | null
    getDoc: () => any
    loadDoc: (next: any) => boolean
    mapping?: DomainMapping | null
  }) => void
}

//

export const Canvas: React.FC<CanvasProps> = ({ decisionId, onReady, persistDelayMs = 500, persistOnlyWithTldraw = false, hideBanner = false, hideFeedback = false, embedded = false, explainHighlightNodeId = null, onAPIReady }) => {
  const STORAGE_KEY = useMemo(() => `dgai:canvas:decision/${decisionId || 'demo'}`, [decisionId])
  const { track } = useTelemetry()
  const [canvasId, setCanvasId] = useState<string | null>(null)
  const [doc, setDoc] = useState<any | null>(() => {
    try {
      const saved = localStorage.getItem(`dgai:canvas:decision/${decisionId || 'demo'}`)
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })
  const [localOnly, setLocalOnly] = useState(false)
  // Removed tip banner for simplicity
  const savingRef = useRef<number | null>(null)
  const localSaveRef = useRef<number | null>(null)
  const editorRef = useRef<any | null>(null)
  const unsubRef = useRef<null | (() => void)>(null)
  const mappingRef = useRef<DomainMapping | null>(null)
  const hydratedFromLocalRef = useRef<boolean>(!!doc)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const flags = useFlags()
  const { user: authUser, profile } = useAuth()
  const graphApi = useGraphOptional()
  const sessionIdRef = useRef<string>(Math.random().toString(36).slice(2))
  const shapeIndexRef = useRef<Map<string, string>>(new Map())
  const [connectActive, setConnectActive] = useState(false)
  const connectSourceRef = useRef<string | null>(null)
  const [perNodeScore, setPerNodeScore] = useState<Record<string, number>>({})
  const scoreTimerRef = useRef<number | null>(null)
  // Optional overrides (What-If) — provider may be absent
  const overrides = (() => { try { return useOverrides() } catch { return null } })()
  // Local focus attr state ensures deterministic flips on ESC, even pre-hydration
  const [focusAttrOn, setFocusAttrOn] = useState<boolean>(!!overrides?.focusOnNodeId)
  useEffect(() => { setFocusAttrOn(!!overrides?.focusOnNodeId) }, [overrides?.focusOnNodeId])

  // Using internal TLDraw store for minimal/safe integration

  // Preload or create
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { canvasId } = await ensureCanvasForDecision(decisionId)
        if (cancelled) return
        setCanvasId(canvasId)
        onReady?.({ canvasId })

        const existing = await loadCanvasDoc(canvasId)
        if (cancelled) return

        if (existing && existing.shapes) {
          if (!hydratedFromLocalRef.current) setDoc(existing)
        } else {
          const seeded = await loadSeed(decisionId)
          if (cancelled) return
          if (!hydratedFromLocalRef.current) setDoc(seeded.doc)
          // Prime persistence immediately with seed
          await saveCanvasDoc(canvasId, seeded.doc)
          await writeProjection(decisionId, seeded.doc)
        }
      } catch (e) {
        if (import.meta.env.DEV && import.meta.env.VITE_DEBUG_BOARD === 'true') {
          console.error('[Whiteboard] init failed', e)
        }
        // Local-first fallback: proceed with a local doc and skip cloud persistence
        try {
          const seeded = await loadSeed(decisionId)
          if (cancelled) return
          setLocalOnly(true)
          const localId = `local:${decisionId}`
          setCanvasId(localId)
          onReady?.({ canvasId: localId })
          if (!hydratedFromLocalRef.current) setDoc(seeded.doc)
        } catch (e2) {
          // As a last resort, mount an empty doc so UI remains interactive
          setLocalOnly(true)
          const localId = `local:${decisionId}`
          setCanvasId(localId)
          onReady?.({ canvasId: localId })
          if (!hydratedFromLocalRef.current) setDoc({ shapes: [], bindings: [], meta: { decision_id: decisionId, kind: 'sandbox' } })
        }
      }
    })()
    return () => {
      cancelled = true
      if (savingRef.current) window.clearTimeout(savingRef.current)
    }
  }, [decisionId])

  // Persist on doc change (basic debounce)
  useEffect(() => {
    if (!canvasId || !doc) return
    if (localOnly) return
    if (persistOnlyWithTldraw && !(doc as any)?.tldraw) return
    if (savingRef.current) window.clearTimeout(savingRef.current)
    savingRef.current = window.setTimeout(async () => {
      await saveCanvasDoc(canvasId, doc)
      await writeProjection(decisionId, doc)
    }, persistDelayMs)
  }, [canvasId, doc, decisionId, persistDelayMs, persistOnlyWithTldraw, localOnly])

  // In a fuller impl, we would connect Tldraw editor events to update `doc` when content changes.
  // Here we connect to the editor store and mirror its snapshot into doc.tldraw.
  const handleMount = useCallback((editor: any) => {
    editorRef.current = editor
    try {
      // Load previous snapshot if present
      const snap = (doc as any)?.tldraw
      if (snap && editor?.store?.loadSnapshot) {
        editor.store.loadSnapshot(snap)
      }
    } catch (e) {
      if (import.meta.env.DEV && import.meta.env.VITE_DEBUG_BOARD === 'true') {
        console.warn('[Whiteboard] loadSnapshot failed', e)
      }
    }

    try {
      // Listen to document changes and mirror snapshot into doc
      if (unsubRef.current) unsubRef.current()
      const store = editor?.store
      if (store?.listen) {
        unsubRef.current = store.listen(() => {
          try {
            const nextSnap = store.getSnapshot ? store.getSnapshot() : store.getState?.()
            setDoc((prev: any) => {
              if (!prev) return prev
              const same = (prev as any).tldraw === nextSnap
              return same ? prev : { ...prev, tldraw: nextSnap }
            })
            // Selection bridging: map selected TL shape to Graph selection
            try {
              const selectedShapes = editor?.getSelectedShapes?.() ?? []
              const shape = selectedShapes?.[0] ?? null
              const meta = shape?.meta || null
              if (meta?.nodeId && graphApi?.setSelectedNode) {
                graphApi.setSelectedNode(meta.nodeId)
                graphApi.setSelectedEdge(null)
              } else if (meta?.edgeId && graphApi?.setSelectedEdge) {
                graphApi.setSelectedEdge(meta.edgeId)
                graphApi.setSelectedNode(null)
              }
              // Connect mode: source -> target via selections
              if (connectActive && meta?.nodeId) {
                if (!connectSourceRef.current) {
                  connectSourceRef.current = meta.nodeId
                } else if (connectSourceRef.current !== meta.nodeId) {
                  const src = connectSourceRef.current
                  const dst = meta.nodeId
                  connectSourceRef.current = null
                  setConnectActive(false)
                  const edgeId = `e_${Math.random().toString(36).slice(2,8)}`
                  graphApi?.upsertEdge?.({ id: edgeId, from: src, to: dst, kind: 'supports' })
                  mappingRef.current?.upsertConnectorFromEdge?.({ id: edgeId, from: src, to: dst, kind: 'supports' } as any)
                }
              }
            } catch {}

            // TL → Domain incremental sync (diff by signature)
            try {
              if (!flags.sandboxMapping || !graphApi) return
              const shapes: any[] = editor?.getCurrentPageShapes?.() ?? []
              const index = shapeIndexRef.current
              const seen = new Set<string>()

              // Build reverse maps for quick lookups
              const revNode = new Map<string, string>()
              const revEdge = new Map<string, string>()
              for (const [nid, sid] of mappingRef.current?.nodeToShape ?? []) revNode.set(sid, nid)
              for (const [eid, sid] of mappingRef.current?.edgeToShape ?? []) revEdge.set(sid, eid)

              const sigFor = (s: any): string => {
                if (!s) return ''
                if (s.type === 'geo') return JSON.stringify({ x: s.x, y: s.y, w: s.props?.w, h: s.props?.h, text: s.props?.text })
                if (s.type === 'arrow') return JSON.stringify({ start: s.props?.start?.boundShapeId, end: s.props?.end?.boundShapeId, kind: s.meta?.kind })
                return JSON.stringify({})
              }

              // Handle creates/updates
              for (const s of shapes) {
                const id = s.id
                seen.add(id)
                const curSig = sigFor(s)
                const prevSig = index.get(id)
                if (prevSig === undefined) {
                  // Create
                  if (mappingRef.current?.isFromMapping(id)) {
                    index.set(id, curSig)
                    continue
                  }
                  if (s.type === 'geo') {
                    const nodeId = s.meta?.nodeId || `n_${Math.random().toString(36).slice(2, 8)}`
                    const title = (s.props?.text || '').split('\n')[0] || 'Node'
                    graphApi.upsertNode({ id: nodeId, type: 'Option', title, view: { x: s.x ?? 0, y: s.y ?? 0, w: s.props?.w ?? 160, h: s.props?.h ?? 80 } })
                    // adopt existing TL shape id into mapping, then reconcile
                    if (mappingRef.current) {
                      try { mappingRef.current.nodeToShape.set(nodeId, id) } catch {}
                      mappingRef.current.upsertShapeFromNode({ id: nodeId, type: 'Option', title, view: { x: s.x ?? 0, y: s.y ?? 0, w: s.props?.w ?? 160, h: s.props?.h ?? 80 } } as any)
                    }
                  } else if (s.type === 'arrow') {
                    const fromSid = s.props?.start?.boundShapeId
                    const toSid = s.props?.end?.boundShapeId
                    const fromNode = revNode.get(fromSid)
                    const toNode = revNode.get(toSid)
                    if (fromNode && toNode) {
                      const edgeId = s.meta?.edgeId || `e_${Math.random().toString(36).slice(2, 8)}`
                      const kind = (s.meta?.kind as any) || 'supports'
                      graphApi.upsertEdge({ id: edgeId, from: fromNode, to: toNode, kind })
                      if (mappingRef.current) {
                        try { mappingRef.current.edgeToShape.set(edgeId, id) } catch {}
                        mappingRef.current.upsertConnectorFromEdge({ id: edgeId, from: fromNode, to: toNode, kind } as any)
                      }
                    }
                  }
                } else if (prevSig !== curSig) {
                  // Update
                  if (mappingRef.current?.isFromMapping(id)) {
                    index.set(id, curSig)
                    continue
                  }
                  if (s.type === 'geo') {
                    const nodeId = s.meta?.nodeId || revNode.get(id)
                    if (nodeId) {
                      const title = (s.props?.text || '').split('\n')[0] || undefined
                      const patch: any = { }
                      if (title !== undefined) patch.title = title
                      patch.view = { x: s.x ?? 0, y: s.y ?? 0, w: s.props?.w ?? 160, h: s.props?.h ?? 80 }
                      graphApi.updateNodeFields(nodeId, patch)
                    }
                  } else if (s.type === 'arrow') {
                    const edgeId = s.meta?.edgeId || revEdge.get(id)
                    if (edgeId) {
                      const fromSid = s.props?.start?.boundShapeId
                      const toSid = s.props?.end?.boundShapeId
                      const fromNode = revNode.get(fromSid)
                      const toNode = revNode.get(toSid)
                      if (fromNode && toNode) {
                        mappingRef.current?.onConnectorReattach(edgeId, fromNode, toNode)
                      }
                    }
                  }
                }
                index.set(id, curSig)
              }

              // Deletes
              for (const [sid] of Array.from(index.entries())) {
                if (!seen.has(sid)) {
                  // shape deleted
                  const isOut = mappingRef.current?.isFromMapping(sid)
                  index.delete(sid)
                  if (isOut) continue
                  const nodeId = revNode.get(sid)
                  if (nodeId) {
                    graphApi.removeNode(nodeId)
                    try { mappingRef.current?.removeNodeShape(nodeId) } catch {}
                    continue
                  }
                  const edgeId = revEdge.get(sid)
                  if (edgeId) {
                    graphApi.removeEdge(edgeId)
                    try { mappingRef.current?.removeEdgeConnector(edgeId) } catch {}
                    continue
                  }
                }
              }
            } catch {}
          } catch (e) {
            // no-op
          }
        }, { scope: 'document' })
      }
    } catch (e) {
      if (import.meta.env.DEV && import.meta.env.VITE_DEBUG_BOARD === 'true') {
        console.warn('[Whiteboard] store.listen failed', e)
      }
    }
    try {
      // Ensure interactive editor (not read-only) and sensible default tool
      if (editor?.updateInstanceState) {
        editor.updateInstanceState({ isReadonly: false })
      }
      if (!embedded) {
        if (editor?.setCurrentTool) {
          editor.setCurrentTool('geo')
        }
      }
      if (import.meta.env.DEV) {
        try { (window as any).tl = editor } catch {}
      }
    } catch {}

    // Domain mapping (nodes only in this commit)
    try {
      if (flags.sandboxMapping) {
        const trackAny = (name: string, props?: Record<string, unknown>) => {
          try { (track as any)(name, props) } catch {}
        }
        mappingRef.current = createDomainMapping({ editor, decisionId, sessionId: sessionIdRef.current, track: trackAny, onEdgeChange: graphApi?.upsertEdge })
        if (graphApi?.graph) {
          mappingRef.current.rebuildFromGraph(graphApi.graph)
        }
      }
    } catch {}
  }, [])

  // Toolbar actions — stable callbacks reading from editorRef
  const setTool = useCallback((tool: string) => () => {
    try { editorRef.current?.setCurrentTool?.(tool) } finally { try { track('sandbox_whiteboard_action', { action: 'tool_change', tool }) } catch {} }
  }, [track])
  const handleUndo = useCallback(() => { try { editorRef.current?.undo?.() } finally { try { track('sandbox_whiteboard_action', { action: 'undo' }) } catch {} } }, [track])
  const handleRedo = useCallback(() => { try { editorRef.current?.redo?.() } finally { try { track('sandbox_whiteboard_action', { action: 'redo' }) } catch {} } }, [track])
  const handleZoomIn = useCallback(() => { try { editorRef.current?.zoomIn?.() } catch {} }, [])
  const handleZoomOut = useCallback(() => { try { editorRef.current?.zoomOut?.() } catch {} }, [])
  const handleZoomToFit = useCallback(() => { try { editorRef.current?.zoomToFit?.() } catch {} }, [])

  // Local autosave debounce (no backend required)
  useEffect(() => {
    if (!doc) return
    if (localSaveRef.current) window.clearTimeout(localSaveRef.current)
    localSaveRef.current = window.setTimeout(() => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(doc)) } catch {}
    }, 800)
    return () => { if (localSaveRef.current) { window.clearTimeout(localSaveRef.current); localSaveRef.current = null } }
  }, [doc, STORAGE_KEY])

  // Toolbar: Save/Restore/Reset handlers (local-only)
  const handleSaveNow = useCallback(() => {
    try {
      if (doc) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(doc))
        return true
      }
    } catch {}
    return false
  }, [doc, STORAGE_KEY])
  const handleRestore = useCallback(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        setDoc(parsed)
        try { editorRef.current?.store?.loadSnapshot?.({}) } catch {}
        return true
      }
    } catch {}
    return false
  }, [STORAGE_KEY])
  const handleReset = useCallback(() => {
    try { localStorage.removeItem(STORAGE_KEY) } catch {}
    const empty = { meta: { decision_id: decisionId, kind: 'sandbox' }, shapes: [], bindings: [] }
    setDoc(empty)
    try { editorRef.current?.store?.loadSnapshot?.({}) } catch {}
    return true
  }, [STORAGE_KEY, decisionId])

  // Expose imperative API to parent (combined route)
  useEffect(() => {
    if (!onAPIReady) return
    const setStyleOpen = (open: boolean) => {
      const el = rootRef.current
      if (!el) return
      el.setAttribute('data-dg-style-open', open ? 'true' : 'false')
    }
    const toggleStyle = () => {
      const el = rootRef.current
      if (!el) return
      const cur = el.getAttribute('data-dg-style-open') === 'true'
      el.setAttribute('data-dg-style-open', (!cur).toString())
    }
    const loadDoc = (next: any) => { try { setDoc(next); try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}; try { editorRef.current?.store?.loadSnapshot?.({}) } catch {}; return true } catch { return false } }
    onAPIReady({ saveNow: handleSaveNow, restore: handleRestore, reset: handleReset, setStyleOpen, toggleStyle, getRoot: () => rootRef.current, editor: editorRef.current, getDoc: () => doc, loadDoc, mapping: mappingRef.current })
  }, [onAPIReady, handleSaveNow, handleRestore, handleReset, doc])

  // Cleanup subscriptions and timers on unmount
  useEffect(() => {
    return () => {
      if (unsubRef.current) {
        try { unsubRef.current() } catch {}
        unsubRef.current = null
      }
      if (savingRef.current) {
        window.clearTimeout(savingRef.current)
        savingRef.current = null
      }
      if (mappingRef.current) {
        try { mappingRef.current.detach() } catch {}
        mappingRef.current = null
      }
    }
  }, [])

  // Keyboard shortcuts: duplicate selected node (Cmd/Ctrl+D) and cancel connect (Esc)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!flags.sandboxMapping) return
      if (e.key === 'Escape') {
        connectSourceRef.current = null
        setConnectActive(false)
        return
      }
      if ((e.key === 'd' || e.key === 'D') && (e.metaKey || e.ctrlKey)) {
        const api = graphApi
        if (!api?.selectedNodeId) return
        const src = api.graph.nodes[api.selectedNodeId]
        if (!src) return
        const id = `n_${Math.random().toString(36).slice(2, 8)}`
        const view = src.view || { x: 80, y: 80, w: 160, h: 80 }
        const dst = { ...src, id, title: src.title + ' Copy', view: { ...view, x: (view.x ?? 0) + 24, y: (view.y ?? 0) + 24 } }
        api.upsertNode(dst)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [flags.sandboxMapping, graphApi])

  // ESC to exit Focus Mode (independent of mapping)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        try {
          if (flags.sandboxWhatIf && overrides?.focusOnNodeId) {
            // Immediately flip the focus state for deterministic tests
            setFocusAttrOn(false)
            overrides.setFocusOn(null)
          }
        } catch {}
      }
    }
    // Capture phase so TLDraw or other handlers cannot swallow Esc first
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [flags.sandboxWhatIf, overrides?.focusOnNodeId])

  // Rebuild mapping from graph when it changes (nodes only)
  useEffect(() => {
    if (!flags.sandboxMapping) return
    if (!editorRef.current) return
    if (!graphApi?.graph) return
    try { mappingRef.current?.rebuildFromGraph(graphApi.graph) } catch {}
  }, [flags.sandboxMapping, graphApi?.graph])
  // Debounced score compute for per-node badges
  useEffect(() => {
    if (!flags.sandboxScore) return
    let g = graphApi?.graph || { schemaVersion: 1, nodes: {}, edges: {} }
    try {
      if (overrides && (overrides.hasOverrides)) {
        g = overrides.effectiveGraph(g)
      }
    } catch {}
    if (scoreTimerRef.current) window.clearTimeout(scoreTimerRef.current)
    scoreTimerRef.current = window.setTimeout(() => {
      try {
        const res = scoreGraph(g)
        setPerNodeScore(res.perNode || {})
      } catch {}
    }, 300) as unknown as number
    return () => { if (scoreTimerRef.current) { window.clearTimeout(scoreTimerRef.current); scoreTimerRef.current = null } }
  }, [flags.sandboxScore, graphApi?.graph, overrides?.version])

  const ui = useMemo(() => (
    <div ref={rootRef} data-dg-style-open="true" data-dg-focus={focusAttrOn ? 'on' : 'off'} data-dg-explain={explainHighlightNodeId ? 'true' : undefined} data-dg-explain-highlight={explainHighlightNodeId || undefined} className="relative w-full h-full overflow-hidden">
      {/* Toolbar: top-left; only when not embedded */}
      {!embedded && (
        <div className="pointer-events-auto absolute top-2 left-2 z-[1000] flex flex-wrap gap-1">
          <button aria-label="Select" title="Select (V)" data-testid="tb-select" className="px-2 py-1 text-xs rounded border bg-white/90 hover:bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" onClick={setTool('select')}>Select</button>
          <button aria-label="Rectangle" title="Rectangle (R)" data-testid="tb-rect" className="px-2 py-1 text-xs rounded border bg-white/90 hover:bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" onClick={setTool('geo')}>Rect</button>
          <button aria-label="Text" title="Text (T)" data-testid="tb-text" className="px-2 py-1 text-xs rounded border bg-white/90 hover:bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" onClick={setTool('text')}>Text</button>
          <button aria-label="Undo" title="Undo (⌘Z)" data-testid="tb-undo" className="px-2 py-1 text-xs rounded border bg-white/90 hover:bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" onClick={handleUndo}>Undo</button>
          <button aria-label="Redo" title="Redo (⇧⌘Z)" data-testid="tb-redo" className="px-2 py-1 text-xs rounded border bg-white/90 hover:bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" onClick={handleRedo}>Redo</button>
          <button aria-label="Zoom In" title="Zoom In" data-testid="tb-zoom-in" className="px-2 py-1 text-xs rounded border bg-white/90 hover:bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" onClick={handleZoomIn}>+</button>
          <button aria-label="Zoom Out" title="Zoom Out" data-testid="tb-zoom-out" className="px-2 py-1 text-xs rounded border bg-white/90 hover:bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" onClick={handleZoomOut}>−</button>
          <button aria-label="Zoom To Fit" title="Zoom to Fit" data-testid="tb-zoom-fit" className="px-2 py-1 text-xs rounded border bg-white/90 hover:bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" onClick={handleZoomToFit}>Fit</button>
          {flags.sandboxWhatIf && (
            <button
              aria-label="Focus Mode"
              title="Focus Mode"
              data-testid="pal-focus"
              aria-pressed={!!overrides?.focusOnNodeId}
              className={`px-2 py-1 text-xs rounded border focus:outline-none focus:ring-2 ${overrides?.focusOnNodeId ? 'bg-amber-600 text-white border-amber-600' : 'bg-white hover:bg-gray-50'}`}
              onClick={() => {
                try {
                  if (!overrides) return
                  if (overrides.focusOnNodeId) { overrides.setFocusOn(null); return }
                  const sel = graphApi?.selectedNodeId
                  if (sel) { overrides.setFocusOn(sel); return }
                  const first = graphApi?.graph ? Object.keys(graphApi.graph.nodes)[0] : null
                  if (first) overrides.setFocusOn(first)
                } catch {}
              }}
            >
              Focus
            </button>
          )}
        </div>
      )}
      {doc ? (
        <Tldraw persistenceKey={"sandbox-local"} onMount={handleMount} />
      ) : (
        <div className="w-full h-[70vh] flex items-center justify-center text-gray-600">Initializing canvas…</div>
      )}
      {/* What-If overlays */}
      {flags.sandboxWhatIf && (
        <>
          <WhatIfOverlay />
          <FocusOverlay />
        </>
      )}
      {/* Explain highlight overlay: non-blocking outline */}
      {explainHighlightNodeId && graphApi?.graph && (
        <div className="pointer-events-none absolute inset-0 z-[982]" data-dg-explain-overlay>
          {(() => {
            const n = graphApi.graph.nodes[explainHighlightNodeId]
            if (!n) return null
            const x = n.view?.x ?? 0
            const y = n.view?.y ?? 0
            const w = n.view?.w ?? 160
            const h = n.view?.h ?? 80
            return (
              <div data-testid="explain-highlight-ring" aria-hidden className="absolute rounded-sm ring-2 ring-indigo-400/80" style={{ left: x - 2, top: y - 2, width: w + 4, height: h + 4 }} />
            )
          })()}
        </div>
      )}
      {/* Per-node score badges overlay: non-blocking */}
      {flags.sandboxScore && graphApi?.graph && (
        <div className="pointer-events-none absolute inset-0 z-[999]" data-dg-score-overlay>
          {Object.values(graphApi.graph.nodes).map(n => {
            const v = perNodeScore[n.id] || 0
            if (!v) return null
            const x = (n.view?.x ?? 0) + (n.view?.w ?? 160) - 18
            const y = (n.view?.y ?? 0) + (n.view?.h ?? 80) - 14
            const txt = String(Math.max(-99, Math.min(99, Math.round(v))))
            const overridden = !!(overrides && (overrides.isNodeOverridden(n.id) || overrides.isNodeDisabled(n.id)))
            return (
              <span key={n.id} data-dg-score-node={n.id} className={`absolute text-[10px] px-1 py-0.5 rounded border bg-white/90 ${overridden ? 'ring-1 ring-amber-400' : ''}`} style={{ left: x, top: y }} title="Node score">{txt}</span>
            )
          })}
        </div>
      )}
      {!embedded && !hideBanner && (
        <div className="pointer-events-none absolute top-2 right-2 z-[1000] bg-white/80 text-xs text-gray-700 rounded px-2 py-1 shadow">
          Scenario Sandbox (MVP)
        </div>
      )}
      {/* Top-right actions: feedback (optional) */}
      {!embedded && !hideFeedback && (
        <div className="pointer-events-auto absolute top-2 right-28 z-[1000] flex gap-2">
          <a
            aria-label="Send feedback"
            title="Send feedback"
            data-testid="tb-feedback"
            className="px-2 py-1 text-xs rounded border bg-white/90 hover:bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            href={`mailto:?subject=${encodeURIComponent('Sandbox MVP Feedback')}&body=${encodeURIComponent(`decisionId=${decisionId}\nua=${navigator.userAgent}\n\nDescribe your feedback:`)}`}
          >
            Send feedback
          </a>
        </div>
      )}
      {!embedded && !hideBanner && localOnly && (
        <div className="pointer-events-none absolute top-2 left-2 z-[1000] bg-amber-50/90 text-amber-800 text-xs rounded px-2 py-1 border border-amber-200 shadow">
          Working locally — cloud sync unavailable
        </div>
      )}
    </div>
  ), [handleMount, localOnly, flags.sandboxScore, graphApi?.graph, perNodeScore, flags.sandboxPresence, authUser?.id, profile, flags.sandboxWhatIf, focusAttrOn, doc])

  return ui
}
