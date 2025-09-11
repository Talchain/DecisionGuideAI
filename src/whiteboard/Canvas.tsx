import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Tldraw } from '@/whiteboard/tldraw'
import { ensureCanvasForDecision, loadCanvasDoc, saveCanvasDoc } from './persistence'
import { loadSeed } from './seed'
import { writeProjection } from './projection'
import { useTelemetry } from '@/lib/useTelemetry'

interface CanvasProps {
  decisionId: string
  onReady?: (info: { canvasId: string }) => void
  persistDelayMs?: number
  persistOnlyWithTldraw?: boolean
  hideBanner?: boolean
  hideFeedback?: boolean
  embedded?: boolean
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
  }) => void
}

export const Canvas: React.FC<CanvasProps> = ({ decisionId, onReady, persistDelayMs = 500, persistOnlyWithTldraw = false, hideBanner = false, hideFeedback = false, embedded = false, onAPIReady }) => {
  const STORAGE_KEY = useMemo(() => `dgai:canvas:decision/${decisionId || 'demo'}`, [decisionId])
  const TIP_KEY = 'dgai:canvas:tip:dismissed'
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
  const [tipVisible, setTipVisible] = useState(() => {
    try { return localStorage.getItem(TIP_KEY) !== 'true' } catch { return false }
  })
  const savingRef = useRef<number | null>(null)
  const localSaveRef = useRef<number | null>(null)
  const editorRef = useRef<any | null>(null)
  const unsubRef = useRef<null | (() => void)>(null)
  const hydratedFromLocalRef = useRef<boolean>(!!doc)
  const rootRef = useRef<HTMLDivElement | null>(null)

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
    onAPIReady({ saveNow: handleSaveNow, restore: handleRestore, reset: handleReset, setStyleOpen, toggleStyle, getRoot: () => rootRef.current, editor: editorRef.current, getDoc: () => doc, loadDoc })
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
    }
  }, [])

  const ui = useMemo(() => (
    <div ref={rootRef} data-dg-style-open="true" className="relative w-full h-full overflow-hidden">
      {/* Toolbar: top-left; only when not embedded; non-blocking banners remain pointer-events-none */}
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
      </div>
      )}
      {!embedded && tipVisible && (
        <div data-testid="toolbar-tip" className="pointer-events-auto absolute top-12 left-2 z-[1000] max-w-xs text-xs bg-white shadow rounded border p-2">
          <div className="mb-1 text-gray-800">Draw (R), Text (T), Select/Move (V), Pan (Space-drag), Zoom (trackpad/Cmd+scroll), Undo (⌘Z).</div>
          <button className="mt-1 px-2 py-0.5 text-xs rounded border bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500" onClick={() => { try { localStorage.setItem(TIP_KEY, 'true') } catch {}; setTipVisible(false) }}>Got it</button>
        </div>
      )}
      {/* Top-right actions: feedback (optional) */}
      {!embedded && !hideFeedback && (
        <div className="pointer-events-auto absolute top-2 right-2 z-[1000] flex gap-2">
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
      <Tldraw persistenceKey={"sandbox-local"} onMount={handleMount} />
      {!embedded && !hideBanner && (
        <div className="pointer-events-none absolute top-2 right-2 z-[1000] bg-white/80 text-xs text-gray-700 rounded px-2 py-1 shadow">
          Scenario Sandbox (MVP)
        </div>
      )}
      {!embedded && !hideBanner && localOnly && (
        <div className="pointer-events-none absolute top-2 left-2 z-[1000] bg-amber-50/90 text-amber-800 text-xs rounded px-2 py-1 border border-amber-200 shadow">
          Working locally — cloud sync unavailable
        </div>
      )}
    </div>
  ), [handleMount, localOnly])

  if (!doc) {
    return (
      <div className="w-full h-[70vh] flex items-center justify-center text-gray-600">
        Initializing canvas…
      </div>
    )
  }

  return ui
}
