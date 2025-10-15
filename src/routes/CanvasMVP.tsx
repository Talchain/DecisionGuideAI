// src/routes/CanvasMVP.tsx
// Canvas MVP - React Flow graph editor on dedicated route

import '../styles/plot.css'
import { useEffect } from 'react'
import ReactFlowGraph from '../canvas/ReactFlowGraph'

export default function CanvasMVP() {
  // Console boot line
  useEffect(() => {
    const commit = import.meta.env?.VITE_GIT_SHORT || 'dev'
    // eslint-disable-next-line no-console
    console.log('[CANVAS] route=/canvas component=CanvasMVP graph=ReactFlow commit=%s', commit)
  }, [])

  const commit = import.meta.env?.VITE_GIT_SHORT || 'dev'

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden">
      {/* Build Badge */}
      <div 
        className="fixed left-2 top-2 z-[9999] rounded bg-black/80 px-2 py-1 text-[11px] text-cyan-300"
        data-testid="build-badge"
      >
        ROUTE=/canvas • COMMIT={commit} • MODE=RF
      </div>

      {/* Graph Canvas */}
      <div className="flex-1 relative" data-testid="rf-root">
        <ReactFlowGraph />
      </div>
    </div>
  )
}
