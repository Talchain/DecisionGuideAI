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
    { type: 'goal', icon: '🎯', label: 'Goal', color: 'bg-teal-100 border-teal-300' },
    { type: 'decision', icon: '⚖️', label: 'Decision', color: 'bg-indigo-100 border-indigo-300' },
    { type: 'option', icon: '🔷', label: 'Option', color: 'bg-blue-100 border-blue-300' },
    { type: 'factor', icon: '⚙️', label: 'Factor', color: 'bg-slate-100 border-slate-300' },
    { type: 'risk', icon: '⚠️', label: 'Risk', color: 'bg-amber-100 border-amber-300' },
    { type: 'outcome', icon: '📊', label: 'Outcome', color: 'bg-green-100 border-green-300' },
    { type: 'action', icon: '⚡', label: 'Action', color: 'bg-emerald-100 border-emerald-300' },
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
                ? 'bg-indigo-100 border-2 border-indigo-400'
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
                ? 'bg-teal-100 border-2 border-teal-400'
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
              ? 'bg-amber-100 border-2 border-amber-400'
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
        Mode: <span className="text-indigo-600">
          {currentTool === 'select' ? 'Select' : 
           currentTool === 'pan' ? 'Pan' : 
           currentTool === 'connect' ? 'Connect' :
           currentTool === 'add-note' ? 'Add Note' :
           'Add Node'}
        </span>
      </div>

      {/* Hint chip */}
      <div className="mt-2 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 text-xs text-indigo-900 max-w-[180px]">
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
