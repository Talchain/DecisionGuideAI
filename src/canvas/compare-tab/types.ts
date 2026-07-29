/**
 * Compare Tab: Refinement Journey — Type Definitions
 *
 * Types for the analysis snapshot store, state machine,
 * and transition derivation.
 */

// ---------------------------------------------------------------------------
// Snapshot types
// ---------------------------------------------------------------------------

export interface FactorSensitivitySummary {
  /** Node ID (stable, for canvas linking) */
  id: string
  label: string
  elasticity: number
  rankFlipRate: number
  /** Attribution stability label from PLoT bootstrap */
  attributionStability: string
}

/**
 * Where a snapshot came from, and — inseparably — which HASH REGIME its
 * `graphHash` belongs to. The two are one fact, so they are one field:
 * a second `graphHashFamily` field would be a hand-maintained mirror of this
 * one (CLAUDE.md trap 12).
 *
 *   • 'session'   captured in this browser session at `resultsComplete` from
 *                 the live canvas. `graphHash` is the UI's own
 *                 `generateGraphHash(nodes, edges)`.
 *   • 'persisted' rebuilt from a `v5_handler_facts` `run_analysis` row.
 *                 `graphHash` is CEE's ANALYSIS-AFFECTING hash (`aag_v1`)
 *                 as stored in `result.graph_hash_at_run`.
 *
 * ⚠ THE REGIMES NEVER COMPARE. Three different hashes over "the graph" exist
 * in this estate (UI `generateGraphHash`, CEE identity, CEE `aag_v1`); the
 * `model_versions` and `decision_records` DDL both say so explicitly. Any
 * code comparing two `graphHash` values MUST first check that both snapshots
 * share a `source` — see `detectStructureChange` in deriveTransitions.ts.
 */
export type SnapshotSource = 'session' | 'persisted'

export interface AnalysisSnapshot {
  runId: string
  /** Sequential, 1-indexed */
  runNumber: number
  /** ISO 8601 */
  timestamp: string
  /**
   * Provenance AND hash regime. See {@link SnapshotSource} — comparing
   * `graphHash` across two different sources is meaningless.
   */
  source: SnapshotSource
  /**
   * 'session': `generateGraphHash(nodes, edges)`.
   * 'persisted': `result.graph_hash_at_run` (`aag_v1`).
   *
   * T2b absence-preserving: null when the run carries no hash at all. 55 of
   * the 773 live persisted runs have no `graph_hash_at_run`; a fabricated ''
   * would make two such runs compare EQUAL and silently assert "structure
   * unchanged" about two runs nobody measured.
   */
  graphHash: string | null
  /**
   * For structure-change detection alongside graphHash.
   *
   * T2b absence-preserving: null when the graph the run was computed over is
   * not available. A run rebuilt from a persisted fact has no graph — the
   * fact stores the analysis, not the model — so these are null there. A
   * fabricated 0 would report "the model lost every node" on the first
   * transition into a session snapshot.
   */
  nodeCount: number | null
  edgeCount: number | null

  // Winner/runner-up (from option_comparison sorted by win_probability desc)
  winnerId: string
  winnerLabel: string
  /** 0-100 (matches existing results store convention) */
  winnerProbability: number
  /** null if only 1 option */
  runnerUpId: string | null
  runnerUpLabel: string | null
  runnerUpProbability: number | null

  // Robustness
  //
  // T2b: these are absence-preserving. null means the producer sent no
  // robustness data — NOT "zero". Rendering a fabricated 0 here contradicted
  // AdvancedSection, which honestly hides the same fact when it is absent.
  /** Raw 0-1; null when the producer sent no recommendation_stability. */
  recommendationStability: number | null
  /** "fragile" | "mostly stable" | "stable"; null when stability is unknown. */
  stabilityLabel: string | null
  /** null when the producer sent no fragile_edges array. `[]` is an honest 0. */
  fragileEdgeCount: number | null

  // Evidence
  /**
   * "3/5" format — factor nodes carrying observed data, over all factor nodes.
   *
   * T2b absence-preserving: null when the run was rebuilt from a persisted
   * fact, because the quantity is derived from the GRAPH and the fact stores
   * only the analysis. "0/0" would be a fabricated verdict ("no evidence
   * anywhere"), and `coverageImproving` would then read a rise out of it.
   * Renders as "Not assessed", the same treatment `recommendationStability`
   * and `fragileEdgeCount` already get.
   */
  evidenceCoverage: string | null

  // Factor sensitivity — top 5 for transition derivation
  topFactors: FactorSensitivitySummary[]
  /** max |elasticity| / sum |elasticity|, as percentage */
  influenceConcentration: number
  /**
   * The factor the Compare hero invites the user to calibrate: the top factor
   * by |elasticity|, i.e. the same one whose influence the hero already prints.
   *
   * ⛔ Was `topEvpiFactor` / `topEvpiFactorId` / `topEvpiValue`, selected by
   * max `evpi_percentage_points` with `?? 0` fabricating absence as zero.
   * Renamed rather than left pointing at a quantity it no longer carries — a
   * field named for something it is not is the defect this estate keeps
   * paying for. `topEvpiValue` had exactly one reader (the removed hero
   * clause) and is gone entirely.
   */
  topCalibrationFactor: string
  /** Node ID for canvas linking */
  topCalibrationFactorId: string
  /** As percentage */
  topElasticity: number
  /** From top factor */
  rankFlipRate: number

  // Goal
  goalProbability: number | null
  jointGoalProbability: number | null

  // ISL fields (may be empty arrays when ISL doesn't provide them)
  inferenceWarnings: string[]
  conditionalWinners: Array<{
    factorId: string
    factorLabel: string
    winner: string
    condition: string
  }>
  edgeEValues: Array<{
    edgeId: string
    edgeLabel: string
    eValue: number
  }>

  // Meta
  /** T2b: null when the engine did not echo a usable seed — never a fabricated 0. */
  seedUsed: number | null
  responseHash: string
  /** Derived from events, max 60 chars */
  editSummary: string
}

// ---------------------------------------------------------------------------
// State machine
// ---------------------------------------------------------------------------

/** State precedence: stale > flipped > noWinner > converged > improving */
export type CompareState = 'improving' | 'noWinner' | 'converged' | 'flipped' | 'stale'

// ---------------------------------------------------------------------------
// Run selector
// ---------------------------------------------------------------------------

export type RunPreset = 'prev' | 'first' | 'all'

// ---------------------------------------------------------------------------
// Transition types
// ---------------------------------------------------------------------------

export interface Transition {
  fromRunNumber: number
  toRunNumber: number
  magnitude: 'major' | 'refinement' | 'minor'
  edits: string[]
  winnerProbDelta: number
  /** T2b: false when either end was never assessed — absence is not a change. */
  robustnessChanged: boolean
  /** T2b: null when the producer sent no robustness data for that run. */
  robustnessFrom: string | null
  robustnessTo: string | null
  goalProbDelta: number | null
  /** Node IDs of affected factors */
  affectedFactorIds: string[]
  /** Labels for display */
  affectedFactorLabels: string[]
  deterministicAnchor: string
  /** graphHash OR nodeCount/edgeCount differs */
  structureChanged: boolean
  /** Lowest E-value among affected edges */
  eValue: number | null
  /** Edge label for E-value display */
  eValueEdge: string | null
  conditionalWinner: string | null
  warningsResolved: string[]
  warningsIntroduced: string[]
  /** true for synthetic first→latest card */
  isCumulative: boolean
  /** Caveats for cumulative cards */
  cumulativeCaveats: string[]
  /** AI-generated reason (null until prompt updated) */
  reason: string | null
  /** AI-generated context (null until prompt updated) */
  aiContext: string | null
}
