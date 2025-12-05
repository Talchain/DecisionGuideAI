/**
 * DriverChips - Interactive driver chips with keyboard nav and highlighting
 *
 * Features:
 * - ID-first matching with label fallback
 * - Keyboard: Up/Down (navigate), Enter/Space (focus on canvas), Esc (blur)
 * - Hover dwell (300ms) before highlight activation
 * - Multi-match badge + cycling
 * - Communicates with HighlightLayer via store
 *
 * Phase 1B: Option B Implementation
 * - Client-side filtering: Causal factors (Risk/Factor) vs Other Influences
 * - Two-section UI with collapsible "Other Influences"
 * - Brand-compliant colors matching canvas nodes
 * - Node icons matching canvas exactly
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Minus,
  Zap,
  Target,
  Crosshair,
  Lightbulb,
  Settings,
  Info,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useCanvasStore } from '../store'
import { findDriverMatches, type Driver } from '../utils/driverMatching'
import { focusNodeById, focusEdgeById } from '../utils/focusHelpers'
import { typography } from '../../styles/typography'

// Node icon mapping (matches canvas nodes exactly)
const NODE_ICONS: Record<string, LucideIcon> = {
  goal: Target,
  decision: Crosshair,
  option: Lightbulb,
  factor: Settings,
  risk: AlertTriangle,
  outcome: TrendingUp,
}

// Node color mapping (matches canvas nodes - brand compliant)
const NODE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  goal: { bg: 'bg-amber-100', border: 'border-amber-400', text: 'text-amber-900' },
  decision: { bg: 'bg-sky-100', border: 'border-sky-400', text: 'text-sky-900' },
  option: { bg: 'bg-purple-100', border: 'border-purple-400', text: 'text-purple-900' },
  factor: { bg: 'bg-sand-100', border: 'border-sand-300', text: 'text-ink-900' },
  risk: { bg: 'bg-red-100', border: 'border-red-400', text: 'text-red-900' },
  outcome: { bg: 'bg-emerald-100', border: 'border-emerald-400', text: 'text-emerald-900' },
}

// Causal node types (Risk and Factor are causal factors)
const CAUSAL_TYPES = new Set(['risk', 'factor'])

interface ReportDriver {
  label: string
  polarity: 'up' | 'down' | 'neutral'
  strength: 'low' | 'medium' | 'high'
  contribution?: number
  nodeId?: string
  edgeId?: string
  /** Node kind (optional from API, otherwise determined via canvas lookup) */
  nodeKind?: string | null
}

interface DriverChipsProps {
  drivers: ReportDriver[]
}

interface EnrichedDriver extends ReportDriver {
  originalIndex: number
  nodeKind: string | null
}

export function DriverChips({ drivers }: DriverChipsProps) {
  // React #185 FIX: Use shallow comparison for array selectors
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)

  const [selectedIndex, setSelectedIndex] = useState<number>(-1)
  const [hoverIndex, setHoverIndex] = useState<number>(-1)
  const [activeDriver, setActiveDriver] = useState<{ driver: Driver; matchIndex: number } | null>(null)
  const [matchCycles, setMatchCycles] = useState<Map<number, number>>(new Map())
  const [otherInfluencesOpen, setOtherInfluencesOpen] = useState(false)

  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const chipsRef = useRef<HTMLDivElement>(null)

  // Enrich drivers with node kind
  // Priority: 1) API nodeKind, 2) Extract from node_id prefix, 3) Canvas ID match, 4) Label match
  const enrichedDrivers = useMemo<EnrichedDriver[]>(() => {
    return drivers.map((d, index) => {
      // 1) Use API-provided nodeKind if available
      let nodeKind: string | null = d.nodeKind?.toLowerCase() || null

      // 2) Extract node type from API node_id prefix (e.g., "risk_market_saturation" → "risk")
      // This handles cases where API uses type-prefixed IDs
      if (!nodeKind && d.nodeId) {
        const prefixMatch = d.nodeId.match(/^(goal|decision|option|factor|risk|outcome)_/i)
        if (prefixMatch) {
          nodeKind = prefixMatch[1].toLowerCase()
        }
      }

      // 3) Fallback: find node by exact ID match on canvas
      if (!nodeKind && d.nodeId) {
        const node = nodes.find(n => n.id === d.nodeId)
        nodeKind = node?.data?.kind?.toLowerCase() || node?.type?.toLowerCase() || null
      }

      // 4) Fallback: find node by label match (case-insensitive, trimmed)
      if (!nodeKind) {
        const normalizedLabel = d.label.toLowerCase().trim()
        const node = nodes.find(n => {
          const canvasLabel = n.data?.label?.toLowerCase().trim()
          return canvasLabel === normalizedLabel
        })
        nodeKind = node?.data?.kind?.toLowerCase() || node?.type?.toLowerCase() || null
      }

      // Dev-only logging for diagnosis (won't appear in production builds)
      if (import.meta.env.DEV && !nodeKind) {
        console.debug('[DriverChips] Could not determine nodeKind for driver:', {
          label: d.label,
          nodeId: d.nodeId,
          canvasNodeLabels: nodes.map(n => ({ id: n.id, label: n.data?.label, kind: n.data?.kind })),
        })
      }

      return {
        ...d,
        originalIndex: index,
        nodeKind,
      }
    })
  }, [drivers, nodes])

  // Split drivers into causal factors and other influences
  const { causalDrivers, otherDrivers } = useMemo(() => {
    const causal: EnrichedDriver[] = []
    const other: EnrichedDriver[] = []

    for (const driver of enrichedDrivers) {
      const kind = driver.nodeKind?.toLowerCase()
      if (kind && CAUSAL_TYPES.has(kind)) {
        causal.push(driver)
      } else {
        other.push(driver)
      }
    }

    return { causalDrivers: causal, otherDrivers: other }
  }, [enrichedDrivers])

  // Convert report drivers to Driver format for matching
  // Use ID-first matching: nodeId/edgeId when available, label fallback
  const driverList: Driver[] = drivers.map(d => {
    // Determine kind based on which ID is provided
    if (d.edgeId) {
      return {
        kind: 'edge' as const,
        id: d.edgeId,
        label: d.label,
      }
    }
    // Default to node (most drivers are node-based)
    return {
      kind: 'node' as const,
      id: d.nodeId, // May be undefined - findDriverMatches handles fallback
      label: d.label,
    }
  })

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

  // Quick Win #4: Check if a node has evidence on its edges
  const checkNodeHasEvidence = useCallback((nodeId: string): boolean => {
    const relevantEdges = edges.filter(e => e.source === nodeId || e.target === nodeId)
    return relevantEdges.some(e => {
      const provenance = e.data?.provenance
      return provenance && provenance !== 'assumption' && provenance !== 'template'
    })
  }, [edges])

  // Render a single driver chip - compact single-line layout
  const renderDriverChip = (driver: EnrichedDriver, globalIndex: number) => {
    const matches = allMatches[driver.originalIndex]
    const matchCount = matches?.length || 0
    const isSelected = selectedIndex === driver.originalIndex
    const isHovered = hoverIndex === driver.originalIndex

    const contribution = driver.contribution
    const nodeId = driver.nodeId || (matchCount > 0 ? matches[0].targetId : null)
    const hasEvidence = nodeId ? checkNodeHasEvidence(nodeId) : false

    // Get node-specific colors and icon
    const kind = driver.nodeKind?.toLowerCase() || 'factor'
    const colors = NODE_COLORS[kind] || NODE_COLORS.factor
    const NodeIcon = NODE_ICONS[kind] || Settings

    return (
      <button
        key={driver.originalIndex}
        type="button"
        role="listitem"
        className={`
          w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 cursor-pointer border
          ${isSelected || isHovered
            ? `bg-white ${colors.border} shadow-md ring-2 ring-sand-200`
            : `bg-paper-50 border-sand-200 hover:bg-white hover:shadow-sm hover:border-sand-300`}
        `}
        onMouseEnter={() => handleHoverStart(driver.originalIndex)}
        onMouseLeave={handleHoverEnd}
        onClick={() => handleDriverFocus(driver.originalIndex)}
        aria-label={`Driver ${globalIndex + 1}: ${driver.label}${contribution ? `, ${Math.round(contribution * 100)}% contribution` : ''}`}
      >
        {/* Node icon with type-specific color - smaller */}
        <div
          className={`flex items-center justify-center w-6 h-6 rounded flex-shrink-0 ${colors.bg}`}
        >
          <NodeIcon className={`w-3.5 h-3.5 ${colors.text}`} aria-hidden="true" />
        </div>

        {/* Label - truncated to fit */}
        <span className={`${typography.caption} font-medium text-ink-900 truncate flex-1 min-w-0 text-left`}>
          {driver.label}
        </span>

        {/* Polarity indicator - compact */}
        {driver.polarity && driver.polarity !== 'neutral' && (
          <span
            className={`flex-shrink-0 ${
              driver.polarity === 'up' ? 'text-emerald-500' : 'text-red-500'
            }`}
            title={driver.polarity === 'up' ? 'Positive influence' : 'Negative influence'}
          >
            {driver.polarity === 'up' ? (
              <TrendingUp className="w-4 h-4" aria-hidden="true" />
            ) : (
              <TrendingDown className="w-4 h-4" aria-hidden="true" />
            )}
          </span>
        )}

        {/* Contribution percentage - compact */}
        {contribution !== undefined && contribution > 0 && CAUSAL_TYPES.has(kind) && (
          <span
            className={`px-1.5 py-0.5 rounded ${typography.caption} font-medium bg-sand-200 text-ink-700 flex-shrink-0`}
            title={`Contributes ${Math.round(contribution * 100)}% to outcome`}
          >
            {Math.round(contribution * 100)}%
          </span>
        )}

        {/* Evidence status - compact */}
        {!hasEvidence && matchCount > 0 && (
          <span
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${typography.caption} font-medium bg-amber-100 text-amber-700 flex-shrink-0`}
            title="No evidence supporting this driver - consider adding data"
          >
            <AlertTriangle className="w-3 h-3" aria-hidden="true" />
            <span>Add evidence</span>
          </span>
        )}

        {/* Arrow indicator */}
        <ArrowRight className="w-4 h-4 text-sand-400 flex-shrink-0" aria-hidden="true" />
      </button>
    )
  }

  // Empty state: show informative message instead of returning null
  if (driverList.length === 0) {
    return (
      <div className="p-4 bg-paper-50 rounded-xl border border-sand-200">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 bg-amber-100 rounded-lg">
            <Zap className="w-4 h-4 text-amber-600" aria-hidden="true" />
          </div>
          <h4 className={`${typography.label} font-semibold text-ink-900`}>
            Top causal factors
          </h4>
        </div>
        <div className="flex items-start gap-2 p-3 bg-sand-100 rounded-lg border border-sand-200">
          <Info className="w-4 h-4 text-ink-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div className={`${typography.caption} text-ink-700`}>
            No drivers identified yet. Run an analysis to see which factors most influence your outcome.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={chipsRef}
      className="space-y-3 p-4 bg-paper-50 rounded-xl border border-sand-200"
      role="list"
      aria-label="Key drivers"
      tabIndex={0}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="p-1.5 bg-amber-100 rounded-lg">
          <Zap className="w-4 h-4 text-amber-600" aria-hidden="true" />
        </div>
        <h4 className={`${typography.label} font-semibold text-ink-900`}>
          Top causal factors
        </h4>
      </div>

      {/* Causal Factors Section (Risk + Factor nodes) */}
      {causalDrivers.length > 0 ? (
        <div className="space-y-2">
          {causalDrivers.map((driver, idx) => renderDriverChip(driver, idx))}
        </div>
      ) : (
        <div className="flex items-start gap-2 p-3 bg-sand-100 rounded-lg border border-sand-200">
          <Info className="w-4 h-4 text-ink-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div className={`${typography.caption} text-ink-700`}>
            No Risk or Factor nodes found as top drivers. Consider adding causal factors to your graph for better analysis.
          </div>
        </div>
      )}

      {/* Other Influences Section (collapsible) */}
      {otherDrivers.length > 0 && (
        <div className="pt-2 border-t border-sand-200">
          <button
            type="button"
            onClick={() => setOtherInfluencesOpen(prev => !prev)}
            className="flex items-center gap-2 w-full text-left py-1 hover:bg-sand-100 rounded-md px-1 -mx-1 transition-colors"
            aria-expanded={otherInfluencesOpen}
          >
            {otherInfluencesOpen ? (
              <ChevronUp className="w-4 h-4 text-ink-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-ink-500" />
            )}
            <span className={`${typography.caption} text-ink-700 font-medium`}>
              Other Key Influences ({otherDrivers.length})
            </span>
          </button>

          {otherInfluencesOpen && (
            <div className="space-y-2 mt-2">
              {otherDrivers.map((driver, idx) =>
                renderDriverChip(driver, causalDrivers.length + idx)
              )}
            </div>
          )}
        </div>
      )}

      {/* Help text */}
      <div className={`${typography.caption} text-ink-400 text-center pt-1`}>
        Click to highlight on canvas • Use ↑↓ keys to navigate
      </div>
    </div>
  )
}
