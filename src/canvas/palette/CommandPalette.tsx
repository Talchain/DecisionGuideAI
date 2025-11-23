/**
 * Command Palette Component
 *
 * Universal "jump" and "do" surface for Canvas.
 * Keyboard-driven, accessible, with instant search results.
 *
 * Performance target: ≤50ms open latency, ≤75ms search results
 * Accessibility: WCAG 2.1 AA, zero Axe violations
 */

import { useEffect, useRef } from 'react'
import { usePalette } from './usePalette'
import type { PaletteItemKind, SearchResult } from './indexers'
import { sanitizeLabel } from '../persist'

const KIND_LABELS: Record<PaletteItemKind, string> = {
  action: 'Actions',
  node: 'Nodes',
  edge: 'Edges',
  driver: 'Drivers',
  template: 'Templates',
  run: 'Recent Runs',
}

const KIND_ICONS: Record<PaletteItemKind, string> = {
  action: '⚡',
  node: '●',
  edge: '→',
  driver: '📊',
  template: '📄',
  run: '🔄',
}

interface CommandPaletteProps {
  /** Whether feature is enabled (from flag) */
  enabled?: boolean
}

/**
 * Command Palette overlay
 */
export function CommandPalette({ enabled = false }: CommandPaletteProps) {
  const {
    isOpen,
    query,
    selectedIndex,
    results,
    groupedResults,
    close,
    setQuery,
    executeSelected,
  } = usePalette({ enabled })

  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Auto-focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      // Small delay to ensure DOM is ready
      requestAnimationFrame(() => {
        inputRef.current?.focus()
      })
    }
  }, [isOpen])

  // Scroll selected item into view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const selectedEl = listRef.current.querySelector('[data-selected="true"]')
      selectedEl?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [selectedIndex, isOpen])

  if (!enabled || !isOpen) {
    return null
  }

  // Flatten grouped results for index mapping
  const flatResults: SearchResult[] = []
  const kindOrder: PaletteItemKind[] = ['action', 'node', 'edge', 'driver', 'template', 'run']

  for (const kind of kindOrder) {
    const items = groupedResults[kind] || []
    flatResults.push(...items)
  }

  return (
    <div
      role="dialog"
      aria-label="Command palette"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-start justify-center pt-32"
      onClick={e => {
        // Click backdrop to close
        if (e.target === e.currentTarget) {
          close()
        }
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true" />

      {/* Palette */}
      <div className="relative w-full max-w-2xl rounded-lg bg-white shadow-panel">
        {/* Search input */}
        <div className="border-b border-gray-200 p-4">
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-results"
            aria-activedescendant={
              flatResults[selectedIndex] ? `palette-item-${flatResults[selectedIndex].id}` : undefined
            }
            aria-label="Search commands, nodes, edges, and more"
            className="w-full border-none bg-transparent text-lg outline-none placeholder:text-gray-400"
            placeholder="Type to search... (⌘K to close)"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault()
                executeSelected()
              }
            }}
          />
        </div>

        {/* Results */}
        <div
          ref={listRef}
          id="palette-results"
          role="listbox"
          aria-label="Search results"
          className="max-h-96 overflow-y-auto"
        >
          {flatResults.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {query ? 'No results found' : 'Start typing to search...'}
            </div>
          ) : (
            <div className="py-2">
              {kindOrder.map(kind => {
                const items = groupedResults[kind] || []
                if (items.length === 0) return null

                return (
                  <div key={kind} className="mb-2">
                    {/* Section header */}
                    <div className="px-4 py-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      {KIND_LABELS[kind]}
                    </div>

                    {/* Items */}
                    {items.map(item => {
                      const globalIndex = flatResults.indexOf(item)
                      const isSelected = globalIndex === selectedIndex

                      return (
                        <button
                          key={item.id}
                          id={`palette-item-${item.id}`}
                          role="option"
                          aria-selected={isSelected}
                          data-selected={isSelected}
                          className={`
                            w-full px-4 py-3 text-left transition-colors
                            ${isSelected ? 'bg-blue-50 text-blue-900' : 'text-gray-900 hover:bg-gray-50'}
                          `}
                          onClick={() => executeSelected()}
                          onMouseEnter={() => {
                            // Update selection on hover
                            const newIndex = flatResults.indexOf(item)
                            if (newIndex !== -1) {
                              // Force re-render by updating parent state
                              // (In practice, this would call a selectByIndex action)
                            }
                          }}
                        >
                          <div className="flex items-center gap-3">
                            {/* Icon */}
                            <span className="text-xl" aria-hidden="true">
                              {KIND_ICONS[kind]}
                            </span>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">
                                {sanitizeLabel(item.label)}
                              </div>
                              {item.description && (
                                <div className="text-sm text-gray-500 truncate">
                                  {sanitizeLabel(item.description)}
                                </div>
                              )}
                            </div>

                            {/* Match type badge (debug) */}
                            {item.matchType && query && (
                              <span
                                className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600"
                                aria-label={`Match type: ${item.matchType}`}
                              >
                                {item.matchType}
                              </span>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="border-t border-gray-200 px-4 py-2 text-xs text-gray-500 flex items-center justify-between">
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-mono">↑</kbd>
            <kbd className="ml-1 px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-mono">↓</kbd>
            {' '}to navigate
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-mono">↵</kbd>
            {' '}to select
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-mono">esc</kbd>
            {' '}to close
          </span>
        </div>
      </div>

      {/* Screen reader status */}
      <div role="status" aria-live="polite" className="sr-only">
        {results.length > 0
          ? `${results.length} result${results.length === 1 ? '' : 's'} found`
          : query
          ? 'No results found'
          : ''}
      </div>
    </div>
  )
}
