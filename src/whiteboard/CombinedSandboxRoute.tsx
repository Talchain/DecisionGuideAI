import React from 'react'
import { useParams } from 'react-router-dom'
import { useFlags } from '@/lib/flags'
import { useTelemetry } from '@/lib/useTelemetry'
import { ScenarioPanels } from '@/sandbox/panels/ScenarioPanels'
import { Canvas } from '@/whiteboard/Canvas'
import { ScorePill } from '@/whiteboard/ScorePill'
import { ExplainDeltaPanel } from '@/whiteboard/ExplainDeltaPanel'
import { GraphProvider, useGraph } from '@/sandbox/state/graphStore'
import { OverridesProvider, useOverrides } from '@/sandbox/state/overridesStore'
import CompareView from '@/whiteboard/CompareView'
import { useToast } from '@/components/ui/use-toast'
import { normalizeGraph, serializeGraph, countEntities, validateAndNormalizeImport } from '@/sandbox/state/graphIO'
import { templates, type Template } from '@/sandbox/templates'
import { useDecision } from '@/contexts/DecisionContext'

const MIN_W = 240
const MAX_W = 560
const MIN_CANVAS_W_DESKTOP = 480
const MIN_CANVAS_W_MOBILE = 320

const keyW = (id: string) => `dgai:combined:${id}:panel_w`
const keyCollapsed = (id: string) => `dgai:combined:${id}:panel_collapsed`
const keyStyle = (id: string) => `dgai:combined:${id}:style_open`
const keyTab = (id: string) => `dgai:combined:${id}:active_tab`

type Tab = 'panels' | 'canvas'

export const CombinedSandboxRoute: React.FC = () => {
  const { decisionId = 'demo' } = useParams<{ decisionId: string }>()
  const flags = useFlags()
  const { track } = useTelemetry()
  const { toast } = useToast()
  const { decision: decisionTitle } = (() => {
    try { return useDecision() } catch { return { decision: null as string | null } as any }
  })()

  // Gate: require sandbox flag; canvas mounts regardless (Canvas has its own local-first fallback).
  if (!flags.sandbox) {
    return <div className="p-8 text-center text-sm text-gray-700">Scenario Sandbox is not enabled.</div>
  }

  function RestoreUndoButton({ snapId, onDone }: { snapId: string; onDone: () => void }) {
    const api = useGraph()
    return (
      <button className="px-2 py-0.5 rounded border bg-white hover:bg-gray-50" onClick={() => { try { api.restoreSnapshot(snapId) } finally { onDone() } }}>Undo</button>
    )
  }

  function DeleteUndoButton({ onDone }: { onDone: () => void }) {
    const api = useGraph()
    return (
      <button className="px-2 py-0.5 rounded border bg-white hover:bg-gray-50" onClick={() => { const r = api.undoDeleteSnapshot(); if ((r as any)?.ok) { setAnnounce(`Restored deleted snapshot ${lastDeletedNameRef.current}.`)}; onDone() }}>Undo</button>
    )
  }

  const isMobile = typeof window !== 'undefined' ? window.innerWidth < 1024 : false
  const clampWithViewport = (w: number) => {
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1280
    const minCanvas = isMobile ? MIN_CANVAS_W_MOBILE : MIN_CANVAS_W_DESKTOP
    const maxAllowed = Math.max(MIN_W, Math.min(MAX_W, vw - minCanvas))
    return Math.max(MIN_W, Math.min(maxAllowed, w))
  }
  const [panelW, setPanelW] = React.useState<number>(() => {
    try {
      const raw = Number(localStorage.getItem(keyW(decisionId)))
      const base = Number.isFinite(raw) && raw > 0 ? raw : 320
      return clampWithViewport(base)
    } catch { return 320 }
  })
  const [dragging, setDragging] = React.useState(false)
  const [collapsed, setCollapsed] = React.useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(keyCollapsed(decisionId))
      if (raw === 'true') return true
      if (raw === 'false') return false
    } catch {}
    return isMobile
  })
  const [styleOpen, setStyleOpen] = React.useState<boolean>(() => {
    try { return localStorage.getItem(keyStyle(decisionId)) === 'true' } catch { return false }
  })
  const [liveText, setLiveText] = React.useState<string>("")
  const asideRef = React.useRef<HTMLElement | null>(null)
  const sessionIdRef = React.useRef<string>(Math.random().toString(36).slice(2))
  const baseMeta = () => ({ decisionId, route: 'combined', viewport: { w: (typeof window !== 'undefined' ? window.innerWidth : 0), h: (typeof window !== 'undefined' ? window.innerHeight : 0) }, sessionId: sessionIdRef.current })

  // Snapshot & Compare state (UI-only)
  const [snapMenuOpen, setSnapMenuOpen] = React.useState(false)
  const [compareOpen, setCompareOpen] = React.useState(false)
  const [leftSource, setLeftSource] = React.useState<string>('current')
  const [rightSource, setRightSource] = React.useState<string>('current')
  const [announce, setAnnounce] = React.useState<string>('')
  // Explain Δ panel state
  const [explainOpen, setExplainOpen] = React.useState(false)
  const [explainHighlight, setExplainHighlight] = React.useState<string | null>(null)
  const lastRestoreBackupRef = React.useRef<string | null>(null)
  const [showRestoreUndo, setShowRestoreUndo] = React.useState(false)
  const [showDeleteUndo, setShowDeleteUndo] = React.useState(false)
  const lastDeletedNameRef = React.useRef<string>('')
  // header subcomponents live inside GraphProvider to use hooks safely

  function HeaderSnapshotControls() {
    const graphApi = useGraph()
    return (
      <>
        {flags.sandboxCompare && (
          <div className="relative inline-flex items-center gap-2">
            <button
              className="px-2 py-1 text-xs rounded border bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              onClick={() => {
                try {
                  const name = window.prompt('Snapshot name?', 'Snapshot') || 'Snapshot'
                  graphApi.saveSnapshot(name)
                  toast({ title: `Snapshot saved`, description: name })
                } catch {}
              }}
            >Save Snapshot</button>
            <div className="inline-flex">
              <button
                className="px-2 py-1 text-xs rounded border bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                onClick={() => setSnapMenuOpen(v => !v)}
                aria-expanded={snapMenuOpen}
                aria-controls="snapshots-menu"
              >Snapshots ▾</button>
            </div>
            <button
              className="px-2 py-1 text-xs rounded border bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              onClick={() => {
                setCompareOpen(true)
                setAnnounce('Compare chooser opened')
              }}
            >Compare</button>
            {snapMenuOpen && (
              <div id="snapshots-menu" className="absolute right-0 top-[110%] z-30 min-w-[280px] max-h-64 overflow-auto rounded border bg-white shadow">
                <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-gray-500 border-b">Snapshots</div>
                <ul className="divide-y">
                  {(graphApi.listSnapshots() || []).map(s => (
                    <li key={s.id} className="px-2 py-1 text-xs flex items-center gap-2">
                      <span className="flex-1 truncate" title={s.id}>{s.name}</span>
                      <button aria-label={`Restore snapshot ${s.name}`} className="px-1 py-0.5 border rounded bg-white hover:bg-gray-50" onClick={() => {
                        try {
                          const backup = graphApi.saveSnapshot('Pre-restore')
                          lastRestoreBackupRef.current = backup?.snapId || null
                          const ok = graphApi.restoreSnapshot(s.id)
                          if ((ok as any)?.ok) {
                            setShowRestoreUndo(true)
                            setTimeout(() => setShowRestoreUndo(false), 10000)
                            toast({ title: `Restored ${s.name}` })
                            setAnnounce(`Restored ${s.name}. Undo available for 10 seconds.`)
                          }
                        } catch {}
                      }}>Restore</button>
                      <button aria-label={`Duplicate snapshot ${s.name}`} className="px-1 py-0.5 border rounded bg-white hover:bg-gray-50" onClick={() => {
                        const res = graphApi.duplicateSnapshot(s.id)
                        if ((res as any)?.snapId) {
                          toast({ title: `Duplicated ${s.name}` })
                          setSnapMenuOpen(true)
                        }
                      }}>Duplicate</button>
                      <button aria-label={`Rename snapshot ${s.name}`} className="px-1 py-0.5 border rounded bg-white hover:bg-gray-50" onClick={() => {
                        const name = window.prompt('Rename to:', s.name)
                        if (!name) return
                        graphApi.renameSnapshot(s.id, name)
                        setSnapMenuOpen(true)
                      }}>Rename</button>
                      <button aria-label={`Delete snapshot ${s.name}`} className="px-1 py-0.5 border rounded bg-white hover:bg-gray-50" onClick={() => {
                        const ok = graphApi.deleteSnapshot(s.id)
                        if ((ok as any)?.ok) {
                          toast({ title: `Deleted ${s.name}` })
                          lastDeletedNameRef.current = s.name
                          setShowDeleteUndo(true)
                          setAnnounce(`Deleted ${s.name}. Undo available for 10 seconds.`)
                        }
                      }}>Delete</button>
                    </li>
                  ))}
                  {((graphApi.listSnapshots() || []).length === 0) && (
                    <li className="px-2 py-2 text-xs text-gray-500">No snapshots</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}
      </>
    )
  }

  const onMouseDownDivider = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault(); setDragging(true)
  }, [])
  const dragStartWRef = React.useRef<number>(panelW)
  const dragStartTsRef = React.useRef<number>(0)
  const lastEmitRef = React.useRef<number>(0)
  const rafRef = React.useRef<number>(0)
  const pendingWRef = React.useRef<number | null>(null)
  React.useEffect(() => {
    if (!dragging) return
    dragStartWRef.current = panelW
    dragStartTsRef.current = Date.now()
    const onMove = (e: MouseEvent) => {
      const raw = e.clientX - 24
      const next = clampWithViewport(raw)
      pendingWRef.current = next
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(() => {
          if (pendingWRef.current != null) setPanelW(pendingWRef.current)
          rafRef.current = 0
        })
      }
      const now = Date.now()
      if (now - lastEmitRef.current >= 1000) {
        lastEmitRef.current = now
        try { track('sandbox_panel_resize', { ...baseMeta(), width: next, delta: next - dragStartWRef.current, durationMs: now - dragStartTsRef.current }) } catch {}
      }
    }
    const onUp = () => {
      setDragging(false)
      const now = Date.now()
      const finalW = pendingWRef.current ?? panelW
      if (pendingWRef.current != null) setPanelW(finalW)
      setLiveText(`Panel width ${Math.round(finalW)}px`)
      try { track('sandbox_panel_resize', { ...baseMeta(), width: finalW, delta: finalW - dragStartWRef.current, durationMs: now - dragStartTsRef.current }) } catch {}
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0 }
      pendingWRef.current = null
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [dragging, panelW])
  React.useEffect(() => { try { localStorage.setItem(keyW(decisionId), String(panelW)) } catch {} }, [panelW, decisionId])

  // Responsive tabs for <1024px, keep both mounted
  const [active, setActive] = React.useState<Tab>(() => {
    try { return (localStorage.getItem(keyTab(decisionId)) as Tab) || (isMobile ? 'canvas' : 'canvas') } catch { return isMobile ? 'canvas' : 'canvas' }
  })
  const onTab = (tab: Tab) => {
    setActive(tab)
    try { localStorage.setItem(keyTab(decisionId), tab) } catch {}
    // Emit name-only telemetry for tab switch; map Panels to 'intelligence' for now
    try { track('sandbox_panel_view', { ...baseMeta(), panel: tab === 'panels' ? 'intelligence' : 'canvas' }) } catch {}
  }

  // Apply inert/focus-removal when collapsed
  React.useEffect(() => {
    const el = asideRef.current
    if (!el) return
    if (collapsed) {
      try { el.setAttribute('inert', '') } catch {}
      const focusables = el.querySelectorAll<HTMLElement>('a,button,input,textarea,select,[tabindex]')
      focusables.forEach(n => {
        if (!n.hasAttribute('data-prev-tabindex')) {
          const prev = n.getAttribute('tabindex')
          if (prev !== null) n.setAttribute('data-prev-tabindex', prev)
        }
        n.setAttribute('tabindex', '-1')
      })
    } else {
      try { el.removeAttribute('inert') } catch {}
      const toRestore = el.querySelectorAll<HTMLElement>('[data-prev-tabindex]')
      toRestore.forEach(n => {
        const prev = n.getAttribute('data-prev-tabindex')
        if (prev === null) n.removeAttribute('tabindex')
        else n.setAttribute('tabindex', prev)
        n.removeAttribute('data-prev-tabindex')
      })
    }
  }, [collapsed])

  // Stop TLDraw hotkeys when typing in panels
  const stopCanvasHotkeys: React.KeyboardEventHandler = (e) => {
    const keys = ['v','r','t','z','y',' ']
    const target = e.target as HTMLElement
    if (['INPUT','TEXTAREA'].includes(target.tagName)) {
      const k = e.key.toLowerCase()
      if (keys.includes(k)) {
        // Allow browser undo/redo inside inputs
        if ((e.metaKey || e.ctrlKey) && (k === 'z' || k === 'y')) return
        e.stopPropagation()
      }
    }
  }

  // Helpers
  const isTextInput = (el: EventTarget | null) => {
    const t = el as HTMLElement | null
    if (!t) return false
    const tag = t.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
    if ((t as any).isContentEditable) return true
    const role = t.getAttribute('role')
    if (role === 'combobox' || role === 'textbox') return true
    return false
  }

  // Panel toggle via header button and Alt+P
  const togglePanels = React.useCallback(() => {
    setCollapsed(prev => {
      const next = !prev
      try { localStorage.setItem(keyCollapsed(decisionId), String(next)) } catch {}
      try { track('sandbox_panel_toggle', { ...baseMeta(), collapsed: next }) } catch {}
      // On mobile, ensure Panels become visible when opening
      if (next === false && isMobile) setActive('panels')
      return next
    })
  }, [isMobile, track, decisionId])

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && (e.key.toLowerCase() === 'p')) {
        if (isTextInput(e.target)) return
        e.preventDefault(); togglePanels()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [togglePanels])

  // Canvas API for actions and style toggle
  const apiRef = React.useRef<null | {
    saveNow: () => boolean
    restore: () => boolean
    reset: () => boolean
    setStyleOpen: (open: boolean) => void
    toggleStyle: () => void
    getRoot: () => HTMLElement | null
    editor: any | null
    getDoc: () => any
    loadDoc: (next: any) => boolean
  }>(null)

  const onCanvasAPI = React.useCallback((api: any) => {
    apiRef.current = api
    // Default: style panel collapsed per state
    try { api.setStyleOpen(styleOpen) } catch {}
  }, [styleOpen])

  function HeaderIOControls() {
    const graphApi = useGraph()
    const importInputRef = React.useRef<HTMLInputElement | null>(null)
    const handleExportJSON = React.useCallback(() => {
      try {
        const payload = serializeGraph(decisionId, graphApi.getGraph())
        const { nodeCount, edgeCount } = countEntities(payload.graph)
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `decision-${decisionId}-graph.json`
        document.body.appendChild(a); a.click(); document.body.removeChild(a)
        URL.revokeObjectURL(url)
        try { track('sandbox_io_export', { ...baseMeta(), nodeCount, edgeCount }) } catch {}
        setAnnounce(`Exported ${nodeCount} nodes, ${edgeCount} links.`)
      } catch {}
    }, [graphApi])
    const doImportPayload = React.useCallback((rawText: string) => {
      try {
        const { graph: g, counts } = validateAndNormalizeImport(rawText)
        const { nodeCount, edgeCount } = counts
        // Snapshot backup for Undo
        try {
          const backup = graphApi.saveSnapshot('Pre-import')
          lastRestoreBackupRef.current = backup?.snapId || null
          setShowRestoreUndo(true)
          window.setTimeout(() => setShowRestoreUndo(false), 10000)
        } catch {}
        // Replace storage and reload graph
        try { localStorage.setItem(`dgai:graph:decision:${decisionId}`, JSON.stringify(g)) } catch {}
        graphApi.reloadFromStorage()
        setAnnounce(`Imported ${nodeCount} nodes, ${edgeCount} links.`)
        toast({ title: `Imported ${nodeCount} nodes, ${edgeCount} links` })
        try { track('sandbox_io_import', { ...baseMeta(), nodeCount, edgeCount }) } catch {}
      } catch (e) {
        const reason = (e as any)?.reason || 'unknown'
        try { track('sandbox_io_import', { ...baseMeta(), error: true, reason }) } catch {}
        toast({ title: 'Failed to import JSON', description: (e as any)?.message || String(reason), type: 'destructive' })
      }
    }, [graphApi])
    return (
      <div className="inline-flex items-center gap-2" data-dg-io>
        <button data-testid="io-export-btn" className="px-2 py-1 text-xs rounded border bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500" onClick={handleExportJSON}>Export JSON</button>
        <button data-testid="io-import-btn" className="px-2 py-1 text-xs rounded border bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500" onClick={() => importInputRef.current?.click()}>Import JSON</button>
        <input data-testid="io-import-input" ref={importInputRef} type="file" accept="application/json" className="hidden" onChange={async (e) => {
          const f = e.currentTarget.files?.[0]
          if (!f) return
          // pre-validate size (2MB)
          if (f.size > 2 * 1024 * 1024) { toast({ title: 'File too large (limit 2MB)', type: 'destructive' }); try { track('sandbox_io_import', { ...baseMeta(), error: true, reason: 'too_large' }) } catch {}; e.currentTarget.value = ''; return }
          const txt = await f.text()
          doImportPayload(txt)
          e.currentTarget.value = ''
        }} />
      </div>
    )
  }

  function HeaderTemplatesControls() {
    const graphApi = useGraph()
    const [open, setOpen] = React.useState(false)
    return (
      <div className="relative inline-flex" data-dg-template>
        <button className="px-2 py-1 text-xs rounded border bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500" onClick={() => setOpen(v => !v)} aria-expanded={open} aria-controls="templates-menu">Templates ▾</button>
        {open && (
          <div id="templates-menu" className="absolute right-0 top-[110%] z-30 min-w-[240px] rounded border bg-white shadow">
            <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-gray-500 border-b">Quickstart</div>
            <ul>
              {templates.map((t: Template) => (
                <li key={t.id}>
                  <button className="w-full text-left px-2 py-1 text-xs hover:bg-gray-50" title={t.title} onClick={() => {
                    try {
                      const g = normalizeGraph({ graph: t.graph })
                      const { nodeCount, edgeCount } = countEntities(g)
                      // backup
                      const backup = graphApi.saveSnapshot(`Pre-template ${t.id}`)
                      lastRestoreBackupRef.current = backup?.snapId || null
                      setShowRestoreUndo(true); window.setTimeout(() => setShowRestoreUndo(false), 10000)
                      // apply
                      localStorage.setItem(`dgai:graph:decision:${decisionId}`, JSON.stringify(g))
                      graphApi.reloadFromStorage()
                      setAnnounce(`Applied template ${t.title} with ${nodeCount} nodes, ${edgeCount} links.`)
                      toast({ title: `Template applied`, description: `${t.title} (${nodeCount} nodes, ${edgeCount} links)` })
                      try { track('sandbox_template_apply', { ...baseMeta(), templateId: t.id, nodeCount, edgeCount }) } catch {}
                    } catch (e) {
                      toast({ title: 'Failed to apply template', type: 'destructive' })
                    } finally {
                      setOpen(false)
                    }
                  }}>{t.title}</button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )
  }

  const exportSnapshot = React.useCallback(() => {
    try {
      const data = apiRef.current?.getDoc?.() || {}
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `canvas-${decisionId}.json`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      try { track('sandbox_canvas_error', { ...baseMeta(), op: 'export', message: (e as any)?.message }) } catch {}
    }
  }, [decisionId])

  const handleSave = React.useCallback(() => {
    try {
      const ok = apiRef.current?.saveNow?.()
      if (ok) { toast({ title: 'Canvas saved' }); track('sandbox_canvas_save', baseMeta()) }
      else {
        toast({ title: 'Unable to save locally. Storage may be blocked or full.', type: 'destructive' })
        if (window.confirm('Local save failed. Export JSON now?')) exportSnapshot()
        track('sandbox_canvas_error', { ...baseMeta(), op: 'save' })
      }
    } catch (e) {
      toast({ title: 'Failed to save', type: 'destructive' }); try { track('sandbox_canvas_error', { ...baseMeta(), op: 'save', message: (e as any)?.message }) } catch {}
    }
  }, [toast])
  const handleRestore = React.useCallback(() => {
    try {
      const ok = apiRef.current?.restore?.()
      if (ok) { toast({ title: 'Canvas restored' }); track('sandbox_canvas_restore', baseMeta()) }
      else { toast({ title: 'Nothing to restore', type: 'destructive' }); track('sandbox_canvas_error', { ...baseMeta(), op: 'restore', message: 'empty' }) }
    } catch (e) {
      toast({ title: 'Failed to restore', type: 'destructive' }); try { track('sandbox_canvas_error', { ...baseMeta(), op: 'restore', message: (e as any)?.message }) } catch {}
    }
  }, [toast])
  const preResetRef = React.useRef<any | null>(null)
  const undoTimerRef = React.useRef<number | null>(null)
  const [showUndoBanner, setShowUndoBanner] = React.useState(false)
  const handleReset = React.useCallback(() => {
    try {
      const confirm = window.prompt('Type RESET to confirm')
      if (confirm !== 'RESET') return
      preResetRef.current = apiRef.current?.getDoc?.()
      const ok = apiRef.current?.reset?.()
      if (ok) {
        setShowUndoBanner(true)
        if (undoTimerRef.current) { clearTimeout(undoTimerRef.current); undoTimerRef.current = null }
        undoTimerRef.current = window.setTimeout(() => { preResetRef.current = null; undoTimerRef.current = null; setShowUndoBanner(false) }, 10000)
        track('sandbox_canvas_reset', baseMeta())
      } else {
        toast({ title: 'Failed to reset', type: 'destructive' }); track('sandbox_canvas_error', { ...baseMeta(), op: 'reset' })
      }
    } catch (e) {
      toast({ title: 'Failed to reset', type: 'destructive' }); try { track('sandbox_canvas_error', { ...baseMeta(), op: 'reset', message: (e as any)?.message }) } catch {}
    }
  }, [toast])
  const handleStyleToggle = React.useCallback(() => {
    const next = !styleOpen
    setStyleOpen(next)
    try { localStorage.setItem(keyStyle(decisionId), String(next)) } catch {}
    try { track('sandbox_style_toggle', { ...baseMeta(), open: next }) } catch {}
    try { apiRef.current?.setStyleOpen(next) } catch {}
  }, [styleOpen])

  const body = (
    <div className="w-full h-[75vh] bg-white border rounded shadow-sm overflow-hidden flex flex-col">
      {/* Fallback CSS for TL style panel */}
      <style>{`[data-dg-style-open="false"] .tlui-style-panel{ display:none !important; }`}</style>
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b px-3 py-2 flex items-center gap-3">
        <div className="text-sm font-medium truncate">{decisionTitle || `Decision ${decisionId}`}</div>
        <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border">Panels + Canvas</span>
        {/* Focus chip */}
        {flags.sandboxWhatIf && (
          <FocusChip />
        )}
        <div className="ml-auto flex items-center gap-2">
          {/* Panels toggle (desktop & mobile) */}
          <button
            aria-label={collapsed ? 'Show panels' : 'Hide panels'}
            aria-pressed={!collapsed}
            aria-controls="panels-region"
            aria-expanded={!collapsed}
            className="px-2 py-1 text-xs rounded border bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            onClick={() => togglePanels()}
          >
            {collapsed ? 'Show panels' : 'Hide panels'}
          </button>
          {/* Mobile tabs */}
          <div className="lg:hidden inline-flex items-center gap-1 border rounded overflow-hidden" role="tablist" aria-label="Sandbox view">
            <button role="tab" aria-selected={active==='panels'} className={`px-2 py-1 text-xs ${active==='panels' ? 'bg-indigo-600 text-white' : 'bg-white'}`} onClick={() => onTab('panels')}>Panels</button>
            <button role="tab" aria-selected={active==='canvas'} className={`px-2 py-1 text-xs ${active==='canvas' ? 'bg-indigo-600 text-white' : 'bg-white'}`} onClick={() => onTab('canvas')}>Canvas</button>
          </div>
          {flags.sandboxScore && (
            <ScorePill decisionId={decisionId} onExplain={() => {
              if (!flags.sandboxExplain) return
              setExplainOpen(true)
              try { track('sandbox_score_explain_open', baseMeta()) } catch {}
            }} />
          )}
          {/* Style toggle */}
          <button
            aria-label="Toggle style panel"
            aria-pressed={styleOpen}
            className="px-2 py-1 text-xs rounded border bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            onClick={handleStyleToggle}
          >
            Style
          </button>
          {/* Save/Restore/Reset actions */}
          <button className="px-2 py-1 text-xs rounded border bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500" onClick={handleSave}>Save</button>
          <button className="px-2 py-1 text-xs rounded border bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500" onClick={handleRestore}>Restore</button>
          <button className="px-2 py-1 text-xs rounded border bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500" onClick={handleReset}>Reset</button>
          <a
            aria-label="Send feedback"
            title="Send feedback"
            className="hidden lg:inline-block px-2 py-1 text-xs rounded border bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            href={`mailto:?subject=${encodeURIComponent('Sandbox MVP Feedback')}&body=${encodeURIComponent(`decisionId=${decisionId}\nua=${navigator.userAgent}\n\nDescribe your feedback:`)}`}
          >
            Send feedback
          </a>
          {/* IO (Export / Import JSON) */}
          {flags.sandboxIO && <HeaderIOControls />}
          {/* Templates */}
          {flags.sandboxTemplates && <HeaderTemplatesControls />}
          {flags.sandboxCompare && <HeaderSnapshotControls />}
        </div>
      </div>

      {/* Body */}
      <div
        className={`grid h-full w-full ${collapsed ? 'grid-cols-[0px_0px_1fr] lg:grid-cols-[0px_0px_1fr]' : 'grid-cols-[minmax(240px,420px)_8px_1fr] lg:grid-cols-[minmax(var(--panel-w,320px),560px)_8px_1fr]'}`}
        style={{ '--panel-w': `${panelW}px` } as React.CSSProperties}
      >
        {/* Panels */}
        <aside ref={asideRef} id="panels-region" className={`h-full border-r overflow-y-auto ${isMobile && active !== 'panels' ? 'hidden' : ''} ${collapsed ? 'hidden' : ''}`} onKeyDownCapture={stopCanvasHotkeys} aria-hidden={collapsed ? true : undefined}>
          <ScenarioPanels decisionId={decisionId} />
        </aside>

        {/* Divider column (desktop only) */}
        <div className={`hidden lg:block relative ${collapsed ? 'hidden' : ''}`} aria-hidden>
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize panels"
            aria-controls="panels-region"
            tabIndex={0}
            aria-valuemin={240}
            aria-valuemax={560}
            aria-valuenow={Math.round(panelW)}
            className="absolute inset-y-0 left-0 right-0 cursor-col-resize"
            onMouseDown={onMouseDownDivider}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                e.preventDefault()
                const delta = e.key === 'ArrowRight' ? 16 : -16
                const next = clampWithViewport(panelW + delta)
                setPanelW(next)
              }
            }}
            onKeyUp={(e) => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') setLiveText(`Panel width ${Math.round(panelW)}px`) }}
          />
        </div>

        {/* Canvas or Compare */}
        <section className={`relative h-full overflow-hidden p-4 pr-2 md:pr-4 ${isMobile && active !== 'canvas' ? 'hidden' : ''}`}>
          <div className="relative w-full h-full">
            {!compareOpen && (
              <Canvas decisionId={decisionId} hideBanner hideFeedback embedded onAPIReady={onCanvasAPI} explainHighlightNodeId={explainHighlight} />
            )}
            {compareOpen && flags.sandboxCompare && (
              <CompareView
                decisionId={decisionId}
                left={leftSource}
                right={rightSource}
                onClose={() => { setCompareOpen(false); try { track('sandbox_compare_close', { ...baseMeta(), leftId: leftSource, rightId: rightSource }) } catch {} }}
                onOpened={() => { try { track('sandbox_compare_open', { ...baseMeta(), leftId: leftSource, rightId: rightSource }) } catch {}; setAnnounce(`Compare opened: ${leftSource} vs ${rightSource}`) }}
                onPick={(l: string, r: string) => { setLeftSource(l); setRightSource(r) }}
              />
            )}
          </div>
        </section>
      </div>

      {/* Undo Reset banner (interactive) */}
      {showUndoBanner && (
        <div className="absolute top-[56px] left-1/2 -translate-x-1/2 z-30 pointer-events-auto">
          <div className="rounded border bg-white shadow px-3 py-2 text-xs flex items-center gap-3">
            <span>Canvas reset. Undo?</span>
            <button className="px-2 py-0.5 rounded border bg-white hover:bg-gray-50" onClick={() => { try { if (preResetRef.current) apiRef.current?.loadDoc?.(preResetRef.current) } finally { setShowUndoBanner(false); if (undoTimerRef.current) { clearTimeout(undoTimerRef.current); undoTimerRef.current = null } } }}>Undo</button>
            <button className="px-2 py-0.5 rounded border bg-white hover:bg-gray-50" onClick={() => { setShowUndoBanner(false); if (undoTimerRef.current) { clearTimeout(undoTimerRef.current); undoTimerRef.current = null } }}>Dismiss</button>
          </div>
        </div>
      )}

      {/* Peek handle when collapsed (desktop) */}
      {(!isMobile && collapsed) && (
        <button
          title="Show panels (⌥P)"
          aria-label="Show panels"
          className="absolute left-0 top-[64px] h-24 w-5 bg-white/80 border-r rounded-r shadow flex items-center justify-center text-[10px]"
          onClick={() => togglePanels()}
        >
          ▶
        </button>
      )}

      {/* ARIA live announcer for width */}
      <div className="sr-only" aria-live="polite">{liveText}</div>
      {/* ARIA live announcer for snapshot/compare */}
      <div className="sr-only" aria-live="polite">{announce}</div>
      {/* Explain Δ Panel (UI-only) */}
      {flags.sandboxExplain && explainOpen && (
        <ExplainDeltaPanel
          decisionId={decisionId}
          onClose={() => { setExplainOpen(false); try { track('sandbox_score_explain_close', baseMeta()) } catch {} }}
          onHighlight={(id) => {
            setExplainHighlight(id)
            window.setTimeout(() => setExplainHighlight(null), 1200)
          }}
        />
      )}
      {showRestoreUndo && lastRestoreBackupRef.current && (
        <div className="absolute top-[56px] left-1/2 -translate-x-1/2 z-30 pointer-events-auto">
          <div className="rounded border bg-white shadow px-3 py-2 text-xs flex items-center gap-3">
            <span>Restored. Undo?</span>
            {lastRestoreBackupRef.current && (
              <RestoreUndoButton snapId={lastRestoreBackupRef.current} onDone={() => setShowRestoreUndo(false)} />
            )}
            <button className="px-2 py-0.5 rounded border bg-white hover:bg-gray-50" onClick={() => setShowRestoreUndo(false)}>Dismiss</button>
          </div>
        </div>
      )}
      {showDeleteUndo && (
        <div className="absolute top-[96px] left-1/2 -translate-x-1/2 z-30 pointer-events-auto">
          <div className="rounded border bg-white shadow px-3 py-2 text-xs flex items-center gap-3">
            <span>Deleted {lastDeletedNameRef.current}. Undo?</span>
            <DeleteUndoButton onDone={() => setShowDeleteUndo(false)} />
            <button className="px-2 py-0.5 rounded border bg-white hover:bg-gray-50" onClick={() => setShowDeleteUndo(false)}>Dismiss</button>
          </div>
        </div>
      )}
    </div>
  )

  if (flags.sandboxMapping || flags.sandboxCompare || flags.sandboxScore || flags.sandboxWhatIf) {
    return (
      <GraphProvider decisionId={decisionId}>
        {flags.sandboxWhatIf ? (
          <OverridesProvider decisionId={decisionId}>{body}</OverridesProvider>
        ) : body}
      </GraphProvider>
    )
  }
  return body
}

export default CombinedSandboxRoute

// Focus header chip + ESC behavior and selection sync
function FocusChip() {
  const flags = useFlags()
  const { selectedNodeId, graph } = useGraph()
  const { focusOnNodeId, setFocusOn } = useOverrides()
  const name = focusOnNodeId ? (graph.nodes[focusOnNodeId]?.title || focusOnNodeId) : ''
  // Sync on selection changes when active
  React.useEffect(() => {
    if (!flags.sandboxWhatIf) return
    if (!focusOnNodeId) return
    if (selectedNodeId && selectedNodeId !== focusOnNodeId) setFocusOn(selectedNodeId)
  }, [flags.sandboxWhatIf, selectedNodeId, focusOnNodeId, setFocusOn])
  // ESC to exit focus
  React.useEffect(() => {
    if (!flags.sandboxWhatIf) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && focusOnNodeId) {
        setFocusOn(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [flags.sandboxWhatIf, focusOnNodeId, setFocusOn])
  if (!flags.sandboxWhatIf || !focusOnNodeId) return null
  return (
    <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border" title="Focus Mode active">Focus: {name} (Esc to exit)</span>
  )
}
