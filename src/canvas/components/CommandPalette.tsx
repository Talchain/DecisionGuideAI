import { useState, useEffect, useRef } from 'react'
import { useCanvasStore } from '../store'
import { useReactFlow } from '@xyflow/react'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'

interface Action {
  id: string
  label: string
  shortcut?: string
  execute: () => void | Promise<void>
}

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isExecuting, setIsExecuting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { addNode, selectAll, saveSnapshot, applyLayout } = useCanvasStore()
  const { fitView } = useReactFlow()
  const prefersReducedMotion = usePrefersReducedMotion()

  const actions: Action[] = [
    // Node type actions
    { id: 'add-goal', label: 'Add Goal Node', execute: () => addNode(undefined, 'goal') },
    { id: 'add-decision', label: 'Add Decision Node', execute: () => addNode(undefined, 'decision') },
    { id: 'add-option', label: 'Add Option Node', execute: () => addNode(undefined, 'option') },
    { id: 'add-risk', label: 'Add Risk Node', execute: () => addNode(undefined, 'risk') },
    { id: 'add-outcome', label: 'Add Outcome Node', execute: () => addNode(undefined, 'outcome') },
    // General actions
    { id: 'tidy-layout', label: 'Tidy Layout', execute: async () => {
      setIsExecuting(true)
      try {
        await applyLayout()
      } finally {
        setIsExecuting(false)
      }
    }},
    { id: 'select-all', label: 'Select All', shortcut: '⌘A', execute: () => selectAll() },
    { id: 'zoom-fit', label: 'Zoom to Fit', execute: () => fitView({ padding: 0.2, duration: 300 }) },
    { id: 'save-snapshot', label: 'Save Snapshot', shortcut: '⌘S', execute: () => saveSnapshot() },
  ]

  const filteredActions = query.trim() === ''
    ? actions
    : actions.filter(a => a.label.toLowerCase().includes(query.toLowerCase()))

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus()
      setQuery('')
      setSelectedIndex(0)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(i => Math.min(i + 1, filteredActions.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(i => Math.max(i - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const action = filteredActions[selectedIndex]
        if (action) {
          action.execute()
          onClose()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, filteredActions, selectedIndex, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[3000] flex items-start justify-center pt-32 bg-black/50" onClick={onClose}>
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="px-4 py-3 border-b border-gray-200">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
            placeholder="Search actions..."
            className="w-full text-lg outline-none"
          />
        </div>

        {/* Actions List */}
        <div className="max-h-96 overflow-y-auto">
          {isExecuting ? (
            <div className="px-4 py-8 text-center text-gray-500">
              <div className={`inline-block ${prefersReducedMotion ? '' : 'animate-spin'} rounded-full h-8 w-8 border-b-2 border-[#EA7B4B]`}></div>
              <p className="mt-2">Executing...</p>
            </div>
          ) : filteredActions.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500">
              No actions found
            </div>
          ) : (
            filteredActions.map((action, index) => (
              <button
                key={action.id}
                onClick={async () => {
                  await action.execute()
                  if (!isExecuting) onClose()
                }}
                disabled={isExecuting}
                className={`w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 ${prefersReducedMotion ? '' : 'transition-colors'} disabled:opacity-50 disabled:cursor-not-allowed ${
                  index === selectedIndex ? 'bg-[#EA7B4B]/10' : ''
                }`}
              >
                <span className="font-medium text-gray-900">{action.label}</span>
                {action.shortcut && (
                  <span className="text-sm text-gray-500">{action.shortcut}</span>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
