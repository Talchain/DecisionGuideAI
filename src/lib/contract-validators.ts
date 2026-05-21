/**
 * Contract Validators (Debug Panel Contract Inspector)
 *
 * Real-time validation of API responses against V3 Platform Contract.
 * Used by debug panel to show schema compliance status.
 *
 * Validators are defensive and never throw - they return validation results.
 */

// ============================================================================
// Types
// ============================================================================

export interface ContractCheck {
  /** Check name (e.g., "interventions shape") */
  name: string
  /** Whether check passed */
  passed: boolean
  /** Error message if failed */
  message?: string
  /** JSON path to the issue (e.g., "options[0].interventions.factor_1") */
  path?: string
  /** Severity: error blocks analysis, warning is informational */
  severity: 'error' | 'warning'
}

export interface ContractValidationResult {
  /** Whether all error-level checks passed */
  valid: boolean
  /** All checks performed */
  checks: ContractCheck[]
  /** Number of errors */
  errorCount: number
  /** Number of warnings */
  warningCount: number
}

// ============================================================================
// Helper Functions
// ============================================================================

function createCheck(
  name: string,
  passed: boolean,
  severity: 'error' | 'warning',
  message?: string,
  path?: string
): ContractCheck {
  return { name, passed, severity, message, path }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

/** Narrow unknown to Record for safe nested property access (replaces `as any`) */
function asRecord(value: unknown): Record<string, unknown> | undefined {
  return isObject(value) ? value : undefined
}

// ============================================================================
// CEE Response Validators
// ============================================================================

const VALID_CEE_STATUSES = ['ready', 'needs_encoding', 'needs_user_mapping', 'needs_user_input'] as const
const VALID_NODE_KINDS = ['goal', 'factor', 'outcome', 'decision', 'risk', 'action', 'option'] as const

/**
 * Check that interventions are Record<string, number>
 */
function validateInterventionsShape(response: unknown): ContractCheck {
  if (!isObject(response)) {
    return createCheck('interventions shape', false, 'error', 'Response is not an object')
  }

  const analysisReady = asRecord(response.analysis_ready)
  if (!analysisReady?.options) {
    // No options to validate - pass vacuously
    return createCheck('interventions shape', true, 'error')
  }

  const options = analysisReady.options
  if (!Array.isArray(options)) {
    return createCheck('interventions shape', false, 'error', 'options is not an array', 'analysis_ready.options')
  }

  for (let i = 0; i < options.length; i++) {
    const option = asRecord(options[i])
    if (!option?.interventions) continue

    const interventions = option.interventions
    if (!isObject(interventions)) {
      return createCheck(
        'interventions shape',
        false,
        'error',
        `interventions is not an object`,
        `analysis_ready.options[${i}].interventions`
      )
    }

    for (const [key, value] of Object.entries(interventions)) {
      // V3 allows either number or object with value property
      const numericValue = typeof value === 'number' ? value : asRecord(value)?.value
      if (typeof numericValue !== 'number') {
        return createCheck(
          'interventions shape',
          false,
          'error',
          `expected number, got ${typeof value}`,
          `analysis_ready.options[${i}].interventions.${key}`
        )
      }
    }
  }

  return createCheck('interventions shape', true, 'error')
}

/**
 * Check that status is a valid enum value
 */
function validateCEEStatus(response: unknown): ContractCheck {
  if (!isObject(response)) {
    return createCheck('status enum', false, 'error', 'Response is not an object')
  }

  const analysisReady = asRecord(response.analysis_ready)
  if (!analysisReady?.status) {
    // Status is optional at top level
    return createCheck('status enum', true, 'error')
  }

  const status = analysisReady.status
  if (typeof status !== 'string' || !VALID_CEE_STATUSES.includes(status as typeof VALID_CEE_STATUSES[number])) {
    return createCheck(
      'status enum',
      false,
      'error',
      `invalid status "${status}", expected one of: ${VALID_CEE_STATUSES.join(', ')}`,
      'analysis_ready.status'
    )
  }

  return createCheck('status enum', true, 'error')
}

/**
 * Check that goal_node_id is present
 */
function validateGoalNodeId(response: unknown): ContractCheck {
  if (!isObject(response)) {
    return createCheck('goal_node_id present', false, 'warning', 'Response is not an object')
  }

  const analysisReady = asRecord(response.analysis_ready)
  if (!analysisReady) {
    return createCheck('goal_node_id present', true, 'warning')
  }

  const goalNodeId = analysisReady.goal_node_id
  if (!isNonEmptyString(goalNodeId)) {
    return createCheck(
      'goal_node_id present',
      false,
      'warning',
      'goal_node_id is missing or empty',
      'analysis_ready.goal_node_id'
    )
  }

  return createCheck('goal_node_id present', true, 'warning')
}

/**
 * Check that all nodes have valid kind
 */
function validateNodeKinds(response: unknown): ContractCheck {
  if (!isObject(response)) {
    return createCheck('node kinds valid', false, 'error', 'Response is not an object')
  }

  const nodes = response.nodes ?? asRecord(response.graph)?.nodes
  if (!nodes || !Array.isArray(nodes)) {
    return createCheck('node kinds valid', true, 'error')
  }

  for (let i = 0; i < nodes.length; i++) {
    const node = asRecord(nodes[i])
    const kind = node?.kind || node?.type
    if (kind && typeof kind === 'string' && !VALID_NODE_KINDS.includes(kind as typeof VALID_NODE_KINDS[number])) {
      return createCheck(
        'node kinds valid',
        false,
        'error',
        `invalid kind "${kind}"`,
        `nodes[${i}].kind`
      )
    }
  }

  return createCheck('node kinds valid', true, 'error')
}

/**
 * Check that edges have std > 0
 */
function validateEdgeStd(response: unknown): ContractCheck {
  if (!isObject(response)) {
    return createCheck('edge std > 0', false, 'error', 'Response is not an object')
  }

  const edges = response.edges ?? asRecord(response.graph)?.edges
  if (!edges || !Array.isArray(edges)) {
    return createCheck('edge std > 0', true, 'error')
  }

  for (let i = 0; i < edges.length; i++) {
    const edge = asRecord(edges[i])
    const edgeData = asRecord(edge?.data)
    const strength = asRecord(edge?.strength) ?? asRecord(edgeData?.strength)
    const std = strength?.std ?? edgeData?.strengthStd
    if (typeof std === 'number' && std <= 0) {
      return createCheck(
        'edge std > 0',
        false,
        'error',
        `std must be > 0, got ${std}`,
        `edges[${i}].strength.std`
      )
    }
  }

  return createCheck('edge std > 0', true, 'error')
}

/**
 * Check that edge strength mean is between -1 and 1
 */
function validateEdgeMean(response: unknown): ContractCheck {
  if (!isObject(response)) {
    return createCheck('edge mean in [-1, 1]', false, 'warning', 'Response is not an object')
  }

  const edges = response.edges ?? asRecord(response.graph)?.edges
  if (!edges || !Array.isArray(edges)) {
    return createCheck('edge mean in [-1, 1]', true, 'warning')
  }

  for (let i = 0; i < edges.length; i++) {
    const edge = asRecord(edges[i])
    const edgeData = asRecord(edge?.data)
    const strength = asRecord(edge?.strength) ?? asRecord(edgeData?.strength)
    const mean = strength?.mean ?? edgeData?.confidence
    if (typeof mean === 'number' && (mean < -1 || mean > 1)) {
      return createCheck(
        'edge mean in [-1, 1]',
        false,
        'warning',
        `mean should be in [-1, 1], got ${mean}`,
        `edges[${i}].strength.mean`
      )
    }
  }

  return createCheck('edge mean in [-1, 1]', true, 'warning')
}

/**
 * Validate a CEE response against V3 Platform Contract
 */
export function validateCEEResponse(response: unknown): ContractValidationResult {
  const checks: ContractCheck[] = [
    validateInterventionsShape(response),
    validateCEEStatus(response),
    validateGoalNodeId(response),
    validateNodeKinds(response),
    validateEdgeStd(response),
    validateEdgeMean(response),
  ]

  const errorCount = checks.filter((c) => !c.passed && c.severity === 'error').length
  const warningCount = checks.filter((c) => !c.passed && c.severity === 'warning').length

  return {
    valid: errorCount === 0,
    checks,
    errorCount,
    warningCount,
  }
}

// ============================================================================
// PLoT Response Validators
// ============================================================================

const VALID_ANALYSIS_STATUSES = ['computed', 'partial', 'blocked', 'failed'] as const

/**
 * Check that analysis_status is a valid enum
 */
function validateAnalysisStatus(response: unknown): ContractCheck {
  if (!isObject(response)) {
    return createCheck('analysis_status enum', false, 'error', 'Response is not an object')
  }

  const status = response.analysis_status
  if (!status) {
    return createCheck('analysis_status enum', false, 'error', 'analysis_status is missing')
  }

  if (typeof status !== 'string' || !VALID_ANALYSIS_STATUSES.includes(status as typeof VALID_ANALYSIS_STATUSES[number])) {
    return createCheck(
      'analysis_status enum',
      false,
      'error',
      `invalid status "${status}", expected one of: ${VALID_ANALYSIS_STATUSES.join(', ')}`,
      'analysis_status'
    )
  }

  return createCheck('analysis_status enum', true, 'error')
}

/**
 * Check that seed_used is valid (present and not "42")
 * PLoT returns seed in meta.seed_used
 */
function validateSeedUsed(response: unknown): ContractCheck {
  if (!isObject(response)) {
    return createCheck('seed_used valid', false, 'error', 'Response is not an object')
  }

  // PLoT returns seed in meta.seed_used
  const meta = asRecord(response.meta)
  const seedUsed = meta?.seed_used ?? response.seed_used
  if (seedUsed === undefined) {
    return createCheck('seed_used valid', false, 'error', 'seed_used is missing (check meta.seed_used)')
  }

  // Seed "42" indicates default/test seed wasn't overridden
  if (seedUsed === '42' || seedUsed === 42) {
    return createCheck(
      'seed_used valid',
      false,
      'error',
      'seed_used is "42" (default test seed)',
      'meta.seed_used'
    )
  }

  return createCheck('seed_used valid', true, 'error')
}

/**
 * Check that option_comparison results are present when status is computed
 */
function validateResultsPresent(response: unknown): ContractCheck {
  if (!isObject(response)) {
    return createCheck('results present', false, 'error', 'Response is not an object')
  }

  const status = response.analysis_status
  if (status !== 'computed' && status !== 'partial') {
    return createCheck('results present', true, 'error')
  }

  // PLoT returns option_comparison (not results or options)
  const optionComparison = response.option_comparison
  if (!Array.isArray(optionComparison) || optionComparison.length === 0) {
    return createCheck(
      'results present',
      false,
      'error',
      `option_comparison should be non-empty array when status is ${status}`,
      'option_comparison'
    )
  }

  return createCheck('results present', true, 'error')
}

/**
 * Check that option_comparison entries have valid confidence_interval
 */
function validateOutcomeShape(response: unknown): ContractCheck {
  if (!isObject(response)) {
    return createCheck('outcome shape', false, 'error', 'Response is not an object')
  }

  // PLoT returns option_comparison with confidence_interval
  const optionComparison = response.option_comparison
  if (!Array.isArray(optionComparison)) {
    return createCheck('outcome shape', true, 'error')
  }

  for (let i = 0; i < optionComparison.length; i++) {
    const option = asRecord(optionComparison[i])
    const ci = option?.confidence_interval

    if (!ci) {
      return createCheck(
        'outcome shape',
        false,
        'error',
        'confidence_interval is missing',
        `option_comparison[${i}].confidence_interval`
      )
    }

    if (!Array.isArray(ci) || ci.length !== 2) {
      return createCheck(
        'outcome shape',
        false,
        'error',
        'confidence_interval must be a [low, high] tuple',
        `option_comparison[${i}].confidence_interval`
      )
    }

    if (typeof ci[0] !== 'number' || typeof ci[1] !== 'number') {
      return createCheck(
        'outcome shape',
        false,
        'error',
        'confidence_interval values must be numbers',
        `option_comparison[${i}].confidence_interval`
      )
    }
  }

  return createCheck('outcome shape', true, 'error')
}

/**
 * Check that robustness has valid structure (fragile_edges/robust_edges)
 */
function validateRobustnessShape(response: unknown): ContractCheck {
  if (!isObject(response)) {
    return createCheck('robustness shape', false, 'error', 'Response is not an object')
  }

  const robustness = asRecord(response.robustness)
  if (!robustness) {
    // Robustness is optional
    return createCheck('robustness shape', true, 'error')
  }

  // PLoT returns robustness with fragile_edges and robust_edges arrays
  if (!Array.isArray(robustness.fragile_edges)) {
    return createCheck(
      'robustness shape',
      false,
      'error',
      'robustness.fragile_edges must be an array',
      'robustness.fragile_edges'
    )
  }

  if (!Array.isArray(robustness.robust_edges)) {
    return createCheck(
      'robustness shape',
      false,
      'error',
      'robustness.robust_edges must be an array',
      'robustness.robust_edges'
    )
  }

  return createCheck('robustness shape', true, 'error')
}

/**
 * Check that request_id in response matches sent X-Request-Id
 */
function validateRequestIdMatch(response: unknown, sentRequestId?: string): ContractCheck {
  if (!isObject(response) || !sentRequestId) {
    return createCheck('request_id matches', true, 'warning')
  }

  const responseRequestId = response.request_id
  if (typeof responseRequestId !== 'string') {
    return createCheck('request_id matches', true, 'warning')
  }

  if (responseRequestId !== sentRequestId) {
    return createCheck(
      'request_id matches',
      false,
      'warning',
      `sent "${sentRequestId.slice(0, 8)}...", received "${responseRequestId.slice(0, 8)}..."`,
      'request_id'
    )
  }

  return createCheck('request_id matches', true, 'warning')
}

/**
 * Validate a PLoT response against V3 Platform Contract
 */
export function validatePLoTResponse(response: unknown, sentRequestId?: string): ContractValidationResult {
  const checks: ContractCheck[] = [
    validateAnalysisStatus(response),
    validateSeedUsed(response),
    validateResultsPresent(response),
    validateOutcomeShape(response),
    validateRobustnessShape(response),
    validateRequestIdMatch(response, sentRequestId),
  ]

  const errorCount = checks.filter((c) => !c.passed && c.severity === 'error').length
  const warningCount = checks.filter((c) => !c.passed && c.severity === 'warning').length

  return {
    valid: errorCount === 0,
    checks,
    errorCount,
    warningCount,
  }
}

// ============================================================================
// Service Detection
// ============================================================================

/**
 * Path-boundary regex for the V5 CEE proxy turn endpoint, e.g.
 * `https://cee-staging.onrender.com/proxy/v5/turn`. Required because
 * a loose substring `lower.includes('proxy/v5/turn')` would also
 * match look-alikes like `/proxy/v5/turning` and incorrectly classify
 * them as CEE. The boundary chars are `/`, `?`, `#`, or end-of-string
 * — anything that terminates a URL pathname segment.
 *
 * Mirrors the path-boundary invariant in
 * `src/lib/v5TraceMatching.ts :: V5_TURN_PROXY_PATHNAME_RE` so the
 * two layers (classifier here + selector there) cannot drift.
 */
const PROXY_V5_TURN_RE = /\/proxy\/v5\/turn(?:\/|$|\?|#)/

/**
 * Detect which service a request is for based on endpoint
 */
export function detectService(endpoint: string): 'CEE' | 'PLoT' | 'ISL' | 'BFF' | 'M2' | 'unknown' {
  const lower = endpoint.toLowerCase()
  // CEE / orchestrator endpoints — includes /bff/orchestrate/ proxy path
  // AND the staging V5 proxy turn endpoint (`/proxy/v5/turn`) set via
  // `VITE_V5_ENDPOINT` in the Netlify dashboard. The proxy variant
  // uses a path-boundary regex so look-alikes (`/proxy/v5/turning`)
  // are NOT misclassified as CEE.
  if (
    lower.includes('/cee/') ||
    lower.includes('assist') ||
    lower.includes('draft-graph') ||
    lower.includes('orchestrate') ||
    PROXY_V5_TURN_RE.test(lower)
  ) {
    return 'CEE'
  }
  if (lower.includes('/plot/') || lower.includes('/engine/') || lower.includes('/v2/run') || lower.includes('/v1/run')) {
    return 'PLoT'
  }
  if (lower.includes('/isl/') || lower.includes('validate') || lower.includes('robustness')) {
    return 'ISL'
  }
  // M2 Decision Review (LLM-enhanced coaching)
  if (lower.includes('/v2/review')) {
    return 'M2'
  }
  if (lower.includes('/bff/')) {
    return 'BFF'
  }
  return 'unknown'
}

/**
 * Validate a response based on detected service
 */
export function validateResponse(
  endpoint: string,
  response: unknown,
  requestId?: string
): ContractValidationResult {
  const service = detectService(endpoint)

  switch (service) {
    case 'CEE':
      return validateCEEResponse(response)
    case 'PLoT':
      // Check if this is an error response (blocked/failed)
      if (isObject(response) && typeof response.analysis_status === 'string' && ['blocked', 'failed'].includes(response.analysis_status)) {
        return validatePLoTErrorResponse(response)
      }
      return validatePLoTResponse(response, requestId)
    case 'ISL':
      // ISL uses similar structure to PLoT for validation responses
      return validatePLoTResponse(response, requestId)
    default:
      // No validation for unknown services
      return {
        valid: true,
        checks: [],
        errorCount: 0,
        warningCount: 0,
      }
  }
}

// ============================================================================
// PLoT Error Response Validators
// ============================================================================

/**
 * Validate a PLoT error response (422 blocked, failed, etc.)
 */
export function validatePLoTErrorResponse(response: unknown): ContractValidationResult {
  const checks: ContractCheck[] = []

  if (!isObject(response)) {
    return {
      valid: false,
      checks: [createCheck('response shape', false, 'error', 'Response is not an object')],
      errorCount: 1,
      warningCount: 0,
    }
  }

  // Check analysis_status is blocked or failed
  const analysisStatus = response.analysis_status
  const analysisStatusStr = typeof analysisStatus === 'string' ? analysisStatus : undefined
  checks.push(
    createCheck(
      'analysis_status is error type',
      !!analysisStatusStr && ['blocked', 'failed'].includes(analysisStatusStr),
      'error',
      analysisStatusStr ? `status is "${analysisStatusStr}"` : 'analysis_status missing'
    )
  )

  // Check status_reason present
  const statusReason = response.status_reason
  checks.push(
    createCheck(
      'status_reason present',
      typeof statusReason === 'string' && statusReason.length > 0,
      'warning',
      statusReason ? undefined : 'status_reason is missing or empty'
    )
  )

  // Check critiques array (for blocked responses)
  if (analysisStatusStr === 'blocked') {
    const critiques = response.critiques
    const hasCritiques = Array.isArray(critiques) && critiques.length > 0
    checks.push(
      createCheck(
        'critiques present',
        hasCritiques,
        'warning',
        hasCritiques ? undefined : 'critiques array is empty or missing'
      )
    )

    // Validate critique structure
    if (hasCritiques && Array.isArray(critiques)) {
      for (let i = 0; i < critiques.length; i++) {
        const critique = asRecord(critiques[i])
        if (!critique?.code || typeof critique.code !== 'string') {
          checks.push(
            createCheck(
              'critique has code',
              false,
              'warning',
              'critique missing code',
              `critiques[${i}].code`
            )
          )
        }
        if (!critique?.severity || typeof critique.severity !== 'string' || !['error', 'warning', 'info'].includes(critique.severity)) {
          checks.push(
            createCheck(
              'critique has valid severity',
              false,
              'warning',
              `invalid severity: ${critique?.severity}`,
              `critiques[${i}].severity`
            )
          )
        }
      }
    }
  }

  // Check request_id echoed
  const requestId = response.request_id
  checks.push(
    createCheck(
      'request_id present',
      typeof requestId === 'string' && requestId.length > 0,
      'warning',
      requestId ? undefined : 'request_id is missing'
    )
  )

  const errorCount = checks.filter((c) => !c.passed && c.severity === 'error').length
  const warningCount = checks.filter((c) => !c.passed && c.severity === 'warning').length

  return {
    valid: errorCount === 0,
    checks,
    errorCount,
    warningCount,
  }
}

// ============================================================================
// PLoT Request Validators
// ============================================================================

/**
 * Validate a PLoT request (useful for debugging why requests were rejected)
 */
export function validatePLoTRequest(request: unknown): ContractValidationResult {
  const checks: ContractCheck[] = []

  if (!isObject(request)) {
    return {
      valid: false,
      checks: [createCheck('request shape', false, 'error', 'Request is not an object')],
      errorCount: 1,
      warningCount: 0,
    }
  }

  // After isObject guard, request is Record<string, unknown>

  // Check goal_node_id present
  checks.push(
    createCheck(
      'goal_node_id present',
      typeof request.goal_node_id === 'string' && request.goal_node_id.length > 0,
      'error',
      request.goal_node_id ? undefined : 'goal_node_id is missing or empty'
    )
  )

  // Check options non-empty
  const options = request.options
  const hasOptions = Array.isArray(options) && options.length > 0
  checks.push(
    createCheck(
      'options present',
      hasOptions,
      'error',
      hasOptions ? undefined : 'options array is empty or missing'
    )
  )

  // Check interventions are numbers
  if (hasOptions) {
    let interventionsValid = true
    let invalidPath: string | undefined

    for (let i = 0; i < options.length; i++) {
      const opt = asRecord(options[i])
      const interventions = opt?.interventions
      if (!isObject(interventions)) {
        interventionsValid = false
        invalidPath = `options[${i}].interventions`
        break
      }
      for (const [key, value] of Object.entries(interventions)) {
        if (typeof value !== 'number') {
          interventionsValid = false
          invalidPath = `options[${i}].interventions.${key}`
          break
        }
      }
      if (!interventionsValid) break
    }

    checks.push(
      createCheck(
        'interventions are numbers',
        interventionsValid,
        'error',
        interventionsValid ? undefined : `non-numeric intervention value`,
        invalidPath
      )
    )
  }

  // Check graph structure
  const graph = asRecord(request.graph)
  const hasGraph = !!graph && Array.isArray(graph.nodes) && Array.isArray(graph.edges)
  checks.push(
    createCheck(
      'graph structure valid',
      hasGraph,
      'error',
      hasGraph ? undefined : 'graph is missing or malformed'
    )
  )

  // Check causal path from interventions to goal
  if (hasGraph && hasOptions && typeof request.goal_node_id === 'string') {
    const pathResult = checkCausalPath(
      { nodes: graph.nodes as unknown[], edges: graph.edges as unknown[] },
      options,
      request.goal_node_id
    )
    checks.push(
      createCheck(
        'causal path to goal',
        pathResult.hasPath,
        'error',
        pathResult.hasPath ? undefined : pathResult.reason,
        pathResult.disconnectedNodes?.join(', ')
      )
    )
  }

  const errorCount = checks.filter((c) => !c.passed && c.severity === 'error').length
  const warningCount = checks.filter((c) => !c.passed && c.severity === 'warning').length

  return {
    valid: errorCount === 0,
    checks,
    errorCount,
    warningCount,
  }
}

// ============================================================================
// Causal Path Check
// ============================================================================

interface CausalPathResult {
  hasPath: boolean
  reason?: string
  disconnectedNodes?: string[]
}

/**
 * Check if there's a causal path from intervention targets to the goal node.
 * This validates that interventions can actually affect the goal.
 */
export function checkCausalPath(
  graph: { nodes: unknown[]; edges: unknown[] },
  options: unknown[],
  goalNodeId: string
): CausalPathResult {
  if (!graph || !options || !goalNodeId) {
    return { hasPath: false, reason: 'Missing graph, options, or goal' }
  }

  // Build adjacency list (directed graph)
  const adjacency = new Map<string, string[]>()
  for (const edgeRaw of graph.edges) {
    const edge = asRecord(edgeRaw)
    const from = edge?.from || edge?.source
    const to = edge?.to || edge?.target
    if (typeof from !== 'string' || typeof to !== 'string') continue
    if (!adjacency.has(from)) adjacency.set(from, [])
    adjacency.get(from)!.push(to)
  }

  // Get all intervention target nodes
  const interventionTargets = new Set<string>()
  for (const optionRaw of options) {
    const option = asRecord(optionRaw)
    for (const nodeId of Object.keys((isObject(option?.interventions) ? option.interventions : {}) as Record<string, unknown>)) {
      interventionTargets.add(nodeId)
    }
  }

  if (interventionTargets.size === 0) {
    return { hasPath: false, reason: 'No intervention targets found' }
  }

  // Check if goal node exists in graph
  const nodeIds = new Set(graph.nodes.map((n) => asRecord(n)?.id).filter((id): id is string => typeof id === 'string'))
  if (!nodeIds.has(goalNodeId)) {
    return { hasPath: false, reason: `Goal node "${goalNodeId}" not in graph` }
  }

  // BFS from each intervention target to goal
  const disconnectedNodes: string[] = []

  for (const start of interventionTargets) {
    if (!nodeIds.has(start)) {
      disconnectedNodes.push(start)
      continue
    }

    const visited = new Set<string>()
    const queue = [start]
    let foundPath = false

    while (queue.length > 0) {
      const current = queue.shift()!
      if (current === goalNodeId) {
        foundPath = true
        break
      }
      if (visited.has(current)) continue
      visited.add(current)

      for (const neighbor of adjacency.get(current) || []) {
        queue.push(neighbor)
      }
    }

    if (!foundPath) {
      disconnectedNodes.push(start)
    }
  }

  if (disconnectedNodes.length > 0) {
    return {
      hasPath: false,
      reason: `No path from intervention node(s) to goal`,
      disconnectedNodes,
    }
  }

  return { hasPath: true }
}
