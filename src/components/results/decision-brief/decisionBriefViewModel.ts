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
  /**
   * The producer's stated basis, or `null` when it is not DISPLAY TEXT.
   *
   * `null` means "the producer attested a basis and it cannot be shown to a
   * user" — the label line is omitted and {@link DecisionBriefRobustnessCaveatView.text}
   * still renders. It never means "no basis was sent": an ABSENT basis still
   * withholds the whole caveat, which is a different question (see
   * {@link readRobustnessCaveat}). Callers must render the label only when this
   * is non-null, and must never fall back to the raw value.
   */
  basis: string | null
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

/** A written phrase contains at least one letter. A bare token need not. */
const HAS_LETTER_RE = /\p{L}/u

/**
 * Characters that serialisation formats use and written English does not.
 *
 * `_` is the load-bearing one: it is the whole `snake_case` / `SCREAMING_SNAKE`
 * family in a single character, and no phrase written to be read contains it.
 * The rest are bracket, pipe and escape syntax that only ever arrives from a
 * machine.
 */
const MACHINE_PUNCTUATION_RE = /[_<>{}[\]|\\\x60~^]/

/**
 * A control character is never display text.
 *
 * ⚠ CHECKED BY CODE POINT, NOT IN THE PATTERN ABOVE. Putting `\u0000-\u001F`
 * in a character class trips `no-control-regex`, and silencing a lint rule to
 * keep a range readable is the wrong trade — the rule exists because control
 * characters in a regex are usually a mistake. Scanning code points states the
 * intent plainly and catches DEL (0x7F) as well, which the range did not.
 */
function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0
    if (code < 0x20 || code === 0x7f) return true
  }
  return false
}

/**
 * ⭐⭐ IS THIS STRING HUMAN DISPLAY TEXT — something written to be READ?
 *
 * ## Why this is asked in the positive, and what it replaces
 *
 * The screen it replaces asked the opposite question: "does this look like one
 * of the id shapes we know about?" That is a BLOCKLIST, and it failed exactly
 * the way a blocklist fails. {@link RAW_ID_PATTERN} is a hand-maintained
 * alternation of NODE-ID PREFIXES (`opt_ fac_ goal_ dec_ …`); the token that
 * actually reached a user was `is_robust`, a WIRE ENUM. `is_` was in no list, so
 * the guard returned a clean pass and the Reasoning tab printed
 * `Tested against: is_robust` on the served build `475ee1c7`.
 *
 * Adding `is_` to the alternation would have fixed that one token and left the
 * next enum to leak identically. This is trap 12, the hand-maintained mirror:
 * the defect is not which entries the list has, it is that a list must be
 * remembered. So the question is inverted. A blocklist must enumerate every way
 * a string can be machine output, which is unbounded and grows on the producer's
 * schedule. DISPLAY TEXT is a bounded, stable property of the writing system,
 * and everything that is not display text fails CLOSED — including categories
 * nobody has thought of yet.
 *
 * ## Not a lookup table, deliberately
 *
 * It does not map `is_robust` to English. `friendlyOperation.ts` already ruled
 * on that for this exact class: "a lookup table here would be a hand-maintained
 * mirror of a producer enum, trap 12, and every entry would be a guess at the
 * producer's semantics." Rendering nothing is honest; rendering a guess at what
 * the producer meant is a fabrication wearing display text's clothes.
 *
 * ## The clauses, and what each one costs
 *
 * A phrase must contain a letter, contain no machine punctuation, contain no
 * id-shaped run (so the pre-existing rejection is strictly preserved), and
 * SEPARATE ITS WORDS WITH SPACES.
 *
 * ⚠ THE MULTI-WORD CLAUSE IS THE STRICT ONE AND IT IS A DELIBERATE TRADE. It
 * rejects a legitimate one-word basis such as `Sensitivity`, which no producer
 * has been observed to send. It is safe to be strict here ONLY because the
 * caveat SENTENCE no longer depends on it: a false rejection now costs a label
 * line, not the sentence telling the user how far to trust the ranking. If that
 * ever stops being true, this clause must be revisited with it. What it buys is
 * that a single unbroken token — `isRobust`, `ROBUST`, any future camelCase or
 * bare enum — cannot reach a user as a phrase, and those are the shapes a
 * character-level screen alone would pass.
 *
 * ⚠ IT SCREENS THE `basis` LABEL, NOT THE `text` SENTENCE. A label is a short
 * phrase naming what was tested and is where an enum leaks; a sentence is prose
 * carrying commas, percentages and dashes, and holding it to a phrase predicate
 * would start suppressing legitimate producer copy. `text` keeps the screen it
 * already had. Two fields, two questions (trap 21).
 */
export function isHumanDisplayText(value: string): boolean {
  const trimmed = value.trim()
  if (trimmed.length === 0) return false
  if (!HAS_LETTER_RE.test(trimmed)) return false
  if (MACHINE_PUNCTUATION_RE.test(trimmed)) return false
  if (hasControlCharacter(trimmed)) return false
  if (containsRawIdentifier(trimmed)) return false
  if (!/\s/.test(trimmed)) return false
  return true
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

/**
 * ⚠⚠ THE RATIONALE VALUES IN THIS MAP AND IN `DECISION_BRIEF_DECLARED_DARK` ARE
 * SWEPT BY THE REASONING TAB'S NO-CONTEST GUARD, AND THEY ARE WRITTEN TO PASS IT.
 *
 * `noWinnerVocabulary.spec.ts` derives its scope by walking the import graph
 * from `AnalysisNewTabBody.tsx` (778449d1, #1393), so a module joins the swept
 * corpus the moment the tab first reaches it, with nothing for anyone to
 * remember. This PR's `sections/RobustnessCaveat.tsx` imports
 * `readDecisionBriefViewModel`, which is the first such edge into this file:
 * the two entries below had sat here unswept, and the derivation did exactly
 * what it was built to do by finding them.
 *
 * The guard reads every string literal, so a rationale that NAMES the retired
 * designation reads as a use of it. Both entries are therefore worded in the
 * ruled vocabulary (8 Sep 2026: say what is most likely and how confident we
 * are, never a placing). Nothing is lost: the classification, the reason and
 * the consumer named are unchanged, and describing a key by what it DESIGNATES
 * is if anything more precise than describing it by the word it happens to use.
 *
 * ⭐ WHY NOT TEACH THE GUARD TO SKIP THESE. It already blanks two quotation
 * classes (comments, and sibling ban lists scoped by identifier NAME), so a
 * third would not be unprecedented. But an exception keyed on this map's name
 * is a hand-maintained mirror in the guard, and the precedent it would break is
 * the one 778449d1 set when its own widening found a live violation: it fixed
 * the source and left the guard alone.
 */

/** Reaches the user, but through a different consumer — must not render twice. */
export const DECISION_BRIEF_OWNED_ELSEWHERE = {
  options: 'id-to-label fallback in mapV5AnalysisToReport; the brief must not restate it',
  headline_banded: 'naming-entitlement band consumed by decisionVerdict/useResultsSectionData',
} as const

/**
 * Deliberately not rendered. A reason is REQUIRED — an entry here is a claim that
 * a user loses nothing, and that claim should have to be written down.
 */
export const DECISION_BRIEF_DECLARED_DARK = {
  key_assumptions:
    'a SUBSET of top_drivers on every capture measured, so it can only restate the '
    + 'neighbouring column; 0 of 1,620 captured briefs carry it while top_drivers is empty',
  headline: 'option-designating prose; this surface never restores a placing',
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
 * What answers the real question is what remains: length, blank/NUL, the presence of
 * a `basis` at all, a raw-identifier screen on the SENTENCE, and a display-text screen
 * on the LABEL.
 *
 * ⚠ THE TWO BASIS QUESTIONS ARE NOT ONE. "Was a basis stated?" withholds the whole
 * caveat when the answer is no, per the ruling above. "Can the stated basis be shown
 * to a human?" withholds only the label line when the answer is no, because the
 * sentence is the load-bearing half. See {@link isHumanDisplayText}.
 */
function readRobustnessCaveat(value: unknown): DecisionBriefRobustnessCaveatView | null {
  if (!isRecord(value)) return null
  const text = readNonBlankString(value.text, MAX_NOTE_LENGTH)
  const basis = readNonBlankString(value.basis, MAX_LABEL_LENGTH)
  if (text === null || basis === null) return null
  /**
   * ⚠⚠ BOTH FIELDS ARE SCREENED, BUT NO LONGER BY THE SAME PREDICATE — and the
   * history of this comment is why the file says so at length.
   *
   * It screened `text` alone until review caught it; the omission was reachable
   * the moment a second surface rendered `basis`, because the parked tab shows
   * `.text` only. `RobustnessCaveat` on the Reasoning tab is the first surface
   * to display `basis`, which is what turned a latent asymmetry into a leak.
   * That repair pointed `containsRawIdentifier` at both fields and closed
   * `Tested against: node_<uuid>`.
   *
   * ⭐ IT DID NOT CLOSE THE CLASS, AND THE SERVED BUILD PROVED IT. Six weeks
   * later `Tested against: is_robust` was visible on `475ee1c7`.
   * `containsRawIdentifier` is a blocklist of NODE-ID PREFIXES and the leaked
   * token is a WIRE ENUM — a category the predicate was never given. The repair
   * was correct about WHICH FIELDS to screen and wrong to assume the existing
   * predicate was the right question for a label. `text` keeps that screen;
   * `basis` is now screened positively by {@link isHumanDisplayText}.
   *
   * ⭐ AND THE DOCSTRING ABOVE HAS TWICE DESCRIBED A GUARD THE CODE DID NOT
   * HAVE. A guard described in prose and absent in code is worse than no guard,
   * because the prose is what the next reader checks. It is updated with this
   * change rather than after it.
   *
   * `basis` is read at `MAX_LABEL_LENGTH`, the same bound as the label fields
   * screened at :151 and :295 — it is a LABEL, and PLoT's documented fallback
   * when a display label is absent is the model-element id.
   */
  if (containsRawIdentifier(text)) return null

  /**
   * ⭐⭐ THE BASIS IS SCREENED AS DISPLAY TEXT, AND FAILING IT COSTS THE LABEL,
   * NOT THE CAVEAT.
   *
   * The screen used to be `containsRawIdentifier(basis)`, and a failure returned
   * `null` for the WHOLE caveat. Both halves of that were wrong, in opposite
   * directions:
   *
   * 1. TOO NARROW. `containsRawIdentifier` is a blocklist of node-id prefixes.
   *    The served build rendered `Tested against: is_robust` because `is_` is
   *    not a node-id prefix. See {@link isHumanDisplayText} for why the question
   *    is now asked in the positive rather than the list extended.
   *
   * 2. TOO BLUNT. Dropping the whole caveat over an unusable LABEL discards the
   *    sentence, and the sentence is the load-bearing content — it is the one
   *    line telling the user how far to trust the ranking. This file already
   *    makes that argument for the glossary case a few lines above: "a caveat
   *    suppressed because the analysis used an ordinary word is a silent loss of
   *    the one sentence telling the user how far to trust the ranking." The same
   *    reasoning applies with more force here, because the label is the part the
   *    user can most afford to lose.
   *
   * ⚠ AN ABSENT BASIS AND AN UNRENDERABLE BASIS ARE DIFFERENT QUESTIONS, and
   * this is the trap-21 line in this function. ABSENT means the producer
   * attested nothing, and the existing ruling stands unchanged above: a caveat
   * with no stated basis is an unattested claim about the user's ranking and the
   * whole thing is withheld. PRESENT BUT NOT DISPLAY TEXT means the producer DID
   * attest and the token is not for human eyes. Only the second degrades to a
   * null label. Aligning the two would have been the wrong fix in whichever
   * direction it was aligned.
   */
  return { text, basis: isHumanDisplayText(basis) ? basis : null }
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
