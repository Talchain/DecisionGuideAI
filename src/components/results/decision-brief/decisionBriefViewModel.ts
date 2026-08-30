/**
 * Read-only projection of the CEE-carried Decision Brief.
 *
 * The browser does not receive the complete PLoT DecisionBriefV1 on a
 * withheld run: CEE deliberately removes leader-designating members while
 * retaining non-designating reasoning content. The shared response boundary
 * is also intentionally opaque (`object().passthrough()`), so this module
 * validates only the live-attested projection it renders. It never rebuilds a
 * leader, recommendation, confidence judgement, or robustness verdict.
 */

import { RAW_ID_PATTERN } from '@/canvas/conversation/friendlyOperation'

export interface DecisionBriefDriverView {
  /** Producer label, preserved verbatim. */
  label: string
}

/**
 * One factor the analysis had to default because the user had not supplied a
 * value, carrying the PRODUCER'S OWN sentence about it.
 *
 * The label is the anchor; the `note` is the content. Rendering the labels
 * alone would reproduce the duplication this category was created to fix —
 * `key_assumptions` is a SUBSET of `top_drivers` on every capture measured, so
 * a second list of factor names can never be a distinct answer. The prose is.
 */
export interface DecisionBriefDefaultedView {
  factorLabel: string
  note: string
}

/**
 * The producer's own sentence about how far the ranking held, with the token
 * that licenses it. ⚠ This is a LEADER-RANKING member: CEE strips it, alongside
 * `headline` and `headline_banded`, on a withheld turn, and its absence IS the
 * withheld signal. Rendering it is gated on the owned leader claim — see
 * `DecisionBriefSection`. Never treat its presence as evidence a leader exists.
 */
export interface DecisionBriefRobustnessCaveatView {
  text: string
  basis: string
}

export interface DecisionBriefViewModel {
  topDrivers: DecisionBriefDriverView[]
  keyAssumptions: string[]
  whatWouldChange: string[]
  defaultedAssumptions: DecisionBriefDefaultedView[]
  robustnessCaveat: DecisionBriefRobustnessCaveatView | null
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ISO_INSTANT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
// PLoT currently falls back from absent display labels to model-element IDs in
// some brief members. The projected object carries no flag that distinguishes
// that fallback, so an ID-shaped member fails its whole ordered category
// closed; the UI never prettifies an identifier into an invented name. Reuse
// the canonical UI leak guard and supplement it for persisted ID shapes that
// guard intentionally does not cover.
const SUPPLEMENTAL_RAW_IDENTIFIER_RE = new RegExp([
  UUID_RE.source.replace(/^\^|\$$/g, ''),
  '\\bgc-[0-9a-f-]{8,}\\b',
  '\\b[0-9a-f]{8,64}\\b',
].join('|'), 'i')

const MAX_TOP_DRIVERS = 5
const MAX_KEY_ASSUMPTIONS = 10
const MAX_WHAT_WOULD_CHANGE = 10
const MAX_LABEL_LENGTH = 300
const MAX_NOTE_LENGTH = 600
const MAX_DEFAULTED_ASSUMPTIONS = 10
/**
 * How far to LOOK for qualifying rows — not how many to show. The cap above is the
 * producer's contract on the output; this bounds the input scan so a hostile payload
 * cannot force unbounded regex work. Set at 20x the declared maximum: generous enough
 * that no realistic mix of `source` kinds starves the category, finite by construction.
 */
const MAX_DEFAULTED_SCAN = MAX_DEFAULTED_ASSUMPTIONS * 20

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readNonBlankString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null
  if (value.trim().length === 0 || value.length > maxLength || value.includes('\0')) return null
  return value
}

function isValidIsoInstant(value: string): boolean {
  if (!ISO_INSTANT_RE.test(value)) return false
  const parsed = new Date(value)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value
}

/**
 * Exported so `estimatedInterventions.ts` withholds an id-shaped CANVAS label by
 * the SAME rule this module applies to producer prose. Deliberately shared
 * rather than copied: a second regex pair would be a hand-maintained mirror of
 * this one, and the copy that drifts is the one that leaks an identifier.
 */
export function containsRawIdentifier(value: string): boolean {
  return RAW_ID_PATTERN.test(value) || SUPPLEMENTAL_RAW_IDENTIFIER_RE.test(value)
}

function readStringList(
  value: unknown,
  maxItems: number,
  rejectRawIdentifiers = false,
): string[] {
  if (value == null) return []
  if (!Array.isArray(value)) return []

  // ⭐ CAP BEHAVIOUR. This used to be `value.length > maxItems -> return []`, so a
  // producer that exceeded its OWN declared maximum emptied the whole category:
  // eleven assumptions rendered as zero. The cap is the producer's contract, not
  // a validity test — honour it by TRUNCATING to it, never by discarding the lot.
  const capped = value.slice(0, maxItems)

  // ⭐ POISON-ROW BEHAVIOUR. Ordering is meaningful on these producer arrays, so a
  // malformed row may not simply be filtered out — dropping a middle row silently
  // re-ranks everything after it, which is a quieter lie than showing less. But
  // emptying the category suppresses valid siblings for one bad row. The honest
  // response is a PREFIX: every row shown holds its true rank, and nothing after
  // the first unusable row is claimed.
  const out: string[] = []
  for (const item of capped) {
    const s = readNonBlankString(item, MAX_LABEL_LENGTH)
    if (s === null) break
    if (rejectRawIdentifiers && containsRawIdentifier(s)) break
    out.push(s)
  }
  return out
}

function readTopDrivers(value: unknown): DecisionBriefDriverView[] {
  if (value == null) return []
  if (!Array.isArray(value)) return []

  // Cap truncates (see readStringList); a malformed row ends the prefix rather
  // than emptying a ranked category.
  const drivers: DecisionBriefDriverView[] = []
  for (const item of value.slice(0, MAX_TOP_DRIVERS)) {
    if (!isRecord(item)) break
    const label = readNonBlankString(item.factor_label, MAX_LABEL_LENGTH)
    const sensitivity = item.sensitivity
    const direction = item.direction
    if (
      label === null
      || containsRawIdentifier(label)
      || typeof sensitivity !== 'number'
      || !Number.isFinite(sensitivity)
      || sensitivity < 0
      || (direction !== 'positive' && direction !== 'negative')
    ) {
      break
    }
    // Sensitivity and direction validate that this is a producer driver row,
    // but stay off-screen: V1 does not license a new UI confidence or causal
    // magnitude interpretation here.
    drivers.push({ label })
  }
  return drivers
}

/**
 * ⭐ THE ANTI-DARK CLASSIFICATION — every member the producer sends must be
 * accounted for, or the guard REDs.
 *
 * This estate's dominant loss class is working code no user can reach: the UI
 * mappers rebuild payloads as key-by-key allow-lists, so a new producer field is
 * DARK BY DEFAULT and fails silently with green suites at every other hop. A
 * hand-maintained census of "fields we handle" would drift the same way.
 *
 * So the OBSERVED side is derived — `decisionBriefFieldCoverage.spec.ts` reads the
 * committed live captures and takes the real union of `decision_brief` keys — and
 * this is the DECIDED side. A member that appears on the wire and in none of these
 * four sets is unclassified, and the guard names it and fails.
 *
 * The sets are composed into `DECISION_BRIEF_CLASSIFIED` rather than a fifth list
 * being typed out, so a key cannot be classified twice or belong to none of them
 * while still counting as handled. (Same shape as `decisionReviewAdapter`'s
 * `V0_30_CONTENT_KEYS`, for the same reason: a guard that names examples tests the
 * examples; a guard that iterates the list tests the rule.)
 */
export const DECISION_BRIEF_RENDERED_HERE = [
  'top_drivers',
  'what_would_change',
  'defaulted_assumptions',
  // Moved out of DECLARED_DARK when it gained a renderer. The guard requires
  // exactly-once classification, so this move is what forces the old entry to go.
  'robustness_caveat',
] as const

/** Read to decide whether the projection is a brief at all; never displayed. */
export const DECISION_BRIEF_CONSUMED_AS_IDENTITY = [
  'brief_id',
  'created_at',
  'version',
] as const

/** Reaches the user, but through a different consumer — must not render twice. */
export const DECISION_BRIEF_OWNED_ELSEWHERE = {
  options: 'id-to-label fallback in mapV5AnalysisToReport; the brief must not restate it',
  headline_banded: 'leader-entitlement band consumed by decisionVerdict/useResultsSectionData',
} as const

/**
 * Deliberately not rendered. A reason is REQUIRED — an entry here is a claim that
 * a user loses nothing, and that claim should have to be written down.
 */
export const DECISION_BRIEF_DECLARED_DARK = {
  key_assumptions:
    'a SUBSET of top_drivers on every capture measured, so it can only restate the '
    + 'neighbouring column; 0 of 1,620 captured briefs carry it while top_drivers is empty',
  headline: 'leader-designating prose; this surface never restores a leader',
  robustness: 'a producer verdict this surface has no licence to re-state as its own',
  warnings: 'the canonical inference-warning strip above the brief is sole owner',
  warning_codes: 'machine codes; the human-readable strip above owns this surface',
  analysis_summary: 'band summary owned by the analysis hero, not by the brief',
  lineage: 'audit provenance, not user-facing on this surface',
  graph_hash: 'identity for the run, shown nowhere as copy',
  seed: 'simulation input, never user-facing',
} as const

/** Composed, never listed again. */
export const DECISION_BRIEF_CLASSIFIED: readonly string[] = [
  ...DECISION_BRIEF_RENDERED_HERE,
  ...DECISION_BRIEF_CONSUMED_AS_IDENTITY,
  ...Object.keys(DECISION_BRIEF_OWNED_ELSEWHERE),
  ...Object.keys(DECISION_BRIEF_DECLARED_DARK),
]

/**
 * ⭐ The producer's own honesty prose about values it had to default.
 *
 * PROSE SAFETY (brief §6) — VET, NEVER REWRITE. The note is PRODUCER PROSE and the
 * label is USER DATA; both are rendered verbatim, with no transform between wire and
 * DOM. `safeInterpolatedLabel` is deliberately NOT used: substituting a fallback into
 * the producer's sentence would change what the producer said. A row that cannot be
 * shown unchanged is WITHHELD, never repaired — an absence, never a fabrication.
 *
 * ⚠ THE ANALYSIS GLOSSARY IS DELIBERATELY NOT A GUARD HERE, and this is the correction
 * that matters most on this surface. It used to gate every row on
 * `containsBannedTerm(factorLabel) || containsBannedTerm(note)`. Measured against 13
 * realistic business factor labels, that withheld TEN — `Budget Variance`, `Win Rate`,
 * `Price Elasticity`, `Blocked Pipeline Value`, `Government Intervention Risk`,
 * `Knowledge Graph Coverage`, `Posterior Demand Estimate`, `Confidence Score Threshold`,
 * `Winner Take All Share`, `Recommended Retail Price` — with no trace in the DOM and no
 * withheld-count anywhere. The user lost the honesty disclosure BECAUSE they had named
 * a factor normally, and the loss was invisible to them and to us.
 *
 * It was a category error. `glossaryCheck` gates UI-GENERATED COPY — its own header
 * says "we never rewrite user data, only the generated copy that names it", and
 * `analysis-hero/__tests__/copyHygiene.spec.tsx` states the rule outright:
 * "Producer-supplied strings ... are deliberately NOT scanned — they are rendered as
 * data, never authored here." Two questions were sharing one predicate: "is Olumi
 * authoring jargon or a leader claim in copy it wrote?" (glossary — correct, and
 * untouched at its seven other consumers) and "is this producer sentence safe to
 * render verbatim?" (this surface). The second is answered in full by the guards that
 * remain: raw-identifier, length, blank/NUL, and the `source` token.
 *
 * Nothing forced the gate. No spec scans this surface for banned terms, and the estate's
 * one source scanner walks `src/canvas/components/pre-analysis-v3/` — a different
 * subtree, and blind to runtime wire data by construction. The gate was also applied to
 * `factorLabel`, which has ZERO production consumers: `DecisionBriefSection` renders
 * `entry.note` alone. Rows were being withheld over a string no user could ever see.
 *
 * ⭐ CAP AFTER FILTER, NEVER BEFORE. This used to `slice(0, MAX)` and only then test
 * `source`, so ten leading non-qualifying rows starved the category to zero while the
 * SAME two valid rows rendered fine when placed first — pure ordering dependence, and
 * the same "cap empties the list" defect already fixed in `readStringList`. The cap
 * counts QUALIFYING rows; `MAX_DEFAULTED_SCAN` bounds the input scan separately.
 *
 * Unlike the ranked arrays above, this is an unordered SET of factors, so an unusable
 * row is skipped rather than ending a prefix: there is no rank to lie about, and the
 * remaining rows are each independently true.
 */
function readDefaultedAssumptions(value: unknown): DecisionBriefDefaultedView[] {
  if (value == null) return []
  if (!Array.isArray(value)) return []

  const out: DecisionBriefDefaultedView[] = []
  for (const item of value.slice(0, MAX_DEFAULTED_SCAN)) {
    if (out.length >= MAX_DEFAULTED_ASSUMPTIONS) break
    if (!isRecord(item)) continue
    // The producer's own token for "we defaulted this". Anything else is a row
    // this surface has no licence to describe.
    if (item.source !== 'value_defaulted') continue

    const factorLabel = readNonBlankString(item.factor_label, MAX_LABEL_LENGTH)
    const note = readNonBlankString(item.note, MAX_NOTE_LENGTH)
    if (factorLabel === null || note === null) continue
    if (containsRawIdentifier(factorLabel) || containsRawIdentifier(note)) continue

    out.push({ factorLabel, note })
  }
  return out
}

/**
 * The producer's caveat about the ranking, with its licensing token.
 *
 * `basis` is required: a caveat with no stated basis is an unattested claim about
 * the user's ranking, and this surface has no licence to pass one on.
 *
 * ⚠ THE ANALYSIS GLOSSARY IS DELIBERATELY NOT A GUARD HERE — corrected to match the
 * ruling #846 made on the sibling `defaulted_assumptions` reader, because I had made
 * the same category error twice in one file.
 *
 * I gated this text on `containsBannedTerm`. `glossaryCheck` gates UI-GENERATED COPY;
 * its own header says "we never rewrite user data, only the generated copy that names
 * it", and `copyHygiene.spec.tsx` states outright that "producer-supplied strings are
 * deliberately NOT scanned — they are rendered as data, never authored here". Two
 * questions were sharing one predicate: "is Olumi authoring jargon in copy it wrote?"
 * and "is this producer sentence safe to render verbatim?".
 *
 * The margin was one character and I read it the wrong way round. `perturbation` is a
 * banned term; the producer writes "perturbations", which `\bperturbation\b` does not
 * match. I pinned that near-miss as a case to PRESERVE the withholding. The correct
 * reading is that a producer sentence should never have been withheld for a glossary
 * word at all — a caveat suppressed because the analysis used an ordinary word is a
 * silent loss of the one sentence telling the user how far to trust the ranking.
 *
 * What answers the real question is what remains: raw-identifier, length, blank/NUL,
 * and the `basis` token.
 */
function readRobustnessCaveat(value: unknown): DecisionBriefRobustnessCaveatView | null {
  if (!isRecord(value)) return null
  const text = readNonBlankString(value.text, MAX_NOTE_LENGTH)
  const basis = readNonBlankString(value.basis, MAX_LABEL_LENGTH)
  if (text === null || basis === null) return null
  if (containsRawIdentifier(text)) return null
  return { text, basis }
}

/**
 * Parse the CEE-projected DecisionBriefV1 members that are licensed for this
 * surface. Missing or malformed categories do not suppress valid siblings.
 */
export function readDecisionBriefViewModel(raw: unknown): DecisionBriefViewModel | null {
  if (!isRecord(raw) || raw.version !== '1') return null

  const briefId = readNonBlankString(raw.brief_id, 64)
  const createdAt = readNonBlankString(raw.created_at, 64)
  if (
    briefId === null
    || !UUID_RE.test(briefId)
    || createdAt === null
    || !isValidIsoInstant(createdAt)
  ) {
    return null
  }

  const topDrivers = readTopDrivers(raw.top_drivers)
  const keyAssumptions = readStringList(
    raw.key_assumptions,
    MAX_KEY_ASSUMPTIONS,
    true,
  )
  const whatWouldChange = readStringList(
    raw.what_would_change,
    MAX_WHAT_WOULD_CHANGE,
    true,
  )
  const defaultedAssumptions = readDefaultedAssumptions(raw.defaulted_assumptions)
  const robustnessCaveat = readRobustnessCaveat(raw.robustness_caveat)

  if (
    topDrivers.length === 0
    && keyAssumptions.length === 0
    && whatWouldChange.length === 0
    && defaultedAssumptions.length === 0
    && robustnessCaveat === null
  ) {
    return null
  }

  return { topDrivers, keyAssumptions, whatWouldChange, defaultedAssumptions, robustnessCaveat }
}
