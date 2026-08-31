/**
 * Node domain types and schemas
 * British English: visualisation, colour, initialise
 */

import { z } from 'zod'
import { Target, Crosshair, Lightbulb, Settings, AlertTriangle, TrendingUp, Zap, Shield } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { devWarn } from '../../utils/debugLog'
import { DECISION_NODE_LABEL } from './vocabulary'

/*
 * Node type taxonomy for decision trees
 * 🎯 Goal: Target outcome or objective
 * 🔀 Decision: Choice point requiring evaluation
 * 💡 Option: Specific alternative or path
 * ⚙️ Factor: Intermediate variable or driver
 * ⚠️ Risk: Potential hazard or concern
 * 📈 Outcome: Result or consequence
 * ⚡ Action: Concrete step or task to execute
 * 🛡️ Constraint: Boundary or limit (budget, time, resource)
 */
/**
 * All canvas node type identifiers.
 *
 * NOTE — 'constraint': schema-defined (kept for wire tolerance / ref resolution),
 * but CEE/PLoT never emits canvas nodes with type 'constraint'. Constraints surface as
 * badge data on GoalNode (store.goalConstraints + results.report.goal_constraints), not as
 * standalone canvas nodes. The dead ConstraintNode renderer + its registry entry were
 * removed (honesty sweep) — there is no 'constraint' ReactFlow renderer.
 * Do not add CEE-driven constraint node emission (or re-add a renderer) without a design review.
 */
export const NodeTypeEnum = z.enum(['goal', 'decision', 'option', 'factor', 'risk', 'outcome', 'action', 'constraint'])
export type NodeType = z.infer<typeof NodeTypeEnum>

/**
 * THE ONE FALLBACK CHAIN for "what kind of element is this node?".
 *
 * ⚠ IT LIVES HERE BECAUSE IT IS A DOMAIN QUESTION, NOT A SURFACE ONE. The
 * chain `node.type ?? data.kind ?? data.type` exists because the store, the
 * wire and the importers have each seeded the kind in a different place over
 * time. That is a fact about the DATA, so every surface that asks the question
 * must get the same answer — a second copy in a hook or a panel would be the
 * duplicated-helper defect this estate keeps paying for (trap 12), and it would
 * drift the day a fourth seeding location appears.
 *
 * It was MOVED here from `model-tab-v2/adapters.ts` (18 Aug 2026), not copied:
 * that module's `nodeKind` now calls this and narrows the result to the seven
 * kinds its outline renders. Two callers, ONE chain, and the narrowing stays
 * where the narrowing matters — the two functions answer different questions
 * ("what is this?" vs "does my outline render it?") and are named apart so they
 * cannot be conflated (trap 21).
 *
 * Returns `null` for anything outside the taxonomy, which is a fact to act on
 * rather than a default to invent.
 */
export function resolveNodeTypeLiteral(node: { type?: string; data?: unknown }): NodeType | null {
  const data = node.data as { kind?: unknown; type?: unknown } | undefined
  const raw = node.type ?? data?.kind ?? data?.type
  const parsed = NodeTypeEnum.safeParse(raw)
  return parsed.success ? parsed.data : null
}

/**
 * Prior — either a plain probability (0..1) or the CEE distribution object
 * (`{ distribution, range_min, range_max }`) that external factors carry.
 *
 * The object form is a first-class LIVE shape: written by
 * useInspectorMutations (range edits), read by FactorNode/DecisionNode range
 * displays, FactorExternalEditor/Panel and observedStateHelpers. Real canvas
 * exports carry it (walk-582 fixtures, 2.463), so the import schema must
 * accept it. `.passthrough()` matches the ObservedStateSchema/
 * InterventionSchema convention for CEE-sourced value objects (additive CEE
 * fields must survive the parse).
 */
export const PriorDistributionSchema = z.object({
  distribution: z.string().optional(),
  range_min: z.number().optional(),
  range_max: z.number().optional(),
  /**
   * CEE's marker that this range is IGNORANCE, not an estimate. See
   * `isUnquantifiedPrior` below — declared permissively here (`boolean`) and
   * read strictly there (`=== true`), deliberately: a parse must never reject a
   * node because a producer wrote `false`, and a surface must never treat
   * anything but a literal `true` as a claim.
   */
  prior_is_unquantified: z.boolean().optional(),
}).passthrough()
export const PriorSchema = z.union([z.number().min(0).max(1), PriorDistributionSchema])
export type Prior = z.infer<typeof PriorSchema>

/**
 * The field name, declared ONCE for the whole UI.
 *
 * ⚠ IT IS DECLARED HERE RATHER THAN IMPORTED, AND THAT IS A CORRECTED PREMISE.
 * The intent was to import the spelling from the shared contract. It is not
 * there: the UI pins `@talchain/schemas@0.48.0` (`vendor/`), and unpacking that
 * tarball on 30 Aug 2026 found the field in ZERO files — positive control
 * `range_min` in 13, fabricated control in 0, so the probe both sees and
 * refuses. The pin must NOT move (CEE is on 0.50.0; a skew is a hard 422 on the
 * whole turn), so the UI owns the spelling itself, in one place, with a test
 * asserting the exact string. Replace this with the contract import when the
 * pin next moves.
 *
 * CEE's twin: `cee/provenance/unquantified-factor.ts`
 * `PRIOR_IS_UNQUANTIFIED_FIELD`.
 */
export const PRIOR_IS_UNQUANTIFIED_FIELD = 'prior_is_unquantified'

/**
 * Is this prior an explicit statement of IGNORANCE rather than an estimate?
 *
 * ── THE PRINCIPLE, AND IT IS THE WHOLE REASON THIS FUNCTION EXISTS ──────────
 *
 * **A RANGE IS NOT SELF-DESCRIBING.** `{range_min: 0, range_max: 1}` from a
 * genuine external prior and the same pair from ignorance are BYTE-IDENTICAL
 * and mean opposite things. Only a provenance flag can tell them apart.
 *
 * CEE PR #1223 stops substituting a placeholder `0.5` for a factor the brief
 * gave no number for; the factor now arrives with `uniform(0,1)` carrying this
 * flag — the one range over the unit interval that asserts nothing.
 *
 * ⚠ NEVER DISCRIMINATE ON THE RANGE. Two corpora, measured 30 Aug 2026, return
 * OPPOSITE verdicts on a range predicate: #1223's own corpus holds genuine
 * unflagged `uniform(0,1)` priors (`fac_nrr`, `fac_legal_clearance`) that a
 * range test would wrongly suppress, while all 14 priors across the five
 * shipped starters are narrowed and none sits at exactly (0,1) — so a range
 * discriminator would have shown no false positives there and PASSED REVIEW.
 * No corpus can prove a range predicate unambiguous; it can only fail to have
 * found the counterexample yet.
 *
 * ── POSITIVE EVIDENCE ONLY ──────────────────────────────────────────────────
 *
 * Returns true ONLY on a literal `true`. Not `!== false`, not truthiness, not
 * "has a prior". Every one of those is wider than the spec, and this predicate
 * SUPPRESSES a numeric display — so a widened version would hide a genuine
 * estimate. Written against the spec (*"a prior is ignorance when, and only
 * when, it says so"*), never against the failing input.
 *
 * ⚠ NAMED APART FROM CEE'S TWIN (CLAUDE.md trap 21). CEE's
 * `factorIsExplicitlyUnquantified` takes a NODE and answers *"may the validator
 * relax its value gate?"*. This takes a PRIOR and answers *"may a surface
 * present this as an estimate?"*. Different subjects, different questions —
 * kept under different names so they cannot be conflated.
 *
 * ⭐ ONE OWNER, CONSUMED BY BOTH SURFACES. `isFactorNeedsInput`
 * (`utils/observedStateHelpers.ts`, the amber StatusPill + "Help me estimate
 * this" chip) and `NodeInspector`'s `describePrior` are the same defect on two
 * surfaces, not two unrelated fixes. They call this; they do not re-type it.
 */
export function isUnquantifiedPrior(prior: unknown): boolean {
  if (typeof prior !== 'object' || prior === null) return false
  return (prior as Record<string, unknown>)[PRIOR_IS_UNQUANTIFIED_FIELD] === true
}

/**
 * Base node data schema (v3)
 * All nodes share: label, type, optional description
 * v3 adds v1.2 API fields: kind, prior, utility, body
 */
export const NodeDataSchema = z.object({
  label: z.string().min(1).max(100),
  type: z.string().default('decision'), // Will be refined by NodeTypeEnum
  description: z.string().max(500).optional(),

  // v1.2 API fields (optional, for backend interop)
  kind: z.enum(['goal', 'decision', 'option', 'factor', 'risk', 'outcome', 'action', 'constraint']).optional(), // Backend node classification
  prior: PriorSchema.optional(), // Probability (0..1) or CEE distribution object
  utility: z.number().min(-1).max(1).optional(), // Relative payoff (-1..+1)
  body: z.string().max(2000).optional(), // Longer text (distinct from description)

  // CEE display provenance (optional, threaded from /assist/v1/draft-graph response).
  // Drives "From brief" / "AI estimate" / "User set" pills. UI never invents this value.
  provenance: z.enum(['from_brief', 'ai_inferred', 'user_set']).optional(),
})

/**
 * Goal node: represents target outcome
 */
export const GoalNodeDataSchema = NodeDataSchema.extend({
  type: z.literal('goal'),
})

/**
 * Decision node: represents choice point
 */
export const DecisionNodeDataSchema = NodeDataSchema.extend({
  type: z.literal('decision'),
})

/**
 * ObservedState — canonical runtime shape for factor observed values.
 *
 * Canvas uses `observedState` (camelCase) on node.data; CEE/PLoT wire format
 * uses `observed_state` (snake_case). Fields inside are consistent across both.
 *
 * `display_value` is CEE-provided contextual text. As of the V5 stale-value-
 * protection fix (May 2026), a fresh `raw_value` + meaningful unit (e.g.
 * `26000` + `'£'`) outranks `display_value`, so a stale display string cannot
 * mask a user edit to observed_state. `display_value` still wins over the
 * unitless-raw numeric fallback and the value-only binary heuristic — see the
 * full priority order on `FactorDisplayInput.display_value` in
 * src/utils/formatFactorDisplayValue.ts.
 *
 * All fields are optional because factor observed state is progressively filled
 * in as the user confirms brief content. Validation is warning-only at the
 * mutation boundary — do not reject drafts that omit fields.
 */
export const ObservedStateSchema = z.object({
  display_value: z.string().nullable().optional(),
  value: z.number().nullable().optional(),
  raw_value: z.union([z.string(), z.number()]).nullable().optional(),
  baseline: z.number().nullable().optional(),
  unit: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
  factor_type: z.string().nullable().optional(),
  cap: z.number().nullable().optional(),
  extractionType: z.enum(['explicit', 'inferred', 'external']).nullable().optional(),
  uncertainty_drivers: z.array(z.string()).nullable().optional(),
  /**
   * schemas 0.40.0 `RoundParticipantRefSchema` — WHICH round, WHOSE stated
   * value. Server-stamped by CEE alongside `source: 'panel_elicited'`, and only
   * after it verified the owner's apply claim against its own collab store.
   *
   * IDS ONLY BY CONTRACT: a display name is never persisted here, because a name
   * inside `scenarios.graph` would sit beyond the R-2 redaction routine's reach.
   * Names are resolved at render from round data — `collab/participantNames.ts`.
   *
   * ⚠ DECLARED PERMISSIVELY ON PURPOSE. It rode `.passthrough()` untyped until
   * now, so this adds a READER without adding a rejection: the members are
   * optional here and `readElicitedFrom` is the single place that decides
   * whether a reference is usable. Tightening this object instead would turn a
   * malformed reference into a parse warning on a schema whose own contract is
   * "validation is warning-only — do not reject drafts that omit fields", and
   * the honest outcome for a malformed reference is an unnamed pill, not a
   * complaint about the graph.
   */
  elicited_from: z
    .object({
      round_id: z.string().optional(),
      participant_id: z.string().optional(),
    })
    .passthrough()
    .nullable()
    .optional(),
}).passthrough()
export type ObservedState = z.infer<typeof ObservedStateSchema>

/**
 * Intervention — rich CEE V3 intervention object.
 *
 * Mirrors CEEInterventionV3 in src/adapters/cee/types.ts:261-271. Canvas
 * tolerates both this object shape and plain numbers (the platform-canonical
 * `Record<string, number>` wire shape) via the union below on OptionNodeData.
 */
export const InterventionSchema = z.object({
  value: z.number(),
  source: z.enum(['brief_extraction', 'user_specified', 'cee_hypothesis']).optional(),
  target_match: z.object({
    node_id: z.string(),
    match_type: z.enum(['exact_id', 'exact_label', 'semantic']),
    confidence: z.enum(['high', 'medium', 'low']),
  }).optional(),
  value_confidence: z.enum(['high', 'medium', 'low']).optional(),
  reasoning: z.string().optional(),
}).passthrough()
export type Intervention = z.infer<typeof InterventionSchema>

/**
 * Option node: represents alternative
 *
 * - `is_baseline` is authoritative; the 13-keyword regex in
 *   src/canvas/utils/baselineDetection.ts runs only as nullish fallback.
 * - `interventions` is a union: canonical wire shape is `Record<string, number>`;
 *   CEE V3 object form is tolerated for backward compat.
 */
export const OptionNodeDataSchema = NodeDataSchema.extend({
  type: z.literal('option'),
  is_baseline: z.boolean().nullable().optional(),
  interventions: z.record(
    z.string(),
    z.union([z.number(), InterventionSchema]),
  ).nullable().optional(),
  /**
   * Derived cache of Object.keys(interventions) — written by every live
   * creation path (mapDraftNodeToCanvas, applyPatch buildNode, plot adapter)
   * and present on every real export. Kept in the schema so export → import
   * round-trips losslessly (2.463); readers should still derive from
   * `interventions` where possible.
   */
  interventionKeys: z.array(z.string()).nullable().optional(),
})

/**
 * Controllability type for factors
 * Decision Graph Display v2: Task 6
 * CEE V12.4: Added 'observable' and 'external' from explicit category field
 * - controllable: Options directly set this (solid border)
 * - observable: Known baseline, not changed by options (dashed border)
 * - external: Outside user control - market, regulations (dotted border)
 * - partial: Legacy - indirectly affected by interventions (dashed border)
 * - unknown: No controllability data available (solid border)
 */
export const ControllabilityEnum = z.enum(['controllable', 'observable', 'external', 'partial', 'unknown'])
export type Controllability = z.infer<typeof ControllabilityEnum>

/**
 * CEE factor category (maps to controllability for display)
 * CEE V12.4: Explicit category field from CEE analysis
 */
export const FactorCategoryEnum = z.enum(['controllable', 'observable', 'external'])
export type FactorCategory = z.infer<typeof FactorCategoryEnum>

/**
 * Factor node: represents intermediate variable or driver.
 *
 * `observedState` carries the runtime value/unit/source shape. `uncertainty_drivers`
 * lives inside observedState (not duplicated at the top level) to keep a single
 * source of truth — see ObservedStateSchema above.
 *
 * `display_value` is allowed at the top level because CEE emits it alongside
 * `observed_state` (see golden-path fixture). Readers should prefer top-level
 * and fall back to observedState for legacy data.
 */
export const FactorNodeDataSchema = NodeDataSchema.extend({
  type: z.literal('factor'),
  /** Controllability level for visual border style (Decision Graph Display v2) */
  controllability: ControllabilityEnum.optional(),
  /** CEE V12.4: Explicit category from CEE analysis (takes precedence over derived controllability) */
  category: FactorCategoryEnum.optional(),
  observedState: ObservedStateSchema.nullable().optional(),
  /** CEE wire-shape top-level display text (mirrored in ObservedStateSchema for legacy reads). */
  display_value: z.string().nullable().optional(),
  /**
   * CEE value-encoding legend (e.g. { "0": "Not selected", "1": "Alpha Hall
   * selected" }) — present on every drafted binary factor in real exports
   * (walk-582 fixtures, 2.463). In the schema so export → import round-trips
   * losslessly; numeric values tolerated defensively.
   */
  encoding_map: z.record(z.string(), z.union([z.string(), z.number()])).nullable().optional(),
})

/**
 * Risk impact level
 * Decision Graph Display v2: Task 9
 */
export const RiskImpactEnum = z.enum(['low', 'medium', 'high', 'critical'])
export type RiskImpact = z.infer<typeof RiskImpactEnum>

/**
 * Risk node: represents hazard or concern
 */
export const RiskNodeDataSchema = NodeDataSchema.extend({
  type: z.literal('risk'),
  /** Probability of risk occurring (0-1) - Decision Graph Display v2 */
  probability: z.number().min(0).max(1).optional(),
  /** Impact severity level - Decision Graph Display v2 */
  impact: RiskImpactEnum.optional(),
})

/**
 * Outcome node: represents result
 */
export const OutcomeNodeDataSchema = NodeDataSchema.extend({
  type: z.literal('outcome'),
})

/**
 * Action node: represents concrete step or task to execute
 */
export const ActionNodeDataSchema = NodeDataSchema.extend({
  type: z.literal('action'),
})

/**
 * Constraint type enumeration
 * Task 4.5: Structured constraint types
 */
export const ConstraintTypeEnum = z.enum(['upper_bound', 'lower_bound', 'deadline', 'resource', 'other'])
export type ConstraintType = z.infer<typeof ConstraintTypeEnum>

/**
 * Constraint node: represents a boundary or limit
 * Task 4.5: Structured constraint input
 */
export const ConstraintNodeDataSchema = NodeDataSchema.extend({
  type: z.literal('constraint'),
  /** Type of constraint (budget cap, minimum threshold, deadline) */
  constraintType: ConstraintTypeEnum.optional(),
  /** Threshold value for the constraint */
  thresholdValue: z.number().optional(),
  /** Unit for the threshold (dollars, hours, percent, etc.) */
  unit: z.string().max(50).optional(),
  /** Whether this is a hard (must meet) or soft (prefer to meet) constraint */
  hardConstraint: z.boolean().default(true),
})

/**
 * The eight per-type node-data schemas, in one place. BOTH unions below are
 * derived from this single array, so adding a node type reaches the strict
 * union AND the migration-boundary union automatically — there is no second
 * list to keep in sync (trap 12: derive, don't mirror).
 */
const NODE_DATA_SCHEMAS = [
  GoalNodeDataSchema,
  DecisionNodeDataSchema,
  OptionNodeDataSchema,
  FactorNodeDataSchema,
  RiskNodeDataSchema,
  OutcomeNodeDataSchema,
  ActionNodeDataSchema,
  ConstraintNodeDataSchema,
] as const

/**
 * Discriminated union of all node data types.
 *
 * STRICT (Zod default `unknownKeys: 'strip'`). This is the shape that backs the
 * exported `NodeData`/`GoalNodeData`/… types and the warning-only
 * `validateNodeData` drift check — both want a tight, fully-declared shape.
 * Do NOT use it to parse a snapshot: see `AnyNodeDataImportSchema`.
 */
export const AnyNodeDataSchema = z.discriminatedUnion('type', NODE_DATA_SCHEMAS)

/**
 * ROADMAP 2.590 — the migration-boundary variant of the union above.
 *
 * ── The defect this exists to close ──────────────────────────────────────────
 * `V2SnapshotSchema` (domain/migrations.ts) parsed node `data` with the STRICT
 * union. Zod object schemas strip undeclared keys by default, so importing a
 * real export silently destroyed every field outside the ~8-13 keys each
 * per-type schema declares. A measured genuine export came back with
 * `goal_mrr.data` reduced to exactly `{kind, label, provenance, type}` — target,
 * unit and cap gone, no error anywhere. **The parser was discarding what the
 * renderers read**: `nodes/GoalNode.tsx` reads `data.goal_threshold_raw`,
 * `goal_threshold_unit`, `success_threshold` and `threshold_source`; not one of
 * those is declared by any schema in the union. `nodes/BaseNode.tsx` — the
 * shared wrapper for ALL eight renderers — reads `flagged_as_assumption`,
 * `uncertainty`, `unknownKind` and `originalKind`, none of them declared either.
 *
 * ── Why permissive HERE and nowhere else ─────────────────────────────────────
 * An import parser's job at this boundary is SHAPE VALIDATION AND MIGRATION —
 * check the discriminant, the required fields, the version. Deciding which data
 * fields are legitimate is not its job; the filtering was a side effect of using
 * a strict object schema as a validator, never a designed behaviour. Every other
 * layer of this repo already treats `node.data` as an open bag on purpose:
 *   • `transformNodeToV2` (adapters/plot/v2/adapter.ts) uses a BLOCKLIST, and
 *     says so — "all node.data fields pass through to PLoT EXCEPT … This ensures
 *     V3 fields (goal_threshold_*, prior, etc.) survive without needing explicit
 *     forwarding."
 *   • `CanvasNodeData` (same file) declares `[key: string]: unknown`.
 *   • `computeGraphHash` (hooks/useAutosave.ts) hashes ALL node data by default
 *     with a small explicit ephemeral denylist.
 *   • `ObservedStateSchema` and `EdgeDataSchema` are ALREADY `.passthrough()` —
 *     which is precisely why nested observed state and edge data survived import
 *     while top-level node data did not.
 *   • UI CLAUDE.md: "Preserve unknown fields everywhere — that's how
 *     forward-compatible data survives the version skew."
 * The strict union was the last allowlist on an otherwise open path, and it was
 * the only one positioned to destroy user data.
 *
 * Discrimination, required fields and per-field types are UNCHANGED — a node
 * with a bad `type`, a missing `label` or an out-of-range `utility` is still
 * rejected exactly as before. Only the silent deletion of undeclared keys stops.
 *
 * Round-trip survival is pinned by `__tests__/importFieldSurvival.2590.spec.ts`.
 */
export const AnyNodeDataImportSchema = z.discriminatedUnion(
  'type',
  NODE_DATA_SCHEMAS.map((schema) => schema.passthrough()) as unknown as typeof NODE_DATA_SCHEMAS,
)

export type NodeData = z.infer<typeof AnyNodeDataSchema>
export type GoalNodeData = z.infer<typeof GoalNodeDataSchema>
export type DecisionNodeData = z.infer<typeof DecisionNodeDataSchema>
export type OptionNodeData = z.infer<typeof OptionNodeDataSchema>
export type FactorNodeData = z.infer<typeof FactorNodeDataSchema>
export type RiskNodeData = z.infer<typeof RiskNodeDataSchema>
export type OutcomeNodeData = z.infer<typeof OutcomeNodeDataSchema>
export type ActionNodeData = z.infer<typeof ActionNodeDataSchema>
export type ConstraintNodeData = z.infer<typeof ConstraintNodeDataSchema>

/**
 * Node metadata for rendering and accessibility
 */
export interface NodeMetadata {
  icon: LucideIcon
  label: string
  ariaRole: string
  defaultSize: { width: number; height: number }
}

/**
 * Node type registry: maps types to metadata
 * Used for rendering, a11y, and inspector UI
 */
export const NODE_REGISTRY: Record<NodeType, NodeMetadata> = {
  goal: {
    icon: Target,
    label: 'Goal',
    ariaRole: 'group',
    defaultSize: { width: 240, height: 100 },
  },
  decision: {
    icon: Crosshair,
    label: DECISION_NODE_LABEL,
    ariaRole: 'group',
    defaultSize: { width: 240, height: 100 },
  },
  option: {
    icon: Lightbulb,
    label: 'Option',
    ariaRole: 'group',
    defaultSize: { width: 220, height: 100 },
  },
  factor: {
    icon: Settings,
    label: 'Factor',
    ariaRole: 'group',
    defaultSize: { width: 220, height: 100 },
  },
  risk: {
    icon: AlertTriangle,
    label: 'Risk',
    ariaRole: 'group',
    defaultSize: { width: 220, height: 100 },
  },
  outcome: {
    icon: TrendingUp,
    label: 'Outcome',
    ariaRole: 'group',
    defaultSize: { width: 220, height: 100 },
  },
  action: {
    icon: Zap,
    label: 'Action',
    ariaRole: 'group',
    defaultSize: { width: 220, height: 100 },
  },
  constraint: {
    icon: Shield,
    label: 'Constraint',
    ariaRole: 'group',
    defaultSize: { width: 220, height: 100 },
  },
}

// ---------------------------------------------------------------------------
// Graph Editing Experience Task 6c: Category auto-suggestion
// ---------------------------------------------------------------------------

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  controllable: ['cost', 'price', 'budget', 'revenue', 'spend', 'invest', 'hire', 'salary', 'fee', 'funding'],
  external: ['market', 'regulation', 'weather', 'competitor', 'economy', 'policy', 'demand', 'inflation', 'interest'],
  observable: ['satisfaction', 'quality', 'performance', 'retention', 'churn', 'engagement', 'nps', 'rating'],
}

/**
 * Suggest a category for a factor node based on keyword matching in the label.
 * Returns null if no keyword match is found.
 */
export function suggestCategory(label: string): 'controllable' | 'observable' | 'external' | null {
  const lower = label.toLowerCase()
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) {
      return category as 'controllable' | 'observable' | 'external'
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Schema validation (warning-only)
// ---------------------------------------------------------------------------

/**
 * Validate a node's `data` against its type-specific schema. Warning-only —
 * logs via devWarn in DEV builds, never throws. Call at mutation boundaries
 * (applyDraftResult, backfill, patch-apply), never on the render hot path.
 *
 * Unknown node types silently pass — we only validate types we have schemas for.
 */
export function validateNodeData(nodeId: string, data: unknown): void {
  if (!data || typeof data !== 'object') return
  const type = (data as { type?: unknown }).type
  let schema: z.ZodTypeAny | null = null
  switch (type) {
    case 'factor': schema = FactorNodeDataSchema; break
    case 'option': schema = OptionNodeDataSchema; break
    case 'goal': schema = GoalNodeDataSchema; break
    case 'decision': schema = DecisionNodeDataSchema; break
    case 'risk': schema = RiskNodeDataSchema; break
    case 'outcome': schema = OutcomeNodeDataSchema; break
    case 'action': schema = ActionNodeDataSchema; break
    case 'constraint': schema = ConstraintNodeDataSchema; break
    default: return
  }
  const result = schema.safeParse(data)
  if (!result.success) {
    devWarn('canvas/schema', `Node ${nodeId} (${String(type)}) data shape drift`, {
      nodeId,
      type,
      issues: result.error.issues,
    })
  }
}

/**
 * Validate a batch of nodes. Convenience wrapper — iterates and validates each.
 */
export function validateNodesBatch(nodes: Array<{ id: string; data?: unknown }>): void {
  for (const n of nodes) {
    if (n?.data) validateNodeData(n.id, n.data)
  }
}
