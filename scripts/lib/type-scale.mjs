/**
 * Shared type-scale resolver — the ONE place that turns a Tailwind class string
 * into a font-size / weight / line-height, for every guard in this repo.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * It was lifted, unchanged in behaviour, out of
 * `scripts/conversation-type-census.mjs` (where it was a private function with
 * no exports). A second guard —
 * `src/canvas/model-tab-v2/__tests__/inputsStayAtMinimumSize.spec.ts` — then
 * hand-rolled its own regex for the same question and FAILED OPEN: its default
 * on a class string it could not parse was PASS. It silently missed
 * `nodeTitle` / `nodeLabel` / `edgeLabel` (the sanctioned
 * `text-[length:calc(Npx*var(--x,1))]` shape) and `screenReaderOnly`
 * (`sr-only` — no size class at all). Two resolvers for one question is this
 * estate's signature defect; the fix is one resolver, imported.
 *
 * PLAIN `.mjs` ON PURPOSE. It must be importable BOTH by the `.mjs` census
 * script under plain `node` (no build step, no loader) AND by a vitest `.ts`
 * spec. Types for the TypeScript side live in the sibling `type-scale.d.mts`
 * declaration file, which is how `scripts/build-id.mjs` is already consumed
 * from `vite.config.ts` and `tests/ci-guards/build-id-stamp.spec.ts`.
 *
 * THREE OUTCOMES, NEVER TWO
 * -------------------------
 * Every axis reports one of `resolved` / `absent` / `unparseable`:
 *   resolved     — a size class was present and this module understands it
 *   absent       — NO class on that axis at all (`sr-only`; a token that sets
 *                  only weight). The element inherits; this module cannot know
 *                  the rendered size, and MUST NOT pretend it is fine.
 *   unparseable  — a class on that axis was present and NOT understood.
 * A boolean predicate collapses `absent` and `unparseable` into "not a
 * violation", which is precisely how the hand-rolled guard shipped green over
 * four real tokens. Callers are expected to FAIL on anything that is not
 * `resolved` — see the block above `SIZE_OUTCOME`.
 *
 * FAIL-LOUD CONTRACT
 * ------------------
 * This module NEVER throws for a class-string problem and NEVER writes to any
 * shared array. It RETURNS its errors, so a caller keeps its own accumulation
 * and reporting (the census pushes `e.message` into the `errors` array it
 * already prints and exits 2 on; a vitest spec asserts on them). Errors are
 * returned in class order, so message order is stable.
 */

// Tailwind v3 default theme (version-pinned; unknown names fail loud below).
export const TW_SIZE_PX = Object.freeze({
  xs: 12, sm: 14, base: 16, lg: 18, xl: 20,
  '2xl': 24, '3xl': 30, '4xl': 36, '5xl': 48, '6xl': 60,
})
export const TW_WEIGHT = Object.freeze({
  thin: 100, extralight: 200, light: 300, normal: 400, medium: 500,
  semibold: 600, bold: 700, extrabold: 800, black: 900,
})
export const TW_LEADING = Object.freeze({
  none: 1, tight: 1.25, snug: 1.375, normal: 1.5, relaxed: 1.625, loose: 2,
})

/**
 * The one arbitrary-length shape resolved rather than rejected:
 * `text-[length:calc(13px*var(--canvas-label-scale,1))]`. The custom property's
 * fallback MUST be exactly 1, so the declared px is the size everywhere the
 * property is unset. Anything else keeps erroring.
 */
export const COUNTER_SCALED_PX =
  /^text-\[length:calc\((\d+(?:\.\d+)?)px\*var\(--[a-z0-9-]+,\s*1\)\)\]$/

/** The three outcomes. `resolved` is the ONLY one a caller may treat as a size. */
export const SIZE_OUTCOME = Object.freeze({
  RESOLVED: 'resolved',
  ABSENT: 'absent',
  UNPARSEABLE: 'unparseable',
})

const { RESOLVED, ABSENT, UNPARSEABLE } = SIZE_OUTCOME

function outcomeFor(value, sawError) {
  if (sawError) return UNPARSEABLE
  return value === null ? ABSENT : RESOLVED
}

/**
 * Resolve a Tailwind class string to its type traits.
 *
 * @param {string} classString  e.g. `'text-sm font-medium leading-normal'`
 * @param {string} [context]    prefixed to every error message, exactly as the
 *                              census has always formatted it. Omit for no prefix.
 * @returns traits + per-axis outcomes + the errors, unthrown.
 */
export function classesToTraits(classString, context) {
  if (typeof classString !== 'string') {
    // A non-string here means the CALLER is broken (a missing token, a wrong
    // field). Silence would look exactly like `sr-only`. Fail loud, immediately.
    throw new TypeError(
      `classesToTraits: expected a class string${context ? ` for ${context}` : ''}, got ${typeof classString}`,
    )
  }

  const traits = {
    size: null,
    weight: null,
    lineHeight: null,
    sizeOutcome: ABSENT,
    weightOutcome: ABSENT,
    lineHeightOutcome: ABSENT,
    errors: [],
  }
  let sizeError = false
  let lineHeightError = false

  const fail = (axis, className, message) => {
    traits.errors.push({
      axis,
      className,
      context: context ?? null,
      message: context ? `${context}: ${message}` : message,
    })
    if (axis === 'size') sizeError = true
    else if (axis === 'lineHeight') lineHeightError = true
  }

  for (const cls of classString.split(/\s+/)) {
    let m
    if ((m = cls.match(/^text-\[(\d+(?:\.\d+)?)px\]$/))) {
      traits.size = Number(m[1])
    } else if ((m = cls.match(COUNTER_SCALED_PX))) {
      // ONE sanctioned calc shape: a declared px multiplied by a counter-scale
      // custom property that DEFAULTS TO 1. The declared type scale is what is
      // measured, and `var(--x, 1)` resolves to the declared px wherever the
      // property is unset — which is everywhere outside the canvas subtree. The
      // regex is narrow enough that any OTHER calc/clamp/rem still falls through
      // to the error below. See src/canvas/utils/zoomLegibility.ts for why the
      // canvas tokens carry it. Deliberately NOT a general calc evaluator: a
      // resolver that guesses at arithmetic is worse than one that refuses it.
      traits.size = Number(m[1])
    } else if ((m = cls.match(/^text-\[/))) {
      fail('size', cls, `unsupported arbitrary text class "${cls}" (only [Npx] and [length:calc(Npx*var(--x,1))] handled)`)
    } else if ((m = cls.match(/^text-(xs|sm|base|lg|xl|\dxl)$/))) {
      // `\dxl` admits 7xl-9xl, which the pinned v3 table does not carry — that
      // is the branch this guard exists for, and it must stay reachable.
      if (!(m[1] in TW_SIZE_PX)) fail('size', cls, `unknown text size "${cls}"`)
      else traits.size = TW_SIZE_PX[m[1]]
    } else if ((m = cls.match(/^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/))) {
      traits.weight = TW_WEIGHT[m[1]]
    } else if ((m = cls.match(/^leading-(none|tight|snug|normal|relaxed|loose)$/))) {
      traits.lineHeight = TW_LEADING[m[1]]
    } else if ((m = cls.match(/^leading-\[(\d+(?:\.\d+)?)\]$/))) {
      traits.lineHeight = Number(m[1])
    } else if (/^(leading-|text-\d)/.test(cls)) {
      // Message text preserved verbatim from the census. The AXIS is new
      // information, derived from the prefix — it is not a new error.
      fail(cls.startsWith('leading-') ? 'lineHeight' : 'size', cls, `unhandled typographic class "${cls}"`)
    }
    // everything else (colour, family, tracking, sr-only, …) is not type-scale
  }

  traits.sizeOutcome = outcomeFor(traits.size, sizeError)
  traits.lineHeightOutcome = outcomeFor(traits.lineHeight, lineHeightError)
  // ⚠ SCOPE, STATED SO IT IS NOT MISREAD: there is no error branch for weight —
  // `font-[550]` or `font-black/50` is silently ignored, as it always has been.
  // So `weightOutcome` is only ever `resolved` or `absent`, NEVER `unparseable`.
  // Adding a weight error would change the census's behaviour and is a separate,
  // rowable decision; this extraction is behaviour-preserving by construction.
  traits.weightOutcome = outcomeFor(traits.weight, false)
  return traits
}

/**
 * The size axis alone, for callers that only police font-size.
 *
 * @returns `{ px, outcome, errors }` — `px` is a number ONLY when
 *          `outcome === 'resolved'`; it is `null` for both `absent` and
 *          `unparseable`, which callers must handle separately.
 */
export function resolveSizePx(classString, context) {
  const t = classesToTraits(classString, context)
  return {
    px: t.sizeOutcome === RESOLVED ? t.size : null,
    outcome: t.sizeOutcome,
    errors: t.errors.filter((e) => e.axis === 'size'),
  }
}

/** Every returned error message, in class order — what an accumulating caller wants. */
export function errorMessages(traits) {
  return traits.errors.map((e) => e.message)
}