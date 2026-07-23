/**
 * buildV7Bias — pure passthrough builder for the V7 L6 "Challenge your
 * assumptions" bias section (V6-RESPEC-2026-07-23 row 11).
 *
 * The producer's bias findings ride on the CEE review payload UNTYPED (the
 * `CeeDecisionReviewPayload` type does not declare `bias_findings`; it is a
 * known-open passthrough seam — the same shape GuidancePanel and
 * PreAnalysisGuidance already read at runtime). This builder reads it
 * DEFENSIVELY, field by field, and invents nothing:
 *   · a bias KIND label from the producer `type`/`code` (humanised only — the
 *     raw token never renders raw);
 *   · the producer DESCRIPTION (`description` / `message` / `explanation`);
 *   · the `micro_intervention.steps` (strings, or `{ text }` step objects — both
 *     shapes appear on the wire) and `estimated_minutes`, verbatim (spec row 11
 *     requires steps + minutes VISIBLE);
 *   · affected node ids, for graph links.
 *
 * Honest absence: a finding with neither a description nor a step is dropped
 * (never an empty coaching shell); no findings at all → `[]`, and the section
 * renders nothing.
 */

export interface V7BiasFinding {
  key: string
  /** Humanised producer bias type/code (e.g. "Anchoring"). Never the raw token. */
  kindLabel: string
  /** Producer-authored description. */
  description: string
  /** micro_intervention.steps, verbatim (spec row 11). */
  steps: string[]
  /** Producer estimate in minutes, or null when absent/non-finite. */
  estimatedMinutes: number | null
  /** Affected canvas node ids, for graph links. */
  affectedNodeIds: string[]
}

const asString = (v: unknown): string | null =>
  typeof v === 'string' && v.trim().length > 0 ? v : null

const asStringArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0) : []

/** Humanise a SCREAMING_SNAKE / snake_case bias token into a title-case label. */
function humaniseKind(raw: string): string {
  const words = raw
    .replace(/_/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\brisk\b/g, '') // "ANCHORING_RISK" → "Anchoring", not "Anchoring risk"
    .trim()
  if (!words) return 'Cognitive bias'
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** Normalise a step that may be a plain string OR a `{ text }` object. */
function stepText(step: unknown): string | null {
  if (typeof step === 'string') return asString(step)
  if (step && typeof step === 'object' && 'text' in step) return asString((step as { text: unknown }).text)
  return null
}

/**
 * Map one raw finding (untyped) into a clean V7BiasFinding, or null when it
 * carries no renderable content.
 */
export function buildV7BiasFinding(raw: unknown, index: number): V7BiasFinding | null {
  if (!raw || typeof raw !== 'object') return null
  const f = raw as Record<string, unknown>

  const typeToken = asString(f.type) ?? asString(f.code)
  const description =
    asString(f.description) ?? asString(f.message) ?? asString(f.explanation) ?? ''

  const micro =
    f.micro_intervention && typeof f.micro_intervention === 'object'
      ? (f.micro_intervention as Record<string, unknown>)
      : null

  const steps = (Array.isArray(micro?.steps) ? micro!.steps : [])
    .map(stepText)
    .filter((s): s is string => s != null)

  // estimated_minutes may sit on the intervention OR the finding root.
  const rawMinutes = micro?.estimated_minutes ?? f.estimated_minutes
  const estimatedMinutes =
    typeof rawMinutes === 'number' && Number.isFinite(rawMinutes) ? rawMinutes : null

  const affectedNodeIds =
    asStringArray(f.affected_node_ids).length > 0
      ? asStringArray(f.affected_node_ids)
      : asStringArray(f.affected_elements).length > 0
        ? asStringArray(f.affected_elements)
        : asStringArray(f.affectedNodes)

  // Honest gate: nothing renderable → drop (never an empty coaching shell).
  if (!description && steps.length === 0) return null

  const key = asString(f.id) ?? `${typeToken ?? 'bias'}-${index}`

  return {
    key,
    kindLabel: typeToken ? humaniseKind(typeToken) : 'Cognitive bias',
    description,
    steps,
    estimatedMinutes,
    affectedNodeIds,
  }
}

export function buildV7BiasFindings(raw: unknown): V7BiasFinding[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((r, i) => buildV7BiasFinding(r, i))
    .filter((f): f is V7BiasFinding => f != null)
}

/**
 * Pick the bias_findings array off a runMeta-shaped object, preferring the
 * current `ceeReviewV1` over the legacy `ceeReview` (the order
 * useResultsSectionData + GuidancePanel already use). Returns the stored array
 * reference (stable) or undefined — never a fresh array, so callers can key a
 * memo on it safely.
 */
export function pickBiasFindingsSource(runMeta: unknown): unknown {
  if (!runMeta || typeof runMeta !== 'object') return undefined
  const m = runMeta as Record<string, unknown>
  const v1 = m.ceeReviewV1 as Record<string, unknown> | null | undefined
  const legacy = m.ceeReview as Record<string, unknown> | null | undefined
  return v1?.bias_findings ?? legacy?.bias_findings
}
