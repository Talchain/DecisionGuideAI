/**
 * analyticalNodeFields — the ONE registry of node/edge `data.*` fields with a
 * per-field record of which cross-cutting behaviours a change of that field
 * participates in.
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
 * ── ALLOWLIST vs DENYLIST — the two purposes are NOT symmetric (Codex P1-1) ─────
 * The two behaviours the registry drives are deliberately opposite shapes:
 *
 *   • 'stale'      — ALLOWLIST. A change invalidates the current analysis
 *                    (readiness / freshness overlay: hasAnalyticalNodeChange /
 *                    hasAnalyticalEdgeChange, and the raw patch-apply path in
 *                    applyPatch.ts). Narrow-is-correct here: only genuinely
 *                    analysis-affecting fields belong. Cosmetic fields (label,
 *                    body, description, position, colour) and derived caches that
 *                    are re-computed on restore are deliberately EXCLUDED.
 *
 *   • 'ephemeral'  — DENYLIST. computeGraphHash now hashes ALL serialized node /
 *                    edge `data.*` BY DEFAULT (so any user-editable field a live
 *                    editor writes survives reload without anyone remembering to
 *                    allowlist it — the #457/description/category/… class of loss).
 *                    'ephemeral' is the small, explicit EXCLUSION list: fields
 *                    whose change must NOT trigger an autosave because they are
 *                    transient UI/session state or a derived cache re-computed on
 *                    load. Persist is the default; you only ever add to this list,
 *                    with a one-line WHY, when a field would otherwise churn or
 *                    resurrect stale derived state.
 *
 * Why this asymmetry (Codex P1-1, adjudicated): the OLD 'persist' purpose was an
 * allowlist-guarding-an-allowlist. computeGraphHash only hashed fields on the
 * persist allowlist, so six user-editable fields never on it (`description`,
 * `category`, `extractionType`, `factor_type`, `state_space`,
 * `uncertainty_drivers`) were silently dropped on reload — the same defect class
 * as #457, one allowlist-omission at a time. Inverting to hash-by-default makes
 * the SAFE direction the default: a new ephemeral field NOT denylisted merely
 * causes an extra (debounced) save — harmless; a field that a live editor writes
 * as persistent state can never be silently lost by omission. The only failure
 * this leaves is the opposite: a genuinely-persistent field wrongly denylisted —
 * which the drift guard catches (named-field diff + the editor-field disjointness
 * assertion in analyticalNodeFields.registry.spec.ts).
 *
 * FIELDS NEEDING NO ENTRY: everything that is neither analysis-affecting nor
 * ephemeral is persisted by default and does not appear here — e.g. `description`,
 * `category`, `extractionType`, `factor_type`, `state_space`,
 * `uncertainty_drivers`, `goal_threshold_unit`, `threshold_source`. They persist
 * because the hash defaults to persisting; they do not stale because they are not
 * analysis inputs (unit/provenance are display/provenance only). Their round-trip
 * is pinned in useAutosave.hashByDefault.spec.ts.
 *
 * Structural signals (node id / RF `type` / label / position; edge source/target)
 * are handled inline by each consumer and are deliberately NOT in this registry —
 * it enumerates `data.*` fields only.
 *
 * ── stale/ephemeral notes carried over from task #23 ───────────────────────────
 * node `probability`, `impact`, `prior` are genuinely user-editable IN ISOLATION
 * on the live path and analysis-affecting → `stale` (and persisted by default).
 * edge `beliefStrength`, `belief`, `exists_probability` have NO live editor that
 * writes them in isolation (creation-time defaults / the DEAD v1 edge inspector /
 * CEE-ingestion that always co-writes the persisted `beliefExists`) → `stale`
 * only; they persist by default. See each field's note for the trace.
 */

export type AnalyticalFieldPurpose = 'ephemeral' | 'stale'

export interface AnalyticalFieldSpec {
  /** The `data.*` key on the node or edge. */
  readonly field: string
  /** Which behaviours a change of this field participates in. At least one. */
  readonly purposes: readonly AnalyticalFieldPurpose[]
  /** WHY this field matters + which consumers read it. Required, non-empty. */
  readonly note: string
}

// ---------------------------------------------------------------------------
// Node data fields
//
// Only 'stale' (analysis-affecting) and 'ephemeral' (excluded from the autosave
// hash) fields need an entry. Persist is the DEFAULT — a user-editable field that
// is not analysis-affecting (description, category, extractionType, factor_type,
// state_space, uncertainty_drivers, goal_threshold_unit, threshold_source) is
// persisted by hash-by-default and correctly needs no row here.
// ---------------------------------------------------------------------------

export const NODE_FIELD_REGISTRY: readonly AnalyticalFieldSpec[] = [
  {
    field: 'observedState',
    purposes: ['stale'],
    note: "A factor/outcome's observed value+baseline+std — the core analysis input. CEE set_factor_value merges here. Consumers: staleness (hasAnalyticalNodeChange), V2 adapter extractObservedState → PLoT. Persisted by hash-by-default.",
  },
  {
    field: 'interventions',
    purposes: ['stale'],
    note: "An option's per-factor intervention values — define what the option does. Consumers: staleness, V2 adapter. Persisted by hash-by-default.",
  },
  {
    field: 'is_baseline',
    purposes: ['stale'],
    note: 'Marks the baseline option; flips the analysis framing. Consumers: staleness. Persisted by hash-by-default.',
  },
  {
    field: 'success_threshold',
    purposes: ['stale'],
    note: "The user's success target on the goal node (written with threshold_source='user'). #457 root cause when the old persist allowlist omitted it. Consumers: staleness, V2 adapter goal_threshold derivation, goal lens. Persisted by hash-by-default.",
  },
  {
    field: 'goal_threshold_raw',
    purposes: ['stale'],
    note: 'User-edited raw goal target; the V2 adapter derives the PLoT goal_threshold from it (raw/cap), so a change is analysis-affecting AND must survive reload. A raw-only edit already reaches staleness via this entry (Codex P1-2 audit: NOT gapped). Consumers: staleness, V2 adapter. Persisted by hash-by-default.',
  },
  {
    field: 'goal_threshold_cap',
    purposes: ['stale'],
    note: 'Cap used to normalise goal_threshold_raw into [0,1] for PLoT (resolveGoalThresholdCap → resolveChipGoalThreshold, UI-SEM-058). A cap edit changes the normalised threshold the request carries (cap 25→100 flips implied 0.8→0.2) so it IS analysis-affecting — Codex P1-2 gave it the `stale` purpose (was persist-only, so GoalAdvancedEditor cap edits left freshness clean while changing the math). Consumers: staleness, V2 adapter normalisation. Persisted by hash-by-default.',
  },
  {
    field: 'prior',
    purposes: ['stale'],
    note: "A factor's prior belief range — analysis-affecting AND user-editable in isolation on the live path (External-factor inspector: FactorExternalPanel/FactorExternalEditor setPriorRange → updateNode(data.prior), routed live via InspectorRouter 'factor-external'; also read by the V1 mapper → PLoT). Consumers: staleness, V1 mapper. Persisted by hash-by-default.",
  },
  {
    field: 'kind',
    purposes: ['stale'],
    note: 'A data-level node kind reclassification. The primary kind signal is the RF `type` field, which both consumers handle structurally; this catches a data.kind-only change for staleness. Persisted by hash-by-default (also caught structurally via n.type in computeGraphHash). Consumers: staleness.',
  },
  {
    field: 'goalThreshold',
    purposes: ['stale', 'ephemeral'],
    note: 'camelCase derived goal-threshold cache on the node; analysis-affecting (staleness) but a DERIVED value re-computed on restore from success_threshold/goal_threshold_raw — EPHEMERAL so it never triggers a persist-save on its own (its inputs are persisted and re-derive it). Consumers: staleness; excluded from computeGraphHash.',
  },
  {
    field: 'goal_threshold',
    purposes: ['stale', 'ephemeral'],
    note: 'snake_case derived/normalised goal threshold; analysis-affecting (staleness) but DERIVED and re-computed on restore, so EPHEMERAL — excluded from the autosave hash (a recompute must not churn the dirty-gate; the raw inputs are persisted). Consumers: staleness, V2 adapter output; excluded from computeGraphHash.',
  },
  {
    field: 'probability',
    purposes: ['stale'],
    note: "A risk's likelihood [0,1] — user-editable in isolation via RiskPanel (setProbability → updateNode(data.probability), live since #453) and analysis-affecting (drives calculateRiskSeverity; passes to PLoT). Top-level node.data, not nested in observedState. #453 root cause when missing from staleness. Consumers: staleness, RiskPanel, V2 adapter. Persisted by hash-by-default.",
  },
  {
    field: 'impact',
    purposes: ['stale'],
    note: "A risk's impact enum (low..critical); with probability drives severity. User-editable in isolation via RiskPanel (setImpact → updateNode(data.impact)). #453. Consumers: staleness, RiskPanel. Persisted by hash-by-default.",
  },
  {
    field: '_baseline_snapshot',
    purposes: ['ephemeral'],
    note: 'Transient session state (labelled as such at store.ts saveScenario / contextMenu/actions.ts): the pre-modification observed value captured by the Set-value best/worst-case actions so "reset to baseline" can restore it. Cleared on scenario save. Never written in isolation — ensureBaselineSnapshot always co-writes observedState (a persisted field) in the same action, so denylisting it changes no save-trigger; it is EPHEMERAL to document intent and stop a future isolated write from falsely dirtying the autosave. Not analysis-affecting (bypasses PLoT). Excluded from computeGraphHash.',
  },
] as const

// ---------------------------------------------------------------------------
// Edge data fields
//
// No edge `data.*` field is ephemeral today — path-highlight / dim / selection
// live in SEPARATE store state (highlightedEdgeIds / dimmedNodeIds), never on
// edge.data, so nothing on the edge churns per-render. Every field below is
// analysis-affecting ('stale') and persisted by hash-by-default.
// ---------------------------------------------------------------------------

export const EDGE_FIELD_REGISTRY: readonly AnalyticalFieldSpec[] = [
  {
    field: 'weight',
    purposes: ['stale'],
    note: 'Magnitude of the edge influence. Consumers: staleness (hasAnalyticalEdgeChange). Persisted by hash-by-default.',
  },
  {
    field: 'direction',
    purposes: ['stale'],
    note: 'Sign of the edge influence; CEE adjust_edge_strength writes it via updateEdgeData without touching endpoints. Consumers: staleness. Persisted by hash-by-default.',
  },
  {
    field: 'strengthStd',
    purposes: ['stale'],
    note: 'Uncertainty (std) on the edge weight. Consumers: staleness. Persisted by hash-by-default.',
  },
  {
    field: 'confidence',
    purposes: ['stale'],
    note: 'Edge confidence; also the legacy dirty-gate composite (computeGraphHash keeps `confidence ?? weight` inline for exact backward compat). Consumers: staleness. Persisted by hash-by-default.',
  },
  {
    field: 'beliefExists',
    purposes: ['stale'],
    note: 'Probability the edge relationship exists. Consumers: staleness. Persisted by hash-by-default.',
  },
  {
    field: 'beliefStrength',
    purposes: ['stale'],
    note: "Belief magnitude on the edge — analysis-affecting. Task #23 trace: NO live editor writes edge.data.beliefStrength in isolation (set only at edge CREATION via DEFAULT_EDGE_DATA and by CEE normalisation in edges.ts; the live edge inspector writes weight/direction/strengthStd/beliefExists). Consumers: staleness. Persisted by hash-by-default.",
  },
  {
    field: 'belief',
    purposes: ['stale'],
    note: "Legacy belief scalar — analysis-affecting. Task #23 trace: the only writer is the DEAD v1 edge inspector (live path is EdgePanel, which writes beliefExists). Consumers: staleness. Persisted by hash-by-default.",
  },
  {
    field: 'exists_probability',
    purposes: ['stale'],
    note: "snake_case existence probability — analysis-affecting. Task #23 trace: written ONLY by CEE ingestion (applyPatch/applyDraftResult buildEdge), each co-writing beliefExists; the live editor (EdgePanel setExistsProbability) writes beliefExists. Consumers: staleness. Persisted by hash-by-default.",
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

/**
 * Node `data.*` fields EXCLUDED from the autosave hash (computeGraphHash) —
 * transient/derived state whose change must NOT trigger a save. Everything else
 * on node.data is hashed by default.
 */
export const EPHEMERAL_NODE_FIELDS = deriveFields(NODE_FIELD_REGISTRY, 'ephemeral')
/** Node `data.*` fields whose change invalidates the analysis (staleness). */
export const STALE_NODE_FIELDS = deriveFields(NODE_FIELD_REGISTRY, 'stale')
/** Edge `data.*` fields EXCLUDED from the autosave hash (empty today). */
export const EPHEMERAL_EDGE_FIELDS = deriveFields(EDGE_FIELD_REGISTRY, 'ephemeral')
/** Edge `data.*` fields whose change invalidates the analysis (staleness). */
export const STALE_EDGE_FIELDS = deriveFields(EDGE_FIELD_REGISTRY, 'stale')
