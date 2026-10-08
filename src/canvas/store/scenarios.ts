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
import type { CEEAnalysisReady, CEEGoalConstraint } from '../../adapters/cee/types'
import type { ReportV1 } from '../../adapters/plot/types'
import { buildPersistedGraph, type PersistedGraph } from '../utils/persistedGraph'
import { isThinClientSession, saveThinLayout } from '../thinClient/thinClient'

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
  /**
   * The persisted graph. Carries an OPTIONAL top-level `goal_constraints`
   * (snake_case, the CEE wire spelling — see persistedGraph.ts), mirroring the
   * authenticated `scenarios.graph` JSONB column so a guest scenario save
   * round-trips hard constraints instead of silently dropping them
   * (ROADMAP 2.932). Absent on records written before that shipped — additive,
   * so an old `{ nodes, edges }` graph still loads (readPersistedGoalConstraints
   * returns null for an absent key).
   */
  graph: PersistedGraph<Node, Edge>
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

/**
 * Where a cold-load deep link keeps a superseded scenario's autosave, verbatim (`hydrate/coldLoadDeepLink.ts`). The key
 * is owned HERE so the writer there and `deleteScenario` below cannot disagree about it.
 */
export function keyedAutosaveKey(scenarioId: string): string {
  return `${AUTOSAVE_KEY}:${scenarioId}`
}
const MAX_SCENARIOS = 50 // Reasonable limit to prevent localStorage bloat

export function clearAllScenarioStorage(): void {
  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem(AUTOSAVE_KEY)
  localStorage.removeItem(CURRENT_SCENARIO_KEY)
}

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

    const sorted = scenarios.sort((a, b) => b.updatedAt - a.updatedAt) // Most recently updated first
    // THIN CLIENT: a record written before sign-in (or by another account) never puts a model on screen here.
    return isThinClientSession()
      ? sorted.map((sc) => ({ ...sc, graph: buildPersistedGraph([], [], null) as Scenario['graph'] }))
      : sorted
  } catch (error) {
    console.error('[scenarios] Failed to load:', error)
    return []
  }
}

/**
 * Save scenarios to localStorage, pruning to MAX_SCENARIOS
 */
export function saveScenarios(scenarios: Scenario[]): void {
  if (getIdentityWriteBlockReason() !== null) return
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
    // THIN CLIENT: a signed-in browser keeps each record's metadata, never its graph.
    const thin = isThinClientSession()
    const pruned = scenarios
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_SCENARIOS)
      .map((sc) => (thin ? { ...sc, graph: buildPersistedGraph([], [], null) as Scenario['graph'] } : sc))

    localStorage.setItem(STORAGE_KEY, JSON.stringify(pruned))
  } catch (error) {
    // Handle quota exceeded or other storage errors
    if (error instanceof DOMException) {
      if (error.name === 'QuotaExceededError') {
        console.error('[scenarios] Storage quota exceeded, clearing oldest scenarios')
        // Try to save with fewer scenarios
        try {
          // THIN CLIENT: the retry is stripped exactly as the first write was — never the graphs that write omitted.
          const minimal = scenarios
            .slice(0, 20)
            .map((sc) => (isThinClientSession() ? { ...sc, graph: buildPersistedGraph([], [], null) as Scenario['graph'] } : sc))
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
  if (getIdentityWriteBlockReason() !== null) return
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
  if (getIdentityWriteBlockReason() !== null) return
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
  /**
   * The scenario's hard constraints, persisted into `graph.goal_constraints`
   * (ROADMAP 2.932). Omitted keeps the historical `{ nodes, edges }` bytes
   * exactly — buildPersistedGraph only emits the key when there is something to
   * persist, so a constraint-free scenario is byte-unchanged.
   */
  goalConstraints?: CEEGoalConstraint[] | null
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
    graph: buildPersistedGraph(nodes, edges, params.goalConstraints),
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
    // Preserve the constraints the caller put on the graph (ROADMAP 2.932).
    // buildPersistedGraph emits the key only when non-empty, so a
    // constraint-free update keeps the historical `{ nodes, edges }` bytes.
    nextUpdates.graph = buildPersistedGraph(nodes, edges, updates.graph.goal_constraints)
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
 *
 * ⚠ THE AUTOSAVE MUST GO WITH THE RECORD, or the deleted decision comes back on
 * the next reload. This function used to clear only the POINTER. That was
 * survivable while `ReactFlowGraph`'s boot path also read only the pointer — a
 * missing pointer dropped the canvas into draft mode and the orphaned autosave
 * was never consulted for its id. It stopped being survivable the moment that
 * boot path gained a fallback to `autosave.scenarioId`: local delete is the one
 * enumerated production path that produces exactly that fallback's trigger state
 * (autosave holding a live UUID while the pointer is missing), and it is
 * precisely the path where restoring the id is WRONG. Worse, the boot path
 * re-persists what it resolves, so the resurrection would become durable.
 *
 * `useScenario.deleteScenario` clears both for the server-backed path, with the
 * same reasoning in its own comment. Two delete paths asking one question must
 * not answer it differently — so the invariant lives HERE, next to the record it
 * guards, and covers every caller of this function rather than the one call site
 * that happens to exist today.
 *
 * ⚠ That symmetry was ASSERTED here before it was true: until the F2 repair, the
 * server path nested its autosave clear inside the POINTER check, so it answered
 * the question about a different object and an orphaned record survived. The two
 * paths now ask both questions independently, and
 * `useScenario.deleteClearsOrphanedAutosave.spec.ts` pins the server half —
 * including a discriminating twin, because clearing unconditionally would
 * destroy the OPEN decision's unsaved work and no single-direction case can see
 * that. A comment is not an invariant; the spec is.
 *
 * Keyed on the AUTOSAVE'S OWN id, not on the pointer: the trigger state is
 * defined by what the record carries, and the pointer may already be null or
 * pointing elsewhere by the time a delete arrives.
 */
export function deleteScenario(id: string): void {
  // This operation also removes the pointer and keyed autosave directly. A stale guest cannot delete the current
  // owner's records or recovery slots. Auth's explicit purge uses clearAllScenarioStorage instead.
  if (getIdentityWriteBlockReason() !== null) return
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

  // And drop an autosave that belongs to the record just removed.
  if (loadAutosave()?.scenarioId === id) {
    clearAutosave()
  }

  // …and a cold-load deep link's preserved copy of it: otherwise a later link to this id would put the deleted model
  // back on screen (the same resurrection, through `hydrate/coldLoadDeepLink.ts`).
  if (isLocalStorageAvailable()) {
    try {
      localStorage.removeItem(keyedAutosaveKey(id))
    } catch {
      // Ignore errors
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
  /** The identity epoch this slot was written under (CAN-F2w; see `IDENTITY_EPOCH_KEY`). Absent before the first boundary. */
  identityEpoch?: string
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
  /**
   * The scenario's hard constraints (ROADMAP 2.932). Absent on records written
   * before this shipped — additive, so an old autosave still loads and the
   * restore resolves an absent value to null (clears rather than throws). The
   * projection emits this only when non-empty, so a constraint-free autosave is
   * byte-unchanged.
   */
  goalConstraints?: CEEGoalConstraint[] | null
}

// P2: Track last autosave payload to skip identical writes
let lastAutosavePayload: string | null = null

/**
 * ⭐ THE IDENTITY EPOCH (CAN-F2w): an owner fence on every autosave slot, the main slot and its preserved copies alike.
 * `clearUserScopedState` writes a fresh epoch at every identity boundary (sign-out, A→B) BEFORE it sweeps, and every
 * autosave is stamped with the epoch it was written under. A slot from another epoch is not this identity's:
 * `loadAutosave` returns nothing for it, and `coldLoadDeepLink` treats it as unowned. So a slot whose removal was REFUSED
 * at sign-out never reaches the next account. Measured on staging 088c9781 before this: B's routeless cold load
 * restored A's graph. An epoch, not the account id: a cold boot cannot know the id synchronously (the session restores
 * async), and fencing on it would block a signed-in user's own restore. Before the first boundary there is no epoch,
 * and every slot behaves exactly as before. An unreadable epoch fails closed: no slot is restored and nothing is
 * written that tick. A boundary in ANOTHER TAB is fenced per tab: `epochThisTabMayWriteUnder` below (CAN-F2g).
 */
export const IDENTITY_EPOCH_KEY = 'olumi-canvas-identity-epoch'
/** The shared epoch: a string, `null` before the first boundary, `undefined` when storage refused the read. */
export function readIdentityEpoch(): string | null | undefined {
  try {
    const epoch = localStorage.getItem(IDENTITY_EPOCH_KEY)
    return epoch && epoch.length > 0 ? epoch : null
  } catch {
    return undefined
  }
}
/**
 * Whether a slot stamped `stamp` belongs to this browser's current identity: the one rule every autosave reader uses.
 * An UNREADABLE epoch fails closed: whether a boundary happened cannot be known, so no slot is anyone's (Codex, #2484).
 */
export function belongsToThisIdentity(stamp: unknown): boolean {
  const epoch = readIdentityEpoch()
  if (epoch === undefined) return false
  return epoch === null || stamp === epoch
}

/**
 * ⭐ THIS TAB's epoch (CAN-F2g, the F2c follow-up above: "a boundary in any tab is a boundary in every tab"). Captured
 * when this module loads (the tab's boot) and moved only by THIS tab's own boundary (`crossIdentityBoundaryInThisTab`,
 * called by `clearUserScopedState`: `crossIdentityBoundaryInThisTab`). Measured 5 Oct (J1 TC3-F2g / TC4-F2w, run
 * 37314393647; also prod UI 42f3c1ba and pre-#2503 400a71f1): the writers stamped the SHARED epoch read at write time,
 * so after tab 1's sign-out rotated it, a drag in tab 2, still showing account A, saved A's model stamped as B's, and
 * B's routeless boot restored it. A tab whose epoch no longer matches the shared one is showing a previous identity's
 * model: its writes are skipped, never stamped. A reload re-captures, and that tab then boots as the new identity.
 */
let tabIdentityEpoch: string | null | undefined = readIdentityEpoch()
// A refused capture is pending, not evidence of an old identity. One synchronous recovery read can witness the boot
// era; the first readable permission read may adopt it only while it still matches. If both boot reads refused, a
// later non-null epoch has no known baseline and remains unreadable rather than being guessed current or stale.
let pendingIdentityEpochWitness = tabIdentityEpoch === undefined ? readIdentityEpoch() : undefined
// A rejected auth adoption without a boot witness cannot be resolved on this page. Preserve the write fence and
// require a reload even though an unknown boot epoch, on its own, is not evidence that another tab changed identity.
let rejectedUnknownIdentityAdoption = false
/**
 * An epoch names the identity whose ERA it opens: `<random>|owner:<user id | none | ?>`, in the one value, so the tag
 * can never tear from the epoch. Readers compare whole strings, so they are unaffected. `?` = the boundary did not say
 * who comes next: such an era is never joined.
 */
const EPOCH_OWNER_TAG = '|owner:'
function ownerTag(nextOwner: string | null | undefined): string {
  return nextOwner === undefined ? '?' : nextOwner === null ? 'none' : nextOwner
}
function eraOwnerOf(epoch: string): string | undefined {
  const at = epoch.lastIndexOf(EPOCH_OWNER_TAG)
  if (at < 0) return undefined
  const tag = epoch.slice(at + EPOCH_OWNER_TAG.length)
  return tag === '?' ? undefined : tag
}
/**
 * THIS tab crosses an identity boundary (`clearUserScopedState`), leading to `nextOwner` (a user id; `null` = signed
 * out; `undefined` = not said). It JOINS the shared epoch only with evidence that this is the same transition arriving
 * here second (gotrue relays SIGNED_OUT across tabs): another tab has rotated since this tab last held the epoch, AND
 * that era belongs to the identity this boundary leads to. Minting again stranded the tab that crossed first, unable
 * to save until a reload (Review Desk + Codex #2516 r1). Joining WITHOUT the owner match let a tab that missed A→B and
 * then crossed A→C join B's era, so B's records that survived a refused removal were C's to restore (Codex #2516 r2).
 * Otherwise rotate, then adopt whatever the shared key actually HOLDS, so a refused or silently dropped epoch write is
 * never adopted (coldLoadDeepLink.spec, "an epoch write … at sign-out").
 */
export function crossIdentityBoundaryInThisTab(freshEpoch: string, nextOwner?: string | null): 'joined' | 'fresh' {
  const shared = readIdentityEpoch()
  const next = nextOwner === undefined ? undefined : ownerTag(nextOwner)
  if (typeof shared === 'string' && shared !== tabIdentityEpoch && next !== undefined && eraOwnerOf(shared) === next) {
    tabIdentityEpoch = shared
    pendingIdentityEpochWitness = undefined
    notifyIdentityEpochChanged()
    return 'joined'
  }
  try {
    localStorage.setItem(IDENTITY_EPOCH_KEY, `${freshEpoch}${EPOCH_OWNER_TAG}${ownerTag(nextOwner)}`)
  } catch {
    /* adopt whatever is held */
  }
  tabIdentityEpoch = readIdentityEpoch()
  pendingIdentityEpochWitness = undefined
  notifyIdentityEpochChanged()
  return 'fresh'
}
/** A non-boundary auth event may join only its own owner's era; a queued session cannot authorise another account. */
export function adoptIdentityEpochAtSignIn(userId: string): boolean {
  const shared = readIdentityEpoch()
  // A transient refusal is not evidence of a boundary. Retain the valid tab witness and any pending boot witness.
  if (shared === undefined) return true
  if (shared === tabIdentityEpoch || (typeof shared === 'string' && eraOwnerOf(shared) === userId)) {
    tabIdentityEpoch = shared
    pendingIdentityEpochWitness = undefined
    notifyIdentityEpochChanged()
    return true
  }
  if (tabIdentityEpoch === undefined) rejectedUnknownIdentityAdoption = true
  notifyIdentityEpochChanged() // the mounted lock latches synchronously, before any further auth side effects
  return false
}

function notifyIdentityEpochChanged(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('olumi:identity-epoch-changed'))
}
/**
 * Whether this tab may write identity-stamped state now, and under which epoch. `null` = skip: the shared epoch is
 * unreadable (CAN-F2w), or ANOTHER tab set an epoch this tab does not hold (CAN-F2g: rotated, or the browser's first
 * boundary). A shared `null` means no boundary has happened in this browser (the sweep never removes the key), so a
 * write proceeds unstamped exactly as before CAN-F2w; only a wholesale storage wipe reaches that state after a
 * boundary, and it takes the session with it.
 */
export type IdentityWriteBlockReason = 'unreadable' | 'stale'

/** Preserve the reason without changing the null-compatible epoch API used by persistence writers. */
function identityWritePermission(): { epoch: string | null } | { reason: 'unreadable' } | { reason: 'stale'; epoch: string } {
  const shared = readIdentityEpoch()
  if (shared === undefined) return { reason: 'unreadable' }
  if (tabIdentityEpoch === undefined) {
    if (pendingIdentityEpochWitness === undefined && shared !== null) return { reason: 'unreadable' }
    // A shared null proves no boundary under the monotonic-key invariant above. Otherwise use only the era observed
    // at boot: a changed shared epoch will then take the ordinary stale branch instead of being adopted.
    tabIdentityEpoch = pendingIdentityEpochWitness === undefined ? null : pendingIdentityEpochWitness
    pendingIdentityEpochWitness = undefined
  }
  if (shared !== null && shared !== tabIdentityEpoch) return { reason: 'stale', epoch: shared }
  return { epoch: shared }
}

export function epochThisTabMayWriteUnder(): { epoch: string | null } | null {
  const permission = identityWritePermission()
  return 'reason' in permission ? null : permission
}

/** One fence for local scenario writers and their UI actions, including thin metadata and cleanup. */
export function getIdentityWriteBlockReason(): IdentityWriteBlockReason | null {
  const permission = identityWritePermission()
  return 'reason' in permission ? permission.reason : null
}

/** The page lock also covers a readable key removal and a rejected auth adoption with no known boot witness. */
export function isIdentityEpochStaleForThisTab(): boolean {
  if (rejectedUnknownIdentityAdoption) return true
  const permission = identityWritePermission()
  if ('reason' in permission) return permission.reason === 'stale'
  return permission.epoch !== tabIdentityEpoch
}

export function identityWriteBlockedMessage(reason: IdentityWriteBlockReason): string {
  return reason === 'unreadable'
    ? 'This browser is not letting Olumi save right now, so this change was not saved.'
    : 'Someone signed in or out in another tab, so this tab can no longer save. Changes made here since then were not saved, and reloading will discard them. Reload this tab to carry on.'
}

/** The same toast bridge used by store actions; autosave owns a tab-lifetime notice key, not a hook-lifetime ref. */
export function showIdentityWriteBlockedToast(reason: IdentityWriteBlockReason): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('topbar:show-toast', {
    detail: { message: identityWriteBlockedMessage(reason), level: 'error' },
  }))
}

const autosaveNotifiedStaleEpochs = new Set<string>()
let autosaveNotifiedUnreadable = false
function showAutosaveFenceToast(reason: IdentityWriteBlockReason, epoch?: string): void {
  // Use the permission decision's epoch. A second read could give an intermittent refusal a new notice key even
  // though no boundary happened. Unreadable ticks must not erase a stale era's tab-lifetime notification history.
  if (reason === 'stale' && epoch !== undefined) {
    if (autosaveNotifiedStaleEpochs.has(epoch)) return
    autosaveNotifiedStaleEpochs.add(epoch)
  } else {
    if (autosaveNotifiedUnreadable) return
    autosaveNotifiedUnreadable = true
  }
  showIdentityWriteBlockedToast(reason)
}

/** Shared automatic recovery/autosave notice decision: one warning per stale era, from one permission read. */
export function automaticIdentityWriteAllowed(): boolean {
  const permission = identityWritePermission()
  if ('reason' in permission) {
    showAutosaveFenceToast(permission.reason, permission.reason === 'stale' ? permission.epoch : undefined)
    return false
  }
  autosaveNotifiedUnreadable = false
  return true
}

/** Returns whether the slot now holds this write (an identical payload already does). `false` = nothing was written. */
export function saveAutosave(data: AutosaveData): boolean {
  if (!isLocalStorageAvailable()) {
    if (!isThinClientSession()) showAutosaveFenceToast('unreadable')
    return false
  }

  // CAN-F2w: every write is stamped with the current identity epoch. CAN-F2g: and only by a tab that holds it.
  // On staging the thin latch already covers a page that was ever signed in; this fences the GUEST page that never
  // was (another tab signed in and out under it), which would otherwise save the previous person's model for the next.
  const may = identityWritePermission()
  if ('reason' in may) {
    // Unreadable, or another tab changed the identity under this one: whose model this is cannot be vouched for, so
    // skip it (never stamp a guess). A reload boots this tab as the new identity.
    showAutosaveFenceToast(may.reason, may.reason === 'stale' ? may.epoch : undefined)
    return false
  }
  autosaveNotifiedUnreadable = false
  // A current thin page still reports true for its layout write; stale or unreadable pages reach no layout writer.
  if (isThinClientSession()) {
    saveThinLayout(data.scenarioId, data.nodes)
    return true
  }
  const epoch = may.epoch
  const stamped: AutosaveData = epoch === null ? data : { ...data, identityEpoch: epoch }
  try {
    const payload = JSON.stringify(stamped)

    // P2: Skip write if payload is identical (shallow diff)
    if (payload === lastAutosavePayload) {
      if (import.meta.env.DEV) {
        console.log('[scenarios] Skipping identical autosave write')
      }
      return true
    }

    localStorage.setItem(AUTOSAVE_KEY, payload)
    lastAutosavePayload = payload

    if (import.meta.env.DEV) {
      console.log('[scenarios] Autosave written')
    }
    return true
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
        const withoutAnalysis = JSON.stringify({ ...stamped, analysis: null })
        localStorage.setItem(AUTOSAVE_KEY, withoutAnalysis)
        lastAutosavePayload = withoutAnalysis
        console.warn(
          '[scenarios] Autosave too large — persisted the graph WITHOUT the analysis. ' +
            'The results panel will not restore this run on return.',
          error,
        )
        return true
      } catch (retryError) {
        console.error('[scenarios] Failed to save autosave (graph-only retry):', retryError)
      }
    }
    console.error('[scenarios] Failed to save autosave:', error)
  }
  return false
}

export function loadAutosave(): AutosaveData | null {
  if (!isLocalStorageAvailable()) {
    return null
  }
  // THIN CLIENT: a signed-in browser restores no local model, whoever's slot this is.
  if (isThinClientSession()) return null

  try {
    const stored = localStorage.getItem(AUTOSAVE_KEY)
    if (!stored) return null

    const data = JSON.parse(stored) as AutosaveData

    // Validate structure
    if (!data.timestamp || !Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
      console.warn('[scenarios] Invalid autosave format, ignoring')
      return null
    }
    // CAN-F2w: a slot written under another identity is not this one's (see `IDENTITY_EPOCH_KEY`).
    if (!belongsToThisIdentity(data.identityEpoch)) return null

    return data
  } catch (error) {
    console.error('[scenarios] Failed to load autosave:', error)
    return null
  }
}

export function clearAutosave(): void {
  if (getIdentityWriteBlockReason() !== null) return
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
