/**
 * generateScenarios - Splits a decision graph into option-specific scenarios
 *
 * Given a graph with 1 decision node and 2+ option nodes, generates separate
 * scenarios where each scenario includes only one selected option and its
 * downstream dependencies.
 *
 * Multi-option support (v2):
 * - Returns up to 4 scenarios for grid comparison
 * - If 5+ options, returns first 4 with allOptions containing full list
 */

import type { Node, Edge } from '@xyflow/react'

/** Maximum number of scenarios to generate for grid comparison */
export const MAX_COMPARISON_SCENARIOS = 4

export interface ScenarioGraph {
  nodes: Node[]
  edges: Edge[]
}

/**
 * New multi-option return type.
 * Supports 2-4 scenarios in a grid layout.
 */
export interface GeneratedScenariosV2 {
  /** Array of scenarios, one per option (up to 4) */
  scenarios: ScenarioGraph[]
  /** Labels for each scenario, parallel to scenarios array */
  labels: string[]
  /** Option IDs for each scenario, parallel to scenarios array */
  optionIds: string[]
  /** All available options (for picker when 5+) */
  allOptions: Array<{ id: string; label: string }>
  /** True if there are more options than displayed */
  hasMoreOptions: boolean
}

/**
 * Legacy return type for backward compatibility.
 * @deprecated Use GeneratedScenariosV2 instead
 */
export interface GeneratedScenarios {
  /** Scenario with first option selected */
  scenarioA: ScenarioGraph
  /** Scenario with second option selected */
  scenarioB: ScenarioGraph
  /** Labels for the scenarios */
  labels: {
    a: string
    b: string
  }
  /** All available options (for UI selection) */
  allOptions: Array<{ id: string; label: string }>
}

export interface GenerateScenariosOptions {
  /** Specific option IDs to compare (for legacy 2-option mode) */
  optionIds?: [string, string]
  /** Specific option IDs to include (for multi-option mode, up to 4) */
  selectedOptionIds?: string[]
}

/**
 * Generate comparison scenarios from a decision graph
 *
 * @param graph - The source graph with nodes and edges
 * @param options - Optional configuration
 * @returns Generated scenarios with labels
 * @throws Error if graph doesn't have required structure
 *
 * @example
 * ```ts
 * const { scenarioA, scenarioB, labels } = generateScenarios(graph)
 * // scenarioA has only first option and its downstream nodes
 * // scenarioB has only second option and its downstream nodes
 * ```
 */
export function generateScenarios(
  graph: ScenarioGraph,
  options: GenerateScenariosOptions = {}
): GeneratedScenariosV2 {
  const { nodes, edges } = graph

  // Find decision and option nodes
  const decision = nodes.find((n) => n.type === 'decision')
  const allOptions = nodes.filter((n) => n.type === 'option')

  // Validate structure
  if (!decision) {
    throw new Error('Graph must have exactly 1 decision node')
  }
  if (allOptions.length < 2) {
    throw new Error('Graph must have at least 2 option nodes')
  }

  // Determine which options to include (up to 4)
  let optionsToInclude: Node[]
  if (options.selectedOptionIds?.length) {
    const selected = options.selectedOptionIds
      .map((id) => allOptions.find((o) => o.id === id))
      .filter((opt): opt is Node => Boolean(opt))
    if (selected.length < 2) {
      throw new Error('At least 2 valid option IDs are required')
    }
    optionsToInclude = selected
  } else if (options.optionIds) {
    // Legacy two-option selection
    const [idA, idB] = options.optionIds
    const optA = allOptions.find((o) => o.id === idA)
    const optB = allOptions.find((o) => o.id === idB)
    if (!optA || !optB) {
      throw new Error('Specified option IDs not found')
    }
    optionsToInclude = [optA, optB]
  } else {
    optionsToInclude = [...allOptions]
  }

  const hasMoreOptions = optionsToInclude.length > MAX_COMPARISON_SCENARIOS
  const limitedOptions = optionsToInclude.slice(0, MAX_COMPARISON_SCENARIOS)

  // Helper: Get all nodes reachable from a starting node
  const getReachableNodeIds = (startNodeId: string): Set<string> => {
    const reachable = new Set<string>()
    const queue = [startNodeId]

    while (queue.length > 0) {
      const current = queue.shift()!
      if (reachable.has(current)) continue
      reachable.add(current)

      // Find all edges from current node
      for (const edge of edges) {
        if (edge.source === current && !reachable.has(edge.target)) {
          queue.push(edge.target)
        }
      }
    }

    return reachable
  }

  // Helper: Create scenario for a selected option
  const createScenario = (selectedOption: Node): ScenarioGraph => {
    const otherOptionIds = allOptions
      .filter((opt) => opt.id !== selectedOption.id)
      .map((opt) => opt.id)

    // Get nodes reachable from the selected option
    const reachableFromOption = getReachableNodeIds(selectedOption.id)

    // Get nodes reachable from other options (to exclude)
    const reachableFromOthers = new Set<string>()
    for (const otherId of otherOptionIds) {
      const otherReachable = getReachableNodeIds(otherId)
      // Only add nodes that are NOT reachable from selected option
      for (const nodeId of otherReachable) {
        if (!reachableFromOption.has(nodeId)) {
          reachableFromOthers.add(nodeId)
        }
      }
    }

    // Filter nodes: keep all except other options and their exclusive downstream
    const filteredNodes = nodes.filter((n) => {
      // Keep decision node
      if (n.id === decision.id) return true
      // Keep selected option
      if (n.id === selectedOption.id) return true
      // Exclude other options
      if (otherOptionIds.includes(n.id)) return false
      // Exclude nodes only reachable from other options
      if (reachableFromOthers.has(n.id)) return false
      // Keep everything else
      return true
    })

    const filteredNodeIds = new Set(filteredNodes.map((n) => n.id))

    // Filter edges: keep only edges where both source and target are in filtered nodes
    const filteredEdges = edges.filter(
      (e) => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target)
    )

    return {
      nodes: filteredNodes,
      edges: filteredEdges,
    }
  }

  // Generate scenarios for each selected option
  const scenarios = limitedOptions.map((opt) => createScenario(opt))
  const labels = limitedOptions.map(
    (opt) => (opt.data?.label as string) || `Option ${opt.id}`
  )
  const optionIds = limitedOptions.map((opt) => opt.id)

  return {
    scenarios,
    labels,
    optionIds,
    allOptions: allOptions.map((opt) => ({
      id: opt.id,
      label: (opt.data?.label as string) || `Option ${opt.id}`,
    })),
    hasMoreOptions,
  }
}

/**
 * Check if a graph can be split into comparison scenarios
 */
export function canGenerateScenarios(graph: ScenarioGraph): boolean {
  const decisions = graph.nodes.filter((n) => n.type === 'decision')
  const options = graph.nodes.filter((n) => n.type === 'option')
  return decisions.length === 1 && options.length >= 2
}
