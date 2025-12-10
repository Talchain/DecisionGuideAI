import { useEffect, useRef, useState } from 'react'
import { useCanvasStore } from './store'
import { useToast } from './ToastContext'
import type { NodeType } from './domain/nodes'

// Node type options for submenu
const NODE_TYPE_OPTIONS: { type: NodeType; label: string; icon: string }[] = [
  { type: 'goal', label: 'Goal', icon: '🎯' },
  { type: 'decision', label: 'Decision', icon: '⚖️' },
  { type: 'option', label: 'Option', icon: '📋' },
  { type: 'factor', label: 'Factor', icon: '📊' },
  { type: 'risk', label: 'Risk', icon: '⚠️' },
  { type: 'outcome', label: 'Outcome', icon: '✅' },
]

interface ContextMenuProps {
  x: number
  y: number
  onClose: () => void
}

export function ContextMenu({ x, y, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [focusedIndex, setFocusedIndex] = useState(0)
  const [showNodeTypeSubmenu, setShowNodeTypeSubmenu] = useState(false)

  // React 18 + Zustand v5: use individual selectors instead of object+shallow
  const clipboard = useCanvasStore((s) => s.clipboard)
  const selection = useCanvasStore((s) => s.selection)
  const addNode = useCanvasStore((s) => s.addNode)
  const deleteSelected = useCanvasStore((s) => s.deleteSelected)
  const duplicateSelected = useCanvasStore((s) => s.duplicateSelected)
  const copySelected = useCanvasStore((s) => s.copySelected)
  const pasteClipboard = useCanvasStore((s) => s.pasteClipboard)
  const cutSelected = useCanvasStore((s) => s.cutSelected)
  const selectAll = useCanvasStore((s) => s.selectAll)
  const deleteEdge = useCanvasStore((s) => s.deleteEdge)
  const beginReconnect = useCanvasStore((s) => s.beginReconnect)
  const { showToast } = useToast()
  const [position, setPosition] = useState({ x, y })

  const menuItems = [
    { label: 'Add Node...', icon: '➕', shortcut: null, action: () => setShowNodeTypeSubmenu(true), enabled: true, hasSubmenu: true },
    { type: 'divider' as const },
    { label: 'Select All', icon: '☑️', shortcut: '⌘A', action: selectAll, enabled: true },
    { type: 'divider' as const },
    { label: 'Cut', icon: '✂️', shortcut: '⌘X', action: cutSelected, enabled: selection.nodeIds.size > 0 },
    { label: 'Copy', icon: '📋', shortcut: '⌘C', action: copySelected, enabled: selection.nodeIds.size > 0 },
    { label: 'Paste', icon: '📎', shortcut: '⌘V', action: pasteClipboard, enabled: clipboard !== null && clipboard.nodes.length > 0 },
    { label: 'Duplicate', icon: '🔁', shortcut: '⌘D', action: duplicateSelected, enabled: selection.nodeIds.size > 0 },
    { type: 'divider' as const },
    { label: 'Delete', icon: '🗑️', shortcut: 'Del', action: deleteSelected, enabled: selection.nodeIds.size > 0 || selection.edgeIds.size > 0 },
    { type: 'divider' as const },
    {
      label: 'Edit Connector',
      icon: '✏️',
      shortcut: null,
      action: () => {
        showToast('Double-click the connector label to edit weight & belief', 'info')
      },
      enabled: selection.edgeIds.size === 1
    },
    {
      label: 'Reconnect Source',
      icon: '🔄',
      shortcut: null,
      action: () => {
        const edgeId = Array.from(selection.edgeIds)[0]
        if (edgeId) {
          beginReconnect(edgeId, 'source')
          showToast('Reconnect source: click a node or press Esc', 'info')
        }
      },
      enabled: selection.edgeIds.size === 1
    },
    { 
      label: 'Reconnect Target', 
      icon: '🔄', 
      shortcut: null, 
      action: () => {
        const edgeId = Array.from(selection.edgeIds)[0]
        if (edgeId) {
          beginReconnect(edgeId, 'target')
          showToast('Reconnect target: click a node or press Esc', 'info')
        }
      }, 
      enabled: selection.edgeIds.size === 1 
    },
    { 
      label: 'Delete Connector', 
      icon: '🗑️', 
      shortcut: 'Del', 
      action: () => {
        const edgeId = Array.from(selection.edgeIds)[0]
        if (edgeId) {
          deleteEdge(edgeId)
          showToast('Connector deleted — press ⌘Z to undo', 'success')
        }
      }, 
      enabled: selection.edgeIds.size === 1 
    }
  ]

  const actionableItems = menuItems.filter(item => !('type' in item))

  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect()
      let adjustedX = x
      let adjustedY = y
      if (x + rect.width > window.innerWidth) adjustedX = window.innerWidth - rect.width - 10
      if (y + rect.height > window.innerHeight) adjustedY = window.innerHeight - rect.height - 10
      setPosition({ x: adjustedX, y: adjustedY })
    }
  }, [x, y])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return }
      if (e.key === 'ArrowDown') { e.preventDefault(); setFocusedIndex((prev) => Math.min(prev + 1, actionableItems.length - 1)); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setFocusedIndex((prev) => Math.max(prev - 1, 0)); return }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        const item = actionableItems[focusedIndex]
        if (item && 'enabled' in item && item.enabled) { item.action(); onClose() }
        return
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, focusedIndex, actionableItems])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  const handleAction = (action: () => void) => { action(); onClose() }

  const handleAddNodeWithType = (type: NodeType) => {
    addNode({ x, y }, type)
    onClose()
  }

  let actionIndex = -1

  // If submenu is shown, render just the submenu
  if (showNodeTypeSubmenu) {
    return (
      <div
        ref={menuRef}
        role="menu"
        aria-label="Select node type"
        className="fixed bg-white rounded-xl shadow-panel border border-gray-200 py-1 z-[9999] min-w-[180px]"
        style={{ left: position.x, top: position.y }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          role="menuitem"
          onClick={() => setShowNodeTypeSubmenu(false)}
          className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 text-gray-500 hover:bg-gray-50 cursor-pointer"
        >
          <span>←</span>
          <span>Back</span>
        </button>
        <div className="h-px bg-gray-200 my-1" role="separator" />
        {NODE_TYPE_OPTIONS.map((opt) => (
          <button
            key={opt.type}
            role="menuitem"
            onClick={() => handleAddNodeWithType(opt.type)}
            className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 hover:bg-info-50 hover:text-info-700 cursor-pointer transition-colors"
          >
            <span className="text-base">{opt.icon}</span>
            <span>{opt.label}</span>
          </button>
        ))}
      </div>
    )
  }

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Canvas context menu"
      className="fixed bg-white rounded-xl shadow-panel border border-gray-200 py-1 z-[9999] min-w-[200px]"
      style={{ left: position.x, top: position.y }}
      onClick={(e) => e.stopPropagation()}
    >
      {menuItems.map((item, index) => {
        if ('type' in item && item.type === 'divider') {
          return <div key={index} className="h-px bg-gray-200 my-1" role="separator" />
        }

        actionIndex++
        const currentActionIndex = actionIndex
        const enabled = 'enabled' in item ? item.enabled : true
        const isFocused = currentActionIndex === focusedIndex
        const hasSubmenu = 'hasSubmenu' in item && item.hasSubmenu

        const stateClasses = !enabled
          ? 'opacity-40 cursor-not-allowed'
          : isFocused
            ? 'bg-danger-50 text-danger-700 cursor-pointer'
            : 'hover:bg-danger-50 hover:text-danger-700 cursor-pointer'

        return (
          <button
            key={index}
            role="menuitem"
            onClick={() => enabled && (hasSubmenu ? item.action() : handleAction(item.action))}
            onMouseEnter={() => setFocusedIndex(currentActionIndex)}
            disabled={!enabled}
            className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between transition-colors ${stateClasses}`}
          >
            <span className="flex items-center gap-2">
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </span>
            {hasSubmenu ? (
              <span className="text-gray-400">▶</span>
            ) : item.shortcut ? (
              <span className="text-xs text-gray-400 font-mono">{item.shortcut}</span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
