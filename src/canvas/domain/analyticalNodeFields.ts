/**
 * analyticalNodeFields — the ONE registry of node/edge `data.*` fields that carry
 * user-meaningful analytical state, with a per-field record of WHICH PURPOSES
 * consume each field.
 *
 * ── Why this file exists (trap-12 closure) ─────────────────────────────────────
 * Two hand-maintained field lists had silently drifted apart, and BOTH shipped a
 * user-visible data-loss bug in the same week:
 *
 *   • `computeGraphHash` (canvas/hooks/useAutosave.ts) — the autosave dirty-gate.
 *     It hand-listed the node/edge fields whose change should trigger a save. It
 *     was missing `success_threshold` / `threshold_source`, so a user's success
 *     target never flipped the dirty hash → the 30s autosave skipped → the target
 *     was lost on reload (#457).
 *
 *   • `ANALYTICAL_NODE_DATA_FIELDS` (canvas/domain/analyticalChange.ts) — the
 *     "is this edit analysis-affecting?" staleness gate. It was missing
 *     `probability` / `impact`, so a risk edit never staled the analysis (#453).
 *
 * A list a human must remember to keep in sync WILL drift, and the drift always
 * reads as green. This registry is the single source of truth; both call sites
 * DERIVE their subset from it (`deriveFields`), and `analyticalNodeFields.registry.spec.ts`
 * is the fail-loud drift guard that verifies the real consumers honour it.
 *
 * ── The two purposes are OVERLAPPING, not identical ────────────────────────────
 * They share a large core (observedState, interventions, is_baseline,
 * success_threshold, goal_threshold_raw; edge weight/direction/…) but each has
 * legitimately-exclusive members, so the registry records purposes PER FIELD
 * rather than forcing a single list:
 *
 *   • 'persist'  — a change MUST survive a reload (autosave dirty-gate,
 *                  computeGraphHash). Includes display/provenance metadata
 *                  (goal_threshold_unit/cap, threshold_source) that is not an
 *                  analysis input but is still user state that must not be lost.
 *   • 'stale'    — a change invalidates the current analysis (readiness /
 *                  freshness overlay: hasAnalyticalNodeChange / hasAnalyticalEdgeChange,
 *                  and the raw patch-apply path in applyPatch.ts). Excludes
 *                  cosmetic fields (label, body, description, position, colour),
 *                  and excludes derived values that are re-computed on restore.
 *
 * Structural signals (node id / RF `type` / label / position; edge source/target)
 * are handled inline by each consumer and are deliberately NOT in this registry —
 * it enumerates `data.*` fields only.
 *
 * ── ⚠ KNOWN persist/stale ASYMMETRIES (behaviour preserved; NOT fixed here) ─────
 * Some analysis-affecting fields are NOT in the persist gate today — the SAME
 * class of gap as #457 (an edit to ONLY that field would not flip the autosave
 * dirty hash). They are flagged `stale`-only below with a "KNOWN GAP" note and
 * left as-is so this refactor preserves both behaviours exactly. Candidates for a
 * follow-up: node `probability`, `impact`, `prior`; edge `beliefStrength`,
 * `belief`, `exists_probability`. Making the registry surface these openly is the
 * point of the exercise.
 */

export type AnalyticalFieldPurpose = 'persist' | 'stale'

export interface AnalyticalFieldSpec {
  /** The `data.*` key on the node or edge. */
  readonly field: string
  /** Which consumers must react to a change of this field. At least one. */
  readonly purposes: readonly AnalyticalFieldPurpose[]
  /** WHY this field matters + which consumers read it. Required, non-empty. */
  readonly note: string
}

// ---------------------------------------------------------------------------
// Node data fields
// ---------------------------------------------------------------------------

export const NODE_FIELD_REGISTRY: readonly AnalyticalFieldSpec[] = [
  {
    field: 'observedState',
    purposes: ['persist', 'stale'],
    note: "A factor/outcome's observed value+baseline+std — the core analysis input. CEE set_factor_value merges here. Consumers: staleness (hasAnalyticalNodeChange), autosave dirty-gate (computeGraphHash), V2 adapter extractObservedState → PLoT.",
  },
  {
    field: 'interventions',
    purposes: ['persist', 'stale'],
    note: "An option's per-factor intervention values — define what the option does. Consumers: staleness, autosave, V2 adapter.",
  },
  {
    field: 'is_baseline',
    purposes: ['persist', 'stale'],
    note: 'Marks the baseline option; flips the analysis framing. Consumers: staleness, autosave.',
  },
  {
    field: 'success_threshold',
    purposes: ['persist', 'stale'],
    note: "The user's success target on the goal node (written with threshold_source='user'). #457 root cause when it was missing from persist. Consumers: staleness, autosave, V2 adapter goal_threshold derivation, goal lens.",
  },
  {
    field: 'goal_threshold_raw',
    purposes: ['persist', 'stale'],
    note: 'User-edited raw goal target; the V2 adapter derives the PLoT goal_threshold from it, so a change is analysis-affecting AND must survive reload. Consumers: staleness, autosave, V2 adapter.',
  },
  {
    field: 'goal_threshold_unit',
    purposes: ['persist'],
    note: 'Display/format metadata for the goal target. Must survive reload so the restored target renders identically, but a unit change alone (without a raw change) is not treated as analysis-affecting today. Consumers: autosave.',
  },
  {
    field: 'goal_threshold_cap',
    purposes: ['persist'],
    note: 'Cap used to normalise goal_threshold_raw into [0,1] for PLoT; persisted so the raw target re-normalises identically on reload. Not in the staleness set today (a cap change without a raw change is not currently treated as analysis-affecting). Consumers: autosave, V2 adapter normalisation.',
  },
  {
    field: 'threshold_source',
    purposes: ['persist'],
    note: "Provenance only ('user' vs auto-synthesised). Pure provenance, not an analysis input — but MUST survive reload (#457: without it a restored user target reads as 'auto'). Consumers: autosave, goal lens / nudge gate.",
  },
  {
    field: 'prior',
    purposes: ['stale'],
    note: "A factor's prior belief — analysis-affecting. ⚠ KNOWN GAP: not in the persist dirty-gate today (a prior-only edit would not trigger an autosave — same class as #457). Behaviour preserved; follow-up candidate. Consumers: staleness.",
  },
  {
    field: 'kind',
    purposes: ['stale'],
    note: 'A data-level node kind reclassification. The primary kind signal is the RF `type` field, which both consumers handle structurally; this catches a data.kind-only change for staleness. Persist covers kind via n.type. Consumers: staleness.',
  },
  {
    field: 'goalThreshold',
    purposes: ['stale'],
    note: 'camelCase derived goal-threshold cache on the node; analysis-affecting when present, but a derived value that is re-computed on restore, so deliberately not persisted. Consumers: staleness.',
  },
  {
    field: 'goal_threshold',
    purposes: ['stale'],
    note: 'snake_case derived/normalised goal threshold; analysis-affecting. Derived and re-computed on restore, so deliberately not persisted. Consumers: staleness, V2 adapter output.',
  },
  {
    field: 'probability',
    purposes: ['stale'],
    note: "A risk's likelihood [0,1] — passes through to PLoT (V2 adapter) and drives calculateRiskSeverity. #453 root cause when missing from staleness. ⚠ KNOWN GAP: not in the persist dirty-gate today (top-level node.data field, not nested in observedState — a probability-only edit would not trigger an autosave, same class as #457). Behaviour preserved; follow-up candidate. Consumers: staleness, RiskPanel, V2 adapter.",
  },
  {
    field: 'impact',
    purposes: ['stale'],
    note: "A risk's impact enum (low..critical); with probability drives severity. #453. ⚠ KNOWN GAP: same persist gap as probability. Behaviour preserved; follow-up candidate. Consumers: staleness, RiskPanel.",
  },
] as const

// ---------------------------------------------------------------------------
// Edge data fields
// ---------------------------------------------------------------------------

export const EDGE_FIELD_REGISTRY: readonly AnalyticalFieldSpec[] = [
  {
    field: 'weight',
    purposes: ['persist', 'stale'],
    note: 'Magnitude of the edge influence. Consumers: staleness (hasAnalyticalEdgeChange), autosave.',
  },
  {
    field: 'direction',
    purposes: ['persist', 'stale'],
    note: 'Sign of the edge influence; CEE adjust_edge_strength writes it via updateEdgeData without touching endpoints. Consumers: staleness, autosave.',
  },
  {
    field: 'strengthStd',
    purposes: ['persist', 'stale'],
    note: 'Uncertainty (std) on the edge weight. Consumers: staleness, autosave.',
  },
  {
    field: 'confidence',
    purposes: ['persist', 'stale'],
    note: 'Edge confidence; also the legacy dirty-gate key (computeGraphHash previously keyed on confidence ?? weight). Consumers: staleness, autosave.',
  },
  {
    field: 'beliefExists',
    purposes: ['persist', 'stale'],
    note: 'Probability the edge relationship exists. Consumers: staleness, autosave.',
  },
  {
    field: 'beliefStrength',
    purposes: ['stale'],
    note: 'Belief magnitude on the edge — analysis-affecting. ⚠ KNOWN GAP: not in the persist dirty-gate today. Behaviour preserved; follow-up candidate. Consumers: staleness.',
  },
  {
    field: 'belief',
    purposes: ['stale'],
    note: 'Legacy belief scalar — analysis-affecting. ⚠ KNOWN GAP: not in the persist dirty-gate today. Behaviour preserved; follow-up candidate. Consumers: staleness.',
  },
  {
    field: 'exists_probability',
    purposes: ['stale'],
    note: 'snake_case existence probability — analysis-affecting. ⚠ KNOWN GAP: not in the persist dirty-gate today. Behaviour preserved; follow-up candidate. Consumers: staleness.',
  },
] as const

// ---------------------------------------------------------------------------
// Derivation — the ONLY way a consumer should obtain its field list.
// ---------------------------------------------------------------------------

/**
 * The `data.*` field names from `registry` that the given `purpose` consumes,
 * in registry order. This is the single derivation both call sites use — a new
 * field added to the registry with the right purpose flag reaches every consumer
 * automatically, and the drift guard fails loud if a consumer stops honouring it.
 */
export function deriveFields(
  registry: readonly AnalyticalFieldSpec[],
  purpose: AnalyticalFieldPurpose,
): readonly string[] {
  return registry.filter((f) => f.purposes.includes(purpose)).map((f) => f.field)
}

/** Node `data.*` fields whose change must survive a reload (autosave dirty-gate). */
export const PERSIST_NODE_FIELDS = deriveFields(NODE_FIELD_REGISTRY, 'persist')
/** Node `data.*` fields whose change invalidates the analysis (staleness). */
export const STALE_NODE_FIELDS = deriveFields(NODE_FIELD_REGISTRY, 'stale')
/** Edge `data.*` fields whose change must survive a reload (autosave dirty-gate). */
export const PERSIST_EDGE_FIELDS = deriveFields(EDGE_FIELD_REGISTRY, 'persist')
/** Edge `data.*` fields whose change invalidates the analysis (staleness). */
export const STALE_EDGE_FIELDS = deriveFields(EDGE_FIELD_REGISTRY, 'stale')
