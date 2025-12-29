/**
 * Node ID Normalisation (P0-UI-3)
 *
 * ISL V2 constraint: Node IDs must match `^[a-z0-9_:-]+$`
 *
 * This module provides:
 * - normaliseId(): Normalises a single ID
 * - normaliseGraphIds(): Normalises all IDs in a graph with collision handling
 * - translateResponseToUIIds(): Translates response IDs back to UI IDs
 */

// ============================================================================
// Types
// ============================================================================

export interface NormalisationResult<TNode, TEdge, TOption> {
  /** Graph with normalised IDs */
  graph: { nodes: TNode[]; edges: TEdge[] }
  /** Options with normalised IDs and intervention keys */
  options: TOption[]
  /** Goal node ID (normalised) */
  goalNodeId: string | null
  /** Map from original ID to normalised ID */
  idMap: Map<string, string>
  /** Map from normalised ID to original ID (for response translation) */
  reverseIdMap: Map<string, string>
  /** Whether any IDs were changed */
  hasChanges: boolean
}

// Generic interfaces for graph elements
interface HasId {
  id: string
}

interface HasFromTo {
  from: string
  to: string
}

interface HasInterventions {
  id: string
  interventions: Record<string, unknown>
}

// ============================================================================
// Normalisation Functions
// ============================================================================

/**
 * Normalise a single ID to ISL V2 format.
 *
 * Rules:
 * - Convert to lowercase
 * - Replace invalid characters with underscore
 * - Collapse multiple underscores
 * - Trim leading/trailing underscores
 */
export function normaliseId(id: string): string {
  if (!id) return 'node'

  return id
    .toLowerCase()
    .replace(/[^a-z0-9_:-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '') || 'node'
}

/**
 * Check if an ID is valid for ISL V2.
 */
export function isValidId(id: string): boolean {
  return /^[a-z0-9_:-]+$/.test(id)
}

/**
 * Normalise all IDs in a graph with deterministic collision handling.
 *
 * Collision resolution:
 * - Sort nodes by original ID for deterministic results
 * - Append `__2`, `__3`, etc. for collisions
 *
 * Returns idMap and reverseIdMap for response translation.
 */
export function normaliseGraphIds<
  TNode extends HasId,
  TEdge extends HasFromTo & { id?: string },
  TOption extends HasInterventions
>(
  graph: { nodes: TNode[]; edges: TEdge[] },
  options: TOption[],
  goalNodeId: string | null
): NormalisationResult<TNode, TEdge, TOption> {
  const idMap = new Map<string, string>()
  const reverseIdMap = new Map<string, string>()
  const usedIds = new Set<string>()

  // Sort nodes by original ID for deterministic collision resolution
  const sortedNodes = [...graph.nodes].sort((a, b) => a.id.localeCompare(b.id))

  for (const node of sortedNodes) {
    let normalised = normaliseId(node.id)

    // Handle collisions — trigger on ANY collision
    if (usedIds.has(normalised)) {
      let suffix = 2
      while (usedIds.has(`${normalised}__${suffix}`)) {
        suffix++
      }
      normalised = `${normalised}__${suffix}`
    }

    usedIds.add(normalised)
    idMap.set(node.id, normalised)
    reverseIdMap.set(normalised, node.id)
  }

  // Also normalise option IDs that are NOT node IDs
  // Options have their own identifiers from CEE that may need normalisation
  const sortedOptions = [...options].sort((a, b) => a.id.localeCompare(b.id))
  for (const option of sortedOptions) {
    // Skip if already in idMap (option ID is also a node ID)
    if (idMap.has(option.id)) continue

    let normalised = normaliseId(option.id)

    // Handle collisions with both node IDs and other option IDs
    if (usedIds.has(normalised)) {
      let suffix = 2
      while (usedIds.has(`${normalised}__${suffix}`)) {
        suffix++
      }
      normalised = `${normalised}__${suffix}`
    }

    usedIds.add(normalised)
    idMap.set(option.id, normalised)
    reverseIdMap.set(normalised, option.id)
  }

  // Check if any IDs actually changed
  const hasChanges = [...idMap.entries()].some(([orig, norm]) => orig !== norm)

  if (!hasChanges) {
    return {
      graph,
      options,
      goalNodeId,
      idMap,
      reverseIdMap,
      hasChanges: false,
    }
  }

  // Apply mapping to nodes
  const normalisedNodes = graph.nodes.map((n) => ({
    ...n,
    id: idMap.get(n.id) ?? n.id,
  }))

  // Apply mapping to edges
  // NOTE: DO NOT normalise edge.id — idMap only contains node IDs
  // Only normalise from/to endpoint references
  const normalisedEdges = graph.edges.map((e) => ({
    ...e,
    // Keep edge.id unchanged (idMap only has node IDs, not edge IDs)
    from: idMap.get(e.from) ?? e.from,
    to: idMap.get(e.to) ?? e.to,
  }))

  // Apply mapping to options (id and intervention keys)
  const normalisedOptions = options.map((opt) => ({
    ...opt,
    id: idMap.get(opt.id) ?? opt.id,
    interventions: Object.fromEntries(
      Object.entries(opt.interventions).map(([k, v]) => [
        idMap.get(k) ?? k,
        v,
      ])
    ),
  }))

  // Apply mapping to goal node ID
  const normalisedGoalId = goalNodeId ? (idMap.get(goalNodeId) ?? goalNodeId) : null

  return {
    graph: { nodes: normalisedNodes, edges: normalisedEdges },
    options: normalisedOptions,
    goalNodeId: normalisedGoalId,
    idMap,
    reverseIdMap,
    hasChanges: true,
  }
}

/**
 * Translate response IDs back to UI IDs.
 *
 * Used to ensure:
 * - Critique `affected_nodes` can highlight correct canvas nodes
 * - Response option IDs match option cards
 * - Driver node_ids map to correct canvas nodes
 * - Robustness factor node_ids map correctly
 * - Error messages reference recognisable node names
 */
export function translateResponseToUIIds<T extends {
  options?: Array<{ id: string; [key: string]: unknown }>
  critiques?: Array<{ affected_nodes?: string[]; [key: string]: unknown }>
  drivers?: Array<{ node_id: string; [key: string]: unknown }>
  robustness?: { factors?: Array<{ node_id: string; [key: string]: unknown }>; [key: string]: unknown }
}>(
  response: T,
  reverseIdMap: Map<string, string>
): T {
  if (reverseIdMap.size === 0) {
    return response
  }

  const translateId = (id: string): string => reverseIdMap.get(id) ?? id

  return {
    ...response,
    options: response.options?.map((opt) => ({
      ...opt,
      id: translateId(opt.id),
    })),
    critiques: response.critiques?.map((c) => ({
      ...c,
      affected_nodes: c.affected_nodes?.map(translateId),
    })),
    drivers: response.drivers?.map((d) => ({
      ...d,
      node_id: translateId(d.node_id),
    })),
    robustness: response.robustness ? {
      ...response.robustness,
      factors: response.robustness.factors?.map((f) => ({
        ...f,
        node_id: translateId(f.node_id),
      })),
    } : undefined,
  }
}

/**
 * Get a list of IDs that will be normalised (for warning display).
 */
export function getIdsRequiringNormalisation(ids: string[]): { original: string; normalised: string }[] {
  const changes: { original: string; normalised: string }[] = []

  for (const id of ids) {
    const normalised = normaliseId(id)
    if (normalised !== id) {
      changes.push({ original: id, normalised })
    }
  }

  return changes
}
