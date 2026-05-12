/**
 * Canvas-derived signals used to ground the v17 readiness strip.
 *
 * Every signal here is computed directly from the canvas store's nodes
 * and edges (or from `ResultsSectionDataReturn`) — no invention. Each
 * derivation is documented + unit tested in `__tests__/canvasSignals.spec.ts`.
 *
 * Per P1.6 review feedback: no `as any` casts. We narrow `data` via the
 * `in` operator so TypeScript verifies the kind-discriminator check
 * without weakening the type system.
 */

/** A node-shaped object minimal enough to test without coupling to React Flow internals. */
export interface NodeLike {
  id: string
  type?: string | undefined
  data?: unknown
}

/** Discriminator for the schema-v2 `data.kind` field. */
function hasKindOfFactor(data: unknown): boolean {
  return (
    typeof data === 'object'
    && data !== null
    && 'kind' in data
    && (data as { kind: unknown }).kind === 'factor'
  )
}

function hasKindOfRisk(data: unknown): boolean {
  return (
    typeof data === 'object'
    && data !== null
    && 'kind' in data
    && (data as { kind: unknown }).kind === 'risk'
  )
}

/**
 * A factor node is one whose React Flow `type === 'factor'` OR whose
 * `data.kind === 'factor'` (schema-v2 convention). Both checks are
 * type-safe via the `in` operator + property narrowing.
 */
export function isFactorNode(n: NodeLike): boolean {
  if (n.type === 'factor') return true
  return hasKindOfFactor(n.data)
}

/** Symmetric guard for risk nodes — used by the Coverage signal. */
export function isRiskNode(n: NodeLike): boolean {
  if (n.type === 'risk') return true
  return hasKindOfRisk(n.data)
}

/** Goal nodes via either convention. */
export function isGoalNode(n: NodeLike): boolean {
  if (n.type === 'goal') return true
  return (
    typeof n.data === 'object'
    && n.data !== null
    && 'kind' in n.data
    && (n.data as { kind: unknown }).kind === 'goal'
  )
}

// ── Structural / coverage signals for the readiness strip ──────────────────

export interface StructureSignals {
  /** Goal node present in the canvas. */
  hasGoal: boolean
  /** Two or more options. */
  hasMultipleOptions: boolean
  /** At least one factor node. */
  hasFactors: boolean
  /** At least one edge (causal connection). */
  hasConnections: boolean
}

export interface CoverageSignals {
  /** Two or more options. */
  hasMultipleOptions: boolean
  /** At least one risk node. */
  hasRisks: boolean
  /** A baseline option has been identified. */
  hasBaseline: boolean
  /** A goal threshold has been set. */
  hasGoalThreshold: boolean
}

/**
 * Derive a 0..1 Structure score by counting boolean signals. Each
 * signal contributes equally (0.25). Rationale:
 *   - The v17 prototype defines Structure as "model structure
 *     completeness" — a coarse, equal-weight composite is honest about
 *     this being a checklist rather than a continuous metric.
 *   - Refinements (weighting one signal more than another) would be
 *     an invention without underlying data to justify the weights.
 *   - The four signals match the prototype's listed inputs
 *     (goal · options · factors · connections).
 */
export function deriveStructureScore(signals: StructureSignals): number {
  let count = 0
  if (signals.hasGoal) count += 1
  if (signals.hasMultipleOptions) count += 1
  if (signals.hasFactors) count += 1
  if (signals.hasConnections) count += 1
  return count / 4
}

/**
 * Derive a 0..1 Coverage score using the same equal-weight composite
 * pattern. The four signals match the v17 prototype's "Coverage" intent:
 * option coverage, risk modelling, baseline/current approach, and
 * goal/target coverage.
 */
export function deriveCoverageScore(signals: CoverageSignals): number {
  let count = 0
  if (signals.hasMultipleOptions) count += 1
  if (signals.hasRisks) count += 1
  if (signals.hasBaseline) count += 1
  if (signals.hasGoalThreshold) count += 1
  return count / 4
}
