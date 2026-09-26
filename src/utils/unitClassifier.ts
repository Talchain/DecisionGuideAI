/**
 * Unit classification — single source of truth.
 *
 * Moved here from `src/canvas/utils/labelUtils.ts` in Brief 5.7 close-out
 * follow-up so shared components (ScientificEditor, TriageCard) can consume
 * it without importing from the canvas layer. The canvas labelUtils.ts
 * re-exports these symbols for backward compatibility, keeping every
 * existing canvas import path stable while reversing the dependency
 * direction (canvas now depends on this neutral util, not the other way
 * round).
 *
 * Used by every value formatter that renders a numeric value with a unit:
 * canvas FactorNode/OptionNode, model-tab utils, shared ScientificEditor
 * and TriageCard, results ConfidenceSection, and `formatFactorDisplayValue`.
 */

/**
 * Generic placeholder units that should render as "scale" / "index" /
 * "score" labels rather than concrete units. Drives the qualitative-tier
 * branch in formatters.
 *
 * ⭐⭐ THE TEST IS WHETHER THE WORD NAMES A QUANTITY OR NAMES A RANGE. `months`
 * and `active leads` name a quantity — a reader knows what 5 of them is.
 * `scale`, `index` and `unit_interval` name a RANGE and say nothing about what
 * is being measured, so `0.15 unit_interval` tells a reader only that the
 * number is between nought and one, which they could already see.
 *
 * ⚠ `unit_interval` WAS MISSING AND IT IS LIVE — added 19 Sep 2026. Measured
 * across nine of the founder's own debug bundles from that day: **18
 * occurrences**, rendering on his factor cards as `0.15 unit_interval est.`
 * beside the `0.3 scale` this set already caught. It is the mathematical name
 * for [0,1] and is therefore the purest member of this set — more obviously a
 * placeholder than `unit`, which was already here.
 *
 * ⛔ `ratio` IS DELIBERATELY ABSENT and must stay absent. It classifies as a
 * PROPORTION unit, its frame is an open producer question (does a `ratio`
 * between 0 and 1 assert a percentage?), and independent review has ruled the
 * UI must not convert until that is answered. 27 occurrences on the same
 * boards. Adding it here would silently change what a quarter of his edges
 * claim.
 *
 * ⚠ THIS LIST NEEDS A COMPLETENESS CHECK THAT IS NOT DERIVED FROM IT
 * (CLAUDE.md trap 12d): deriving consumers from a list stops them drifting from
 * it, and can never notice the list is SHORT — which is exactly how
 * `unit_interval` survived. `unitClassifier.realUnitCorpus.spec.ts` holds a
 * corpus of units measured off real wire captures, with both directions
 * asserted, and is the only thing that can catch the next missing member.
 */
export const GENERIC_PLACEHOLDER_UNITS: ReadonlySet<string> = new Set([
  'scale', 'index', 'score', 'normalised', 'normalized', 'norm', 'unit', 'units',
  'unit_interval', 'unitinterval', 'unit interval',
])

/**
 * Currency glyphs that prefix the number with NO space (e.g. "£49", "$500").
 * Single-char symbols only. Multi-char ISO codes live in ISO_CURRENCY_CODES.
 */
export const CURRENCY_SYMBOLS: ReadonlySet<string> = new Set([
  '£', '$', '€', '¥', '₹', '₩', '₽', '฿', '₫', '₪', '₴', '₸', '₺', '₼', '₾',
])

/**
 * ISO currency codes that prefix the number WITH a space (e.g. "CHF 500",
 * "USD 1,200"). Single source of truth for both labelUtils and model-tab/utils.
 */
export const ISO_CURRENCY_CODES: ReadonlySet<string> = new Set([
  'USD', 'GBP', 'EUR', 'JPY', 'INR', 'KRW', 'RUB', 'TRY', 'UAH', 'NGN', 'VND', 'BTC',
  'CHF', 'CAD', 'AUD', 'NZD', 'HKD', 'SGD', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK',
  'HUF', 'RON', 'BGN', 'HRK', 'MXN', 'BRL', 'ARS', 'CLP', 'COP', 'PEN', 'ZAR',
  'EGP', 'AED', 'SAR', 'QAR', 'ILS', 'THB', 'MYR', 'IDR', 'PHP', 'PKR', 'BDT', 'LKR',
  // Non-standard labels that behave like ISO codes for display purposes.
  'kr', 'R$',
])

/**
 * UI-SEM-093 — percent-unit WORD recognition (and the ×100 it unlocks).
 *
 * ⚠ THE REAL FIX IS UPSTREAM, NOT HERE. CLAUDE.md: "UI is a passthrough for
 * display — it must not transform meaning… If you see incorrect data displayed,
 * the bug is upstream (PLoT or CEE), not in the UI." CEE emits
 * `goal_threshold_unit: 'percent'` where the rest of the estate uses the glyph
 * `'%'`; the durable answer is CEE/PLoT sending ONE spelling. This UI-side
 * recognition is the interim, and it is TAGGED and REGISTERED (CLAUDE.md
 * Semantic Transform Inventory) rather than added silently — which is what the
 * five copies it retires had all done.
 *
 * WHY IT IS A SEMANTIC TRANSFORM AND NOT MERE FORMATTING: most consumers of
 * `kind === 'percent'` only change the suffix ("20 percent" → "20%"), which is
 * formatting. But FOUR consumers additionally SCALE a 0–1 value by 100:
 * `labelUtils.ts` (formatInterventionValue, formatObservedValueWithUnit),
 * `formatFactorDisplayValue.ts`, and `FactorNode.tsx`'s prior-range line. So a
 * factor whose unit is the WORD `percent` and whose value is a normalised 0.2
 * changes from "0.2 percent" to "20%". That is the intent those branches already
 * document in prose ("Percent is the one exception: a 0–1 ratio converts to
 * percentage points (×100) with no cap at all") and could not reach, because the
 * classifier only matched the glyph. It is still a value transform, so it is
 * declared.
 *
 * WHY THE WORDS ARE HERE AND NOT IN SIX OTHER FILES (U2)
 * CEE spells the unit as the WORD — `goal_threshold_unit: 'percent'` — while
 * this classifier originally matched the glyph only (`trimmed === '%'`). Every
 * surface that needed the word therefore grew its own recogniser, and by
 * 26 Jul 2026 there were SIX, which had already drifted apart:
 *
 *   computeSuccessState.ts      'percent' | 'percentage'         (trim + lower)
 *   useResultsSectionData.ts    '%' | 'percent' | 'percentage'   (lower, no trim)
 *   GoalNode.tsx                '%' | 'percent' | 'percentage'   (lower, no trim)
 *   NodeInspector.tsx           '%' | 'percent' | 'percentage'   (lower, no trim)
 *   ComparisonCanvasLayout.tsx  '%' | 'percent' | 'percentage'   (exact case)
 *   v5GraphPatchDescription.ts  '%' | 'percent'  ← NO 'percentage'
 *
 * So a CEE `unit: 'percentage'` rendered "20%" on five surfaces and
 * "20 percentage" in the graph-patch receipt; `'Percent'` rendered as a
 * trailing suffix in the comparison layout and as "%" everywhere else. All six
 * are retired in favour of this set, guarded by
 * `src/utils/__tests__/percentWordSingleSource.spec.ts`, which also fails if a
 * surface reintroduces a local `'percentage'` literal.
 *
 * NOT included, deliberately: `'percentile'`, `'percentage points'` and
 * `'per cent'`. The first two are different units (a rank, and an absolute
 * difference) whose values must not be rendered with a `%` suffix; the third has
 * never appeared on the wire and would be a guess. All three are pinned as
 * negative controls in the spec above.
 */
const PERCENT_UNIT_SPELLINGS: ReadonlySet<string> = new Set(['%', 'percent', 'percentage'])

export type UnitClass = 'none' | 'symbol' | 'iso' | 'percent' | 'placeholder' | 'other'

/**
 * ⭐⭐ WHERE A UNIT GOES, SAID ONCE. Takes an ALREADY-FORMATTED figure.
 *
 * Placement and precision are two concerns, and every defect in this class came
 * from tangling them. Each caller owns how many digits its surface shows — the
 * threshold sentences cap at two decimals after `passes 0.361111%` shipped,
 * `formatValueWithUnit` uses significant digits, proportion units use four —
 * but NONE of them should own where the glyph sits. This function owns that,
 * and only that.
 *
 * ⛔ IT EXISTS BECAUSE THE RULE WAS RE-SPELLED AT EVERY SITE AND THE SITES
 * DISAGREED, on screen, on the same datum:
 *
 *   21 Sep, deployed `e6551858`, one Reasoning tab, eight inches apart:
 *     At-a-Glance        "Could change if Monthly Churn Rate passes 0.04%"   ✓
 *     the same threshold "would have to rise from %0.03 to %0.04"            ✗
 *
 *   and earlier, from the same class: "Customer demand passes index0.361111"
 *   and "Price increase for new customers passes 1".
 *
 * `glanceCondition`'s header had already named the cause — *"a rule that only
 * one of two threshold sites can reach is a rule this surface does not have"* —
 * and the fix at the time was to re-spell it at the second site, which is why
 * it came back a third time at the third.
 *
 * ⚠ A SYMBOL PREFIXES AND A PERCENT SUFFIXES, and neither is a style choice:
 * `£49` and `49%` are how the glyphs are read. An ISO code and a unit word take
 * a space (`USD 49`, `53.86 £/month`) because they are words, not glyphs.
 * `none` and `placeholder` render the bare figure — a placeholder NAMES a scale
 * rather than measuring in one, so printing it gives "0.36 index".
 */
export function applyUnitPlacement(figure: string, unit: string | null | undefined): string {
  const { kind, canonical } = classifyUnit(unit)
  if (kind === 'none' || kind === 'placeholder') return figure
  if (kind === 'symbol') return `${canonical}${figure}`
  if (kind === 'iso') return `${canonical} ${figure}`
  if (kind === 'percent') return `${figure}%`
  return `${figure} ${canonical}`
}

/**
 * ISO code → glyph, for the three codes whose glyph is unambiguous in this
 * product. Moved here unchanged from `formatFactorDisplayValue`'s
 * `CURRENCY_RATE_GLYPH` so the compact reading below and the factor card read
 * ONE map (the patch receipt's `CURRENCY_PREFIXES` maps the same three). Any
 * other code (`CHF`, `SEK`, …) keeps its code: a glyph this product has never
 * shown for it would be a guess.
 */
export const ISO_CURRENCY_GLYPHS: Readonly<Record<string, string>> = { GBP: '£', USD: '$', EUR: '€' }

/** A figure and the unit words printed after it (`null`: the unit is written into the figure). */
export interface CompactUnitParts {
  figure: string
  unit: string | null
}

/** `<head> per <period>` or `<head>/<period>` — a single-word period. */
const COMPOUND_RATE_UNIT = /^(.+?)(\s*\/\s*|\s+per\s+)([A-Za-z]+)$/i
/** `<head> out of <N>` — the head may be empty or a placeholder word. */
const OUT_OF_UNIT = /^(.*?)\s*\bout of\s+(\d[\d,]*(?:\.\d+)?)$/i

/**
 * ⭐⭐ THE COMPACT READING OF A VALUE WHOSE UNIT IS A COMPOUND — THE ONE OWNER
 * (canvas card values, DESIGN-GAP-v31 #9/#22, contract reference board:
 * "£49 per subscriber / month", "£20,000 / month").
 *
 * Measured on served `cd6a82e4` (26 Sep, Paul's pricing brief): the producer
 * carries `unit: "GBP per month"`, `"percent per month"`, `"index out of 100"`,
 * `"subscribers per month"` (and, on another board, `"£/month"`,
 * `"score out of 100"`). `classifyUnit` knows none of these compounds, so every
 * formatter printed them as a trailing WORD — "49 GBP per month", "7 percent per
 * month", "50 index out of 100" — and one option row ran "49 GBP per month → 59
 * GBP per month · brief" off the card's right edge.
 *
 * Takes an ALREADY-FORMATTED figure (like `applyUnitPlacement`) and returns it
 * placed against the compound unit, or `null` when the unit is not a compound
 * this recognises — the caller then prints exactly what it printed before:
 *   · `<currency> per|/ <period>` → `£49` + `/ month` (the glyph from
 *     `classifyUnit` or `ISO_CURRENCY_GLYPHS`; an ISO code with no glyph keeps
 *     its code, placed as `applyUnitPlacement` places it — `CHF 49`);
 *   · `percent per|/ <period>` → `7%` + `/ month`;
 *   · `<word> per <period>` → `20` + `subscribers / month`;
 *   · `[index|score] out of <N>` → `50` + `/ 100` (the placeholder word names no
 *     real-world scale — the estate's rule, `placeholderMagnitudeNumber`; the
 *     "out of 100" frame is kept).
 *
 * ⛔ IT NEVER CHANGES THE FIGURE'S DIGITS, NEVER SCALES, NEVER INVENTS A UNIT
 * AND NEVER DROPS A REAL ONE. `7 percent per month` reads `7% / month`, not
 * `700%`: the ×100 of the plain percent class is a declared semantic transform
 * (UI-SEM-093) and is NOT extended to compounds. Every word of the unit that
 * names a quantity survives; only its notation changes.
 *
 * ⚠ DELIBERATELY NARROW, and each narrowing is pinned:
 *   · a word head already written with a slash (`hours/week`) is left as it is —
 *     it is already compact, and re-spacing it changes no meaning;
 *   · a head that is itself compound (`GBP per subscriber per month`) is left;
 *   · a negative currency figure is left (`£-500` is not how a negative is
 *     written, and choosing a sign convention is not this function's call);
 *   · a placeholder head on a rate (`index per month`) is left.
 */
export function compactUnitParts(figure: string, unit: string | null | undefined): CompactUnitParts | null {
  if (unit == null) return null
  const trimmed = unit.trim()
  if (!trimmed) return null

  const outOf = OUT_OF_UNIT.exec(trimmed)
  if (outOf) {
    const headKind = classifyUnit(outOf[1]).kind
    if (headKind !== 'none' && headKind !== 'placeholder') return null
    return { figure, unit: `/ ${outOf[2]}` }
  }

  const rate = COMPOUND_RATE_UNIT.exec(trimmed)
  if (!rate) return null
  const head = rate[1].trim()
  const slashed = rate[2].includes('/')
  const period = rate[3]
  if (/\/|\bper\b/i.test(head)) return null
  const { kind, canonical } = classifyUnit(head)
  const negative = figure.trim().startsWith('-')
  if (kind === 'symbol') {
    if (negative) return null
    return { figure: `${canonical}${figure}`, unit: `/ ${period}` }
  }
  if (kind === 'iso') {
    if (negative) return null
    const glyph = ISO_CURRENCY_GLYPHS[canonical.toUpperCase()]
    if (glyph === undefined) return null
    return { figure: `${glyph}${figure}`, unit: `/ ${period}` }
  }
  if (kind === 'percent') return { figure: applyUnitPlacement(figure, head), unit: `/ ${period}` }
  if (kind === 'other' && !slashed) return { figure, unit: `${canonical} / ${period}` }
  return null
}

/** The visible text of `compactUnitParts` — figure and unit words joined by one space. */
export function joinCompactUnitParts(parts: CompactUnitParts): string {
  return parts.unit === null ? parts.figure : `${parts.figure} ${parts.unit}`
}

/** A reading that is exactly `<number> <unit>` — the producer's figure, then the carried unit. */
const NUMBER_THEN_UNIT = /^([-+]?\d[\d,]*(?:\.\d+)?)\s+(.+)$/

/**
 * ⭐ A PRODUCER READING, RE-SPELT ONLY WHEN IT IS THE CARRIED UNIT — or `null`.
 *
 * CEE authors `intervention_details[].display_value` as `"59 GBP per month"`:
 * its own figure, one space, and the factor's own `unit`, byte for byte (served
 * `cd6a82e4`, `{display_value:"59 GBP per month", raw_value:59, unit:"GBP per
 * month"}`). That string is the carried unit written after the carried figure,
 * so it takes the same compact notation as every UI-composed reading — the
 * figure's digits are the producer's own (`"59"`), never re-derived.
 *
 * ⛔ Anything else is the producer's prose and is left verbatim: a reading
 * whose trailing text is NOT exactly the carried unit (`"£18k"`, `"Low (0.1)"`,
 * `"59 GBP/month"` against a `"GBP per month"` unit), or a unit
 * `compactUnitParts` does not recognise.
 */
export function compactCarriedReading(reading: string, unit: string | null | undefined): string | null {
  if (unit == null || !unit.trim()) return null
  const m = NUMBER_THEN_UNIT.exec(reading.trim())
  if (m === null || m[2] !== unit.trim()) return null
  const parts = compactUnitParts(m[1], unit)
  return parts === null ? null : joinCompactUnitParts(parts)
}

/**
 * Unit classification used by every value formatter.
 *
 * Returns:
 *   - 'none'        — unit is null / undefined / empty after trim
 *   - 'symbol'      — single-char currency glyph (£, $, €, …)
 *   - 'iso'         — multi-char ISO code or ISO-ish label (CHF, USD, kr, R$)
 *   - 'percent'     — '%', 'percent' or 'percentage' (see PERCENT_UNIT_SPELLINGS)
 *   - 'placeholder' — generic placeholder (scale, index, score, …)
 *   - 'other'       — a real unit that should render as a trailing suffix
 *                     (engineers, months, FTE, …)
 *
 * Lookup order: none → symbol (exact) → iso (case-insensitive for 3-letter
 * ISO codes; exact for non-ISO labels like 'kr' / 'R$') → percent →
 * placeholder → other.
 */
export function classifyUnit(unit: string | null | undefined): { kind: UnitClass; canonical: string } {
  if (unit == null) return { kind: 'none', canonical: '' }
  const trimmed = unit.trim()
  if (!trimmed) return { kind: 'none', canonical: '' }

  // Symbol match first — single-char glyphs are case-sensitive (£/$/€ don't
  // have "upper/lowercase" versions anyway).
  if (CURRENCY_SYMBOLS.has(trimmed)) return { kind: 'symbol', canonical: trimmed }

  // ISO code match — try the raw form first (preserves 'kr' / 'R$' labels),
  // then the uppercase form (so 'chf' / 'usd' work too).
  if (ISO_CURRENCY_CODES.has(trimmed)) return { kind: 'iso', canonical: trimmed }
  const upper = trimmed.toUpperCase()
  if (ISO_CURRENCY_CODES.has(upper)) return { kind: 'iso', canonical: upper }

  // The glyph AND the words CEE actually emits — see PERCENT_UNIT_SPELLINGS.
  // Canonical is always the glyph, so a caller that renders `canonical` gets
  // "%" rather than echoing the producer's spelling back at the user.
  if (PERCENT_UNIT_SPELLINGS.has(trimmed.toLowerCase())) {
    return { kind: 'percent', canonical: '%' }
  }

  if (GENERIC_PLACEHOLDER_UNITS.has(trimmed.toLowerCase())) {
    return { kind: 'placeholder', canonical: trimmed }
  }

  return { kind: 'other', canonical: trimmed }
}

/**
 * ⭐⭐ UNIT SPELLINGS THAT STAND IN FOR "NO UNIT" WITHOUT BEING A SCALE.
 *
 * CEE's digit-string brief form mints `goal_threshold_unit: "count"` when the
 * target is a plain number of things with no named unit — the wire type
 * documents it (`adapters/cee/types.ts:587`, `e.g. "count", "USD"`). It is a
 * sentinel, not a scale, and printing it gives the reader "800,000 count".
 *
 * ⚠ WHY THIS IS NOT A MEMBER OF `GENERIC_PLACEHOLDER_UNITS`, WHICH IS WHERE IT
 * FIRST LOOKS LIKE IT BELONGS. That set answers a DIFFERENT question — "is this
 * value on a normalised / qualitative scale?" — and roughly twenty consumers
 * read it for that: the ×100 percent scaling, the qualitative-word branch in
 * `canvas/utils/formatValueWithUnit` (which turns a 0-1 magnitude into "very
 * high"), `usePreAnalysisData`'s `hasMeaningfulUnit`, `resolveEditorRawValue`'s
 * seeding of an edit field, `OptionNode`'s directional label and
 * `factorPriorRange`'s calibration gate. A `count` target of 800,000 IS a real
 * magnitude on a real scale, so joining that set would flip semantics on those
 * surfaces — a 0.8 count would start reading as "very high". Two questions
 * under one name is this estate's trap 21; they are named apart instead.
 *
 * Only `count` is listed. `counts` is NOT included, deliberately: it has never
 * appeared on the wire and would be a guess — the same rule
 * `PERCENT_UNIT_SPELLINGS` states for `'per cent'`. A new spelling joins this
 * set; it does not earn a new branch in a formatter.
 */
export const BARE_MAGNITUDE_UNITS: ReadonlySet<string> = new Set(['count'])

/**
 * ⭐⭐ THE ONE ANSWER TO "DOES THIS UNIT CONTRIBUTE A WORD THE READER SHOULD SEE?"
 *
 * False when the unit names no real-world scale, so the magnitude renders bare:
 * no unit at all (`kind: 'none'`), a generic placeholder (`scale`, `index`,
 * `score`, `norm`, `normalised`, `unit`, `units`), or a bare-magnitude sentinel
 * (`count`). True for a currency symbol, an ISO code, percent, and every real
 * unit (`months`, `customers`, `FTE`).
 *
 * ⚠ IT DECIDES WHETHER THE WORD APPEARS, NEVER HOW. Placement and number
 * formatting stay with each surface's own composer, which is why the Model tab
 * can keep echoing the producer's percent spelling ("20 percent") while
 * `formatGoalTarget` renders the canonical glyph ("20%"). Converging the
 * grammar as well would regress the ISO spacing fixed on 10 Sep 2026 and would
 * round a fractional percent away.
 *
 * ⚠ `'count'` IS A SAME-NAMED TWIN IN THIS CODEBASE. `formatTargetValue`,
 * `TornadoChart`, `baselineComparison` and `confidenceRangeLabels` compare a
 * STRUCTURED unit KIND against `'count'` (`'currency' | 'percent' | 'count'`).
 * That is a different value space from the unit STRING this function reads, and
 * a grep for `'count'` hits both. Nothing here touches the kind.
 *
 * Before this existed the question was answered four times over, each by hand:
 * `formatGoalTarget` (`=== 'count'`), `goalConstraintText` (`!== 'count'`),
 * `NodeInspector` (`!== 'count'`), and `canvas/components/model-tab/utils`
 * (`GENERIC_PLACEHOLDER_UNITS`, which omits `count`) — while the Model tab
 * outline answered it not at all and appended every unit verbatim.
 */
export function unitIsDisplayable(unit: string | null | undefined): boolean {
  const { kind } = classifyUnit(unit)
  if (kind === 'none' || kind === 'placeholder') return false
  return !BARE_MAGNITUDE_UNITS.has((unit ?? '').trim().toLowerCase())
}

/**
 * Count / headcount units — whole, countable things (developers, engineers,
 * people, …). Display formatters round these to whole numbers so a denormalised
 * value × cap (which can carry float-precision noise, e.g. 16.080000000000002)
 * renders as a sensible count. Display-only convention — does NOT change any
 * underlying value, cap, or denormalisation semantics.
 *
 * NOTE: FTE is deliberately EXCLUDED — it is fractional by design (0.5, 1.5 FTE),
 * so whole-number rounding would corrupt its meaning. FTE (and any other
 * non-count unit) instead gets the cleaned ≤2-decimal display path.
 */
export const COUNT_UNITS: ReadonlySet<string> = new Set([
  'developer', 'developers', 'dev', 'devs', 'engineer', 'engineers',
  'hire', 'hires', 'employee', 'employees', 'person', 'people',
  'staff', 'headcount', 'member', 'members',
  'customer', 'customers', 'user', 'users', 'seat', 'seats',
  'role', 'roles', 'team', 'teams',
])

/** True when `unit` denotes a whole-number count (see COUNT_UNITS). */
export function isCountUnit(unit: string | null | undefined): boolean {
  if (unit == null) return false
  return COUNT_UNITS.has(unit.trim().toLowerCase())
}

/**
 * ⭐⭐ UNIT SPELLINGS THAT NAME NO REAL-WORLD SCALE A READER CAN INTERPRET
 * UNAIDED — AND THAT IS THE WHOLE OF THE CLAIM.
 *
 * Measured on a founder's own board (`olumi-debug-54a6c321-20260919.json`,
 * 19 Sep 2026): `ratio` is the third unit spelling present, and it reaches the
 * reader as the bare string `0.4 ratio`. His words: *"things like a 0.4 ratio
 * aren't something that most onboarding users will understand."*
 *
 * ⛔⛔ THIS SET IS NOT A CONVERSION LICENCE, AND THE OBVIOUS READING OF IT IS
 * WRONG. The tempting inference is `0.4 ratio` → `40%`. It was briefed and
 * REFUTED before it shipped; both refutations are recorded here because a
 * spelling in a set is exactly where the next session comes looking for
 * permission, and the inference is trivially re-derivable.
 *
 *   (1) `60% on sales` in a brief establishes `40% on product` ONLY if those two
 *       categories exhaust the allocation. They need not — 60/25/15 across
 *       sales/product/admin fits the same brief. A value in [0,1] does not
 *       itself establish a percentage of anything.
 *
 *   (2) DECISIVE, AT THE BYTES: the option interventions carrying this unit in
 *       that bundle are shaped
 *       `{display_value: "0.85 ratio", normalised_value: 0.85, unit: "ratio"}`.
 *       The producer names the number `normalised_value`. A normalised 0–1
 *       coordinate is not a percentage, so ×100 would mint meaning the wire does
 *       not carry. A real-world unit label does NOT establish whether the stored
 *       number is native or normalised — read the frame, not the label.
 *
 * ⚠ WHETHER `ratio` DENOTES A PROPORTION OR A MULTIPLE IS UNRESOLVED, AND IT IS
 * NOT THE UI'S QUESTION. `0.4` could be four tenths of a named whole or a 0.4×
 * multiplier; nothing on the wire distinguishes them. That ruling is owned by the
 * backend (CEE/PLoT), which mints the unit. Until it lands, this set carries no
 * semantic claim at all — it names a spelling whose magnitude the UI must
 * PRESERVE and must not interpret.
 *
 * ⭐ AND THE MULTIPLE READING IS NOT HYPOTHETICAL — THE ESTATE ALREADY RECORDS IT.
 * `canvas/utils/goalConstraintText.ts` rejected `ratio` from its
 * `REWRITTEN_SCALE_UNITS` set on exactly this ground: *"A genuine ratio limit
 * ('keep the ratio under 3') reconstructs EXACTLY and would lose its comparable
 * numeric form for nothing."* So a third, independent refutation of the ×100 sits
 * in this repo, written before this set existed: a `ratio` of 3 is a multiple, and
 * `300%` would be nonsense. Values above 1 are therefore expected, not an edge
 * case, which is why nothing here is bounded to [0,1].
 *
 * ⚠ WHY THIS IS NOT A MEMBER OF `GENERIC_PLACEHOLDER_UNITS`, WHICH IS WHERE IT
 * FIRST LOOKS LIKE IT BELONGS — the same trap `BARE_MAGNITUDE_UNITS` documents
 * above, and for a sharper reason. That set answers *"is this value on a
 * normalised / qualitative scale?"*, and roughly twenty consumers read it for
 * that: the ×100 percent scaling, and the qualitative-word branch in
 * `canvas/utils/formatValueWithUnit` which turns a 0–1 magnitude into `moderate`.
 * Joining it would replace a precise `0.4` with a band label over a scale whose
 * bands are undefined — inventing meaning rather than deferring it. An undefined
 * scale does not justify the word `moderate`. Two questions under one name is
 * trap 21; they are named apart.
 *
 * ⚠ AND IT IS A PREDICATE, NOT A `UnitClass` MEMBER. `ratio` classifies as
 * `other` and keeps doing so. 22 production files consume `classifyUnit` and NOT
 * ONE switches on the kind — every consumer is an if/else chain ending in an
 * `other` fall-through — so a new union member would produce ZERO TypeScript
 * errors while silently changing all 22, four of which read `=== 'other'`
 * explicitly (`canvas/utils/labelUtils.ts:839` and `:904`,
 * `canvas/utils/goalConstraintText.ts:21`, `components/shared/TriageCard.tsx:265`).
 * A value-aware rule cannot live in `classifyUnit` anyway — it never sees the
 * value.
 *
 * Only `ratio` is listed. `proportion`, `fraction` and `share` are NOT included,
 * deliberately: none has appeared on the wire, and an unmeasured spelling would
 * be a guess — the same rule `PERCENT_UNIT_SPELLINGS` states for `'per cent'` and
 * `BARE_MAGNITUDE_UNITS` for `'counts'`. A new spelling joins this set; it does
 * not earn a new branch in a formatter.
 */
export const PROPORTION_UNITS: ReadonlySet<string> = new Set(['ratio'])

/**
 * True when `unit` names a scale the reader cannot interpret unaided (see
 * `PROPORTION_UNITS`). Says nothing about what the value MEANS — only that the
 * UI must preserve its magnitude rather than reinterpret it.
 */
export function isProportionUnit(unit: string | null | undefined): boolean {
  if (unit == null) return false
  return PROPORTION_UNITS.has(unit.trim().toLowerCase())
}
