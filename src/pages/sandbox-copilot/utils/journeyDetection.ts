import type { Node, Edge } from '@xyflow/react'
import type { JourneyStage } from '../hooks/useCopilotStore'

/**
 * Graph data for journey detection
 */
export interface GraphData {
  nodes: Node[]
  edges: Edge[]
}

/**
 * Results data from PLoT analysis
 */
export interface AnalysisResults {
  status: 'complete' | 'error' | 'idle'
  report?: unknown  // Will be typed properly when we integrate with actual PLoT types
}

/**
 * Context for determining journey stage
 */
export interface JourneyContext {
  graph: GraphData
  results?: AnalysisResults
  selectedElement?: string | null
  compareMode?: boolean
}

/**
 * Determines the current journey stage based on context
 *
 * Priority order:
 * 1. User has something selected (inspector)
 * 2. Compare mode active (compare)
 * 3. No graph built yet (empty)
 * 4. Has results from run (post-run)
 * 5. Graph has blockers (pre-run-blocked)
 * 6. Ready to run (pre-run-ready)
 * 7. Still building (building)
 */
export function determineJourneyStage(context: JourneyContext): JourneyStage {
  const { graph, results, selectedElement, compareMode } = context

  // Priority 1: User has something selected
  if (selectedElement) {
    return 'inspector'
  }

  // Priority 2: Compare mode active
  if (compareMode) {
    return 'compare'
  }

  // Priority 3: No graph built yet
  if (!graph.nodes || graph.nodes.length === 0) {
    return 'empty'
  }

  // Priority 4: Has results from run
  if (results && results.status === 'complete') {
    return 'post-run'
  }

  // Priority 5: Check if runnable
  const blockers = findBlockers(graph)
  if (blockers.length > 0) {
    return 'pre-run-blocked'
  }

  // Priority 6: Ready to run
  if (isGraphRunnable(graph)) {
    return 'pre-run-ready'
  }

  // Default: Still building
  return 'building'
}

/**
 * Finds blocking issues that prevent running analysis
 *
 * Blockers include:
 * - Missing outcome node
 * - Missing decision node
 * - No edges connecting nodes
 */
export function findBlockers(graph: GraphData): string[] {
  const blockers: string[] = []

  // Must have outcome node
  const hasOutcome = graph.nodes.some(
    (n) => n.data?.type === 'outcome' || n.type === 'outcome'
  )
  if (!hasOutcome) {
    blockers.push('Missing outcome node')
  }

  // Must have decision node
  const hasDecision = graph.nodes.some(
    (n) => n.data?.type === 'decision' || n.type === 'decision'
  )
  if (!hasDecision) {
    blockers.push('Missing decision node')
  }

  // Must be connected
  if (graph.edges.length === 0 && graph.nodes.length > 1) {
    blockers.push('No edges connecting nodes')
  }

  return blockers
}

/**
 * Checks if graph is runnable (no blockers)
 */
export function isGraphRunnable(graph: GraphData): boolean {
  return findBlockers(graph).length === 0 && graph.nodes.length > 0
}
