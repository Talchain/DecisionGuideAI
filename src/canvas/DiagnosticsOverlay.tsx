import { useState, useEffect } from 'react'
import { useCanvasStore } from './store'

export function DiagnosticsOverlay() {
  const [isVisible, setIsVisible] = useState(false)
  const [metrics, setMetrics] = useState({
    timers: 0,
    listeners: 0,
    historySize: 0,
    undoDepth: 0,
    redoDepth: 0,
    nodeCount: 0,
    edgeCount: 0,
  })

  const { history, nodes, edges } = useCanvasStore()

  useEffect(() => {
    const getDiagParam = () => {
      try {
        // Prefer real query string: /canvas?diag=1
        const searchParams = new URLSearchParams(window.location.search)
        const fromSearch = searchParams.get('diag')
        if (fromSearch) return fromSearch

        // Fallback: read from hash fragment: /#/canvas?diag=1
        const hash = window.location.hash
        const qIndex = hash.indexOf('?')
        if (qIndex !== -1) {
          const hashQuery = hash.slice(qIndex + 1)
          const fromHash = new URLSearchParams(hashQuery).get('diag')
          if (fromHash) return fromHash
        }
      } catch {}
      return null
    }

    const value = getDiagParam()
    setIsVisible(value === '1')
  }, [])

  useEffect(() => {
    if (!isVisible) return

    const interval = setInterval(() => {
      // Count active timers (approximate)
      const timers = (window as any).__activeTimers?.size || 0
      
      // Count event listeners (approximate)
      const listeners = (window as any).__activeListeners?.size || 0

      setMetrics({
        timers,
        listeners,
        historySize: history.past.length + history.future.length,
        undoDepth: history.past.length,
        redoDepth: history.future.length,
        nodeCount: nodes.length,
        edgeCount: edges.length,
      })
    }, 500)

    return () => clearInterval(interval)
  }, [isVisible, history, nodes, edges])

  if (!isVisible) return null

  return (
    <div className="fixed bottom-24 left-6 bg-black/90 text-white rounded-lg p-4 font-mono text-xs z-[3000] backdrop-blur-sm">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-sm">Diagnostics</h3>
        <button
          onClick={() => setIsVisible(false)}
          className="text-white/60 hover:text-white"
          aria-label="Close diagnostics"
        >
          ✕
        </button>
      </div>
      
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-white/60">Timers:</span>
          <span className={metrics.timers > 10 ? 'text-yellow-400' : 'text-green-400'}>
            {metrics.timers}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-white/60">Listeners:</span>
          <span className={metrics.listeners > 50 ? 'text-yellow-400' : 'text-green-400'}>
            {metrics.listeners}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-white/60">History Size:</span>
          <span>{metrics.historySize}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-white/60">Undo Depth:</span>
          <span>{metrics.undoDepth}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-white/60">Redo Depth:</span>
          <span>{metrics.redoDepth}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-white/60">Nodes:</span>
          <span>{metrics.nodeCount}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-white/60">Edges:</span>
          <span>{metrics.edgeCount}</span>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-white/20 text-white/40 text-[10px]">
        Add ?diag=1 to URL to show this panel
      </div>
    </div>
  )
}
