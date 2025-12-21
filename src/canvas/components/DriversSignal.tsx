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
 * - Brief C: ISL Robustness Suite integration
 *   - Tipping points ("If X reaches Y%, recommendation flips")
 *   - Value of Information ("Validating X worth £Y/year")
 */

import { useState, useCallback, useMemo, useEffect } from 'react'
import {
  ChevronDown,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  Lightbulb,
  Search,
  FileText,
  Loader2,
} from 'lucide-react'
import { useCanvasStore } from '../store'
import { focusNodeById, focusEdgeById } from '../utils/focusHelpers'
import { typography } from '../../styles/typography'
import { useISLConformal } from '../../hooks/useISLConformal'
import { buildRichGraphPayload } from '../utils/graphPayload'
import type { ISLConformalPrediction } from '../../adapters/isl/types'
import type { RobustnessResult, SensitiveParameter, ValueOfInformation } from './RecommendationCard/types'
import type { SynthesisNarratives } from '../hooks/useISLSynthesis'
// P0.1: Driver gating types
import type { DriversGatingState } from '../../lib/driversGating'

interface DriversSignalProps {
  /** Maximum drivers to show when collapsed */
  maxCollapsed?: number
  /** Start expanded */
  defaultExpanded?: boolean
  /** Brief C: ISL Robustness data for sensitivity/VoI */
  robustness?: RobustnessResult | null
  /** Brief C: Loading state for robustness data */
  robustnessLoading?: boolean
  /** Callback when sensitive parameter is clicked */
  onParameterClick?: (nodeId: string) => void
  /** Callback when VoI action is clicked */
  onVoiActionClick?: (nodeId: string, action: string) => void
  /** Brief E Task 2: ISL Synthesis narratives */
  synthesis?: SynthesisNarratives | null
  /** Brief E Task 2: Loading state for synthesis */
  synthesisLoading?: boolean
  /** P0.1: Driver gating state for contradiction prevention */
  gatingState?: DriversGatingState
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
  robustness,
  robustnessLoading = false,
  onParameterClick,
  onVoiActionClick,
  synthesis,
  synthesisLoading = false,
  gatingState,
}: DriversSignalProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  const results = useCanvasStore((s) => s.results)
  const setHighlightedNodes = useCanvasStore((s) => s.setHighlightedNodes)
  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)
  const report = results?.report

  // Brief C: Build mapping from node_id to sensitive parameter for tipping point display
  const sensitiveParamByNodeId = useMemo(() => {
    if (!robustness?.sensitivity) return new Map<string, SensitiveParameter>()
    return new Map(robustness.sensitivity.map(p => [p.node_id, p]))
  }, [robustness?.sensitivity])

  // Brief C: Also map by label (normalized lowercase) for fallback matching
  const sensitiveParamByLabel = useMemo(() => {
    if (!robustness?.sensitivity) return new Map<string, SensitiveParameter>()
    return new Map(robustness.sensitivity.map(p => [p.label.toLowerCase(), p]))
  }, [robustness?.sensitivity])

  // Brief C: VoI items worth investigating
  const worthInvestigatingVoi = useMemo(() => {
    if (!robustness?.value_of_information) return []
    return robustness.value_of_information.filter(v => v.worth_investigating)
  }, [robustness?.value_of_information])

  // Conformal predictions for sensitivity badges
  const { data: conformalData, loading: conformalLoading, predict } = useISLConformal()

  // Auto-fetch conformal predictions when results exist
  useEffect(() => {
    // Only fetch if we have results, nodes, and haven't fetched yet
    if (!report?.drivers || nodes.length === 0 || conformalData || conformalLoading) return

    const timer = setTimeout(() => {
      predict({
        graph: buildRichGraphPayload(nodes, edges),
        options: {
          enable_conformal: true,
          confidence_level: 0.95,
        },
      }).catch(() => {
        // Silently fail - badges are optional enhancement
      })
    }, 500)

    return () => clearTimeout(timer)
  }, [report?.drivers, nodes, edges, conformalData, conformalLoading, predict])

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
  const { causalDrivers, otherDrivers } = useMemo(() => {
    if (!report?.drivers) return { causalDrivers: [], otherDrivers: [] }

    const causal: typeof report.drivers = []
    const other: typeof report.drivers = []

    // Structural types to explicitly exclude (these are not causal factors)
    const STRUCTURAL_TYPES = new Set(['goal', 'decision', 'option', 'outcome'])

    for (const driver of report.drivers) {
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
    const sortDrivers = (drivers: typeof report.drivers) =>
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
    }
  }, [report, getDriverNodeKind])

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

  // P0.1: Use gating state when available to determine if drivers should be shown
  const shouldShowDrivers = gatingState ? gatingState.showDriverNarratives : drivers.length > 0

  // Empty/gated state - show fallback message and remediation actions
  if (!shouldShowDrivers) {
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

    // P0.1: Show fallback message from gating state
    const fallbackMessage = gatingState?.fallbackMessage || 'Run analysis to see key factors influencing the outcome'
    const remediationActions = gatingState?.remediationActions || []

    return (
      <div className="p-4 bg-sand-50 border border-sand-200 rounded-xl">
        <div className="flex items-start gap-3">
          <Zap className="h-5 w-5 text-sand-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className={`${typography.body} text-sand-600`}>
              {drivers.length === 0 ? 'No drivers identified' : 'Driver analysis not available'}
            </p>
            <p className={`${typography.caption} text-sand-500 mt-1`}>
              {fallbackMessage}
            </p>
            {/* P0.1: Remediation actions */}
            {remediationActions.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {remediationActions.map((action) => (
                  <li
                    key={action.code}
                    className={`${typography.caption} text-sky-600 flex items-start gap-2`}
                  >
                    <ArrowUpRight className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{action.label}</span>
                  </li>
                ))}
              </ul>
            )}
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

          // Brief C: Get sensitive parameter for tipping point display
          const sensitiveParam = driver.nodeId
            ? sensitiveParamByNodeId.get(driver.nodeId)
            : sensitiveParamByLabel.get(driver.label.toLowerCase())
          const hasTippingPoint = sensitiveParam && sensitiveParam.flip_threshold !== undefined

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

                  {/* Brief C: Tipping point display */}
                  {hasTippingPoint && sensitiveParam && (
                    <div
                      className="mt-2 p-2 bg-banana-50 border border-banana-200 rounded-lg"
                      data-testid={`tipping-point-${driver.nodeId || index}`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className="h-3.5 w-3.5 text-banana-600" aria-hidden="true" />
                        <span className={`${typography.caption} font-medium text-banana-800`}>
                          Tipping Point
                        </span>
                      </div>
                      <p className={`${typography.caption} text-banana-700`}>
                        If {driver.label.toLowerCase()} {sensitiveParam.direction === 'increase' ? 'rises to' : 'falls to'}{' '}
                        <strong>{Math.round(sensitiveParam.flip_threshold * 100)}%</strong>, recommendation flips
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`${typography.caption} text-ink-500`}>
                          Current: {Math.round(sensitiveParam.current_value * 100)}%
                        </span>
                        <span className={`${typography.caption} text-banana-600`}>
                          ({Math.abs(Math.round((sensitiveParam.flip_threshold - sensitiveParam.current_value) * 100))}% gap)
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Focus hint */}
                  {hasTarget && !hasTippingPoint && (
                    <span className={`${typography.caption} text-sky-600 mt-1 block`}>
                      Click to focus
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}

        {/* Brief C: Value of Information section */}
        {worthInvestigatingVoi.length > 0 && (
          <div className="px-4 py-3 bg-violet-50/50" data-testid="voi-section">
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="h-4 w-4 text-violet-600" aria-hidden="true" />
              <span className={`${typography.label} text-ink-700`}>
                Worth Investigating
              </span>
              <span className={`${typography.caption} text-violet-600`}>
                High value of information
              </span>
            </div>
            <div className="space-y-2">
              {worthInvestigatingVoi.map((voi) => {
                // Format EVPI display (as currency or percentage)
                const evpiDisplay = voi.evpi >= 1
                  ? `£${voi.evpi.toLocaleString()}/year`
                  : `${(voi.evpi * 100).toFixed(0)}%`

                return (
                  <button
                    key={voi.node_id}
                    type="button"
                    onClick={() => {
                      onVoiActionClick?.(voi.node_id, voi.suggested_action || 'investigate')
                      setHighlightedNodes([voi.node_id])
                      focusNodeById(voi.node_id)
                      setTimeout(() => setHighlightedNodes([]), 3000)
                    }}
                    className="w-full text-left p-2.5 rounded-lg bg-violet-100 border border-violet-200 hover:bg-violet-200 transition-colors"
                    data-testid={`voi-${voi.node_id}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <Search className="h-3.5 w-3.5 text-violet-600" aria-hidden="true" />
                        <span className={`${typography.bodySmall} font-medium text-ink-800`}>
                          {voi.label}
                        </span>
                      </div>
                      <span className={`${typography.caption} font-medium text-violet-700`}>
                        Worth {evpiDisplay}
                      </span>
                    </div>
                    {voi.suggested_action && (
                      <p className={`${typography.caption} text-violet-700`}>
                        {voi.suggested_action}
                      </p>
                    )}
                    {voi.resolution_cost != null && (
                      <span className={`${typography.caption} text-ink-500 mt-1 block`}>
                        Est. cost: £{voi.resolution_cost.toLocaleString()}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Brief E Task 2: ISL Synthesis Narratives */}
        {(synthesis || synthesisLoading) && (
          <div className="px-4 py-3 bg-sky-50/50" data-testid="synthesis-section">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="h-4 w-4 text-sky-600" aria-hidden="true" />
              <span className={`${typography.label} text-ink-700`}>
                Analysis Narratives
              </span>
              {synthesisLoading && (
                <Loader2 className="h-3.5 w-3.5 text-sky-500 animate-spin" aria-hidden="true" />
              )}
            </div>

            {synthesisLoading && !synthesis && (
              <div className="space-y-2 animate-pulse">
                <div className="h-4 bg-sky-100 rounded w-3/4"></div>
                <div className="h-4 bg-sky-100 rounded w-1/2"></div>
              </div>
            )}

            {synthesis && (
              <div className="space-y-4">
                {synthesis.decision && (
                  <div>
                    <h4 className={`${typography.caption} font-medium text-sky-700 mb-1`}>
                      Decision Context
                    </h4>
                    <p className={`${typography.bodySmall} text-ink-700`}>
                      {synthesis.decision}
                    </p>
                  </div>
                )}

                {synthesis.uncertainty && (
                  <div>
                    <h4 className={`${typography.caption} font-medium text-sky-700 mb-1`}>
                      Key Uncertainties
                    </h4>
                    <p className={`${typography.bodySmall} text-ink-700`}>
                      {synthesis.uncertainty}
                    </p>
                  </div>
                )}

                {synthesis.recommendation && (
                  <div>
                    <h4 className={`${typography.caption} font-medium text-sky-700 mb-1`}>
                      Recommendation
                    </h4>
                    <p className={`${typography.bodySmall} text-ink-700`}>
                      {synthesis.recommendation}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Footer with count and note about filtering */}
        {hasFilteredDrivers && (
          <div className="px-4 py-2 bg-sand-50">
            <span className={`${typography.caption} text-ink-500`}>
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
            </span>
          </div>
        )}
      </div>
      )}
    </div>
  )
}
