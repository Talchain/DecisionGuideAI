/**
 * labelNeedsName — may the product present this node label AS the entity's name?
 *
 * ─── THE DEFECT THIS ANSWERS ────────────────────────────────────────────────
 * CEE has an entity-naming rule and it runs for `goal`, `option` and `decision`
 * only. `factor` has NONE — not a refusing one, an ABSENT one — so a stated
 * `cause` (an explanation the user offered, an answer to "why") becomes a
 * `factor` node whose label is its `source_quote`, VERBATIM, unconditionally
 * (`SPEC-ENTITY-NAMING-AND-VALUE-BINDING-2026-09-03.md` §0, §2.2).
 *
 * On Paul's live model that ships as two causal factors named:
 *
 *     "Operations think extending shifts alone gets us there"
 *     "Finance disagrees and says we will need the second site"
 *
 * — each with Low→High levels, and one of them used as an option's
 * differentiator, so the canvas states that the key difference between two
 * options IS "Finance disagrees and says we will need the second site". A
 * person's stated opinion has become a quantified causal variable.
 *
 * ─── ⚠ WHAT THIS MODULE IS NOT ─────────────────────────────────────────────
 * It does NOT author a name, shorten one, title-case one, or pick an entity out
 * of the sentence. That is a SELECTOR, it belongs at the producer, and the
 * estate has already ruled that it must not live in a render layer
 * (`NODE-NAME-CLAIM-CONTRACT-2026-09-03.md`: *"The `name` is authored where the
 * entity is created … It is never derived downstream"*, and *"The UI must
 * truncate, never rewrite"*). Shortening prose into a name is a judgement about
 * meaning, and a render layer that guesses will eventually put a claim on
 * screen that the model does not support.
 *
 * What a render layer MAY do — and what this module does — is DISCLOSE that it
 * has not been given a name. That is the same move `goalLabelProvenance` makes
 * one node-kind over: state the provenance, hand over the pen, guess nothing.
 *
 * ─── ⚠ WHY THE OBVIOUS SIGNAL IS NOT THE ONE USED ──────────────────────────
 * Derived at the wire, not inferred:
 *
 *   · `label_authored` is the field that answers this question at CEE
 *     (*"DERIVED at the producer from `label !== source_quote`"*). It is NOT
 *     usable here: on the banked draft-graph corpus it is emitted only when
 *     TRUE, so it is ABSENT on the raw-span factors this module exists for AND
 *     absent on the well-formed model-authored ones. A guard keyed on it would
 *     not discriminate. (Measured over `artefacts/b2-draws-2026-09-03/` — 12
 *     draws, 16 nodes each — plus the 3 and 5 Sep manual sessions.)
 *   · `provenance` DOES ride on `data` and IS already consumed
 *     (`attributionOfNode`), but it answers *where did this node's CONTENT come
 *     from*, not *are these the user's words*. `from_brief` is a display
 *     projection of `extractionType` and covers authored-from-brief labels too,
 *     so it is a strict superset — see `goalLabelProvenance`'s header, which
 *     withdraws exactly that conflation.
 *   · `source_quote` DOES ride on `data`, and its ABSENCE from this repo's
 *     source is a NAME-GREP FALSE ZERO: `mapDraftNodeToCanvas`
 *     (`utils/applyDraftResult.ts:39,52`) destructures only
 *     `{id, kind, type, label, observed_state}` and spreads `...rest` onto
 *     `data`, so the field arrives without its name appearing anywhere.
 *     `normalisePersistedGraph` reuses that same mapper and is
 *     content-preserving for arbitrary `data` keys, so it survives a persisted
 *     round-trip. Proven by executing the real destructure against a real wire
 *     node, with a contrast (an `ai_inferred` node, where the producer genuinely
 *     sends none) and a negative control (`observed_state`, which the
 *     destructure consumes).
 *
 * ─── THE PREDICATE, AND WHICH QUESTION EACH HALF ANSWERS ───────────────────
 * Two questions, named apart, because collapsing them is this estate's
 * signature defect:
 *
 *   1. "Does this label read as a SENTENCE rather than an entity?" —
 *      `readsAsSentence`, a shape check. NECESSARY, and the high bar.
 *   2. "Did the producer AUTHOR this label?" — `source_quote`, when present.
 *      A VETO only.
 *
 * The shape check is necessary and the veto is sufficient to suppress. It is
 * deliberately NOT `isVerbatim && readsAsSentence`: requiring proof of verbatim
 * would go dark on every node whose `source_quote` the producer never sent —
 * which, measured, includes the three worst real canvas offenders on record
 * (`NODE-NAME-CLAIM-CONTRACT`'s own quoted examples). A guard that cannot fire
 * on the case it was written for is the reachability trap, not a safe default.
 *
 * ─── ⚠ THE BAR, AND WHICH DIRECTION IT LEANS ───────────────────────────────
 * A false positive HIDES A LEGITIMATE NAME behind a "needs a name" marker and
 * makes the product look stupid about a name that was fine. A false negative
 * leaves one more sentence on the canvas — today's behaviour exactly. The
 * second is much the cheaper error, so every signal below is POSITIVE evidence
 * of a clause, never a heuristic about length or tidiness.
 *
 * Deliberately NOT used as signals, each because a legitimate factor name can
 * carry it: word count (`Channel Partner Programme Investment` is 4 and fine;
 * the spec's own ≤6 bound would flag `Add £3m of New ARR Within Eighteen
 * Months`), digits (`Tier 1 Support Coverage`), bare infinitives that are also
 * nouns (`Budget Burn Without Pipeline`, `Self-Serve Conversion Rate`,
 * `Status Quo — Hold Current GTM`), and plural nouns that are also verbs
 * (`Efficiency Gains`, `Trade Shows`, `Length of Stay`, `Customer Need`).
 * `FINITE_VERBS` therefore holds INFLECTED forms only — never a bare stem.
 *
 * ─── MEASURED, ON A CORPUS NOBODY ON THIS LANE WROTE ────────────────────────
 * 144 real node labels harvested from the banked live captures in
 * `Talchain/olumi-programme-docs` (`artefacts/b2-draws-2026-09-03/` ×12,
 * `manual-test-2026-09-03`, `manual-test-2026-09-05`,
 * `leg5-postrun-2026-09-03`), plus Paul's two live labels:
 *
 *   · 17 flagged / 144 — 11 unique labels, EVERY ONE a genuine sentence.
 *   · 127 not flagged — and ZERO of them read as a sentence, i.e. no miss.
 *   · SPEC §E2's required positive control: 11/11 of the §E4 raw-span set RED.
 *   · SPEC §E2's required contrast control: all 92 claim-derived factor names
 *     in the b2 draws stay GREEN, as do `Customer Success Headcount` and
 *     `Carrier Cut-off Compliance`.
 *
 * ⚠ SCOPE OF THAT, STATED PRECISELY: it is a measurement over labels these
 * captures happen to contain. It bounds the FALSE-POSITIVE rate on real
 * model-authored names, which is the direction that matters. It does not prove
 * the signal list is complete, and completeness cannot be derived from the same
 * intuition that wrote it — SPEC §E3's whiteboard gate is the check that comes
 * from outside, and it must stay human.
 *
 * ⚠ THE VETO IS UN-EXERCISED BY THE REAL CORPUS: 0 of 144 labels are both
 * sentence-shaped AND carry a differing `source_quote`. It is pinned by a
 * constructed case in the spec, and that is the only evidence for it.
 */

/**
 * Inflected finite verb forms. NEVER a bare stem — a bare stem is a noun in
 * half the factor names this estate ships (`Burn`, `Serve`, `Hold`, `Need`).
 */
const FINITE_VERBS: ReadonlySet<string> = new Set([
  'is', 'are', 'was', 'were', 'am', "isn't", "aren't", "wasn't", "weren't",
  'has', 'have', 'had', "hasn't", "haven't", "hadn't",
  'will', 'would', 'could', 'should', 'must', 'might', 'shall',
  "won't", "can't", "couldn't", "shouldn't", "wouldn't",
  'does', 'did', "doesn't", "didn't", "don't",
  'says', 'said', 'think', 'thinks', 'thought', 'believe', 'believes', 'believed',
  'knows', 'knew', 'disagrees', 'disagree', 'agrees', 'agree', 'argues', 'argue',
  'raised', 'lost', 'became', 'went', 'came', 'took', 'gave', 'told', 'seems', 'seem',
  'appears', 'gets', 'got', 'mediate', 'mediates', 'worsens', 'doubles',
])

/**
 * First- and second-person subject/object pronouns only. Possessives
 * (`our`, `my`, `your`) are DELIBERATELY EXCLUDED — they open perfectly
 * ordinary names a user might type ("Our Brand Strength").
 */
const PRONOUNS: ReadonlySet<string> = new Set(['i', 'we', 'us', 'me', 'you'])

/**
 * Contracted copula/auxiliary on a pronoun or determiner stem. Decisive clause
 * evidence and — unlike a bare possessive `'s` — cannot occur in an entity
 * name, which is why this is a closed list rather than a `/'s$/` pattern.
 */
const CONTRACTED_CLAUSE: ReadonlySet<string> = new Set([
  "that's", "it's", "he's", "she's", "there's", "what's", "who's", "here's",
  "we're", "they're", "you're", "i'm", "we've", "they've", "i've", "you've",
  "we'll", "they'll", "it'll", "i'll",
])

/** Which signal fired, for tests and for the disclosure's own explanation. */
export type SentenceSignal = 'finite-verb' | 'contracted-clause' | 'pronoun' | 'terminal-punctuation'

function words(value: string): string[] {
  return value.toLowerCase().match(/[a-z']+/g) ?? []
}

/**
 * Does this string read as a SENTENCE rather than an entity name?
 *
 * Returns the signal that fired (truthy) or `false`. Positive evidence only —
 * see the header for what is deliberately not a signal, and why.
 */
export function readsAsSentence(label: unknown): SentenceSignal | false {
  if (typeof label !== 'string') return false
  const trimmed = label.trim()
  if (!trimmed) return false
  const tokens = words(trimmed)
  if (tokens.some(t => FINITE_VERBS.has(t))) return 'finite-verb'
  if (tokens.some(t => CONTRACTED_CLAUSE.has(t))) return 'contracted-clause'
  if (tokens.some(t => PRONOUNS.has(t))) return 'pronoun'
  if (/[.?!]$/.test(trimmed)) return 'terminal-punctuation'
  return false
}

/**
 * Is this label PROVABLY the user's own words, lifted unedited?
 *
 * True only when the producer sent a `source_quote` and it equals the label —
 * which is exactly how CEE itself derives `label_authored`. Absence proves
 * NOTHING either way, which is why this is never used as a precondition.
 */
export function isVerbatimBriefLabel(data: unknown): boolean {
  const record = data as Record<string, unknown> | undefined
  const quote = record?.source_quote
  const label = record?.label
  if (typeof quote !== 'string' || typeof label !== 'string') return false
  const q = quote.trim()
  return q !== '' && q === label.trim()
}

/**
 * Should this node be shown as needing a name?
 *
 * Returns the signal that fired, or `false`. The label itself is NEVER altered
 * by this module — callers disclose, they do not rewrite.
 */
export function labelNeedsName(data: unknown): SentenceSignal | false {
  const record = data as Record<string, unknown> | undefined
  const label = record?.label
  const signal = readsAsSentence(label)
  if (!signal) return false

  // VETO: the producer sent a quote AND authored a different label from it, so
  // a naming decision has already been made upstream. Defer to it.
  const quote = record?.source_quote
  if (
    typeof quote === 'string' &&
    quote.trim() !== '' &&
    typeof label === 'string' &&
    quote.trim() !== label.trim()
  ) {
    return false
  }
  return signal
}

/** The one testid for the marker, DERIVED by every surface and every spec. */
export const LABEL_NEEDS_NAME_TESTID = 'label-needs-name'

/** The marker itself. Short enough to sit on a width-constrained card. */
export const LABEL_NEEDS_NAME_MARKER = 'Needs a name'

/**
 * The explanation, as a `title`/`aria` sentence.
 *
 * ⚠ TWO SENTENCES, AND THE SPLIT IS AN HONESTY CONSTRAINT, NOT A STYLE CHOICE.
 * When `source_quote` proves the label is the user's own words we may say so.
 * When it is absent we know only that the string reads as a sentence — it may
 * be the user's words or an unnamed model claim — and claiming authorship we
 * cannot prove is the same class of defect this module exists to close.
 */
export function labelNeedsNameExplanation(data: unknown): string {
  return isVerbatimBriefLabel(data)
    ? 'This is a sentence from your brief, shown unedited — Olumi has not been given a short name for it. Double-click to name it.'
    : 'This reads as a sentence rather than a name, and Olumi has not been given a short name for it. Double-click to name it.'
}
