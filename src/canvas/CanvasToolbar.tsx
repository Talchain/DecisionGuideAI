import { useState, useRef, useEffect } from 'react'
import { useCanvasStore } from './store'
import { useReactFlow } from '@xyflow/react'
import { SnapshotManager } from './components/SnapshotManager'
import { ImportExportDialog } from './components/ImportExportDialog'
import { LayoutPopover } from './components/LayoutPopover'
import { NODE_REGISTRY } from './domain/nodes'
import type { NodeType } from './domain/nodes'
import { renderIcon } from './helpers/renderIcon'

export function CanvasToolbar() {
  const [isMinimized, setIsMinimized] = useState(false)
  const [showSnapshots, setShowSnapshots] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [showNodeMenu, setShowNodeMenu] = useState(false)
  const nodeMenuRef = useRef<HTMLDivElement>(null)
  const { undo, redo, canUndo, canRedo, addNode } = useCanvasStore()
  const { fitView, zoomIn, zoomOut } = useReactFlow()

  // Close node menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (nodeMenuRef.current && !nodeMenuRef.current.contains(e.target as Node)) {
        setShowNodeMenu(false)
      }
    }
    if (showNodeMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showNodeMenu])

  const handleAddNode = (type: NodeType) => {
    addNode(undefined, type)
    setShowNodeMenu(false)
  }

  if (isMinimized) {
    return (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[1000]">
        <button
          onClick={() => setIsMinimized(false)}
          className="px-3 py-2 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200 hover:bg-white transition-colors"
          title="Show toolbar"
          aria-label="Show toolbar"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </button>
      </div>
    )
  }

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[1000]">
      <div
        role="toolbar"
        aria-label="Canvas editing toolbar"
        className="flex items-center gap-2 px-4 py-2 bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200"
      >
        {/* Add Node with Type Menu */}
        <div className="relative" ref={nodeMenuRef}>
          <button
            onClick={() => setShowNodeMenu(!showNodeMenu)}
            className="px-3 py-1.5 text-sm font-medium text-white bg-[#EA7B4B] rounded-lg hover:bg-[#EA7B4B]/90 transition-colors focus:outline-none focus:ring-2 focus:ring-[#EA7B4B] focus:ring-offset-2 flex items-center gap-1"
            title="Add Node"
            aria-label="Add node to canvas"
            aria-expanded={showNodeMenu}
            aria-haspopup="menu"
            data-testid="btn-node-menu"
          >
            + Node
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {showNodeMenu && (
            <div
              role="menu"
              className="absolute bottom-full mb-2 left-0 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50"
            >
              {(Object.keys(NODE_REGISTRY) as NodeType[]).map((type) => {
                const meta = NODE_REGISTRY[type]
                return (
                  <button
                    key={type}
                    role="menuitem"
                    onClick={() => handleAddNode(type)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 transition-colors flex items-center gap-2"
                    aria-label={`Add ${meta.label} node`}
                  >
                    {renderIcon(meta.icon, 16)}
                    <span>Add {meta.label}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="w-px h-6 bg-gray-300" role="separator" />

        {/* Undo/Redo */}
        <button
          onClick={undo}
          disabled={!canUndo()}
          className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
          title="Undo (⌘Z)"
          aria-label="Undo last action"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
        </button>

        <button
          onClick={redo}
          disabled={!canRedo()}
          className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
          title="Redo (⌘Y)"
          aria-label="Redo last undone action"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
          </svg>
        </button>

        <div className="w-px h-6 bg-gray-300" role="separator" />

        {/* Zoom */}
        <button
          onClick={() => zoomIn()}
          className="p-1.5 rounded hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
          title="Zoom In"
          aria-label="Zoom in"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
          </svg>
        </button>

        <button
          onClick={() => zoomOut()}
          className="p-1.5 rounded hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
          title="Zoom Out"
          aria-label="Zoom out"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM7 10h6" />
          </svg>
        </button>

        <button
          onClick={() => fitView({ padding: 0.2, duration: 300 })}
          className="p-1.5 rounded hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
          title="Fit View"
          aria-label="Fit all nodes in view"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </button>

        <div className="w-px h-6 bg-gray-300" role="separator" />

        {/* Layout Options */}
        <LayoutPopover />

        {/* Snapshots */}
        <button
          onClick={() => setShowSnapshots(true)}
          className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
          title="Manage Snapshots (⌘S)"
          aria-label="Open snapshot manager"
        >
          Snapshots
        </button>

        <div className="w-px h-6 bg-gray-300" role="separator" />

        {/* Import */}
        <button
          onClick={() => setShowImport(true)}
          className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
          title="Import Canvas"
          aria-label="Import canvas from file"
        >
          Import
        </button>

        {/* Export */}
        <button
          onClick={() => setShowExport(true)}
          className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
          title="Export Canvas"
          aria-label="Export canvas to file"
        >
          Export
        </button>

        {/* Minimize */}
        <button
          onClick={() => setIsMinimized(true)}
          className="p-1.5 rounded hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
          title="Minimize toolbar"
          aria-label="Minimize toolbar"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Modals */}
      <SnapshotManager isOpen={showSnapshots} onClose={() => setShowSnapshots(false)} />
      <ImportExportDialog isOpen={showImport} onClose={() => setShowImport(false)} mode="import" />
      <ImportExportDialog isOpen={showExport} onClose={() => setShowExport(false)} mode="export" />
    </div>
  )
}
