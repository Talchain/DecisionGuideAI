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
  /** EVPI in percentage points */
  evpiPp: number
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
  /** Raw 0-1 */
  recommendationStability: number
  /** "fragile" | "mostly stable" | "stable" */
  stabilityLabel: string
  fragileEdgeCount: number

  // Evidence
  /** "3/5" format */
  evidenceCoverage: string

  // Factor sensitivity — top 5 for transition derivation
  topFactors: FactorSensitivitySummary[]
  /** max |elasticity| / sum |elasticity|, as percentage */
  influenceConcentration: number
  /** Label of highest EVPI factor */
  topEvpiFactor: string
  /** Node ID for canvas linking */
  topEvpiFactorId: string
  topEvpiValue: number
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
  seedUsed: number
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
  robustnessChanged: boolean
  robustnessFrom: string
  robustnessTo: string
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
