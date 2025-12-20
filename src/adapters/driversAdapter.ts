/**
 * Drivers Adapter
 *
 * Transforms PLoT engine driver data into UI-friendly format.
 * PREFERS drivers_payload (new contract) over legacy explain_delta.top_drivers.
 *
 * PLoT Contract:
 * - drivers_payload.status: 'ok' | 'cannot_compute' | 'requires_run' | 'low_discrimination'
 * - drivers_payload.drivers: Present when status='ok' OR 'low_discrimination'
 * - drivers_payload.informative: Boolean flag indicating driver meaningfulness
 * - drivers_payload.remediation_actions: Actions to resolve issues
 *
 * Used by:
 * - OutputsDock to display top drivers
 * - HighlightLayer to highlight driver elements
 * - DriverChips component
 */

import type { Node, Edge } from '@xyflow/react'

// =============================================================================
// Types - PLoT Contract
// =============================================================================

/**
 * DriversPayload from PLoT /v1/run response (new contract)
 */
export interface DriversPayload {
  status: DriversStatus
  status_reason?: string
  remediation_actions?: RemediationAction[]
  drivers?: DriverItem[]
  informative: boolean
}

export type DriversStatus =
  | 'ok'
  | 'cannot_compute'
  | 'requires_run'
  | 'low_discrimination'

export interface DriverItem {
  id: string                    // PLoT format: "from::to::index" for edges
  kind: 'node' | 'edge'
  label: string
  sensitivity_score?: number    // Sensitivity/impact value
}

export interface RemediationAction {
  code: string
  label: string
  target_ids?: string[]
}

/**
 * Legacy raw driver from PLoT API (explain_delta.top_drivers)
 */
export interface RawDriver {
  kind: 'node' | 'edge'
  node_id?: string
  edge_id?: string
  label?: string
  impact?: number
  contribution?: number
  sign?: '+' | '-'
}

// =============================================================================
// Types - UI Output
// =============================================================================

/**
 * Complete drivers display state for UI
 */
export interface DriversDisplayState {
  /** Status from drivers_payload */
  status: DriversStatus

  /** Human-readable reason for non-ok status */
  statusReason?: string

  /** Actions to resolve issues */
  remediationActions?: UIRemediationAction[]

  /** Normalized drivers for display */
  drivers: NormalizedDriver[]

  /** Whether drivers are meaningful for this model */
  informative: boolean

  /** Data source for debugging */
  source: 'drivers_payload' | 'legacy_fallback'
}

export interface UIRemediationAction {
  code: string
  label: string
  targetIds?: string[]
}

/**
 * Normalized driver for UI consumption
 */
export interface NormalizedDriver {
  /** PLoT ID (original format) */
  id: string

  /** UI element ID (mapped from PLoT format) */
  uiId: string

  /** Whether the uiId mapping was successful (false = ID could not be mapped to UI element) */
  uiIdValid: boolean

  kind: 'node' | 'edge'
  label: string

  /** Normalized impact 0-100 */
  impact: number

  impactDirection: 'positive' | 'negative' | 'neutral'

  /** Original impact value for tooltips */
  rawImpact: number

  /** Sensitivity score from new contract */
  sensitivityScore?: number

  /** 1-indexed position */
  rank: number
}

/**
 * Driver display configuration
 */
export interface DriverDisplayConfig {
  maxDrivers: number
  minImpact: number
  showEdges: boolean
}

export const DEFAULT_DRIVER_CONFIG: DriverDisplayConfig = {
  maxDrivers: 5,
  minImpact: 5,
  showEdges: true,
}

// =============================================================================
// Edge ID Mapping (PLoT format → UI format)
// =============================================================================

/**
 * Maps PLoT edge ID format ("from::to::index") to UI edge ID.
 * The index handles parallel edges (multiple edges between same nodes).
 *
 * @param plotEdgeId - Edge ID in PLoT format
 * @param uiEdges - UI edges to search
 * @returns UI edge ID or original if not found
 */
export function mapPloTEdgeIdToUI(plotEdgeId: string, uiEdges: Edge[]): string {
  // First: check if any edge has this exact plot_id stored
  const directMatch = uiEdges.find(e => (e.data as any)?.plot_id === plotEdgeId)
  if (directMatch) {
    return directMatch.id
  }

  // Parse PLoT format: "from::to::index"
  const parts = plotEdgeId.split('::')
  if (parts.length < 2) {
    if (import.meta.env.DEV) {
      console.warn('[DriversAdapter] Invalid PLoT edge ID format:', plotEdgeId)
    }
    return plotEdgeId
  }

  const [from, to, indexStr] = parts
  const index = indexStr ? parseInt(indexStr, 10) : 0

  // Find ALL edges matching source/target, sorted by ID for stable ordering
  const matchingEdges = uiEdges
    .filter(e => e.source === from && e.target === to)
    .sort((a, b) => a.id.localeCompare(b.id))

  if (matchingEdges.length === 0) {
    if (import.meta.env.DEV) {
      console.warn('[DriversAdapter] No UI edge found for PLoT ID:', plotEdgeId, { from, to })
    }
    return plotEdgeId
  }

  // Get the Nth edge (by index)
  if (index >= matchingEdges.length) {
    if (import.meta.env.DEV) {
      console.warn('[DriversAdapter] Index out of range for PLoT ID:', plotEdgeId, {
        from,
        to,
        index,
        availableCount: matchingEdges.length,
      })
    }
    // Fall back to first match
    return matchingEdges[0].id
  }

  return matchingEdges[index].id
}

/**
 * Map driver ID to UI element ID
 * Returns { uiId, valid } where valid indicates if mapping succeeded
 */
function mapDriverIdToUI(
  plotId: string,
  kind: 'node' | 'edge',
  uiNodes: Node[],
  uiEdges: Edge[]
): { uiId: string; valid: boolean } {
  if (kind === 'node') {
    // Check if node exists in UI
    const nodeExists = uiNodes.some(n => n.id === plotId)
    return { uiId: plotId, valid: nodeExists }
  }

  // For edges, try to map from PLoT format
  const mappedId = mapPloTEdgeIdToUI(plotId, uiEdges)

  // If mappedId is the same as plotId and contains '::', mapping failed
  // (mapPloTEdgeIdToUI returns original on failure)
  const valid = mappedId !== plotId || uiEdges.some(e => e.id === mappedId)

  return { uiId: mappedId, valid }
}

// =============================================================================
// Legacy Driver Transformation (fallback)
// =============================================================================

function getDriverIdLegacy(driver: RawDriver): string {
  if (driver.kind === 'node' && driver.node_id) return driver.node_id
  if (driver.kind === 'edge' && driver.edge_id) return driver.edge_id
  return `driver_${driver.label?.replace(/\s+/g, '_').toLowerCase() || 'unknown'}`
}

function getRawImpact(driver: RawDriver): number {
  if (typeof driver.impact === 'number') return driver.impact
  if (typeof driver.contribution === 'number') return driver.contribution
  return 0
}

function normalizeImpact(rawImpact: number): number {
  const absImpact = Math.abs(rawImpact)
  if (absImpact > 1 && absImpact <= 100) return Math.round(absImpact)
  if (absImpact <= 1) return Math.round(absImpact * 100)
  return 100
}

function getImpactDirection(driver: RawDriver): NormalizedDriver['impactDirection'] {
  if (driver.sign === '+') return 'positive'
  if (driver.sign === '-') return 'negative'
  const impact = getRawImpact(driver)
  if (impact > 0) return 'positive'
  if (impact < 0) return 'negative'
  return 'neutral'
}

function resolveLabelLegacy(
  driver: RawDriver,
  nodes: Node[],
  edges: Edge[]
): string {
  if (driver.label) return driver.label

  if (driver.kind === 'node' && driver.node_id) {
    const node = nodes.find(n => n.id === driver.node_id)
    if (node?.data?.label) return String(node.data.label)
    return driver.node_id
  }

  if (driver.kind === 'edge' && driver.edge_id) {
    const edge = edges.find(e => e.id === driver.edge_id)
    if (edge?.data?.label) return String(edge.data.label)
    if (edge) {
      const sourceNode = nodes.find(n => n.id === edge.source)
      const targetNode = nodes.find(n => n.id === edge.target)
      return `${sourceNode?.data?.label || edge.source} → ${targetNode?.data?.label || edge.target}`
    }
    return driver.edge_id
  }

  return 'Unknown driver'
}

function normalizeLegacyDrivers(
  rawDrivers: RawDriver[],
  nodes: Node[],
  edges: Edge[],
  config: DriverDisplayConfig
): NormalizedDriver[] {
  return rawDrivers
    .filter(driver => {
      if (!config.showEdges && driver.kind === 'edge') return false
      const impact = normalizeImpact(getRawImpact(driver))
      return impact >= config.minImpact
    })
    .map((driver): NormalizedDriver => {
      const rawImpact = getRawImpact(driver)
      const plotId = getDriverIdLegacy(driver)
      const { uiId, valid: uiIdValid } = mapDriverIdToUI(plotId, driver.kind, nodes, edges)
      return {
        id: plotId,
        uiId,
        uiIdValid,
        kind: driver.kind,
        label: resolveLabelLegacy(driver, nodes, edges),
        impact: normalizeImpact(rawImpact),
        impactDirection: getImpactDirection(driver),
        rawImpact,
        rank: 0,
      }
    })
    .sort((a, b) => b.impact - a.impact)
    .slice(0, config.maxDrivers)
    .map((driver, index) => ({ ...driver, rank: index + 1 }))
}

// =============================================================================
// New Contract Driver Transformation
// =============================================================================

function normalizeNewDrivers(
  drivers: DriverItem[],
  nodes: Node[],
  edges: Edge[],
  config: DriverDisplayConfig
): NormalizedDriver[] {
  return drivers
    .filter(driver => config.showEdges || driver.kind !== 'edge')
    .map((driver, index): NormalizedDriver => {
      const impact = driver.sensitivity_score !== undefined
        ? normalizeImpact(driver.sensitivity_score)
        : 50 // Default if no score provided

      const { uiId, valid: uiIdValid } = mapDriverIdToUI(driver.id, driver.kind, nodes, edges)

      return {
        id: driver.id,
        uiId,
        uiIdValid,
        kind: driver.kind,
        label: driver.label,
        impact,
        impactDirection: driver.sensitivity_score !== undefined
          ? driver.sensitivity_score >= 0 ? 'positive' : 'negative'
          : 'neutral',
        rawImpact: driver.sensitivity_score ?? 0,
        sensitivityScore: driver.sensitivity_score,
        rank: index + 1,
      }
    })
    .filter(d => d.impact >= config.minImpact)
    .slice(0, config.maxDrivers)
    .map((driver, index) => ({ ...driver, rank: index + 1 }))
}

// =============================================================================
// Main Export Functions
// =============================================================================

/**
 * Adapt drivers from PLoT response to UI format.
 * PREFERS drivers_payload over legacy explain_delta.top_drivers.
 *
 * @param report - PLoT run report (may contain drivers_payload or explain_delta)
 * @param uiNodes - Canvas nodes for label resolution
 * @param uiEdges - Canvas edges for ID mapping and label resolution
 * @param config - Display configuration
 * @returns Complete drivers display state
 *
 * @example
 * const driversState = adaptDrivers(report, nodes, edges)
 * if (driversState.status !== 'ok' && driversState.status !== 'low_discrimination') {
 *   showDriversError(driversState.statusReason, driversState.remediationActions)
 * }
 */
export function adaptDrivers(
  report: {
    drivers_payload?: DriversPayload
    explain_delta?: { top_drivers?: RawDriver[]; top_edge_drivers?: RawDriver[] }
  },
  uiNodes: Node[],
  uiEdges: Edge[],
  config: Partial<DriverDisplayConfig> = {}
): DriversDisplayState {
  const mergedConfig = { ...DEFAULT_DRIVER_CONFIG, ...config }

  // PREFER new structured payload
  if (report.drivers_payload) {
    const { status, status_reason, remediation_actions, drivers, informative } = report.drivers_payload

    return {
      status,
      statusReason: status_reason,
      remediationActions: remediation_actions?.map(a => ({
        code: a.code,
        label: a.label,
        targetIds: a.target_ids,
      })),
      drivers: drivers ? normalizeNewDrivers(drivers, uiNodes, uiEdges, mergedConfig) : [],
      informative,
      source: 'drivers_payload',
    }
  }

  // FALLBACK to legacy (log warning in dev)
  if (import.meta.env.DEV) {
    console.warn('[DriversAdapter] Using legacy fallback - drivers_payload not present')
  }

  const legacyDrivers =
    report.explain_delta?.top_drivers ??
    report.explain_delta?.top_edge_drivers

  if (!legacyDrivers || legacyDrivers.length === 0) {
    return {
      status: 'cannot_compute',
      statusReason: 'Driver information not available',
      remediationActions: [{ code: 'rerun', label: 'Re-run analysis' }],
      drivers: [],
      informative: false,
      source: 'legacy_fallback',
    }
  }

  return {
    status: 'ok',
    drivers: normalizeLegacyDrivers(legacyDrivers, uiNodes, uiEdges, mergedConfig),
    informative: true,
    source: 'legacy_fallback',
  }
}

/**
 * Legacy function - Transform raw API drivers to normalized format
 * @deprecated Use adaptDrivers() instead
 */
export function normalizeDrivers(
  rawDrivers: RawDriver[] | undefined,
  nodes: Node[],
  edges: Edge[],
  config: Partial<DriverDisplayConfig> = {}
): NormalizedDriver[] {
  if (!rawDrivers || rawDrivers.length === 0) return []
  return normalizeLegacyDrivers(rawDrivers, nodes, edges, { ...DEFAULT_DRIVER_CONFIG, ...config })
}

/**
 * Get driver IDs for highlighting (uses uiId for correct mapping)
 * Only includes drivers with valid UI ID mappings
 */
export function getDriverHighlightIds(
  drivers: NormalizedDriver[]
): { nodeIds: string[]; edgeIds: string[] } {
  const nodeIds: string[] = []
  const edgeIds: string[] = []

  for (const driver of drivers) {
    // Only include drivers with valid UI ID mappings
    if (!driver.uiIdValid) continue

    if (driver.kind === 'node') {
      nodeIds.push(driver.uiId)
    } else {
      edgeIds.push(driver.uiId)
    }
  }

  return { nodeIds, edgeIds }
}

/**
 * Format impact for display
 */
export function formatDriverImpact(driver: NormalizedDriver): string {
  const sign = driver.impactDirection === 'positive' ? '+' :
               driver.impactDirection === 'negative' ? '-' : ''
  return `${sign}${driver.impact}%`
}

/**
 * Get CSS class for impact direction
 */
export function getImpactColorClass(
  direction: NormalizedDriver['impactDirection']
): string {
  switch (direction) {
    case 'positive': return 'text-success-600'
    case 'negative': return 'text-error-600'
    default: return 'text-gray-600'
  }
}

/**
 * Convert normalized drivers back to store format
 */
export function toStoreDrivers(
  drivers: NormalizedDriver[]
): Array<{ kind: 'node' | 'edge'; id: string }> {
  return drivers.map(d => ({ kind: d.kind, id: d.uiId }))
}

/**
 * Check if drivers state is actionable (has drivers to display)
 */
export function hasDisplayableDrivers(state: DriversDisplayState): boolean {
  return (state.status === 'ok' || state.status === 'low_discrimination') && state.drivers.length > 0
}

/**
 * Get status message for non-ok states
 */
export function getDriversStatusMessage(state: DriversDisplayState): string {
  switch (state.status) {
    case 'ok':
      return state.informative ? 'Key drivers' : 'Drivers (may not be meaningful)'
    case 'low_discrimination':
      return 'Results are close - drivers may vary'
    case 'cannot_compute':
      return state.statusReason ?? 'Unable to compute drivers'
    case 'requires_run':
      return 'Run analysis to see drivers'
    default:
      return 'Driver information unavailable'
  }
}
