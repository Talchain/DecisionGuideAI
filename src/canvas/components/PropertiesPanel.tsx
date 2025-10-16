import { useState, useEffect, useRef } from 'react'
import { useCanvasStore } from '../store'

export function PropertiesPanel() {
  const { nodes, selection, updateNode } = useCanvasStore()
  const [editLabel, setEditLabel] = useState('')
  const [editLocked, setEditLocked] = useState(false)
  const updateTimerRef = useRef<NodeJS.Timeout | null>(null)

  const selectedNode = selection.nodeIds.size === 1 
    ? nodes.find(n => n.id === Array.from(selection.nodeIds)[0])
    : null

  useEffect(() => {
    // Clear any pending timer when switching nodes
    if (updateTimerRef.current) {
      clearTimeout(updateTimerRef.current)
      updateTimerRef.current = null
    }
    
    if (selectedNode) {
      setEditLabel(selectedNode.data?.label || '')
      setEditLocked(selectedNode.data?.locked || false)
    }
  }, [selectedNode?.id])

  const handleLabelChange = (value: string) => {
    setEditLabel(value)
    if (updateTimerRef.current) clearTimeout(updateTimerRef.current)
    updateTimerRef.current = setTimeout(() => {
      if (selectedNode) {
        updateNode(selectedNode.id, { data: { ...selectedNode.data, label: value } })
      }
    }, 200)
  }

  const handleLockedChange = (value: boolean) => {
    setEditLocked(value)
    if (selectedNode) {
      updateNode(selectedNode.id, { data: { ...selectedNode.data, locked: value } })
    }
  }

  useEffect(() => () => { if (updateTimerRef.current) clearTimeout(updateTimerRef.current) }, [])

  if (!selectedNode) return null

  return (
    <div className="fixed right-6 top-24 w-80 bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Properties</h3>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Label</label>
          <input
            type="text"
            value={editLabel}
            onChange={(e) => handleLabelChange(e.target.value)}
            maxLength={100}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#EA7B4B] focus:border-transparent"
          />
        </div>

        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={editLocked}
              onChange={(e) => handleLockedChange(e.target.checked)}
              className="w-4 h-4 text-[#EA7B4B] rounded focus:ring-[#EA7B4B]"
            />
            <span className="text-sm font-medium text-gray-700">Locked (prevent drag)</span>
          </label>
        </div>
      </div>
    </div>
  )
}
