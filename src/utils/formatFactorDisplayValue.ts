/**
 * formatFactorDisplayValue — contextual display text for factor values.
 *
 * TEMPORARY: display_value should come from CEE. This heuristic bridges
 * until schema v0.3.0. This utility is the single location for the
 * heuristic so it can be replaced with a one-line passthrough later.
 *
 * Returns null when no meaningful text can be produced (node renders
 * no body text). Never returns generic placeholders.
 *
 * Polish 4 review follow-up: currency detection now goes through
 * classifyUnit from labelUtils so symbols (£, $, €) prefix with no space,
 * ISO codes (CHF, USD, kr, R$) prefix with a space, and case / whitespace
 * drift ('chf', ' CHF ') resolve to the canonical form. Previously this
 * file had a hardcoded `['£', '$', '€', '¥']` list that treated CHF as a
 * trailing suffix ("500 CHF") — inconsistent with the rest of the codebase.
 */

import { classifyUnit, unwrapInterventionValue } from '../canvas/utils/labelUtils'

const KNOWN_SUFFIXES = /\s*(Presence|Capacity|Level|Status|State|Added|Rate)\s*$/i

function stripSuffixes(label: string): string {
  return label.replace(KNOWN_SUFFIXES, '').trim()
}

function formatNumber(value: number): string {
  return Math.abs(value) >= 1000
    ? value.toLocaleString('en-GB')
    : String(value)
}

/**
 * A display string this guard is willing to JUDGE: a single bare, percent, or
 * currency-prefixed number. Nothing else.
 *
 * Deliberately, provably narrow — everything it does not match keeps today's
 * behaviour byte-for-byte:
 *   · qualitative text ("Moderate", "No acquisition pursued") — no number, so
 *     no contradiction can be established;
 *   · ranges ("0.48 to 1", "3–5 months") — two numbers, describes a prior, not
 *     the observed point;
 *   · magnitude shorthand ("£40k", "$2.1m") — the digits are not the value;
 *   · anything with unit words ("42 days", "6 developers").
 * Judging any of those would need a vocabulary, and a vocabulary over natural
 * language drawn from one author's head is exactly the class of predicate this
 * estate keeps getting wrong.
 */
const SINGLE_NUMERIC_DISPLAY = /^\s*[-+]?[£$€¥₹]?\s*[-+]?\d[\d,]*(?:\.\d+)?\s*%?\s*$/

/** How many decimal places a display string committed to. */
function decimalPlaces(text: string): number {
  const m = /\.(\d+)/.exec(text)
  return m ? m[1].length : 0
}

/**
 * Could `candidate` have been rounded to produce `shown`, at the precision
 * `shown` committed to? "0.42" may legitimately render 0.4234; "20" may not
 * render 40.
 */
function couldRoundTo(candidate: number, shown: number, places: number): boolean {
  if (!Number.isFinite(candidate)) return false
  const tolerance = 0.5 * Math.pow(10, -places)
  return Math.abs(candidate - shown) <= tolerance + Number.EPSILON * 8
}

/**
 * Is this `display_value` CONTRADICTED by the node's own numeric state?
 *
 * ROADMAP 2.1003 / audit finding F3 — "the screen lies". Measured on deployed
 * staging 2026-08-09: a CEE receipt carried `observed_state.value = 40` beside
 * a stale top-level `display_value = "20%"`. This formatter returned "20%"
 * verbatim, so the canvas showed 20% — before AND after reload — while the
 * rerun computed on 40 and flipped the leading option. The brief's words:
 * **contradictory display must be invalidated, not preferred.**
 *
 * FAILS SAFE IN THE DIRECTION THAT MATTERS. It answers "can I POSITIVELY
 * establish a contradiction?" — never "does this look right?". Anything it
 * cannot judge is not contradicted, and renders exactly as it does today.
 *
 * Accepted renderings of the state are `value`, `raw_value`, and the two
 * percent scalings (`value × 100`, `value ÷ 100`), because the estate stores
 * percentages on both 0–1 and 0–100 scales and a display string cannot tell us
 * which one it used.
 *
 * ⚠ KNOWN LIMIT, stated rather than hidden: when `raw_value` is present but
 * itself stale, the display agrees with `raw_value` and this returns false.
 * That is a real, measured CEE-side applier defect (the value applier updates
 * `observed_state.value` and leaves `raw_value` behind) and it is not
 * repairable here — a consumer cannot tell a stale producer field from a
 * deliberate one.
 *
 * Exported so the rule is a concept with its own tests and its own mutants,
 * not an expression buried in a branch.
 */
export function isDisplayValueContradicted(
  displayValue: string | null | undefined,
  state: { value?: number | null; raw_value?: number | string | null },
): boolean {
  if (displayValue == null || displayValue === '') return false
  if (!SINGLE_NUMERIC_DISPLAY.test(displayValue)) return false

  const shown = Number(displayValue.replace(/[£$€¥₹,%\s]/g, ''))
  if (!Number.isFinite(shown)) return false

  const rawNumeric =
    typeof state.raw_value === 'number'
      ? state.raw_value
      : typeof state.raw_value === 'string' && state.raw_value.trim() !== ''
        ? Number(state.raw_value)
        : null

  const candidates: number[] = []
  if (typeof state.value === 'number' && Number.isFinite(state.value)) {
    candidates.push(state.value, state.value * 100, state.value / 100)
  }
  if (rawNumeric != null && Number.isFinite(rawNumeric)) {
    candidates.push(rawNumeric, rawNumeric * 100, rawNumeric / 100)
  }
  // No numeric state at all ⇒ nothing to contradict it with.
  if (candidates.length === 0) return false

  const places = decimalPlaces(displayValue)
  return !candidates.some((c) => couldRoundTo(c, shown, places))
}

export interface FactorDisplayInput {
  label: string
  value?: number | null
  raw_value?: number | string | null
  unit?: string | null
  factor_type?: string | null
  cap?: number | null
  /**
 * Who stated this value — the producer's own `observed_state.source`.
 *
 * ⭐⭐ IT EXISTS FOR EXACTLY ONE DECISION, and that decision was being made
 * wrongly. Pattern 1 skips a placeholder unit on a stated premise: *"raw_value
 * is just the denormalised normalised value (value x cap) — not a real-world
 * measurement."* **That premise is false when the person typed the number.**
 *
 * Measured on the founder's board, 19 Sep 2026 (`olumi-debug-12928b8c`):
 * `Round Oversubscription Likelihood` holds `value: 4`, `raw_value: 4`,
 * `unit: 'scale'`, **`source: 'user'`**, and no `cap` at all — so `raw_value`
 * is not `value x cap`, it IS what he stated, and `value: 4` is outside [0,1]
 * so it is not a normalised value either. **The card rendered nothing.**
 *
 * ⛔ HIDING A PERSON'S OWN NUMBER IS A DIFFERENT ACT FROM DECLINING TO ASSERT
 * A MACHINE'S. The suppression exists so the product does not present an
 * uncalibrated inference as a measurement — a claim about what OLUMI may say.
 * It was also answering *"may I hide what the user told me?"*, which nobody
 * asked and whose answer is always no. One predicate, two questions
 * (CLAUDE.md trap 21).
 */
value_source?: string | null
  /**
   * ⭐⭐ THE NUMBER A PERSON HAS JUST TYPED THAT THE ENGINE HAS NOT ACKNOWLEDGED.
   * Model-scale, from `conversation/pendingFactorEdit`. `null` normally.
   *
   * ⛔ IT IS NOT PROVENANCE AND MUST NEVER BE TREATED AS ANY. It is delivery
   * state: this node was given this value by a person and no receipt has come
   * back. `observedState.source` is deliberately withheld until CEE returns an
   * applied receipt, because stamping it at dispatch asserts a review the
   * engine has not acknowledged — the 2.304 defect verbatim. So this field
   * exists to answer a DIFFERENT question from `value_source`: not *"who is on
   * record as stating this?"* but *"is the product currently hiding something
   * the user can see themselves typing?"* (CLAUDE.md trap 21 — one predicate
   * must not answer two questions; that is why this is a second field and not
   * a third value of `value_source`.)
   *
   * ⚠ IT ONLY EVER RESCUES ITS OWN NUMBER. Every use below requires
   * `pending_user_value === value`, so a stale in-flight figure can never make
   * a DIFFERENT number visible. Without that identity bind this would be a
   * value predicate another object could satisfy.
   *
   * Witnessed defect it closes (#1837, 21 Sep 2026): typing `0.77` into a
   * `unit: "scale"` factor moved the canonical store 0.5 → 0.77 and the card
   * then showed **nothing**, unmounting the editor with it.
   */
  pending_user_value?: number | null
  category?: string | null
  /**
   * CEE-provided contextual display text. Returned verbatim when none of the
   * higher-priority branches apply. Priority order (V5 stale-value-protection
   * fix, May 2026):
   *   1. Pattern 1 (raw_value + meaningful unit) — outranks display_value
   *   2. display_value                          — outranks raw/heuristic
   *   3. raw_value without unit (numeric fallback)
   *   4. value-only binary heuristic
   *
   * Only Pattern 1 can outrank display_value: a fresh raw_value paired with a
   * meaningful unit (£, %, count, …) wins so a stale display_value cannot mask
   * a user-edited observed_state. For unitless raw_values, placeholder units
   * (scale/index/…), or null raw_value, display_value still wins.
   */
  display_value?: string | null
  /**
   * The producer's statement of what each value on this factor's scale MEANS.
   * Outranks `display_value` when the value matches a key exactly — see
   * `encodingMapPhrase`.
   */
  encoding_map?: unknown
}

/**
 * Read a factor's CEE `display_value` from node data, honouring the canonical
 * priority: top-level `display_value` (CEE wire shape, see
 * golden-path-staging-2026-04-05.json) THEN `observedState.display_value`
 * (legacy / in-flight shapes). Single source of truth so every consumer
 * (factorDisplayText below, OptionNode's binary baseline label) shares one
 * priority rule instead of re-implementing it. Returns undefined when neither
 * is a non-empty string.
 */
export function readFactorDisplayValue(
  data: Record<string, unknown> | null | undefined,
): string | undefined {
  if (!data || typeof data !== 'object') return undefined
  const observedState = data.observedState as Record<string, unknown> | undefined
  const v = (data.display_value as unknown) ?? observedState?.display_value
  // Empty string → undefined so the helper matches its "non-empty" contract.
  // Behaviour-preserving: every caller already treats '' as falsy, and
  // factorDisplayText's `?? null` makes null/'' identical to the formatter's
  // `display_value != null && display_value !== ''` gate.
  return typeof v === 'string' && v !== '' ? v : undefined
}

/**
 * Render the CEE-canonical factor display text for a node's data.
 *
 * Shared entry point for BOTH graph (FactorNode), inspector-v2 factor panels,
 * AND the debug bundle's renderFactorDisplayState — guarantees they use the
 * identical priority chain (see `FactorDisplayInput.display_value` for the
 * full priority order).
 *
 * Accepts the raw `node.data` shape (with `observedState` and `category`) and
 * returns a string suitable for direct display, or null if no meaningful text
 * can be produced. Callers decide whether to render anything on null.
 */
export function factorDisplayText(
  data: Record<string, unknown> | null | undefined,
  fallbackLabel?: string,
): string | null {
  const input = factorDisplayInputFromData(data, fallbackLabel)
  return input === null ? null : formatFactorDisplayValue(input)
}

/**
 * The ONE read of node data into the formatter's input, shared by
 * `factorDisplayText` and `factorDisplayParts` so the string and its split can
 * never be computed from two different readings of the same node.
 */
function factorDisplayInputFromData(
  data: Record<string, unknown> | null | undefined,
  fallbackLabel?: string,
): FactorDisplayInput | null {
  if (!data || typeof data !== 'object') return null
  const label = (data.label as string | undefined) ?? fallbackLabel ?? ''
  const observedState = (data.observedState as Record<string, unknown> | undefined) ?? undefined
  const category = (data.category as string | undefined) ?? null
  const unit = observedState?.unit as string | null | undefined
  // Defensive unwrap: `value` / `raw_value` can be compound `{ value, unit }`
  // objects from legacy or wrapped shapes. Coercing to string would produce
  // "[object Object]". unwrapInterventionValue handles both plain numbers and
  // wrapped forms and returns null when the input cannot resolve.
  const rawValueUnwrapped = unwrapInterventionValue(observedState?.raw_value).value
  const valueUnwrapped = unwrapInterventionValue(observedState?.value).value
  // raw_value is allowed to be a string (e.g. "£49"), so preserve strings as-is.
  const rawValueForFormatter: number | string | null =
    rawValueUnwrapped ??
    (typeof observedState?.raw_value === 'string' ? (observedState!.raw_value as string) : null)
  // `display_value` may arrive at either top level (CEE wire shape) or inside
  // observedState. Shared priority via readFactorDisplayValue (top-level →
  // observedState); `?? null` preserves this function's prior null contract.
  const displayValue = readFactorDisplayValue(data) ?? null
  return {
    label,
    value: valueUnwrapped,
    raw_value: rawValueForFormatter,
    unit: unit ?? null,
    factor_type: (observedState?.factor_type as string | null | undefined) ?? null,
    cap: unwrapInterventionValue(observedState?.cap).value,
    value_source: (observedState?.source as string | null | undefined) ?? null,
    // ⭐ Read from the TOP LEVEL, never from `observedState`. The canonical
    // observed state is the persisted model; an unacknowledged keystroke is not
    // part of it and must never be written there (see
    // `conversation/pendingFactorEdit`). The card passes it in alongside the
    // node data, so this projection stays the single owner of the decision.
    pending_user_value:
      typeof data.pending_user_value === 'number' ? (data.pending_user_value as number) : null,
    category,
    display_value: displayValue,
    // Top-level on node data (`mapDraftNodeToCanvas` spreads the wire node's
    // remaining keys verbatim), NOT inside observed_state.
    encoding_map: data.encoding_map,
  }
}

/**
 * A factor value split into the FIGURE and its UNIT WORD, for the card's
 * contract §02 anatomy: `<strong>` figure at weight 610, the unit as a separate
 * smaller, muted, regular-weight span.
 *
 * `unit` is `null` when the unit is written INTO the figure (`£49`, `CHF 500`,
 * `45%`): the currency mark and the percent sign are how the amount is
 * written, not a unit word beside it (contract fixture: `<strong>£49</strong>`,
 * `<strong>8%</strong>`). When `unit` is present the two are joined by exactly
 * one space, which is the formatter's own spacing (`1,200 customers`).
 */
export interface FactorDisplayParts {
  figure: string
  unit: string | null
}

/** The visible text of a split — byte-identical to the unsplit string. */
export function joinFactorDisplayParts(parts: FactorDisplayParts): string {
  return parts.unit === null ? parts.figure : `${parts.figure} ${parts.unit}`
}

/**
 * ⭐ THE SAME VALUE AS `formatFactorDisplayValue`, SPLIT — OR `null`.
 *
 * Returns a split ONLY when the formatter's string was COMPOSED here from a raw
 * NUMBER plus a known real-world unit (Pattern 1: currency symbol, ISO code,
 * percent, or a unit word). Everything else returns `null` and the caller keeps
 * rendering the one string exactly as today:
 *   · a producer `display_value` (CEE's own text) — it cannot be split
 *     reliably, and splitting it would mean parsing a unit out of prose;
 *   · a placeholder unit (`scale`, `index`, …) — no unit is shown at all;
 *   · a non-numeric `raw_value` string, the cost-at-zero sentence, the binary
 *     "No X in place" heuristic and every other branch.
 *
 * ⛔ IT NEVER PARSES OR INVENTS A UNIT and never substitutes a figure: the
 * unit is the node's own `unit` (canonicalised by the shared `classifyUnit`,
 * exactly as Pattern 1 prints it), and the split is returned ONLY if joining it
 * reproduces `formatFactorDisplayValue(input)` BYTE FOR BYTE. If the formatter
 * ever changes, the split stops firing and the card falls back to the one
 * string — it can never show different text from every other surface.
 */
export function formatFactorDisplayParts(input: FactorDisplayInput): FactorDisplayParts | null {
  const text = formatFactorDisplayValue(input)
  if (text === null) return null
  const { raw_value, unit } = input
  // Built from a raw NUMBER. A string `raw_value` is the producer's text.
  if (typeof raw_value !== 'number' || !Number.isFinite(raw_value)) return null
  if (!unit) return null
  const { kind, canonical } = classifyUnit(unit)
  const amount = formatNumber(raw_value)
  let parts: FactorDisplayParts
  if (kind === 'symbol') parts = { figure: `${canonical}${amount}`, unit: null }
  else if (kind === 'iso') parts = { figure: `${canonical} ${amount}`, unit: null }
  else if (kind === 'percent') {
    // Pattern 1's own 0–1 rule; the byte check below binds it to the original.
    const scaled = raw_value > 0 && raw_value < 1 ? raw_value * 100 : raw_value
    parts = { figure: `${Math.round(scaled)}%`, unit: null }
  } else if (kind === 'other') parts = { figure: amount, unit: canonical || unit }
  else return null
  return joinFactorDisplayParts(parts) === text ? parts : null
}

/**
 * `factorDisplayText`, split — the same node-data read, the same string, or
 * `null` wherever `formatFactorDisplayParts` declines. See that function.
 */
export function factorDisplayParts(
  data: Record<string, unknown> | null | undefined,
  fallbackLabel?: string,
): FactorDisplayParts | null {
  const input = factorDisplayInputFromData(data, fallbackLabel)
  return input === null ? null : formatFactorDisplayParts(input)
}

/**
 * ⭐⭐ WHAT THE NUMBER MEANS, WHEN THE PRODUCER HAS ALREADY SAID SO.
 *
 * THE DEFECT. A binary or stepped factor arrives with an `encoding_map` — the
 * producer's own statement of what each level means — and a `display_value`
 * composed in the language of MAGNITUDE. Measured across the four committed
 * starter captures: 10 of 87 nodes carry an `encoding_map`, and the card
 * rendered the magnitude word every time.
 *
 *   Germany Market Entry      "Low (0)"        map: 0 = "Not pursued"
 *   Segment Platform Adoption "Low (0)"        map: 0 = "Not adopted"
 *   Account Executives Added  "Low (0)"        map: 0   = "No AEs added",
 *                                                   0.5 = "Two AEs added"
 *
 * ⛔ THESE ARE NOT VAGUE, THEY ARE WRONG. "Low" is not a small amount of
 * market entry; the market entry is NOT PURSUED. "Low (0)" for headcount means
 * zero people, which the map says in words the reader can act on. A magnitude
 * word applied to a categorical scale is a category error, and it reads as a
 * finding.
 *
 * ⚠ MEASURED REACH, NOT THE WHOLE SET: 9 of the 10 resolve. The tenth is
 * `GDPR EU Data Residency Compliance`, which carries `value: 0.5` against its
 * own binary map {0 = "Non-compliant", 1 = "Fully compliant"} — so the
 * producer contradicts itself, and this returns `null` and leaves the card
 * exactly as it was. That case needs a producer fix, not a consumer guess, and
 * it is reported rather than papered over. The one input this cannot answer
 * honestly is the one it declines to answer.
 *
 * ⚠ WHY THIS OUTRANKS `display_value` RATHER THAN DEFERRING TO IT — this
 * module already settled the principle, at ROADMAP 2.1003: *"A denormalised
 * string that contradicts the value the analysis is actually computing on is
 * not a 'contextual override', it is a lie about the user's model."* The same
 * holds one field over. The producer sent BOTH the truth and a bad summary of
 * it; the truth is the node's own data and wins.
 *
 * ⛔ AND IT NEVER INTERPOLATES. A value that matches no key returns `null` and
 * falls through to the existing chain. A stepped map of {0, 0.5, 1} says
 * nothing whatsoever about 0.3, and inventing "between two and four" from two
 * neighbouring labels would be exactly the fabrication the rest of this file
 * exists to refuse. Exact numeric match or nothing.
 *
 * Keys are compared NUMERICALLY, not as strings: the captures carry `"1.0"`
 * and `"0.5"` alongside `"0"`, so `"1.0" === String(1)` would miss.
 */
export function encodingMapPhrase(
  encodingMap: unknown,
  value: number | null | undefined,
): string | null {
  // ⚠ `Number.isFinite` here is DEFENSIVE AND DEMONSTRABLY NOT LOAD-BEARING,
  // recorded rather than claimed: a mutant dropping it SURVIVED, and the
  // reason is that the key comparison below already excludes NaN and
  // Infinity — `finiteKey !== NaN` is true for every key, and no key can
  // itself be non-finite because `Number.isFinite(numericKey)` filters it.
  // So no input exists for which this line changes the result. It stays
  // because it states the precondition where a reader looks for it; it is
  // NOT covered by a test, and nobody should believe it is.
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  if (!encodingMap || typeof encodingMap !== 'object' || Array.isArray(encodingMap)) return null
  for (const [key, phrase] of Object.entries(encodingMap as Record<string, unknown>)) {
    const numericKey = Number(key)
    if (!Number.isFinite(numericKey) || numericKey !== value) continue
    // The schema admits `string | number`. A NUMBER is not a phrase — it is a
    // second encoding, and printing it would swap one bare number for another.
    if (typeof phrase === 'string' && phrase.trim() !== '') return phrase.trim()
  }
  return null
}

/**
 * Is this `display_value` a MAGNITUDE SUMMARY of the node's own number, rather
 * than contextual copy?
 *
 * The producer composes two very different strings into one field. A summary
 * restates the model-scale value it is summarising — `"Low (0)"`,
 * `"Moderate (0.5)"`, `"Very high (0.8)"` — so the parenthesised figure EQUALS
 * `value`. Contextual copy — `"No acquisition pursued"`, `"No dedicated tech
 * lead"` — carries no such figure.
 *
 * ⭐ STRUCTURAL, NOT SEMANTIC, AND THAT IS THE WHOLE POINT. It asks whether a
 * number the node already holds is restated in the string. It does not ask what
 * the words mean, does not hold a list of band words, and cannot drift as copy
 * changes. An absent `display_value` is not a summary.
 */
function displayValueRestatesValue(displayValue: string | null | undefined, value: number | null | undefined): boolean {
  if (typeof displayValue !== 'string' || typeof value !== 'number' || !Number.isFinite(value)) return false
  const parenthesised = /\(\s*(-?\d+(?:\.\d+)?)\s*\)/.exec(displayValue)
  if (parenthesised !== null) return Number(parenthesised[1]) === value
  // ⭐ SECOND SURFACE FORM OF THE SAME SUMMARY, and it must be recognised here
  // or the encoding map silently loses to it. `"0 scale"` restates the node's
  // own number just as `"Low (0)"` does — it simply spells the scale instead of
  // naming a band. Independent review found the consequence: with
  // `encoding_map {0: "Not pursued"}`, a rule reading `"0 scale"` before this
  // one returned a MAGNITUDE for a categorical state, which is precisely the
  // category error `encodingMapPhrase` above exists to refuse.
  const bare = BARE_MAGNITUDE_SUMMARY.exec(displayValue)
  if (bare === null) return false
  if (classifyUnit(bare[2]).kind !== 'placeholder') return false
  return Number(bare[1].replace(/,/g, '')) === value
}

/**
 * ⭐⭐ A PLACEHOLDER UNIT SPELLED INTO `display_value` — THE THIRD PATH.
 *
 * THE DEFECT, on the founder's own board (debug bundle
 * `olumi-debug-b3d5806d-20260919`, `client_build: fd65f971`): a `scale`-dominated
 * graph — 54 raw occurrences over 8 distinct values — whose factor cards read
 * `0.3 scale est.` and `0.5 scale est.` on their faces. *"Things like a 0.4
 * ratio aren't something that most onboarding users will understand."*
 *
 * ⭐ WHY TWO CORRECT GUARDS DID NOT CATCH IT, which is the only interesting part.
 * `scale` is in `GENERIC_PLACEHOLDER_UNITS`, and this module already suppresses
 * it on BOTH numeric paths — Pattern 1 skips placeholder units outright, Pattern 2
 * calls them `isMeaningless` and returns `null`. Measured at this tip by rendering
 * `FactorNode` with `{ value: 0.3, unit: 'scale' }` and no `display_value`: the
 * card body is EMPTY. Both gates hold.
 *
 * They guard what this module COMPOSES. Nothing guarded what it FORWARDS. The
 * `display_value` passthrough below returns the producer's string verbatim, and
 * its docblock justifies that with CONTEXTUAL PROSE ("No dedicated tech lead") —
 * it never contemplated a magnitude summary wearing a placeholder unit. So the
 * header's promise, *"Never returns generic placeholders"*, was true of every
 * string this module builds and false of the one it passes on.
 *
 * That is trap 21's shape: one predicate answering *"may I compose this?"* while
 * no predicate answered *"may I forward this?"*. Two authorities, different
 * questions, and the gap between them is what the user reads.
 *
 * ⛔⛔ IT SUPPRESSES. IT DOES NOT BAND — AND THE FIRST VERSION OF THIS FIX DID,
 * WHICH WAS WRONG. It mapped the number to a qualitative word ("0.3 scale" →
 * "Low"). Independent review refused it, on this module's OWN ruling: naming
 * `scale` a defined PLACEHOLDER does not define what "Low" MEANS. The
 * consequential case it derived — `value: 0`, `display_value: "0 scale"`,
 * `encoding_map {0: "Not pursued", 1: "Pursued"}` — resolved to "Very low",
 * manufacturing a magnitude for a categorical state, the exact category error
 * `encodingMapPhrase` above was written to refuse. Both halves are fixed:
 * `displayValueRestatesValue` now recognises this surface form, so the declared
 * encoding wins wherever one exists; and where none does, the treatment is the
 * one the other two paths already give an uncalibrated placeholder — nothing.
 *
 * ⛔ NARROW BY CONSTRUCTION, AND THE NARROWNESS IS THE DESIGN:
 *   · the unit word is classified through the shared `classifyUnit`, never a
 *     local list — a unit added to `GENERIC_PLACEHOLDER_UNITS` is covered here
 *     the same day, and nothing else can ever match;
 *   · `ratio` is NOT a placeholder (it is a proportion unit) and is untouched.
 *     Its frame is an open producer question and it renders exactly as today;
 *   · the whole string must be `<number> <single word>`. Prose, ranges,
 *     parenthesised summaries ("Moderate (0.5)"), real units ("42 days") and
 *     bare numbers all fail to match and keep today's behaviour byte-for-byte;
 *   · no number is rounded, rescaled or invented anywhere on this path. The
 *     stored value is untouched; only an unreadable RENDERING is withheld.
 *
 * @returns `true` when the string is a magnitude summary wearing a placeholder
 *          unit and must not be shown as it stands.
 */
/**
 * ⚠⚠ THE SUFFIX CLASS WAS `[A-Za-z]+` AND THAT SILENTLY EXCLUDED THE UNIT THIS
 * RULE WAS EXTENDED FOR. `unit_interval` contains an underscore, so
 * `"0.15 unit_interval"` did not match, the forwarding branch returned the
 * producer's string verbatim, and the founder's card went on printing
 * `0.15 unit_interval est.` **after the PR that added that spelling to
 * `GENERIC_PLACEHOLDER_UNITS`.** Classification succeeded; the formatter never
 * asked it. Found by independent review, not by the corpus written to prevent
 * exactly this — that corpus exercised the CLASSIFIER and shared the
 * FORMATTER's blind spot (CLAUDE.md trap 13d: a corpus that shares the code's
 * blind spot cannot see the code's defect).
 *
 * ⭐ THE CLASS NOW MATCHES WHAT `classifyUnit` CAN ACCEPT — letters, plus the
 * inner separators a producer uses for a multi-word unit (`unit_interval`,
 * `unit interval`, `unit-interval`). It is still anchored, still requires a
 * leading number and a single trailing token, and `classifyUnit` remains the
 * only thing that decides whether the token is a placeholder — so widening the
 * SHAPE cannot widen the POLICY.
 */
const BARE_MAGNITUDE_SUMMARY = /^\s*([-+]?\d[\d,]*(?:\.\d+)?)\s+([A-Za-z][A-Za-z_\- ]*[A-Za-z]|[A-Za-z])\s*$/

/**
 * The producer's own figure, with the false unit removed — or `null` when this
 * is not that shape.
 *
 * ⭐⭐ WHY THE NUMBER SURVIVES AND ONLY THE UNIT GOES. The first version of this
 * fix returned `null` and blanked the card. That was wrong, and this module had
 * already said so: ROADMAP 2.1003 below is a whole paragraph about the same
 * mistake — *"without it, suppressing the lie renders BLANK … the user went
 * from a wrong '20%' to nothing. Killing the symptom while never measuring the
 * outcome (what the user actually sees) is the defect class this lane exists to
 * stop."* I killed "0.3 scale" and shipped exactly the blank it warns about.
 *
 * ⚠ AND THE OUTCOME IS WORSE THAN AN EMPTY LINE, which is the part that decides
 * it. `FactorNode.tsx:928` gates the value and the `est.` marker on ONE
 * condition — `valueDisplay !== null`. Blank the value and the marker goes with
 * it, so the card no longer discloses that the figure was INFERRED at all. The
 * user cannot challenge an assumption they cannot see, and this product's whole
 * claim is that they remain the author. Measured on nine of the founder's
 * boards from 19 Sep: 47 of 133 display values are this shape, so a third of
 * his factor cards silently stopped admitting they were guesses.
 *
 * ⛔ IT STILL INVENTS NOTHING, which is the constraint independent review
 * imposed and it is unchanged: no band, no tier, no qualitative word, no
 * rescaling, no rounding. `0.3 scale` renders `0.3` — the producer's own
 * figure, minus a unit word that asserts a scale nobody defined. The estate's
 * existing policy for a placeholder unit says exactly this: drop the unit,
 * keep the number, *"because placeholder units carry no real-world scale, so
 * '0 score' / '50 index' are misleading"*.
 *
 * ⚠ A DECLARED `encoding_map` STILL WINS, above this line. Nothing here reaches
 * a factor whose producer stated what its levels mean.
 *
 * Exported, unchanged, for the option change row (contract v3.1 pt 7, gap U12:
 * "0.3 scale → 0.85 scale est."), so one rule strips the word on both cards.
 */
export function placeholderMagnitudeNumber(displayValue: string): string | null {
  const m = BARE_MAGNITUDE_SUMMARY.exec(displayValue)
  if (m === null) return null
  // Shared classifier — never a local unit list (the hand-maintained mirror).
  if (classifyUnit(m[2]).kind !== 'placeholder') return null
  const n = Number(m[1].replace(/,/g, ''))
  if (!Number.isFinite(n)) return null
  // The producer's own text for the figure, not a re-rendering of it: reaching
  // for `value` here would silently change WHICH number is being shown.
  return m[1]
}

export function formatFactorDisplayValue(input: FactorDisplayInput): string | null {
  const { label, value, raw_value, unit, factor_type, category, display_value } = input

  // External factors with no data: no body text (dashed border is the signal)
  if (category === 'external' && (value == null && raw_value == null)) {
    return null
  }

  // Priority order (V5 stale-value-protection fix, May 2026):
  //   1. Pattern 1: raw_value + meaningful unit  ← outranks display_value
  //   2. display_value                          ← contextual override
  //   3. raw_value without unit (numeric fallback formatter)
  //   4. Pattern 2: value-only binary heuristic
  //
  // Only Pattern 1 (fresh raw_value + meaningful unit such as £, %, …) is
  // permitted to outrank a CEE-authored display_value. The motivation is
  // stale-value protection: a CEE-authored display_value can lag behind a
  // user edit to observed_state (e.g. user changes raw_value to 26000 but
  // the old display_value "£20,000" is still on the node) — when a fresh
  // real-world raw_value + unit pair is present, that wins.
  //
  // display_value still outranks the unitless-raw fallback below so the
  // golden-fixture case `raw_value: 0, no unit, display_value:
  // "No acquisition pursued"` continues to render the contextual text
  // rather than the bare number "0". Unitless raw_value carries no
  // human-meaningful magnitude on its own — there's nothing "fresh and
  // real-world" about it the way £26,000 is — so display_value is the
  // safer choice when both are present.

  // Pattern 1: raw_value + unit → formatted display
  // Graph v2 fix: when unit is a generic placeholder (scale, index, score, …),
  // raw_value is just the denormalised normalised value (value × cap) — not a
  // real-world measurement. Skip Pattern 1 entirely so Pattern 2 can apply
  // the binary heuristic or return null (suppression).
  const { kind: unitKind, canonical: unitCanonical } = unit
    ? classifyUnit(unit)
    : { kind: null as null, canonical: '' }
  // ⭐⭐ A VALUE THE USER STATED IS NEVER A DENORMALISED GUESS, so the skip
  // above does not apply to it. See `value_source` on the input type for the
  // measurement: the founder stated 4 on a `scale` factor with no cap, and the
  // card rendered nothing. The product may decline to assert its OWN estimate;
  // it may not hide his.
  /**
   * ⚠⚠ ENUMERATE THE MEMBERS. This read `'user' || 'user_confirmed'` and MISSED
   * `'user_override'` — which is the literal `USER_VALUE_STAMP` writes
   * (`valueProvenance.ts`: `USER_VALUE_STAMP = { source: 'user_override' }`,
   * classified `user_override: 'edited'`, i.e. the person typed it). So the one
   * spelling produced by a LOCAL user edit was the one the rescue could not see,
   * and every local-only factor value edit on an unanchored `scale` factor
   * rendered a blank card — the exact defect the docblock above this describes
   * and was written to fix. Two of three limbs covered is how a predicate over a
   * small enum passes review: the missing member is invisible in the diff.
   *
   * Witnessed 21 Sep 2026, headed, with `orchestratorV2` off: the value wrote
   * `source: "user_override"` and the card still showed nothing.
   */
  const userStatedThisValue =
    input.value_source === 'user'
    || input.value_source === 'user_confirmed'
    || input.value_source === 'user_override'
  /**
   * ⭐ THE SAME VISIBILITY RULE, ONE STATE EARLIER — and deliberately a separate
   * name from `userStatedThisValue` rather than another arm of it.
   *
   * `userStatedThisValue` answers *"who is on record as stating this?"*. This
   * answers *"is a person watching a number they just typed?"*. They coincide
   * on the visibility decision and differ on every provenance claim, so fusing
   * them into one predicate would be exactly the trap this file's own
   * `value_source` docblock names.
   *
   * ⚠ Bound to the number being formatted, never merely to the node.
   */
  const pendingUserValueIsThisNumber =
    typeof input.pending_user_value === 'number'
    && typeof value === 'number'
    && input.pending_user_value === value
  /** The person's own number, acknowledged or not. Visibility only. */
  const doNotHideThePersonsNumber = userStatedThisValue || pendingUserValueIsThisNumber

  /**
   * ⛔⛔ THE RESCUE FIRES ONLY WHERE NOTHING HAS ALREADY BEEN SAID — AND THE
   * FIRST VERSION OF IT DID NOT, WHICH DELETED MEANING A PRODUCER HAD DECLARED.
   *
   * Pattern 1 sits ABOVE `display_value` and above `encoding_map` in the
   * precedence documented at :427. Opening it to a PLACEHOLDER unit therefore
   * jumped the whole ladder, and a value the producer had already given words to
   * lost them the moment the user confirmed it:
   *
   *   {display_value:"0 scale", encoding_map:{"0":"Not pursued"},
   *    observedState:{value:0, raw_value:0, unit:"scale", source:"user_confirmed"}}
   *     → "0"   instead of   "Not pursued"
   *
   * ⭐ AND THE PREMISE STILL HOLDS, WHICH IS WHY THIS NARROWS RATHER THAN
   * REVERTS. The rescue exists because *"the product may decline to assert its
   * OWN estimate; it may not hide his"*. **A declared `encoding_map` is not a
   * hidden value — it IS that value, said in words.** Replacing it with a bare
   * digit is the same loss the rescue was written to prevent, pointed the other
   * way. The founder's UNMAPPED `4 scale` has no such declaration and still
   * renders; that case is the positive control in the spec, because a narrowing
   * that swallowed it would pass every other assertion.
   *
   * ⚠ BOTH LIMBS REUSE THE DOWNSTREAM OWNERS — `encodingMapPhrase` and
   * `placeholderMagnitudeNumber` — rather than restating their rules. A
   * second copy agrees on the day it is written and drifts after (trap 12), and
   * the copy here would decide the OPPOSITE branch from the original, so the
   * drift would be silent in both directions.
   *
   * ⚠⚠ THE OWNER WAS RENAMED UNDER THIS BRANCH, AND ONLY THE INTEGRATION SAW IT.
   * Staging replaced the boolean `isPlaceholderMagnitudeSummary` with
   * `placeholderMagnitudeNumber`, which returns the producer's own figure or
   * `null`. This line still called the removed name: TS2552 at typecheck and a
   * ReferenceError in the unit shard, neither visible on the branch alone.
   *
   * ⚠ `=== null` RATHER THAN FALSINESS, AND THE REASON IS NOT THE ONE THIS
   * BLOCK FIRST GAVE. It claimed `!placeholderMagnitudeNumber(...)` would flip
   * the branch on `"0 scale"`. **That is false and a mutant proved it**:
   * substituting the falsy test left all 36 cases green, because the function
   * returns the figure as TEXT and `"0"` is truthy. Executed against the regex,
   * group 1 is `[-+]?\d[\d,]*(?:\.\d+)?` — it cannot match empty — so every
   * return is `null` or a non-empty string and the two forms are EQUIVALENT.
   * An equivalent mutant has to be demonstrated, never asserted (CLAUDE.md
   * trap 13c), and this one is. `=== null` stays because it states the
   * function's contract instead of relying on a coincidence of JS truthiness,
   * but it is a legibility choice and nothing here depends on it.
   */
  const placeholderMeaningAlreadyDeclared =
    unitKind === 'placeholder'
    && (encodingMapPhrase(input.encoding_map, value) !== null
      || (display_value != null
        && display_value !== ''
        && placeholderMagnitudeNumber(display_value) === null))

  if (
    raw_value != null
    && unit
    && (unitKind !== 'placeholder' || (doNotHideThePersonsNumber && !placeholderMeaningAlreadyDeclared))
  ) {
    const numericRaw = typeof raw_value === 'number' ? raw_value : Number(raw_value)
    if (!isNaN(numericRaw)) {
      // Cost factor at zero → contextual
      if (numericRaw === 0 && factor_type?.toLowerCase() === 'cost') {
        return 'No cost allocated'
      }
      // Polish 4 review follow-up: classifyUnit handles symbol/ISO/%/other
      // with case + whitespace normalisation. 'CHF' now renders as the
      // ISO-style prefix "CHF 500" instead of the old suffix "500 CHF".
      // ⚠ A PLACEHOLDER UNIT STILL PRINTS NO UNIT WORD, only the figure. The
      // word asserts a scale nobody defined; the figure is the person's own.
      // Reached only when `doNotHideThePersonsNumber` opened the gate above.
      if (unitKind === 'placeholder') {
        return formatNumber(numericRaw)
      }
      if (unitKind === 'symbol') {
        return `${unitCanonical}${formatNumber(numericRaw)}`
      }
      if (unitKind === 'iso') {
        return `${unitCanonical} ${formatNumber(numericRaw)}`
      }
      if (unitKind === 'percent') {
        // 0–1 ratio handling: when raw_value is strictly between 0 and 1 we
        // treat it as a probability/ratio and scale by 100 (0.25 → "25%").
        // raw_value === 0 stays "0%". raw_value >= 1 is treated as already in
        // percentage points (25 → "25%"). Deterministic by design — do NOT
        // revert to a bare Math.round, which produces "0%" for 0.25 and was
        // the source of the V5 value-display bug.
        const scaled = numericRaw > 0 && numericRaw < 1 ? numericRaw * 100 : numericRaw
        return `${Math.round(scaled)}%`
      }
      // 'other' | 'none' (unreachable here — unit is truthy)
      return `${formatNumber(numericRaw)} ${unitCanonical || unit}`
    }
    // raw_value is a non-numeric string with unit
    return `${raw_value} ${unit}`
  }

  // CEE-provided display_value: contextual override when Pattern 1 didn't
  // apply (no raw_value, no unit, or only a placeholder unit). Returned
  // verbatim so CEE-authored contextual text (e.g. "No dedicated tech lead",
  // "No acquisition pursued") surfaces instead of a bare number like "0".
  // Previously sat at the top of the function with absolute priority —
  // moved here so a stale display_value cannot mask a fresh raw_value +
  // meaningful unit (Pattern 1), but still beats the unitless-raw numeric
  // fallback below and the value-only heuristic that follows.
  //
  // ROADMAP 2.1003 — …UNLESS THE NODE'S OWN NUMBERS SAY IT IS WRONG.
  // A denormalised string that contradicts the value the analysis is actually
  // computing on is not a "contextual override", it is a lie about the user's
  // model. Measured live: `display_value = "20%"` beside
  // `observed_state.value = 40`, rendered as 20% on the canvas immediately and
  // after reload while the rerun used 40 and flipped the leading option.
  // ⭐ THE PRODUCER'S OWN MEANING, ABOVE ITS OWN SUMMARY. See
  // `encodingMapPhrase` for why this outranks `display_value` and why it
  // never interpolates. Below Pattern 1 deliberately: a real-world magnitude
  // (£26,000) is a measurement, and where one exists the map adds nothing.
  // ⛔ NARROWED, AND CI NARROWED IT. The first version preferred the map
  // UNCONDITIONALLY, on the premise that the producer had sent "the truth and a
  // bad summary of it". That premise is too broad and the golden fixture proved
  // it: `fac_acquisition` carries `display_value: "No acquisition pursued"`
  // beside `encoding_map {0: "Not pursued"}`, and the CEE-authored sentence is
  // BETTER — it names the subject, where the map's phrase loses it.
  //
  // So the map only wins where `display_value` is a MAGNITUDE SUMMARY, and that
  // is decided STRUCTURALLY rather than by judging prose: the summary restates
  // this node's own model-scale number in parentheses ("Low (0)",
  // "Moderate (0.5)"), so a parenthesised figure EQUAL to `value` is what marks
  // it. Contextual copy carries no such figure and keeps its place.
  //
  // ⚠ Deliberately NOT a predicate over language. This lane closed a PR earlier
  // today for exactly that: an unwitnessed natural-language rule with no corpus,
  // where two opposite harms shared one condition. A number that must equal a
  // number the node already holds is checkable and cannot drift.
  const encoded = encodingMapPhrase(input.encoding_map, value)
  if (encoded !== null && displayValueRestatesValue(display_value, value)) return encoded

  const displayValueContradicted =
    display_value != null
    && display_value !== ''
    && isDisplayValueContradicted(display_value, { value, raw_value })

  if (display_value != null && display_value !== '' && !displayValueContradicted) {
    // ⭐ THE FORWARDING GATE. Everything above decides whether this string may be
    // TRUSTED; this decides whether it may be SHOWN AS IT STANDS. A magnitude
    // summary wearing a placeholder unit ("0.3 scale") is the one shape the
    // module's own header forbids it to return — so the UNIT goes and the
    // producer's own figure stays. See `placeholderMagnitudeNumber` for why
    // blanking it was worse than the lie: the `est.` marker rides the same
    // condition, so a blank card stops admitting the value was inferred.
    // By this line any declared `encoding_map` has already won.
    const withoutFalseUnit = placeholderMagnitudeNumber(display_value)
    if (withoutFalseUnit !== null) return withoutFalseUnit
    return display_value
  }

  // ROADMAP 2.1003 — RECOVERY AFTER INVALIDATION. **Do not delete this without
  // reading the next paragraph: without it, suppressing the lie renders BLANK.**
  //
  // MEASURED: with the exact audit fixture (`value: 40, raw_value: null,
  // unit: '%', display_value: '20%'`) the invalidated string fell through to
  // Pattern 2, whose non-binary branch returns `null` — so the factor node got
  // NO BODY TEXT AT ALL. The user went from a wrong "20%" to nothing. Killing
  // the symptom (the wrong number) while never measuring the outcome (what the
  // user actually sees) is the defect class this lane exists to stop.
  //
  // WHY `raw_value` IS ABSENT IN THAT FIXTURE, and why this is one defect and
  // not two: CEE's value applier updates `observed_state.value` and leaves
  // `raw_value` behind (ROADMAP 2.1033). The numeric branches below need
  // `raw_value`; it isn't there; so there is nothing left to render.
  //
  // ⚠ SCOPED TO WHAT CAN BE RENDERED HONESTLY — and the exclusions are the
  // point, not an oversight:
  //   · percent units — `value` maps deterministically to the shown
  //     percentage, using Pattern 1's own 0–1-vs-0–100 rule (reused, not
  //     re-implemented), so "40" and "0.4" both render "40%";
  //   · no unit at all — the bare committed number is exactly the truth;
  //   · EVERYTHING ELSE (currency, time, counts, ISO codes) returns nothing
  //     here and falls through. For those, `value` is a 0–1 figure normalised
  //     against `cap` and is NOT a real-world magnitude: rendering "£0.3" for
  //     a £30,000 factor would replace one lie with a worse one, and
  //     reconstructing `value × cap` would be inventing a number. Blank is the
  //     honest outcome there, and it is disclosed rather than papered over.
  // Gated on `displayValueContradicted` so it fires ONLY where we just
  // suppressed something — a node that simply never had a `display_value`
  // keeps today's behaviour byte-for-byte.
  if (displayValueContradicted && raw_value == null && value != null) {
    if (unitKind === 'percent') {
      const scaled = value > 0 && value < 1 ? value * 100 : value
      return `${Math.round(scaled)}%`
    }
    if (!unit) {
      return formatNumber(value)
    }
  }

  // raw_value without unit — numeric fallback formatter. Runs AFTER
  // display_value because a unitless raw_value carries no human-meaningful
  // magnitude on its own (no £, %, or count semantics), so CEE-authored
  // contextual text is preferable when present.
  if (raw_value != null && !unit) {
    const numericRaw = typeof raw_value === 'number' ? raw_value : Number(raw_value)
    if (!isNaN(numericRaw)) {
      return formatNumber(numericRaw)
    }
    return String(raw_value)
  }

  // Pattern 2: value only (no raw_value) → binary heuristic.
  // Also applies when raw_value is present but the unit is a generic placeholder
  // (scale, index, …) — the raw_value is just a denormalised normalised value
  // and carries no real-world meaning, so treat it as value-only.
  if (value != null && (raw_value == null || unitKind === 'placeholder')) {
    // Graph v1.1 polish 4 Task 1 + review feedback: when the unit is
    // meaningless ("scale" or undefined), a normalised value tells the user
    // nothing real. The contextual "No X in place" / "X active" text is only
    // honest when the user has explicitly tagged the factor as binary.
    // Otherwise — including the previous "qualitative factor_type" loophole —
    // suppress entirely so the dashed/amber border + StatusPill (or the
    // higher-fidelity Detailed view) carry the meaning.
    const isExplicitlyBinary = factor_type?.toLowerCase().trim() === 'binary'
    const factorTypeUnset = factor_type == null
    // A unit is "meaningless" for display purposes when it's null/empty, or
    // any generic placeholder (scale, index, score, norm, …). Uses unitKind
    // from classifyUnit so ALL placeholder units get the same gating.
    const isMeaningless = unit == null || unit.trim() === '' || unitKind === 'placeholder'
    // Graph v2 fix: when value === 0 and factor_type is not set, CEE likely
    // omitted factor_type for a binary factor (CEE-4 upstream issue). Treat
    // as binary-like zero and produce contextual "No X in place" text.
    // When factor_type IS set to something non-binary (e.g. 'continuous'),
    // suppress — the explicit type indicates this isn't binary.
    // ⭐ THE SAME RULE ON THE SECOND PATH. Pattern 1 covers a user-stated value
    // that arrives with a `raw_value`; this covers one that does not. Both
    // paths suppressed, so fixing one would have left the other hiding the
    // person's own number for a shape nobody would think to test.
    if (isMeaningless && !isExplicitlyBinary && doNotHideThePersonsNumber && typeof value === 'number') {
      return formatNumber(value)
    }
    if (isMeaningless && !isExplicitlyBinary) {
      if (value === 0 && factorTypeUnset) {
        const stripped = stripSuffixes(label).toLowerCase()
        return `No ${stripped} in place`
      }
      // NOTE: the value === 1 mirror case is deliberately NOT implemented yet.
      // If CEE starts providing binary factors with value=1 and no factor_type,
      // extend this heuristic to produce "[Label] in place" or "[Label] active".
      // Do not add a mismatched pattern (e.g. "No X" for 1) here without
      // considering both branches together.
      return null
    }
    const stripped = stripSuffixes(label).toLowerCase()
    if (value === 0) {
      return `No ${stripped} in place`
    }
    if (value === 1) {
      return `${stripped.charAt(0).toUpperCase()}${stripped.slice(1)} active`
    }
    // Non-binary numeric value (e.g. 0.42) with a real unit but no raw_value:
    // return null (no meaningful display).
    return null
  }

  // Pattern 3: no value at all → no body text
  return null
}
