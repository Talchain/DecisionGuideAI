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
  drivers: Array<{
    label: string
    polarity: 'up' | 'down' | 'neutral'
    strength: 'low' | 'medium' | 'high'
    kind?: 'node' | 'edge'
    node_id?: string
    edge_id?: string
  }>
}

export function DriverChips({ drivers }: DriverChipsProps) {
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)
  const setHighlightedDriver = useCanvasStore(s => s.setHighlightedDriver)
  const clearHighlightedDriver = useCanvasStore(s => s.clearHighlightedDriver)

  const [selectedIndex, setSelectedIndex] = useState<number>(-1)
  const [hoverIndex, setHoverIndex] = useState<number>(-1)
  const [activeDriver, setActiveDriver] = useState<{ driver: Driver; matchIndex: number } | null>(null)
  const [matchCycles, setMatchCycles] = useState<Map<number, number>>(new Map())

  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const chipsRef = useRef<HTMLDivElement>(null)

  // Convert report drivers to Driver format using real backend metadata
  // Backend now provides kind/node_id/edge_id from explain_delta.top_drivers
  const driverList: Driver[] = drivers.map(d => ({
    kind: d.kind || 'node', // Use actual kind from API, default to node for legacy
    label: d.label,
    // If backend provides explicit IDs, prefer those for matching
    id: d.kind === 'node' ? d.node_id : d.kind === 'edge' ? d.edge_id : undefined,
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

  // Handle hover with 300ms dwell + throttle to ≤10 Hz (100ms minimum between updates)
  const lastHighlightTime = useRef<number>(0)
  const HIGHLIGHT_THROTTLE_MS = 100 // 10 Hz = 100ms between updates

  const handleHoverStart = useCallback((index: number) => {
    setHoverIndex(index)

    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current)
    }

    hoverTimerRef.current = setTimeout(() => {
      const now = Date.now()
      const timeSinceLastHighlight = now - lastHighlightTime.current

      // Throttle: skip if we updated too recently
      if (timeSinceLastHighlight < HIGHLIGHT_THROTTLE_MS) {
        return
      }

      const matches = allMatches[index]
      if (matches && matches.length > 0) {
        const currentCycle = matchCycles.get(index) || 0
        const match = matches[currentCycle % matches.length]

        setActiveDriver({
          driver: driverList[index],
          matchIndex: currentCycle % matches.length
        })

        // Communicate highlight to HighlightLayer via store
        setHighlightedDriver({
          kind: match.kind,
          id: match.targetId
        })

        lastHighlightTime.current = now
      }
    }, 300)
  }, [allMatches, driverList, matchCycles, setHighlightedDriver])

  const handleHoverEnd = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
    setHoverIndex(-1)
    setActiveDriver(null)
    clearHighlightedDriver()
  }, [clearHighlightedDriver])

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
      case 'up': return 'var(--olumi-success)'
      case 'down': return 'var(--olumi-danger)'
      default: return 'var(--olumi-text)'
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
      <h4 className="text-sm font-semibold" style={{ color: 'var(--olumi-text)' }}>
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
            className="flex items-center gap-2 p-2 rounded transition-colors cursor-pointer"
            style={{
              backgroundColor: isSelected || isHovered
                ? 'rgba(91, 108, 255, 0.15)'
                : 'rgba(91, 108, 255, 0.05)',
              borderLeft: `3px solid ${getPolarityColor(reportDriver.polarity)}`
            }}
            onMouseEnter={() => handleHoverStart(index)}
            onMouseLeave={handleHoverEnd}
            onClick={() => handleDriverFocus(index)}
            tabIndex={0}
            aria-label={`Driver: ${driver.label}, ${matchCount} match${matchCount !== 1 ? 'es' : ''}`}
          >
            <div className="flex-1">
              <div className="text-sm font-medium" style={{ color: 'var(--olumi-text)' }}>
                {driver.label}
              </div>
              <div className="text-xs" style={{ color: 'rgba(232, 236, 245, 0.6)' }}>
                {reportDriver.strength} impact
              </div>
            </div>

            {/* Match badge + cycle controls */}
            {matchCount > 0 && (
              <div className="flex items-center gap-1">
                <div
                  className="px-2 py-1 rounded text-xs font-medium"
                  style={{
                    backgroundColor: matches[0].matchType === 'id'
                      ? 'rgba(32, 201, 151, 0.2)'
                      : 'rgba(247, 201, 72, 0.2)',
                    color: matches[0].matchType === 'id'
                      ? 'var(--olumi-success)'
                      : 'var(--olumi-warning)'
                  }}
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
                    <ChevronDown className="w-3 h-3" style={{ color: 'var(--olumi-primary)' }} />
                  </button>
                )}
              </div>
            )}

            {matchCount === 0 && (
              <div
                className="px-2 py-1 rounded text-xs font-medium"
                style={{
                  backgroundColor: 'rgba(255, 107, 107, 0.2)',
                  color: 'var(--olumi-danger)'
                }}
                title="No matches found on canvas"
              >
                Not found
              </div>
            )}
          </div>
        )
      })}

      <div className="text-xs" style={{ color: 'rgba(232, 236, 245, 0.5)' }}>
        Hover or click to highlight • ↑↓ to navigate • Enter to focus
      </div>
    </div>
  )
}
