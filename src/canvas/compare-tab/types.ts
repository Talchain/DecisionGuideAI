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

export interface AnalysisSnapshot {
  runId: string
  /** Sequential, 1-indexed */
  runNumber: number
  /** ISO 8601 */
  timestamp: string
  /** From generateGraphHash(nodes, edges) */
  graphHash: string
  /** For structure-change detection alongside graphHash */
  nodeCount: number
  edgeCount: number

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
  /** "3/5" format */
  evidenceCoverage: string

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
