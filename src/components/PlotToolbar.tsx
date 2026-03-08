// src/components/PlotToolbar.tsx
// Left toolbar for plot workspace tools

import { useState } from 'react'

export type Tool = 'select' | 'pan' | 'add-node' | 'add-note' | 'connect'
export type NodeType = 'goal' | 'decision' | 'option' | 'factor' | 'risk' | 'outcome' | 'action'

interface PlotToolbarProps {
  currentTool: Tool
  onToolChange: (tool: Tool) => void
  onAddNode?: (type: NodeType) => void
  onAddNote?: () => void
  onHelpClick?: () => void
}

export default function PlotToolbar({ currentTool, onToolChange, onAddNode, onAddNote, onHelpClick }: PlotToolbarProps) {
  const [showNodeMenu, setShowNodeMenu] = useState(false)

  const tools = [
    { id: 'select' as Tool, icon: '⚡', label: 'Select', key: 'V' },
    { id: 'pan' as Tool, icon: '✋', label: 'Pan', key: 'H' },
    { id: 'connect' as Tool, icon: '🔗', label: 'Connect', key: 'C' },
  ]

  const nodeTypes: { type: NodeType; icon: string; label: string; color: string }[] = [
    { type: 'goal', icon: '🎯', label: 'Goal', color: 'bg-panel border-success/30' },
    { type: 'decision', icon: '⚖️', label: 'Decision', color: 'bg-panel border-info/30' },
    { type: 'option', icon: '🔷', label: 'Option', color: 'bg-panel border-info/30' },
    { type: 'factor', icon: '⚙️', label: 'Factor', color: 'bg-panel border-panel-border' },
    { type: 'risk', icon: '⚠️', label: 'Risk', color: 'bg-panel border-warning/30' },
    { type: 'outcome', icon: '📊', label: 'Outcome', color: 'bg-panel border-success/30' },
    { type: 'action', icon: '⚡', label: 'Action', color: 'bg-panel border-success/30' },
  ]

  return (
    <div className="absolute left-4 top-24 z-20">
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-2 space-y-2">
        {/* Tool buttons */}
        {tools.map(tool => (
          <button
            key={tool.id}
            onClick={() => onToolChange(tool.id)}
            className={`w-12 h-12 rounded-lg flex flex-col items-center justify-center transition-colors ${
              currentTool === tool.id
                ? 'bg-panel border-2 border-info/30'
                : 'bg-white border border-gray-200 hover:bg-gray-50'
            }`}
            title={`${tool.label} (${tool.key})`}
          >
            <span className="text-xl">{tool.icon}</span>
            <span className="text-[8px] text-gray-600 mt-0.5">{tool.label}</span>
          </button>
        ))}

        {/* Divider */}
        <div className="border-t border-gray-200 my-2"></div>

        {/* Add Node button with menu */}
        <div className="relative">
          <button
            onClick={() => setShowNodeMenu(!showNodeMenu)}
            className={`w-12 h-12 rounded-lg flex flex-col items-center justify-center transition-colors ${
              currentTool === 'add-node'
                ? 'bg-panel border-2 border-success'
                : 'bg-white border border-gray-200 hover:bg-gray-50'
            }`}
            title="Add Node (N)"
          >
            <span className="text-xl">➕</span>
            <span className="text-[8px] text-gray-600 mt-0.5">Node</span>
          </button>

          {/* Node type menu */}
          {showNodeMenu && (
            <div className="absolute left-full ml-2 top-0 bg-white rounded-lg shadow-xl border border-gray-200 p-2 min-w-[140px]">
              <div className="text-xs font-semibold text-gray-700 mb-2 px-2">Add Node</div>
              {nodeTypes.map(nt => (
                <button
                  key={nt.type}
                  onClick={() => {
                    onAddNode?.(nt.type)
                    setShowNodeMenu(false)
                    onToolChange('select')
                  }}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 text-left ${nt.color} border mb-1`}
                >
                  <span className="text-base">{nt.icon}</span>
                  <span className="text-xs font-medium text-gray-900">{nt.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Add Note button */}
        <button
          onClick={() => {
            onAddNote?.()
            onToolChange('select')
          }}
          className={`w-12 h-12 rounded-lg flex flex-col items-center justify-center transition-colors ${
            currentTool === 'add-note'
              ? 'bg-panel border-2 border-warning'
              : 'bg-white border border-gray-200 hover:bg-gray-50'
          }`}
          title="Add Note (M)"
        >
          <span className="text-xl">📝</span>
          <span className="text-[8px] text-gray-600 mt-0.5">Note</span>
        </button>

        {/* Help button */}
        <button
          onClick={onHelpClick}
          className="w-12 h-12 rounded-lg flex items-center justify-center bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
          title="Keyboard shortcuts"
        >
          <span className="text-sm font-bold text-gray-600">?</span>
        </button>
      </div>

      {/* Mode state chip */}
      <div className="mt-3 bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs font-medium text-gray-700">
        Mode: <span className="text-info">
          {currentTool === 'select' ? 'Select' : 
           currentTool === 'pan' ? 'Pan' : 
           currentTool === 'connect' ? 'Connect' :
           currentTool === 'add-note' ? 'Add Note' :
           'Add Node'}
        </span>
      </div>

      {/* Hint chip */}
      <div className="mt-2 bg-panel border border-info/30 rounded-lg px-3 py-2 text-xs text-info max-w-[180px]">
        <div className="font-semibold mb-1">💡 Tip</div>
        <div>
          {currentTool === 'connect'
            ? 'Click source, then target node to connect. Esc to cancel.'
            : currentTool === 'add-note'
            ? 'Note will appear in the center of your view.'
            : 'Drag nodes to move. Del to delete. C to connect.'}
        </div>
      </div>
    </div>
  )
}
