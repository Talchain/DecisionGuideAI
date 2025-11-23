/**
 * DriverChips - Interactive driver chips with keyboard nav and highlighting
 *
 * Features:
 * - ID-first matching with label fallback
 * - Keyboard: Up/Down (navigate), Enter/Space (focus on canvas), Esc (blur)
 * - Hover dwell (300ms) before highlight activation
 * - Multi-match badge + cycling
 * - Communicates with HighlightLayer via store
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { useCanvasStore } from '../store'
import { findDriverMatches, type Driver, type DriverMatch } from '../utils/driverMatching'
import { focusNodeById, focusEdgeById } from '../utils/focusHelpers'

interface DriverChipsProps {
  drivers: Array<{ label: string; polarity: 'up' | 'down' | 'neutral'; strength: 'low' | 'medium' | 'high' }>
}

export function DriverChips({ drivers }: DriverChipsProps) {
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)

  const [selectedIndex, setSelectedIndex] = useState<number>(-1)
  const [hoverIndex, setHoverIndex] = useState<number>(-1)
  const [activeDriver, setActiveDriver] = useState<{ driver: Driver; matchIndex: number } | null>(null)
  const [matchCycles, setMatchCycles] = useState<Map<number, number>>(new Map())

  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const chipsRef = useRef<HTMLDivElement>(null)

  // Convert report drivers to Driver format
  // Note: Backend currently only provides labels, not kind/id
  // When backend adds driver.kind and driver.id, update this mapping
  const driverList: Driver[] = drivers.map(d => ({
    kind: 'node' as const, // Try node first (most common)
    label: d.label
  }))

  // Find matches for all drivers
  const allMatches = driverList.map(driver =>
    findDriverMatches(driver, nodes, edges)
  )

  // Clear hover timer on unmount
  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current)
      }
    }
  }, [])

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!chipsRef.current?.contains(document.activeElement)) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(prev => Math.min(prev + 1, driverList.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(prev => Math.max(prev - 1, 0))
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        if (selectedIndex >= 0) {
          handleDriverFocus(selectedIndex)
        }
      } else if (e.key === 'Escape') {
        e.preventDefault()
        setSelectedIndex(-1)
        setActiveDriver(null)
        chipsRef.current?.blur()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedIndex, driverList.length])

  // Focus driver on canvas
  const handleDriverFocus = useCallback((index: number) => {
    const matches = allMatches[index]
    if (!matches || matches.length === 0) return

    const currentCycle = matchCycles.get(index) || 0
    const match = matches[currentCycle % matches.length]

    if (match.kind === 'node') {
      focusNodeById(match.targetId)
    } else {
      focusEdgeById(match.targetId)
    }

    setActiveDriver({
      driver: driverList[index],
      matchIndex: currentCycle % matches.length
    })
  }, [allMatches, driverList, matchCycles])

  // Handle hover with 300ms dwell
  const handleHoverStart = useCallback((index: number) => {
    setHoverIndex(index)

    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current)
    }

    hoverTimerRef.current = setTimeout(() => {
      const matches = allMatches[index]
      if (matches && matches.length > 0) {
        const currentCycle = matchCycles.get(index) || 0
        const match = matches[currentCycle % matches.length]

        setActiveDriver({
          driver: driverList[index],
          matchIndex: currentCycle % matches.length
        })
      }
    }, 300)
  }, [allMatches, driverList, matchCycles])

  const handleHoverEnd = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
    setHoverIndex(-1)
    setActiveDriver(null)
  }, [])

  // Cycle to next match
  const handleCycleNext = useCallback((index: number, e: React.MouseEvent) => {
    e.stopPropagation()
    const matches = allMatches[index]
    if (!matches || matches.length <= 1) return

    const currentCycle = matchCycles.get(index) || 0
    const nextCycle = (currentCycle + 1) % matches.length

    setMatchCycles(prev => new Map(prev).set(index, nextCycle))
    handleDriverFocus(index)
  }, [allMatches, matchCycles, handleDriverFocus])

  // Get polarity color
  const getPolarityColor = (polarity: string) => {
    switch (polarity) {
      case 'up':
        return 'var(--success-500)'
      case 'down':
        return 'var(--danger-500)'
      default:
        return 'var(--text-primary)'
    }
  }

  if (driverList.length === 0) return null

  return (
    <div
      ref={chipsRef}
      className="space-y-2"
      role="list"
      aria-label="Key drivers"
      tabIndex={0}
    >
      <h4 className="text-sm font-semibold text-gray-900">
        Key Drivers
      </h4>
      {driverList.map((driver, index) => {
        const matches = allMatches[index]
        const matchCount = matches.length
        const currentCycle = matchCycles.get(index) || 0
        const isSelected = selectedIndex === index
        const isHovered = hoverIndex === index
        const reportDriver = drivers[index]

        return (
          <div
            key={index}
            role="listitem"
            className={`
              flex items-center gap-2 p-2 rounded transition-colors cursor-pointer border-l-4
              ${isSelected || isHovered ? 'bg-info-100' : 'bg-info-50'}
            `}
            style={{
              borderLeftColor: getPolarityColor(reportDriver.polarity)
            }}
            onMouseEnter={() => handleHoverStart(index)}
            onMouseLeave={handleHoverEnd}
            onClick={() => handleDriverFocus(index)}
            tabIndex={0}
            aria-label={`Driver: ${driver.label}, ${matchCount} match${matchCount !== 1 ? 'es' : ''}`}
          >
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-900">
                {driver.label}
              </div>
              <div className="text-xs text-gray-400">
                {reportDriver.strength} impact
              </div>
            </div>

            {/* Match badge + cycle controls */}
            {matchCount > 0 && (
              <div className="flex items-center gap-1">
                <div
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    matches[0].matchType === 'id'
                      ? 'bg-green-100 text-green-600'
                      : 'bg-yellow-100 text-yellow-600'
                  }`}
                  title={matches[0].matchType === 'id' ? 'Exact ID match' : 'Label match'}
                >
                  {matchCount > 1 ? `${currentCycle + 1}/${matchCount}` : '1'}
                </div>

                {matchCount > 1 && (
                  <button
                    onClick={(e) => handleCycleNext(index, e)}
                    className="p-1 rounded hover:bg-black/10 transition-colors"
                    aria-label="Next match"
                    title="Cycle to next match"
                  >
                    <ChevronDown className="w-3 h-3 text-info-600" />
                  </button>
                )}
              </div>
            )}

            {matchCount === 0 && (
              <div
                className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-600"
                title="No matches found on canvas"
              >
                Not found
              </div>
            )}
          </div>
        )
      })}

      <div className="text-xs text-gray-400">
        Hover or click to highlight • ↑↓ to navigate • Enter to focus
      </div>
    </div>
  )
}
