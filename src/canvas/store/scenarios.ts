/**
 * Scenario Storage Model
 *
 * Manages scenario persistence to localStorage with autosave and recovery.
 * A scenario represents a named graph configuration that can be saved, duplicated, and compared.
 *
 * Features:
 * - CRUD operations for scenarios
 * - Autosave with 30-second interval
 * - Recovery banner for unsaved work
 * - Template source tracking
 * - Last result hash tracking for compare
 */

import type { Node, Edge } from '@xyflow/react'
import type { CEEAnalysisReady } from '../../adapters/cee/types'
import type { ReportV1 } from '../../adapters/plot/types'

export interface ScenarioFraming {
  title?: string          // Decision or question
  goal?: string           // Primary goal or outcome
  timeline?: string       // Timeline or horizon (free text)
  constraints?: string    // Key constraints (optional)
  risks?: string          // Key risks (optional)
  uncertainties?: string  // Key unknowns (optional)
  baseline?: number       // Baseline value for verdict comparison (defaults to 0 = status quo)
}

export interface Scenario {
  id: string // uuid
  name: string
  createdAt: number // timestamp ms
  updatedAt: number // timestamp ms
  source_template_id?: string // template this was created from
  source_template_version?: string // template version
  graph: {
    nodes: Node[]
    edges: Edge[]
  }
  last_result_hash?: string // Most recent analysis hash for this scenario
  last_run_at?: string // ISO timestamp of last analysis run for this scenario
  last_run_seed?: string // Seed used for last analysis run
  framing?: ScenarioFraming

  // CEE analysis_ready payload for pre-analysis panel state restoration
  ceeAnalysisReady?: CEEAnalysisReady | null

  // Node ID snapshot when ceeAnalysisReady was created (for staleness detection)
  ceeAnalysisReadyNodeIds?: string[] | null
}

const STORAGE_KEY = 'olumi-canvas-scenarios'
const AUTOSAVE_KEY = 'olumi-canvas-autosave'
const CURRENT_SCENARIO_KEY = 'olumi-canvas-current-scenario-id'
const MAX_SCENARIOS = 50 // Reasonable limit to prevent localStorage bloat

/**
 * Check if localStorage is available (guards against SSR, tests)
 */
function isLocalStorageAvailable(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
  } catch {
    return false
  }
}

/**
 * Generate a unique ID for scenarios.
 *
 * Uses crypto.randomUUID() so new scenario/model IDs are UUID-format and pass the
 * orchestrator's isUUID() wire guard — keeping model identity and CEE conversation
 * identity on the same stable ID. Legacy "scenario-{ts}-{rand}" IDs already saved in
 * localStorage are NOT migrated; they still load and function, and receive a fresh
 * UUID on their next CEE turn via the lazy-allocation guard in useConversation.
 */
function generateId(): string {
  return crypto.randomUUID()
}

/**
 * Reseed node and edge IDs to avoid conflicts
 * Checks both saved scenarios AND current canvas state
 */
function reseedIds(nodes: Node[], edges: Edge[], currentCanvasNodes?: Node[], currentCanvasEdges?: Edge[]): { nodes: Node[]; edges: Edge[] } {
  const nodeIdMap = new Map<string, string>()

  // Find max existing IDs from saved scenarios
  const existingScenarios = loadScenarios()
  let maxNodeId = 0
  let maxEdgeId = 0

  for (const scenario of existingScenarios) {
    for (const node of scenario.graph.nodes) {
      const numId = parseInt(node.id, 10)
      if (!isNaN(numId) && numId > maxNodeId) {
        maxNodeId = numId
      }
    }
    for (const edge of scenario.graph.edges) {
      const match = edge.id.match(/^e(\d+)$/)
      if (match) {
        const numId = parseInt(match[1], 10)
        if (!isNaN(numId) && numId > maxEdgeId) {
          maxEdgeId = numId
        }
      }
    }
  }

  // Also check current canvas state (if provided)
  if (currentCanvasNodes) {
    for (const node of currentCanvasNodes) {
      const numId = parseInt(node.id, 10)
      if (!isNaN(numId) && numId > maxNodeId) {
        maxNodeId = numId
      }
    }
  }
  if (currentCanvasEdges) {
    for (const edge of currentCanvasEdges) {
      const match = edge.id.match(/^e(\d+)$/)
      if (match) {
        const numId = parseInt(match[1], 10)
        if (!isNaN(numId) && numId > maxEdgeId) {
          maxEdgeId = numId
        }
      }
    }
  }

  let nextNodeId = maxNodeId + 1
  let nextEdgeId = maxEdgeId + 1

  // Create node ID mapping
  for (const node of nodes) {
    const newId = String(nextNodeId++)
    nodeIdMap.set(node.id, newId)
  }

  // Remap node IDs
  const remappedNodes = nodes.map(node => ({
    ...node,
    id: nodeIdMap.get(node.id) || node.id
  }))

  // Remap edge IDs and source/target
  const remappedEdges = edges.map(edge => ({
    ...edge,
    id: `e${nextEdgeId++}`,
    source: nodeIdMap.get(edge.source) || edge.source,
    target: nodeIdMap.get(edge.target) || edge.target
  }))

  return {
    nodes: remappedNodes,
    edges: remappedEdges
  }
}

function deepCloneGraph(nodes: Node[], edges: Edge[]): { nodes: Node[]; edges: Edge[] } {
  return JSON.parse(JSON.stringify({ nodes, edges }))
}

/**
 * Load all scenarios from localStorage
 */
export function loadScenarios(): Scenario[] {
  if (!isLocalStorageAvailable()) {
    return []
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return []

    const scenarios = JSON.parse(stored) as Scenario[]

    // Validate scenarios array
    if (!Array.isArray(scenarios)) {
      console.warn('[scenarios] Invalid scenarios format, resetting')
      return []
    }

    return scenarios.sort((a, b) => b.updatedAt - a.updatedAt) // Most recently updated first
  } catch (error) {
    console.error('[scenarios] Failed to load:', error)
    return []
  }
}

/**
 * Save scenarios to localStorage, pruning to MAX_SCENARIOS
 */
export function saveScenarios(scenarios: Scenario[]): void {
  if (!isLocalStorageAvailable()) {
    return
  }

  try {
    // Validate input
    if (!Array.isArray(scenarios)) {
      console.warn('[scenarios] Invalid scenarios input, skipping save')
      return
    }

    // Prune to MAX_SCENARIOS (keep most recently updated)
    const pruned = scenarios
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_SCENARIOS)

    localStorage.setItem(STORAGE_KEY, JSON.stringify(pruned))
  } catch (error) {
    // Handle quota exceeded or other storage errors
    if (error instanceof DOMException) {
      if (error.name === 'QuotaExceededError') {
        console.error('[scenarios] Storage quota exceeded, clearing oldest scenarios')
        // Try to save with fewer scenarios
        try {
          const minimal = scenarios.slice(0, 20)
          localStorage.setItem(STORAGE_KEY, JSON.stringify(minimal))
        } catch {
          console.error('[scenarios] Failed to save even minimal scenarios')
        }
      } else {
        console.error('[scenarios] Storage error:', error.message)
      }
    } else {
      console.error('[scenarios] Failed to save:', error)
    }
  }
}

/**
 * Get current scenario ID
 */
export function getCurrentScenarioId(): string | null {
  if (!isLocalStorageAvailable()) {
    return null
  }

  try {
    return localStorage.getItem(CURRENT_SCENARIO_KEY)
  } catch {
    return null
  }
}

/**
 * Set current scenario ID
 */
export function setCurrentScenarioId(id: string): void {
  if (!isLocalStorageAvailable()) {
    return
  }

  try {
    localStorage.setItem(CURRENT_SCENARIO_KEY, id)
  } catch (error) {
    console.error('[scenarios] Failed to set current scenario ID:', error)
  }
}

/**
 * Clear current scenario ID (when starting fresh or creating new draft)
 */
export function clearCurrentScenarioId(): void {
  if (!isLocalStorageAvailable()) {
    return
  }

  try {
    localStorage.removeItem(CURRENT_SCENARIO_KEY)
  } catch (error) {
    console.error('[scenarios] Failed to clear current scenario ID:', error)
  }
}

/**
 * Get a scenario by ID
 */
export function getScenario(id: string): Scenario | undefined {
  return loadScenarios().find(s => s.id === id)
}

/**
 * Create a new scenario
 */
export function createScenario(params: {
  name: string
  nodes: Node[]
  edges: Edge[]
  /**
   * Optional explicit record ID. When omitted, a fresh UUID is generated.
   * Used by saveCurrentScenario to ADOPT an already-allocated conversation UUID
   * (the lazily-assigned scenario_id) when first persisting an unsaved model, so
   * the saved record reuses the same ID rather than minting a replacement.
   */
  id?: string
  source_template_id?: string
  source_template_version?: string
  framing?: ScenarioFraming
  last_result_hash?: string
  last_run_at?: string
  last_run_seed?: string
  ceeAnalysisReady?: CEEAnalysisReady | null
  ceeAnalysisReadyNodeIds?: string[] | null
}): Scenario {
  const now = Date.now()
  const { nodes, edges } = deepCloneGraph(params.nodes, params.edges)
  const scenario: Scenario = {
    id: params.id ?? generateId(),
    name: params.name,
    createdAt: now,
    updatedAt: now,
    source_template_id: params.source_template_id,
    source_template_version: params.source_template_version,
    graph: {
      nodes,
      edges
    },
    last_result_hash: params.last_result_hash,
    last_run_at: params.last_run_at,
    last_run_seed: params.last_run_seed,
    framing: params.framing,
    ceeAnalysisReady: params.ceeAnalysisReady ?? null,
    ceeAnalysisReadyNodeIds: params.ceeAnalysisReadyNodeIds ?? null,
  }

  const scenarios = loadScenarios()
  scenarios.push(scenario)
  saveScenarios(scenarios)
  setCurrentScenarioId(scenario.id)

  return scenario
}

/**
 * Update an existing scenario
 */
export function updateScenario(id: string, updates: Partial<Omit<Scenario, 'id' | 'createdAt'>>): void {
  const scenarios = loadScenarios()
  const index = scenarios.findIndex(s => s.id === id)

  if (index === -1) {
    console.warn('[scenarios] Scenario not found for update:', id)
    return
  }

  const nextUpdates: Partial<Omit<Scenario, 'id' | 'createdAt'>> = { ...updates }

  if (updates.graph) {
    const { nodes, edges } = deepCloneGraph(updates.graph.nodes, updates.graph.edges)
    nextUpdates.graph = {
      nodes,
      edges,
    }
  }

  scenarios[index] = {
    ...scenarios[index],
    ...nextUpdates,
    updatedAt: Date.now()
  }

  saveScenarios(scenarios)
}

/**
 * Rename a scenario
 */
export function renameScenario(id: string, name: string): void {
  updateScenario(id, { name })
}

/**
 * Duplicate a scenario
 */
export function duplicateScenario(id: string, newName?: string): Scenario | null {
  const original = getScenario(id)
  if (!original) {
    console.warn('[scenarios] Scenario not found for duplication:', id)
    return null
  }

  const now = Date.now()
  const { nodes, edges } = deepCloneGraph(original.graph.nodes, original.graph.edges)
  const duplicate: Scenario = {
    ...original,
    id: generateId(),
    name: newName || `${original.name} (Copy)`,
    createdAt: now,
    updatedAt: now,
    last_result_hash: undefined, // Don't copy last result
    last_run_at: undefined,
    last_run_seed: undefined,
    graph: {
      nodes,
      edges,
    },
  }

  const scenarios = loadScenarios()
  scenarios.push(duplicate)
  saveScenarios(scenarios)

  return duplicate
}

/**
 * Delete a scenario
 */
export function deleteScenario(id: string): void {
  const scenarios = loadScenarios().filter(s => s.id !== id)
  saveScenarios(scenarios)

  // If we deleted the current scenario, clear the current ID
  if (getCurrentScenarioId() === id) {
    if (isLocalStorageAvailable()) {
      try {
        localStorage.removeItem(CURRENT_SCENARIO_KEY)
      } catch {
        // Ignore errors
      }
    }
  }
}

/**
 * Import a scenario from file
 * Validates format, reseeds IDs, creates new scenario
 * Accepts optional current canvas nodes/edges to avoid ID collisions
 */
export function importScenarioFromFile(
  fileContent: string,
  currentCanvasNodes?: Node[],
  currentCanvasEdges?: Edge[]
): { success: boolean; scenario?: Scenario; error?: string } {
  try {
    const data = JSON.parse(fileContent)

    // Validate format
    if (data.format !== 'olumi-scenario-v1') {
      return {
        success: false,
        error: `Unsupported format: ${data.format || 'unknown'}. Expected olumi-scenario-v1.`
      }
    }

    // Validate required fields
    if (!data.scenario || !data.graph) {
      return {
        success: false,
        error: 'Invalid file: missing scenario or graph data'
      }
    }

    if (!Array.isArray(data.graph.nodes) || !Array.isArray(data.graph.edges)) {
      return {
        success: false,
        error: 'Invalid file: graph must contain nodes and edges arrays'
      }
    }

    // Reseed IDs to avoid conflicts (check both saved scenarios and current canvas)
    const { nodes, edges } = reseedIds(data.graph.nodes, data.graph.edges, currentCanvasNodes, currentCanvasEdges)

    // Create new scenario from imported data
    const scenario = createScenario({
      name: data.scenario.name || 'Imported scenario',
      nodes,
      edges,
      source_template_id: data.scenario.source_template_id,
      source_template_version: data.scenario.source_template_version
    })

    return {
      success: true,
      scenario
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to parse file'
    }
  }
}

/**
 * Update the last result hash for a scenario
 */
export function updateScenarioResultHash(id: string, hash: string): void {
  updateScenario(id, { last_result_hash: hash })
}

/**
 * S9-PROMOTE: Promote a comparison snapshot as the current scenario
 * Replaces the current scenario's graph with the snapshot's graph
 *
 * @param scenarioId - The scenario to update
 * @param graph - The graph snapshot to promote (from StoredRun)
 * @returns true if successful, false if scenario not found
 */
export function promoteSnapshot(
  scenarioId: string,
  graph: { nodes: Node[]; edges: Edge[] }
): boolean {
  const scenario = getScenario(scenarioId)
  if (!scenario) {
    console.warn('[scenarios] S9-PROMOTE: Scenario not found:', scenarioId)
    return false
  }

  // Update scenario with the snapshot's graph
  updateScenario(scenarioId, {
    graph,
    last_result_hash: undefined // Clear last result since graph has changed
  })

  if (import.meta.env.DEV) {
    console.log('[scenarios] S9-PROMOTE: Promoted snapshot to scenario', {
      scenarioId,
      nodeCount: graph.nodes.length,
      edgeCount: graph.edges.length
    })
  }

  return true
}

/**
 * The completed analysis, persisted IN the autosave record — beside the graph
 * it was computed over, not in a second store keyed on something else.
 *
 * WHY THIS EXISTS (live defect, reproduced 1/1 on deployed staging 26 Jul 2026)
 * The answer did not survive leaving the canvas and returning via "Continue
 * without an account": the graph came back, the conversation came back, and the
 * Results panel reset to "Analyse first pass". Two independent links were dead,
 * BOTH of them on the deployed guest path:
 *
 *  1. The WRITE. `resultsComplete` gates its run-history `addRun` on a SEED.
 *     `results.seed` is set only by `resultsStart`, which only the direct
 *     Run-button path calls; the live V5 path goes through `resultsAnalysing`
 *     and `applyV5State` passes `rawV2Response: null`. Live-probed after a real
 *     analysis: `'seed' in results === false`, `olumi-canvas-run-history` absent.
 *  2. The POINTER. `resultsComplete` writes `last_result_hash` onto the SCENARIO
 *     record — but guest mode never creates one. Live-probed:
 *     `olumi-canvas-scenarios` absent. So the boot restore
 *     (ReactFlowGraph init → `scenarios.getScenario(autosave.scenarioId)`)
 *     found no record, and its graphHash fallback scanned an empty run history.
 *
 * The record that DID survive and IS read back at boot is this one: the
 * autosave already carries `nodes`, `edges`, `scenarioId` and `ceeAnalysisReady`
 * — written together, read together. The answer was the only part of the
 * scenario not riding it. Putting it here means every surface restores from ONE
 * record instead of re-deriving agreement between three.
 *
 * IDENTITY IS THE RESPONSE HASH, NOT A SEED. `response_hash` is present on the
 * live V5 wire (`v5:c9185f4c9c602851`, captured 26 Jul); the seed is not, and a
 * fabricated one would fork the graph hash (CLAUDE.md trap #10). Nothing here
 * invents a seed — `seed` is optional and simply absent on the V5 path.
 */
export interface PersistedAnalysis {
  /**
   * `report.model_card.response_hash` — the run identity that IS on the wire.
   * Also what `resultsLoadHistorical` puts back into `results.hash`.
   */
  hash?: string
  /** ISO instant the run completed, for provenance on the restored surface. */
  computedAt: string
  /** A.9 provenance: which path produced it. */
  resultsSource?: 'direct' | 'conversation'
  runId?: string
  /** Present only on the direct Run path, which does know a seed. Never faked. */
  seed?: number
  drivers?: Array<{ kind: 'node' | 'edge'; id: string }>
  /** The full report the Results surfaces render. ~21 kB in the live 5-option case. */
  report: ReportV1
}

/**
 * Autosave: Store current graph state temporarily
 * Used to recover unsaved work on reload
 */
export interface AutosaveData {
  timestamp: number
  scenarioId?: string // If editing an existing scenario
  nodes: Node[]
  edges: Edge[]
  /**
   * The completed analysis for THIS graph, or null/absent when none has run.
   * See PersistedAnalysis. Dropped (never the graph) if the write hits quota.
   */
  analysis?: PersistedAnalysis | null
  // V3: Persist analysis_ready so options survive page refresh
  ceeAnalysisReady?: {
    options: Array<{
      id: string
      label: string
      status: 'ready' | 'needs_user_mapping' | 'needs_encoding'
      interventions: Record<string, unknown>
      user_questions?: string[]
      unresolved_targets?: string[]
    }>
    goal_node_id: string
    suggested_seed?: string
    status?: string
    user_questions?: string[]
  } | null
  selectedGoalNode?: string | null
}

// P2: Track last autosave payload to skip identical writes
let lastAutosavePayload: string | null = null

export function saveAutosave(data: AutosaveData): void {
  if (!isLocalStorageAvailable()) {
    return
  }

  try {
    const payload = JSON.stringify(data)

    // P2: Skip write if payload is identical (shallow diff)
    if (payload === lastAutosavePayload) {
      if (import.meta.env.DEV) {
        console.log('[scenarios] Skipping identical autosave write')
      }
      return
    }

    localStorage.setItem(AUTOSAVE_KEY, payload)
    lastAutosavePayload = payload

    if (import.meta.env.DEV) {
      console.log('[scenarios] Autosave written')
    }
  } catch (error) {
    // DECLARED DEGRADATION, in this order deliberately.
    //
    // The analysis report is the largest thing in this record (~21 kB live) and
    // it is the OPTIONAL half: the graph is the user's work, the analysis can be
    // recomputed. Before this field existed a quota failure lost only the newest
    // graph edits; it must not now be able to lose the GRAPH because an analysis
    // pushed the payload over the limit. So on any write failure, retry once
    // without the analysis rather than leaving the slot at its previous value.
    //
    // Both the retry and its own failure are reported — silence here would make
    // a lost graph look identical to a successful save (the failure-reads-as-
    // green class this repo keeps catching).
    if (data.analysis) {
      try {
        const withoutAnalysis = JSON.stringify({ ...data, analysis: null })
        localStorage.setItem(AUTOSAVE_KEY, withoutAnalysis)
        lastAutosavePayload = withoutAnalysis
        console.warn(
          '[scenarios] Autosave too large — persisted the graph WITHOUT the analysis. ' +
            'The results panel will not restore this run on return.',
          error,
        )
        return
      } catch (retryError) {
        console.error('[scenarios] Failed to save autosave (graph-only retry):', retryError)
      }
    }
    console.error('[scenarios] Failed to save autosave:', error)
  }
}

export function loadAutosave(): AutosaveData | null {
  if (!isLocalStorageAvailable()) {
    return null
  }

  try {
    const stored = localStorage.getItem(AUTOSAVE_KEY)
    if (!stored) return null

    const data = JSON.parse(stored) as AutosaveData

    // Validate structure
    if (!data.timestamp || !Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
      console.warn('[scenarios] Invalid autosave format, ignoring')
      return null
    }

    return data
  } catch (error) {
    console.error('[scenarios] Failed to load autosave:', error)
    return null
  }
}

export function clearAutosave(): void {
  if (!isLocalStorageAvailable()) {
    return
  }

  try {
    localStorage.removeItem(AUTOSAVE_KEY)
    // P2: Reset payload cache for fresh test state
    lastAutosavePayload = null
  } catch {
    // Ignore errors
  }
}

/**
 * Check if there's unsaved work
 * Returns true if autosave exists and is newer than the last scenario save
 */
export function hasUnsavedWork(): boolean {
  const autosave = loadAutosave()
  if (!autosave) return false

  // If autosave references a scenario, check if it's newer
  if (autosave.scenarioId) {
    const scenario = getScenario(autosave.scenarioId)
    if (scenario) {
      return autosave.timestamp > scenario.updatedAt
    }
  }

  // If no scenario ID, check if autosave is recent (within last hour)
  const ONE_HOUR = 60 * 60 * 1000
  return Date.now() - autosave.timestamp < ONE_HOUR
}
