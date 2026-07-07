/**
 * phase3TypedBlocks — adapt verbatim Phase 3 raw payloads (coaching /
 * review_card) to the UI's typed V5 conversation blocks per the 0.13.x
 * @talchain/schemas shapes (Track C slice 1, approved D-5).
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
