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
 * metadata (signal_id, created_at, source_handler) — a real producer
 * block must not be suppressed over metadata the UI never shows.
 * `graph_hash_at_generation` moved OUT of that ignored set when #670 made
 * it render-relevant (the derived staleness sentence): every adapter now
 * carries it VERBATIM when present, and its ABSENCE still never suppresses
 * the block — it costs the currency verdict (cannot-confirm), not the card.
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
  V5DskClaimProvenance,
  V5DskProtocolProvenance,
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
  // CEE's graph hash at authoring time, carried verbatim so the card can
  // compare it — at RENDER time — against CEE's CURRENT graph hash (#670's
  // mechanism, extended to this surface). A non-string is DROPPED rather
  // than coerced: a fabricated hash would compare unequal to everything and
  // manufacture a permanent false "changed".
  const graphHashAtGeneration = nonEmptyString(raw.graph_hash_at_generation)

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
    ...(graphHashAtGeneration ? { graph_hash_at_generation: graphHashAtGeneration } : {}),
  }
}

// ─── PR3 importance / evidence helpers ─────────────────────────────────

/**
 * The producer's four-value guidance class, enum-checked.
 *
 * ⚠ ENUM-CHECKED, unlike `coaching_kind`/`source` above — and the asymmetry
 * is deliberate, not an inconsistency. Those two are pass-through
 * discriminators that only ever reach a `data-*` attribute, so an unknown
 * value costs nothing and a new producer kind must not need a UI release.
 * `category` DRIVES A VISUAL SEVERITY CHANNEL and a user-facing badge, and
 * the UI never guesses severity (the same rule `severity` on review_card
 * already follows). An unrecognised value therefore yields `undefined` —
 * the card renders with NO badge, which is the honest degradation. It must
 * never fall back to a default tier: inventing "should fix" for a value we
 * failed to parse is a claim about the user's decision that no one made.
 *
 * The four values are pinned against `GuidanceCategory` in the vendored
 * schema by an identity assertion in the spec, so a contract widening REDs
 * here rather than silently dropping the new class.
 */
const GUIDANCE_CATEGORIES = ['must_fix', 'should_fix', 'could_fix', 'technique'] as const

function guidanceCategory(v: unknown): V5CoachingBlock['category'] | undefined {
  const s = nonEmptyString(v)
  if (!s) return undefined
  return (GUIDANCE_CATEGORIES as readonly string[]).includes(s)
    ? (s as NonNullable<V5CoachingBlock['category']>)
    : undefined
}

/**
 * The DSK CLAIM provenance triple — the claim sibling of
 * `dskProtocolProvenance` below, and it follows that helper's doctrine
 * exactly: ALL-OR-NOTHING.
 *
 * A refusal costs the ATTRIBUTION only — never the card. Losing a badge is
 * a lost affordance; showing a wrong one is a lie about science. So a
 * partial or malformed triple returns `undefined` and the card renders
 * ungrounded, which is true, rather than grounded-in-something-unverifiable,
 * which is not.
 *
 * `claim_id` is narrowed to the CLAIM arms — `B` (bias) and `T` (technique)
 * — so a protocol id (`DSK-P-…`) or trigger id (`DSK-TR-…`) cannot
 * masquerade as the claim this card cites. `protocol_id` is optional and,
 * per the contract, lives INSIDE the object so it can never travel without
 * its claim anchor; a malformed one is dropped without costing the triple.
 */
const DSK_CLAIM_ID_RE = /^DSK-(B|T)-\d{3}$/

function dskClaimProvenance(raw: unknown): V5DskClaimProvenance | undefined {
  if (!isPlainObject(raw)) return undefined
  const id = nonEmptyString(raw.claim_id)
  const title = nonEmptyString(raw.claim_title)
  const strength = nonEmptyString(raw.evidence_strength)
  if (!id || !title || !strength) return undefined
  if (!DSK_CLAIM_ID_RE.test(id)) return undefined
  if (!(DSK_EVIDENCE_STRENGTHS as readonly string[]).includes(strength)) return undefined
  const protocolId = nonEmptyString(raw.protocol_id)
  return {
    claim_id: id,
    claim_title: title,
    evidence_strength: strength as V5DskClaimProvenance['evidence_strength'],
    ...(protocolId && DSK_PROTOCOL_ID_RE.test(protocolId) ? { protocol_id: protocolId } : {}),
  }
}

/**
 * Adapt a verbatim raw payload to a typed v5_coaching block.
 * Returns null when the payload is not a well-formed 0.13.x coaching block
 * (fail-closed; the caller counts + suppresses).
 *
 * The return type pins `priority_rank` as PRESENT (/simplify item 9): the
 * guard below fails closed without a finite rank, so callers no longer need
 * a defensive missing-rank arm — the compiler now proves it dead. The
 * V5CoachingBlock TYPE keeps rank optional for the UI-side bias bridge,
 * which legitimately builds rank-less blocks.
 */
export function adaptTypedCoachingBlock(
  raw: unknown,
): (V5CoachingBlock & { priority_rank: number }) | null {
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
  // 0.31.0 / ROADMAP 2.225 — producer-authored turn text. Carried verbatim
  // and only when the producer sent it: its PRESENCE is what makes the
  // coaching action pill a dispatching button, so inventing or defaulting it
  // here would manufacture an affordance the producer never authorised.
  const actionPrompt = nonEmptyString(raw.action_prompt)

  // ── PR3: the importance / evidence channel ─────────────────────────────
  // Five producer-owned fields that have been on the wire since 0.19.0 /
  // 0.20.0 / 0.39.0 and that this adapter has never read. Each is carried
  // VERBATIM and only when the producer sent it in a form we can trust —
  // a malformed member costs that one signal, never the card.
  const category = guidanceCategory(raw.category)
  const priority = finiteNumber(raw.priority)
  const signalCode = nonEmptyString(raw.signal_code)
  const signalLine = nonEmptyString(raw.signal)
  const claimProvenance = dskClaimProvenance(raw.dsk_claim_provenance)

  // CEE's graph hash at authoring time. Preserved verbatim so the card can
  // compare it — at RENDER time — against CEE's CURRENT graph hash and notice
  // that the model moved underneath the advice. `useConversation.ts` has kept
  // this field on the raw block "so consumers can read it directly" since
  // slice 1; until now no consumer did, which is why the card's
  // "your model has changed" sentence was unreachable.
  //
  // A non-string is DROPPED rather than coerced: a fabricated hash would
  // compare unequal to everything and manufacture a permanent false "changed".
  const graphHashAtGeneration = nonEmptyString(raw.graph_hash_at_generation)

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
    ...(actionPrompt ? { action_prompt: actionPrompt } : {}),
    ...(category ? { category } : {}),
    // `priority` is a real 0–100 number: 0 is meaningful and must survive, so
    // this tests for undefined rather than truthiness (a `? :` here would
    // silently drop the least-urgent band).
    ...(priority !== undefined && priority >= 0 && priority <= 100 ? { priority } : {}),
    ...(signalCode ? { signal_code: signalCode } : {}),
    ...(signalLine ? { signal: signalLine } : {}),
    ...(claimProvenance ? { dsk_claim_provenance: claimProvenance } : {}),
    ...(graphHashAtGeneration ? { graph_hash_at_generation: graphHashAtGeneration } : {}),
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
 * UI never shows (signal_id, created_at, source_handler) is deliberately
 * NOT required — live staging omits it on the other Phase 3 types.
 * `graph_hash_at_generation` is carried verbatim when present (render-
 * relevant since the #670 staleness extension) and never required.
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
  // #670's staleness mechanism, extended: verbatim carry, non-strings dropped.
  const graphHashAtGeneration = nonEmptyString(raw.graph_hash_at_generation)

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
    ...(graphHashAtGeneration ? { graph_hash_at_generation: graphHashAtGeneration } : {}),
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
/**
 * 0.37.0 — the DSK protocol provenance triple, or `undefined`.
 *
 * ⚠ THIS FUNCTION IS THE READER HALF OF CEE #830's FIX, AND ITS REFUSALS ARE
 * THE POINT. #830 shipped an attestation that confirmed a DSK id EXISTED while
 * the text rendered beneath it was the model's own prose — a badge printing
 * assistant narration under the bundle's authority. The badge this feeds makes
 * the same kind of claim, so it must be impossible to render one on a partial
 * or ill-formed triple:
 *   · ALL THREE members required — an id with no title is an authority claim
 *     with nothing to check it against, which is exactly the #830 shape.
 *   · `protocol_id` must match the bundle's PROTOCOL id form. `DSK-T-003` and
 *     `DSK-TR-003` are real bundle objects, so "the id exists" is true of them
 *     and still must not badge a protocol.
 *   · `evidence_strength` must be one of the bundle's DECLARED values
 *     (`DSKObjectBase.evidence_strength`), not merely a non-empty string.
 * A refusal costs the ATTRIBUTION only — never the card. Losing a badge is a
 * lost affordance; showing a wrong one is a lie about science.
 */
const DSK_PROTOCOL_ID_RE = /^DSK-P-\d{3}$/
const DSK_EVIDENCE_STRENGTHS = ['strong', 'medium', 'weak', 'mixed'] as const

function dskProtocolProvenance(raw: unknown): V5DskProtocolProvenance | undefined {
  if (!isPlainObject(raw)) return undefined
  const id = nonEmptyString(raw.protocol_id)
  const title = nonEmptyString(raw.protocol_title)
  const strength = nonEmptyString(raw.evidence_strength)
  if (!id || !title || !strength) return undefined
  if (!DSK_PROTOCOL_ID_RE.test(id)) return undefined
  if (!(DSK_EVIDENCE_STRENGTHS as readonly string[]).includes(strength)) return undefined
  return {
    protocol_id: id,
    protocol_title: title,
    evidence_strength: strength as V5DskProtocolProvenance['evidence_strength'],
  }
}

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
  const dskProvenance = dskProtocolProvenance(raw.dsk_provenance)
  // #670's staleness mechanism, extended: verbatim carry, non-strings dropped.
  const graphHashAtGeneration = nonEmptyString(raw.graph_hash_at_generation)

  return {
    type: 'v5_exercise',
    block_id: blockId,
    exercise_kind: exerciseKind,
    ...(dskProvenance ? { dsk_provenance: dskProvenance } : {}),
    ...(failureScenario ? { failure_scenario: failureScenario } : {}),
    ...(signs ? { warning_signs: signs } : {}),
    ...(mitigation ? { mitigation } : {}),
    ...(referenceClass ? { reference_class: referenceClass } : {}),
    ...(counterCase ? { counter_case: counterCase } : {}),
    ...(reviewTrigger ? { review_trigger: reviewTrigger } : {}),
    ...(targetElementRef ? { target_element_ref: targetElementRef } : {}),
    target_refs: refs,
    freshness: fresh,
    ...(graphHashAtGeneration ? { graph_hash_at_generation: graphHashAtGeneration } : {}),
  }
}
