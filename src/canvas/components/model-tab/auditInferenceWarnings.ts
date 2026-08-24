/**
 * Audit-trail inference warnings — a machine code is correct content here, a
 * machine code ALONE is not.
 *
 * ## The defect this closes
 *
 * `ModelHealthSection`'s audit trail rendered the warning list as
 * `inferenceWarnings.map(w => w?.code ?? 'UNKNOWN').join(', ')`, so the Model
 * card printed
 *
 *     Inference warnings: CONSTRAINT_NODE_DEFAULT_BASE
 *
 * and nothing else. That code is not hypothetical: it is on the wire in the
 * repo's own captured staging run
 * (`src/test/fixtures/golden-path-staging-2026-04-05.json`, `plot_response
 * .inference_warnings[0]`), so this is what a real user has been shown.
 *
 * ⭐ AND IT IS THE SURFACE ANOTHER SURFACE ROUTES PEOPLE TO. The generic
 * fallback in `components/results/utils/humaniseCritique.ts` deliberately ends
 * *"Nothing has been hidden — the raw code is listed in the run's audit
 * details."* Its own comment ratifies the split: *"A machine code is correct
 * content for an audit trail and wrong content for a caveat strip."* That
 * ruling stands and this module keeps it — the code STAYS. What was missing is
 * that a reader sent here to understand a limitation arrived at a bare enum
 * with no sentence attached.
 *
 * ## Why no copy is authored in this file
 *
 * `humaniseCritique` already owns producer-derived, ratified, label-free copy
 * for this exact vocabulary — its templates were written from the ISL
 * construction sites at `staging` 28fe0c95, and its header records that
 * *"EVERY TEMPLATE IGNORES THE RESOLVED LABEL, DELIBERATELY"* because PLoT
 * forwards no `affected_nodes` for these codes. A second copy map here would be
 * two sets of words for one claim, drifting silently (CLAUDE.md trap 12), so
 * this module RESOLVES through that owner and adds none of its own.
 *
 * ## Two things it must never do
 *
 * 1. **Never echo the producer's `message`.** PLoT guarantees one on every
 *    merged warning, but it is ISL's diagnostic string and it interpolates raw
 *    identifiers and engine vocabulary — the captured one reads *"Node
 *    'goal_midmarket' has no ParameterUncertainty — defaulted to base=0.0…"*.
 *    `humaniseCritique` is therefore called WITHOUT `userMessage`, so its
 *    producer-copy branch cannot fire, and `message` is passed empty.
 * 2. **Never mint `'UNKNOWN'`.** A warning that arrives with no code got the
 *    literal string `UNKNOWN` printed at the user — a fabricated token for a
 *    row we simply cannot name. It now renders the generic sentence with no
 *    code reference at all, which is the honest shape: absent, not "unknown".
 */

import { humaniseCritique } from '../../../components/results/utils/humaniseCritique'

/**
 * The audit-trail shape of an inference warning, as `AuditTrailData` declares
 * it. Every field is optional at the type level because this rides PLoT's
 * untyped enrichment passthrough (CLAUDE.md hazard 2) — read defensively.
 */
export interface AuditInferenceWarning {
  code?: string
  severity?: string
  message?: string
}

/**
 * One rendered audit row: the human sentence, plus the machine code kept as an
 * explicit technical reference (null when the producer sent none).
 */
export interface AuditInferenceWarningRow {
  /** The ratified user-facing sentence for this code. Never a machine code. */
  readonly text: string
  /** The producer's code, preserved verbatim. `null` when absent — never 'UNKNOWN'. */
  readonly code: string | null
  /** How many warnings collapsed into this row (>= 1). */
  readonly count: number
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0
}

/**
 * A code that cannot be mapped, used to obtain the generic sentence from its
 * owner rather than copying the words. Asserted equivalent to other unmapped
 * codes in the spec, so this sentinel cannot silently stop meaning "unmapped".
 */
const UNMAPPABLE_SENTINEL = '__OLUMI_AUDIT_UNMAPPED_SENTINEL__'

/** Two labels that differ, used only to detect label dependence. */
const PROBE_NODE = '__OLUMI_AUDIT_LABEL_PROBE__'
const PROBE_LABEL_A = 'PROBE_LABEL_ALPHA'
const PROBE_LABEL_B = 'PROBE_LABEL_BETA'

function titleFor(code: string): string {
  return humaniseCritique({ code, message: '' }).title
}

function titleUnderLabel(code: string, label: string): string {
  return humaniseCritique(
    { code, message: '', affectedNodes: [PROBE_NODE] },
    new Map([[PROBE_NODE, label]]),
  ).title
}

/**
 * Does this code's copy DEPEND on a factor label?
 *
 * ⭐ DERIVED, NOT MIRRORED. The obvious implementation is to test the resolved
 * title for `humaniseCritique`'s unresolved-label placeholder — but that
 * constant is module-private, so naming it here would be a hand-maintained
 * mirror of a string in another file (CLAUDE.md trap 12), silently wrong the
 * day it is reworded. Instead the question is asked of the template directly:
 * resolve it twice under two DIFFERENT labels. A label-free template returns
 * the same sentence both times; a label-interpolating one cannot.
 */
function dependsOnAFactorLabel(code: string): boolean {
  return titleUnderLabel(code, PROBE_LABEL_A) !== titleUnderLabel(code, PROBE_LABEL_B)
}

/**
 * Resolve one code to its user-facing sentence through the single owner of
 * these words.
 *
 * `humaniseCritique` renders the TITLE on both existing live surfaces, so the
 * title is what is reused here; passing an empty `message` and no
 * `userMessage` is deliberate (see the file header).
 *
 * ⚠ A MAPPED TEMPLATE IS NOT AUTOMATICALLY SAFE HERE, AND ASSUMING SO WAS THIS
 * MODULE'S OWN DEFECT (found in adversarial review of the PR that introduced
 * it). `humaniseCritique`'s header records that the ISL inference-warning
 * templates all ignore the resolved label — true, and it is why they are safe.
 * But `inference_warnings` also carries codes OUTSIDE that classified set, and
 * three of them appear in this repo's own captured fixtures
 * (`CONSTRAINT_TARGET_UNRELIABLE`, `EDGE_E_VALUE_NON_FINITE_DROPPED`,
 * `EDGE_SENSITIVITY_UNAVAILABLE_V2_WIRE`). The first is one of the
 * LABEL-INTERPOLATING templates, so with no factor context this row rendered
 * *"This factor's success target can't be evaluated reliably"* — an audit trail
 * naming no factor, while the producer's wire message named one.
 *
 * A sentence built around a factor the surface cannot identify is not an
 * explanation, so it is refused in favour of the generic one. That matches what
 * the caveat strip already does with the same input, and it is the same rule as
 * the rest of this module: withhold rather than render a placeholder.
 */
export function describeAuditInferenceWarningCode(code: string | null): string {
  const generic = titleFor(UNMAPPABLE_SENTINEL)
  const c = code ?? ''
  if (c === '') return generic

  const title = titleFor(c)
  // Unmapped already resolves to the generic sentence — no probe needed, and
  // probing would only emit two more unmapped-code warnings.
  if (title === generic) return generic

  return dependsOnAFactorLabel(c) ? generic : title
}

/**
 * Collapse the raw warning array into rendered rows.
 *
 * Deduplicated by code with a count, mirroring the sibling "Repairs applied"
 * row — ISL emits one warning PER NODE for the defaulting family, and N
 * identical sentences is noise, not audit detail. First-seen order is
 * preserved so the row order still reflects the producer's.
 *
 * Codeless warnings collapse together under a single `null` key.
 */
export function describeAuditInferenceWarnings(
  warnings: readonly AuditInferenceWarning[] | null | undefined,
): AuditInferenceWarningRow[] {
  if (!Array.isArray(warnings) || warnings.length === 0) return []

  const order: Array<string | null> = []
  const counts = new Map<string | null, number>()

  for (const w of warnings) {
    if (w == null || typeof w !== 'object') continue
    const code = isNonEmptyString(w.code) ? w.code : null
    if (!counts.has(code)) order.push(code)
    counts.set(code, (counts.get(code) ?? 0) + 1)
  }

  return order.map((code) => ({
    text: describeAuditInferenceWarningCode(code),
    code,
    count: counts.get(code) ?? 1,
  }))
}
