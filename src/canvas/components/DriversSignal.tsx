/**
 * DriversSignal - Key drivers display for Results tab
 *
 * Shows the top factors driving the outcome from analysis:
 * - Driver label and polarity (up/down/neutral)
 * - Strength indicator (low/medium/high)
 * - Contribution percentage when available
 * - Click to focus on canvas element
 *
 * Features:
 * - Collapsed by default showing top 3 drivers
 * - Expanded view shows all drivers with details
 * - Color-coded polarity indicators
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import {
  ChevronDown,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react'
import { useCanvasStore } from '../store'
import { focusNodeById, focusEdgeById } from '../utils/focusHelpers'
import { typography } from '../../styles/typography'
import { useISLConformal } from '../../hooks/useISLConformal'
import { useKeyInsight } from '../hooks/useKeyInsight'
import { buildRichGraphPayload } from '../utils/graphPayload'
import type { ISLConformalPrediction } from '../../adapters/isl/types'

interface DriversSignalProps {
  /** Maximum drivers to show when collapsed */
  maxCollapsed?: number
  /** Start expanded */
  defaultExpanded?: boolean
}

// Polarity styling
const polarityConfig: Record<'up' | 'down' | 'neutral', {
  icon: typeof TrendingUp
  iconColor: string
  bgColor: string
  label: string
}> = {
  up: {
    icon: ArrowUpRight,
    iconColor: 'text-mint-600',
    bgColor: 'bg-mint-100',
    label: 'Increases',
  },
  down: {
    icon: ArrowDownRight,
    iconColor: 'text-carrot-600',
    bgColor: 'bg-carrot-100',
    label: 'Decreases',
  },
  neutral: {
    icon: Minus,
    iconColor: 'text-sand-500',
    bgColor: 'bg-sand-100',
    label: 'Neutral',
  },
}

// Strength styling
const strengthConfig: Record<'low' | 'medium' | 'high', {
  barWidth: string
  textColor: string
  label: string
}> = {
  low: {
    barWidth: 'w-1/4',
    textColor: 'text-sand-500',
    label: 'Low',
  },
  medium: {
    barWidth: 'w-2/4',
    textColor: 'text-banana-600',
    label: 'Medium',
  },
  high: {
    barWidth: 'w-3/4',
    textColor: 'text-mint-600',
    label: 'High',
  },
}

// Causal node types - only these should be shown as "drivers"
// Option, Decision, Goal nodes are structural, not causal factors
const CAUSAL_TYPES = new Set(['risk', 'factor', 'constraint'])

// Calibration quality badge styling (for sensitivity indicators)
const calibrationConfig: Record<ISLConformalPrediction['calibration_quality'], {
  bgColor: string
  textColor: string
  label: string
}> = {
  excellent: {
    bgColor: 'bg-mint-100',
    textColor: 'text-mint-700',
    label: 'High',
  },
  good: {
    bgColor: 'bg-sky-100',
    textColor: 'text-sky-700',
    label: 'Good',
  },
  fair: {
    bgColor: 'bg-banana-100',
    textColor: 'text-banana-700',
    label: 'Fair',
  },
  poor: {
    bgColor: 'bg-carrot-100',
    textColor: 'text-carrot-700',
    label: 'Low',
  },
}

export function DriversSignal({
  maxCollapsed = 3,
  defaultExpanded = false,
}: DriversSignalProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  const results = useCanvasStore((s) => s.results)
  const setHighlightedNodes = useCanvasStore((s) => s.setHighlightedNodes)
  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)
  const runMeta = useCanvasStore((s) => s.runMeta)
  const report = results?.report

  // Key Insight from CEE (fallback for drivers when ISL fails)
  const responseHash = report?.model_card?.response_hash
  const { insight: keyInsight } = useKeyInsight({
    responseHash,
    autoFetch: true,
    includeDrivers: true,
  })

  // Conformal predictions for sensitivity badges
  const { data: conformalData, loading: conformalLoading, error: conformalError, predict } = useISLConformal()

  // Track if we've attempted conformal fetch (don't retry on failure)
  const conformalAttemptedRef = useRef(false)

  // Auto-fetch conformal predictions when results exist (with circuit breaker)
  useEffect(() => {
    // Only fetch if we have results, nodes, and haven't attempted yet
    if (!report?.drivers || nodes.length === 0 || conformalData || conformalLoading || conformalAttemptedRef.current) return

    // Mark as attempted immediately to prevent retry loop
    conformalAttemptedRef.current = true

    const timer = setTimeout(() => {
      predict({
        graph: buildRichGraphPayload(nodes, edges),
        options: {
          enable_conformal: true,
          confidence_level: 0.95,
        },
      }).catch((err) => {
        // Log but don't retry - 401/404 won't fix themselves
        const status = err?.status || err?.code
        if (status === 401) {
          console.warn('[DriversSignal] ISL conformal unauthorized (401) - check ISL_API_KEY')
        } else if (status === 404) {
          console.warn('[DriversSignal] ISL conformal endpoint not found (404)')
        } else {
          console.warn('[DriversSignal] ISL conformal failed:', err?.message || err)
        }
      })
    }, 500)

    return () => clearTimeout(timer)
  }, [report?.drivers, nodes.length, edges.length, conformalData, conformalLoading, predict])

  // Reset attempted flag when results change (new analysis run)
  useEffect(() => {
    if (!report?.drivers) {
      conformalAttemptedRef.current = false
    }
  }, [report?.drivers])

  // Create mapping from node_id to conformal prediction
  const conformalByNodeId = useMemo(() => {
    if (!conformalData?.predictions) return new Map<string, ISLConformalPrediction>()
    return new Map(conformalData.predictions.map(p => [p.node_id, p]))
  }, [conformalData])

  // Also create mapping from node label to prediction (fallback when driver nodeId not available)
  const conformalByLabel = useMemo(() => {
    if (!conformalData?.predictions || nodes.length === 0) return new Map<string, ISLConformalPrediction>()
    const labelMap = new Map<string, ISLConformalPrediction>()
    for (const pred of conformalData.predictions) {
      // Find the node and get its label
      const node = nodes.find(n => n.id === pred.node_id)
      const nodeLabel = (node?.data as { label?: string })?.label
      if (nodeLabel) {
        labelMap.set(nodeLabel.toLowerCase(), pred)
      }
    }
    return labelMap
  }, [conformalData, nodes])

  // Build map from node ID to node kind for fallback lookup
  const nodeKindMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const node of nodes) {
      if (node.id && node.type) {
        map.set(node.id, node.type.toLowerCase())
      }
      // Also check data.kind for nodes that store type there
      const dataKind = (node.data as { kind?: string })?.kind
      if (node.id && dataKind) {
        map.set(node.id, dataKind.toLowerCase())
      }
    }
    return map
  }, [nodes])

  // Helper to determine if a driver is a causal factor
  const getDriverNodeKind = useCallback((driver: NonNullable<typeof report>['drivers'][0]): string | null => {
    // First check driver's nodeKind from API
    if (driver.nodeKind) {
      return driver.nodeKind.toLowerCase()
    }
    // Fallback: look up node ID in canvas nodes
    if (driver.nodeId && nodeKindMap.has(driver.nodeId)) {
      return nodeKindMap.get(driver.nodeId)!
    }
    // Try to infer from label patterns (e.g., "risk_..." prefix)
    const labelLower = driver.label?.toLowerCase() || ''
    if (labelLower.startsWith('risk')) return 'risk'
    if (labelLower.includes('cost') || labelLower.includes('budget')) return 'factor'
    if (labelLower.includes('constraint') || labelLower.includes('limit')) return 'constraint'
    return null
  }, [nodeKindMap])

  // Extract and filter drivers to causal factors only
  // If we can't determine the kind, include it (assume causal) rather than excluding
  // Falls back to Key Insight's primary_driver when ISL/analysis drivers unavailable
  const { causalDrivers, otherDrivers, hasFallbackDriver } = useMemo(() => {
    // Primary source: report.drivers from analysis
    let reportDrivers = report?.drivers || []

    // Fallback source: Key Insight's primary_driver from CEE
    // Also try CEE story's key_drivers as secondary fallback
    if (reportDrivers.length === 0) {
      const fallbackDrivers: typeof reportDrivers = []

      // Try Key Insight primary_driver first
      if (keyInsight?.primary_driver) {
        fallbackDrivers.push({
          label: keyInsight.primary_driver.label,
          polarity: 'up' as const, // Default to positive since it's the "primary driver"
          strength: 'high' as const, // Primary driver is high importance
          contribution: keyInsight.primary_driver.contribution_pct / 100,
        })
      }

      // Try CEE story key_drivers as additional fallback
      const storyDrivers = runMeta?.ceeReview?.story?.key_drivers || []
      for (const sd of storyDrivers) {
        // Don't duplicate if already added from primary_driver
        if (fallbackDrivers.some(d => d.label === sd.label)) continue
        fallbackDrivers.push({
          label: sd.label,
          polarity: sd.polarity || ('up' as const),
          strength: sd.impact === 'high' ? ('high' as const) : sd.impact === 'low' ? ('low' as const) : ('medium' as const),
          contribution: sd.contribution_pct ? sd.contribution_pct / 100 : undefined,
        })
      }

      if (fallbackDrivers.length > 0) {
        return {
          causalDrivers: fallbackDrivers,
          otherDrivers: [],
          hasFallbackDriver: true,
        }
      }

      return { causalDrivers: [], otherDrivers: [], hasFallbackDriver: false }
    }

    const causal: typeof reportDrivers = []
    const other: typeof reportDrivers = []

    // Structural types to explicitly exclude (these are not causal factors)
    const STRUCTURAL_TYPES = new Set(['goal', 'decision', 'option', 'outcome'])

    for (const driver of reportDrivers) {
      const kind = getDriverNodeKind(driver)
      // Exclude known structural types, but include everything else
      // This handles the case where backend doesn't return node_kind
      if (kind && STRUCTURAL_TYPES.has(kind)) {
        other.push(driver)
      } else {
        // Include if: explicitly causal, OR type unknown (default to showing)
        causal.push(driver)
      }
    }

    // Sort each group by contribution (highest first) or strength
    const sortDrivers = (drivers: typeof reportDrivers) =>
      [...drivers].sort((a, b) => {
        if (a.contribution !== undefined && b.contribution !== undefined) {
          return b.contribution - a.contribution
        }
        const strengthOrder = { high: 3, medium: 2, low: 1 }
        return (strengthOrder[b.strength] || 0) - (strengthOrder[a.strength] || 0)
      })

    return {
      causalDrivers: sortDrivers(causal),
      otherDrivers: sortDrivers(other),
      hasFallbackDriver: false,
    }
  }, [report, getDriverNodeKind, keyInsight, runMeta])

  // Primary drivers to display (causal factors with >5% contribution)
  // Limit to max 5 for scanability
  const MAX_VISIBLE_DRIVERS = 5
  const CONTRIBUTION_THRESHOLD = 0.05 // 5%

  const { drivers, filteredOutCount } = useMemo(() => {
    // Filter to drivers with >= 5% contribution (or keep all if contribution not available)
    const filtered = causalDrivers.filter(d =>
      d.contribution === undefined || d.contribution >= CONTRIBUTION_THRESHOLD
    )

    // Limit to max 5 visible
    const visible = filtered.slice(0, MAX_VISIBLE_DRIVERS)
    // Count drivers filtered out (below threshold + over limit)
    const filteredOut = causalDrivers.length - visible.length
    return { drivers: visible, filteredOutCount: filteredOut }
  }, [causalDrivers])

  // Focus handler
  const handleFocus = useCallback(
    (driver: typeof drivers[0]) => {
      if (driver.nodeId) {
        setHighlightedNodes([driver.nodeId])
        focusNodeById(driver.nodeId)
        setTimeout(() => setHighlightedNodes([]), 3000)
      } else if (driver.edgeId) {
        focusEdgeById(driver.edgeId)
      }
    },
    [setHighlightedNodes]
  )

  // Don't show empty state while analysis is still running
  const isAnalysisRunning = results?.status === 'streaming' || results?.status === 'preparing' || results?.status === 'connecting'

  // Empty state - show message explaining what drivers are
  if (drivers.length === 0) {
    // Show loading placeholder if analysis is in progress
    if (isAnalysisRunning) {
      return (
        <div className="p-4 bg-sand-50 border border-sand-200 rounded-xl animate-pulse">
          <div className="flex items-center gap-3">
            <Zap className="h-5 w-5 text-sand-400 flex-shrink-0" />
            <div className="flex-1">
              <div className="h-4 bg-sand-200 rounded w-32 mb-1"></div>
              <div className="h-3 bg-sand-100 rounded w-48"></div>
            </div>
          </div>
        </div>
      )
    }

    // Different messages based on whether we have results but ISL failed
    const hasResults = report?.results
    const islFailed = conformalError || conformalAttemptedRef.current

    return (
      <div className="p-4 bg-sand-50 border border-sand-200 rounded-xl">
        <div className="flex items-center gap-3">
          <Zap className="h-5 w-5 text-sand-400 flex-shrink-0" />
          <div>
            <p className={`${typography.body} text-sand-600`}>
              {hasResults && islFailed
                ? 'Driver analysis unavailable'
                : 'No drivers identified'}
            </p>
            <p className={`${typography.caption} text-sand-500`}>
              {hasResults && islFailed
                ? 'Sensitivity data temporarily unavailable'
                : 'Run analysis to see key factors influencing the outcome'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Track if there are filtered out drivers to show in footer
  const hasFilteredDrivers = filteredOutCount > 0 || otherDrivers.length > 0

  return (
    <div className="bg-paper-50 border border-sand-200 rounded-xl overflow-hidden" data-testid="drivers-signal">
      {/* Header - always visible */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-sand-50 transition-colors"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-ink-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-ink-500" />
          )}
          <span className={`${typography.body} font-medium text-ink-800`}>Key Drivers</span>
        </div>

        <span className={`${typography.caption} text-ink-500`}>
          {drivers.length} causal factor{drivers.length !== 1 ? 's' : ''}
        </span>
      </button>

      {/* Driver list - collapsible */}
      {isExpanded && (
      <div className="border-t border-sand-200 divide-y divide-sand-100">
        {drivers.map((driver, index) => {
          const polarity = polarityConfig[driver.polarity] || polarityConfig.neutral
          const strength = strengthConfig[driver.strength] || strengthConfig.medium
          const PolarityIcon = polarity.icon
          const hasTarget = driver.nodeId || driver.edgeId

          // Get conformal prediction for this driver (if available)
          // Try by nodeId first, then fallback to label matching
          const conformalPrediction = driver.nodeId
            ? conformalByNodeId.get(driver.nodeId)
            : conformalByLabel.get(driver.label.toLowerCase())
          const calibration = conformalPrediction
            ? calibrationConfig[conformalPrediction.calibration_quality]
            : null
          const confidenceRange = conformalPrediction?.confidence_interval
            ? Math.round((conformalPrediction.confidence_interval.upper - conformalPrediction.confidence_interval.lower) * 50)
            : null

          return (
            <div
              key={`${driver.label}-${index}`}
              className={`px-4 py-3 ${hasTarget ? 'cursor-pointer hover:bg-sand-50' : ''} transition-colors`}
              onClick={hasTarget ? () => handleFocus(driver) : undefined}
              role={hasTarget ? 'button' : undefined}
              tabIndex={hasTarget ? 0 : undefined}
              onKeyDown={(e) => {
                if (hasTarget && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault()
                  handleFocus(driver)
                }
              }}
            >
              <div className="flex items-start gap-3">
                {/* Polarity icon */}
                <div className={`p-1.5 rounded ${polarity.bgColor} flex-shrink-0`}>
                  <PolarityIcon className={`h-4 w-4 ${polarity.iconColor}`} aria-hidden="true" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`${typography.body} text-ink-800 truncate`}>{driver.label}</span>
                      {/* Sensitivity badge */}
                      {calibration && (
                        <span
                          className={`${typography.caption} px-1.5 py-0.5 rounded ${calibration.bgColor} ${calibration.textColor} flex-shrink-0`}
                          title={`Confidence: ${calibration.label}${confidenceRange ? ` (±${confidenceRange}%)` : ''}`}
                        >
                          {calibration.label}{confidenceRange ? ` ±${confidenceRange}%` : ''}
                        </span>
                      )}
                    </div>
                    {driver.contribution !== undefined && (
                      <span className={`${typography.caption} font-semibold text-ink-700 flex-shrink-0`}>
                        {Math.round(driver.contribution * 100)}%
                      </span>
                    )}
                  </div>

                  {/* Strength bar */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-sand-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${strength.barWidth} ${
                          driver.polarity === 'up' ? 'bg-mint-500' :
                          driver.polarity === 'down' ? 'bg-carrot-500' : 'bg-sand-400'
                        } rounded-full`}
                      />
                    </div>
                    <span className={`${typography.caption} ${strength.textColor} flex-shrink-0`}>
                      {strength.label}
                    </span>
                  </div>

                  {/* Focus hint */}
                  {hasTarget && (
                    <span className={`${typography.caption} text-sky-600 mt-1 block`}>
                      Click to focus
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}

        {/* Footer with count and note about filtering */}
        {(hasFilteredDrivers || hasFallbackDriver) && (
          <div className="px-4 py-2 bg-sand-50">
            <span className={`${typography.caption} text-ink-500`}>
              {hasFallbackDriver ? (
                <>
                  <span className="text-violet-600">From Key Insight</span>
                  <span className="text-ink-400"> • Sensitivity data unavailable</span>
                </>
              ) : (
                <>
                  {drivers.length} driver{drivers.length !== 1 ? 's' : ''} with &gt;5% impact
                  {filteredOutCount > 0 && (
                    <span className="text-ink-400">
                      {' '}• {filteredOutCount} minor factor{filteredOutCount !== 1 ? 's' : ''} hidden
                    </span>
                  )}
                  {otherDrivers.length > 0 && (
                    <span className="text-ink-400">
                      {' '}• {otherDrivers.length} structural node{otherDrivers.length !== 1 ? 's' : ''} excluded
                    </span>
                  )}
                </>
              )}
            </span>
          </div>
        )}
      </div>
      )}
    </div>
  )
}
