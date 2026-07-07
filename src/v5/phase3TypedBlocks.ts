/**
 * phase3TypedBlocks — adapt verbatim Phase 3 raw payloads (coaching /
 * review_card — Track C slice 1, approved D-5; evidence / exercise —
 * Track C slice 2, Lane UI-W4 C) to the UI's typed V5 conversation blocks
 * per the 0.13.x @talchain/schemas shapes.
 *
 * Contract (provisional_doctrine_v0):
 *   - Reads EXACTLY the 0.13.x typed fields (dist/boundary/blocks.d.ts in
 *     the vendored tarball): title, body, severity/card_kind (review_card),
 *     coaching_kind/source (coaching), target_refs, priority_rank,
 *     freshness, action_intent?, action_label?. Unknown subfields are
 *     IGNORED at every depth — additive producer fields never break
 *     rendering.
 *   - Fail-closed: a block missing/mistyping any required render-relevant
 *     field adapts to `null`. The caller counts it (dropped-content
 *     counter) and suppresses it — never crashes, never renders a card
 *     with invented fields.
 *   - No invented copy: every rendered string is the producer's, verbatim.
 *
 * Field-presence notes from live staging captures (fixture
 * cee-response-b82c89dd-trimmed.json): blocks omit `created_at` even
 * though the schema declares it, and review_card may omit the optional
 * action fields. Adaptation therefore requires only the render-relevant
 * fields and deliberately ignores schema-required-but-render-irrelevant
 * metadata (signal_id, created_at, source_handler,
 * graph_hash_at_generation) — a real producer block must not be
 * suppressed over metadata the UI never shows.
 *
 * Validation-strictness choices:
 *   - `severity` (review_card) must be one of the 0.13.x enum values —
 *     it drives the visual variant, and the UI never guesses severity.
 *   - `card_kind` / `coaching_kind` / `source` are required non-empty
 *     strings but NOT enum-checked: they are pass-through discriminators
 *     (exposed as data-* attributes only), so a new producer kind renders
 *     fine without a UI release.
 *   - `target_refs` must be an array; entries missing the typed
 *     {id,label,kind} strings are skipped individually (they are
 *     supplementary reference pills, not core content).
 */
import type {
  V5BlockTargetRef,
  V5CoachingBlock,
  V5EvidenceBlock,
  V5ExerciseBlock,
  V5Phase3Freshness,
  V5ReviewCardBlock,
} from '../canvas/conversation/types'

// ─── Field helpers ─────────────────────────────────────────────────────

function nonEmptyString(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim().length > 0 ? v : undefined
}

function finiteNumber(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

const FRESHNESS_VALUES: ReadonlySet<string> = new Set(['fresh', 'stale', 'pending', 'failed'])

function freshness(v: unknown): V5Phase3Freshness | undefined {
  return typeof v === 'string' && FRESHNESS_VALUES.has(v) ? (v as V5Phase3Freshness) : undefined
}

const REVIEW_SEVERITIES: ReadonlySet<string> = new Set(['info', 'warning', 'critical'])

/**
 * Extract the typed target_refs. The FIELD must be an array (schema-required);
 * individual entries are kept only when they carry the full typed
 * {id, label, kind} string triple — partial entries are skipped, not repaired.
 */
function targetRefs(v: unknown): V5BlockTargetRef[] | undefined {
  if (!Array.isArray(v)) return undefined
  const out: V5BlockTargetRef[] = []
  for (const entry of v) {
    if (!isPlainObject(entry)) continue
    const id = nonEmptyString(entry.id)
    const label = nonEmptyString(entry.label)
    const kind = nonEmptyString(entry.kind)
    if (id && label && kind) out.push({ id, label, kind })
  }
  return out
}

// ─── Adapters ──────────────────────────────────────────────────────────

/**
 * Adapt a verbatim raw payload to a typed v5_review_card block.
 * Returns null when the payload is not a well-formed 0.13.x review_card
 * (fail-closed; the caller counts + suppresses).
 */
export function adaptTypedReviewCardBlock(raw: unknown): V5ReviewCardBlock | null {
  if (!isPlainObject(raw)) return null
  if (raw.type !== 'review_card') return null

  const blockId = nonEmptyString(raw.block_id)
  const title = nonEmptyString(raw.title)
  const body = nonEmptyString(raw.body)
  const severityRaw = raw.severity
  const cardKind = nonEmptyString(raw.card_kind)
  const rank = finiteNumber(raw.priority_rank)
  const fresh = freshness(raw.freshness)
  const refs = targetRefs(raw.target_refs)

  if (
    !blockId || !title || !body || !cardKind || rank === undefined || !fresh || refs === undefined ||
    typeof severityRaw !== 'string' || !REVIEW_SEVERITIES.has(severityRaw)
  ) {
    return null
  }

  const actionIntent = nonEmptyString(raw.action_intent)
  const actionLabel = nonEmptyString(raw.action_label)

  return {
    type: 'v5_review_card',
    block_id: blockId,
    title,
    body,
    severity: severityRaw as V5ReviewCardBlock['severity'],
    card_kind: cardKind,
    target_refs: refs,
    priority_rank: rank,
    freshness: fresh,
    ...(actionIntent ? { action_intent: actionIntent } : {}),
    ...(actionLabel ? { action_label: actionLabel } : {}),
  }
}

/**
 * Adapt a verbatim raw payload to a typed v5_coaching block.
 * Returns null when the payload is not a well-formed 0.13.x coaching block
 * (fail-closed; the caller counts + suppresses).
 */
export function adaptTypedCoachingBlock(raw: unknown): V5CoachingBlock | null {
  if (!isPlainObject(raw)) return null
  if (raw.type !== 'coaching') return null

  const blockId = nonEmptyString(raw.block_id)
  const title = nonEmptyString(raw.title)
  const body = nonEmptyString(raw.body)
  const coachingKind = nonEmptyString(raw.coaching_kind)
  const source = nonEmptyString(raw.source)
  const rank = finiteNumber(raw.priority_rank)
  const fresh = freshness(raw.freshness)
  const refs = targetRefs(raw.target_refs)

  if (!blockId || !title || !body || !coachingKind || !source || rank === undefined || !fresh || refs === undefined) {
    return null
  }

  const actionIntent = nonEmptyString(raw.action_intent)
  const actionLabel = nonEmptyString(raw.action_label)

  return {
    type: 'v5_coaching',
    block_id: blockId,
    title,
    body,
    coaching_kind: coachingKind,
    source,
    target_refs: refs,
    priority_rank: rank,
    freshness: fresh,
    ...(actionIntent ? { action_intent: actionIntent } : {}),
    ...(actionLabel ? { action_label: actionLabel } : {}),
  }
}

// ─── Slice 2 adapters (Lane UI-W4 C): evidence / exercise ─────────────

/**
 * A single well-formed {id, label, kind} ref, or undefined. Used for the
 * OPTIONAL single-ref slots (evidence factor_ref, exercise
 * target_element_ref): a malformed entry is omitted, never repaired, and
 * never suppresses the block — the render-relevant naming lives elsewhere
 * (factor_label / target_refs).
 */
function optionalRef(v: unknown): V5BlockTargetRef | undefined {
  if (!isPlainObject(v)) return undefined
  const id = nonEmptyString(v.id)
  const label = nonEmptyString(v.label)
  const kind = nonEmptyString(v.kind)
  return id && label && kind ? { id, label, kind } : undefined
}

/**
 * Adapt a verbatim raw payload to a typed v5_evidence block (0.13.1
 * EvidenceBlockSchema). Returns null when the payload is not a well-formed
 * evidence block (fail-closed; the caller counts + suppresses).
 *
 * Required render-relevant fields: block_id, factor_label, evidence_gap,
 * suggested_technique, impact_if_gathered (the producer prose),
 * current_confidence (data-* discriminator, non-empty string — NOT
 * enum-narrowed), priority_rank, severity (visual channel — enum-checked
 * like review_card), freshness, target_refs. Schema-declared metadata the
 * UI never shows (signal_id, created_at, source_handler,
 * graph_hash_at_generation) is deliberately NOT required — live staging
 * omits it on the other Phase 3 types.
 */
export function adaptTypedEvidenceBlock(raw: unknown): V5EvidenceBlock | null {
  if (!isPlainObject(raw)) return null
  if (raw.type !== 'evidence') return null

  const blockId = nonEmptyString(raw.block_id)
  const factorLabel = nonEmptyString(raw.factor_label)
  const evidenceGap = nonEmptyString(raw.evidence_gap)
  const suggestedTechnique = nonEmptyString(raw.suggested_technique)
  const impactIfGathered = nonEmptyString(raw.impact_if_gathered)
  const currentConfidence = nonEmptyString(raw.current_confidence)
  const rank = finiteNumber(raw.priority_rank)
  const severityRaw = raw.severity
  const fresh = freshness(raw.freshness)
  const refs = targetRefs(raw.target_refs)

  if (
    !blockId || !factorLabel || !evidenceGap || !suggestedTechnique || !impactIfGathered ||
    !currentConfidence || rank === undefined || !fresh || refs === undefined ||
    typeof severityRaw !== 'string' || !REVIEW_SEVERITIES.has(severityRaw)
  ) {
    return null
  }

  const factorRef = optionalRef(raw.factor_ref)
  const actionIntent = nonEmptyString(raw.action_intent)
  const actionLabel = nonEmptyString(raw.action_label)

  return {
    type: 'v5_evidence',
    block_id: blockId,
    factor_label: factorLabel,
    ...(factorRef ? { factor_ref: factorRef } : {}),
    target_refs: refs,
    current_confidence: currentConfidence,
    evidence_gap: evidenceGap,
    suggested_technique: suggestedTechnique,
    impact_if_gathered: impactIfGathered,
    priority_rank: rank,
    severity: severityRaw as V5EvidenceBlock['severity'],
    freshness: fresh,
    ...(actionIntent ? { action_intent: actionIntent } : {}),
    ...(actionLabel ? { action_label: actionLabel } : {}),
  }
}

/**
 * Adapt a verbatim raw payload to a typed v5_exercise block (0.13.1
 * ExerciseBlockSchema). Returns null when the payload is not a well-formed
 * exercise block (fail-closed; the caller counts + suppresses).
 *
 * Per the v1.3 contract the exercise block carries NO title and NO
 * priority_rank; every prose field is optional. Required: block_id,
 * exercise_kind (data-* discriminator, non-empty string — NOT
 * enum-narrowed), freshness, target_refs — PLUS at least one renderable
 * producer prose field (failure_scenario / warning_signs / mitigation /
 * reference_class / counter_case / review_trigger): a card with nothing to
 * say must not render an empty shell. Individual malformed warning_signs
 * entries are skipped, not repaired.
 */
export function adaptTypedExerciseBlock(raw: unknown): V5ExerciseBlock | null {
  if (!isPlainObject(raw)) return null
  if (raw.type !== 'exercise') return null

  const blockId = nonEmptyString(raw.block_id)
  const exerciseKind = nonEmptyString(raw.exercise_kind)
  const fresh = freshness(raw.freshness)
  const refs = targetRefs(raw.target_refs)

  if (!blockId || !exerciseKind || !fresh || refs === undefined) return null

  const failureScenario = nonEmptyString(raw.failure_scenario)
  const mitigation = nonEmptyString(raw.mitigation)
  const referenceClass = nonEmptyString(raw.reference_class)
  const counterCase = nonEmptyString(raw.counter_case)
  const reviewTrigger = nonEmptyString(raw.review_trigger)
  const warningSigns = Array.isArray(raw.warning_signs)
    ? raw.warning_signs.flatMap((s) => {
        const sign = nonEmptyString(s)
        return sign ? [sign] : []
      })
    : undefined
  const signs = warningSigns && warningSigns.length > 0 ? warningSigns : undefined

  // Fail-closed on a content-less card: schema-valid but with no producer
  // prose at all — rendering an empty shell would imply content that does
  // not exist.
  if (!failureScenario && !signs && !mitigation && !referenceClass && !counterCase && !reviewTrigger) {
    return null
  }

  const targetElementRef = optionalRef(raw.target_element_ref)

  return {
    type: 'v5_exercise',
    block_id: blockId,
    exercise_kind: exerciseKind,
    ...(failureScenario ? { failure_scenario: failureScenario } : {}),
    ...(signs ? { warning_signs: signs } : {}),
    ...(mitigation ? { mitigation } : {}),
    ...(referenceClass ? { reference_class: referenceClass } : {}),
    ...(counterCase ? { counter_case: counterCase } : {}),
    ...(reviewTrigger ? { review_trigger: reviewTrigger } : {}),
    ...(targetElementRef ? { target_element_ref: targetElementRef } : {}),
    target_refs: refs,
    freshness: fresh,
  }
}
