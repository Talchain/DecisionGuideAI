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
 */
export const GENERIC_PLACEHOLDER_UNITS: ReadonlySet<string> = new Set([
  'scale', 'index', 'score', 'normalised', 'normalized', 'norm', 'unit', 'units',
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
