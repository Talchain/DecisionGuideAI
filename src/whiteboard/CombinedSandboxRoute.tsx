import React from 'react'
import { useParams } from 'react-router-dom'
import { useFlags } from '@/lib/flags'
import { useTelemetry } from '@/lib/useTelemetry'
import { ScenarioPanels } from '@/sandbox/panels/ScenarioPanels'
import { Canvas } from '@/whiteboard/Canvas'

const PANEL_KEY = 'dgai:combined:panel_w'

type Tab = 'panels' | 'canvas'

export const CombinedSandboxRoute: React.FC = () => {
  const { decisionId = 'demo' } = useParams<{ decisionId: string }>()
  const flags = useFlags()
  const { track } = useTelemetry()

  // Gate: require sandbox flag; canvas mounts regardless (Canvas has its own local-first fallback).
  if (!flags.sandbox) {
    return <div className="p-8 text-center text-sm text-gray-700">Scenario Sandbox is not enabled.</div>
  }

  const [panelW, setPanelW] = React.useState<number>(() => {
    try { return Math.min(560, Math.max(320, Number(localStorage.getItem(PANEL_KEY)) || 360)) } catch { return 360 }
  })
  const [dragging, setDragging] = React.useState(false)

  const onMouseDownDivider = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault(); setDragging(true)
  }, [])
  React.useEffect(() => {
    if (!dragging) return
    const onMove = (e: MouseEvent) => {
      const next = Math.min(560, Math.max(320, e.clientX - 24))
      setPanelW(next)
    }
    const onUp = () => setDragging(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [dragging])
  React.useEffect(() => { try { localStorage.setItem(PANEL_KEY, String(panelW)) } catch {} }, [panelW])

  // Responsive tabs for <1024px, keep both mounted
  const [active, setActive] = React.useState<Tab>('canvas')
  const isMobile = typeof window !== 'undefined' ? window.innerWidth < 1024 : false
  const onTab = (tab: Tab) => {
    setActive(tab)
    // Emit name-only telemetry for tab switch; map Panels to 'intelligence' for now
    try { track('sandbox_panel_view', { panel: tab === 'panels' ? 'intelligence' : 'canvas' }) } catch {}
  }

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

  return (
    <div className="w-full h-[75vh] bg-white border rounded shadow-sm overflow-hidden flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b px-3 py-2 flex items-center gap-3">
        <div className="text-sm font-medium truncate">Decision {decisionId}</div>
        <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border">Panels + Canvas</span>
        <div className="ml-auto flex items-center gap-2">
          {/* Mobile tabs */}
          <div className="lg:hidden inline-flex items-center gap-1 border rounded overflow-hidden" role="tablist" aria-label="Sandbox view">
            <button role="tab" aria-selected={active==='panels'} className={`px-2 py-1 text-xs ${active==='panels' ? 'bg-indigo-600 text-white' : 'bg-white'}`} onClick={() => onTab('panels')}>Panels</button>
            <button role="tab" aria-selected={active==='canvas'} className={`px-2 py-1 text-xs ${active==='canvas' ? 'bg-indigo-600 text-white' : 'bg-white'}`} onClick={() => onTab('canvas')}>Canvas</button>
          </div>
          <a
            aria-label="Send feedback"
            title="Send feedback"
            className="hidden lg:inline-block px-2 py-1 text-xs rounded border bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            href={`mailto:?subject=${encodeURIComponent('Sandbox MVP Feedback')}&body=${encodeURIComponent(`decisionId=${decisionId}\nua=${navigator.userAgent}\n\nDescribe your feedback:`)}`}
          >
            Send feedback
          </a>
        </div>
      </div>

      {/* Body */}
      <div
        className="grid h-full w-full grid-cols-[minmax(320px,420px)_1fr] lg:grid-cols-[minmax(var(--panel-w,360px),560px)_8px_1fr]"
        style={{ '--panel-w': `${panelW}px` } as React.CSSProperties}
      >
        {/* Panels */}
        <aside className={`h-full border-r overflow-y-auto ${isMobile && active !== 'panels' ? 'hidden' : ''}`} onKeyDownCapture={stopCanvasHotkeys}>
          <ScenarioPanels decisionId={decisionId} />
        </aside>

        {/* Divider column (desktop only) */}
        <div className="hidden lg:block relative" aria-hidden>
          <div className="absolute inset-y-0 left-0 right-0 cursor-col-resize" onMouseDown={onMouseDownDivider} />
        </div>

        {/* Canvas */}
        <section className={`relative h-full overflow-hidden p-4 ${isMobile && active !== 'canvas' ? 'hidden' : ''}`}>
          {/* Safe gutter so floating toolbars don't touch edges */}
          <div className="relative w-full h-full">
            <Canvas decisionId={decisionId} hideBanner hideFeedback />
          </div>
        </section>
      </div>
    </div>
  )
}

export default CombinedSandboxRoute
