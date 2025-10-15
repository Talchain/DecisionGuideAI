import { useEffect, useRef, useState } from 'react'
import { useCanvasStore } from './store'

interface ContextMenuProps {
  x: number
  y: number
  onClose: () => void
}

export function ContextMenu({ x, y, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const { 
    addNode, deleteSelected, duplicateSelected,
    copySelected, pasteClipboard, cutSelected,
    clipboard
  } = useCanvasStore()

  const [position, setPosition] = useState({ x, y })

  // Adjust position if menu would overflow viewport
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect()
      let adjustedX = x
      let adjustedY = y

      if (x + rect.width > window.innerWidth) {
        adjustedX = window.innerWidth - rect.width - 10
      }
      if (y + rect.height > window.innerHeight) {
        adjustedY = window.innerHeight - rect.height - 10
      }

      setPosition({ x: adjustedX, y: adjustedY })
    }
  }, [x, y])

  // Close on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    setTimeout(() => document.addEventListener('mousedown', handleClick), 0)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleAction = (action: () => void) => {
    action()
    onClose()
  }

  const menuItems = [
    {
      label: 'Add Node Here',
      icon: '➕',
      shortcut: null,
      action: () => addNode({ x, y }),
      enabled: true
    },
    { type: 'divider' },
    {
      label: 'Cut',
      icon: '✂️',
      shortcut: '⌘X',
      action: cutSelected,
      enabled: true
    },
    {
      label: 'Copy',
      icon: '📋',
      shortcut: '⌘C',
      action: copySelected,
      enabled: true
    },
    {
      label: 'Paste',
      icon: '📎',
      shortcut: '⌘V',
      action: pasteClipboard,
      enabled: clipboard !== null && clipboard.nodes.length > 0
    },
    {
      label: 'Duplicate',
      icon: '🔁',
      shortcut: '⌘D',
      action: duplicateSelected,
      enabled: true
    },
    { type: 'divider' },
    {
      label: 'Delete',
      icon: '🗑️',
      shortcut: 'Del',
      action: deleteSelected,
      enabled: true
    }
  ]

  return (
    <div
      ref={menuRef}
      className="fixed bg-white rounded-xl shadow-xl border border-gray-200 py-1 z-[9999] min-w-[200px]"
      style={{ left: position.x, top: position.y }}
      onClick={(e) => e.stopPropagation()}
    >
      {menuItems.map((item, index) => {
        if ('type' in item && item.type === 'divider') {
          return <div key={index} className="h-px bg-gray-200 my-1" />
        }

        const enabled = 'enabled' in item ? item.enabled : true
        return (
          <button
            key={index}
            onClick={() => enabled && handleAction(item.action)}
            disabled={!enabled}
            className={`
              w-full text-left px-4 py-2 text-sm flex items-center justify-between
              transition-colors
              ${enabled 
                ? 'hover:bg-[#EA7B4B]/10 hover:text-[#EA7B4B] cursor-pointer' 
                : 'opacity-40 cursor-not-allowed'}
            `}
          >
            <span className="flex items-center gap-2">
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </span>
            {item.shortcut && (
              <span className="text-xs text-gray-400 font-mono">{item.shortcut}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
