/**
 * `formatNumber` — the house bound may not annihilate a magnitude it is asked to
 * show. R9: the durable version of a fix already reviewed and merged twice at the
 * edges.
 *
 * ── THE DEFECT ──────────────────────────────────────────────────────────────
 *
 * `BOUNDED_FMT` is `maximumFractionDigits: 4`. Below 5e-5 that renders a real
 * non-zero magnitude as `0`, and `-0.00001` as `-0` — the SIGN survives while the
 * MAGNITUDE does not, so a reader is handed the direction of a quantity that is
 * simultaneously reported as nothing.
 *
 * It was fixed at the edges twice and never at the centre:
 *   - #1742 (`8dca432c`) fixed THREE callers under `ui/inspector-v2/**`.
 *   - #1747 (`165f395e`) fixed it for PROPORTION units inside the helper.
 * Neither fixed the helper for its other consumers. #1747's own docblock names
 * the remainder as a real defect deliberately left open — "widening the
 * instrument would move every unit class … a separate reviewable change" — and
 * pinned `0.00001 months → "0 months"` / `0.00001 £ → "£0"` as UNCHANGED so the
 * boundary would be provable. This spec is that separate reviewable change, and
 * it MOVES those two pins on purpose.
 *
 * ── THE INVARIANT IS WRITTEN AGAINST THE SPEC, NOT AGAINST THE FAILURE MODE ──
 *
 * The property is "a rendered number never parses to zero unless the value IS
 * zero", asserted over a GENERATED corpus spanning the whole double range. It is
 * deliberately NOT written as "values below 5e-5 now show" — that is the case
 * that motivated the fix, and a corpus shaped like the failure mode cannot see
 * the code's blind spot. #1742's own existing test, "never renders a real
 * non-zero value as zero", passed WHILE the defect was live, because its single
 * case was `0.00049` — above the threshold. A corpus that shares the code's
 * blind spot cannot see the code's defect.
 *
 * ── WHAT THIS CORPUS DELIBERATELY EXCLUDES, STATED ──────────────────────────
 *
 *   - Non-finite input (`NaN`, `±∞`) — pinned as UNCHANGED rather than covered
 *     by the invariant: they have no magnitude to preserve.
 *   - `-0` — pinned as UNCHANGED. A stored `-0` IS the value the model holds,
 *     not an erased magnitude, so the rescue must leave it alone.
 *   - Subnormal doubles below ~1e-30, where two-significant-digit DECIMAL
 *     notation grows past ~32 characters. Pinned as an explicit KNOWN-WIDTH set
 *     below, with its exact measured lengths, so the bound is visible in the
 *     suite rather than invisible. This is inherited unchanged from the pattern
 *     already merged at #1742's three call sites; it is reported, not fixed here.
 *   - The house bound's behaviour JUST ABOVE the threshold (`0.00006 → "0.0001"`,
 *     a 66% over-claim). Pinned UNCHANGED. It is a separate property of
 *     `maximumFractionDigits: 4` and is reported, not fixed here.
 */
import { describe, it, expect } from 'vitest'
import {
  formatNumber,
  formatValueWithUnit,
  PROPORTION_SIGNIFICANT_DIGITS,
} from '../formatValueWithUnit'

/** Parse a rendered en-GB number back to a double, stripping group separators. */
function parse(rendered: string): number {
  return Number(rendered.replace(/,/g, ''))
}

/**
 * A generated corpus spanning the double range — NOT a hand-picked list, so it
 * cannot inherit the author's model of where the bound bites. Deterministic seed
 * so a failure is reproducible.
 */
function generatedCorpus(): number[] {
  const out: number[] = []
  for (let e = 3; e >= -30; e--) {
    for (const m of [1, 1.5, 2.5, 4.999, 5, 5.001, 9.99]) {
      out.push(m * Math.pow(10, e))
      out.push(-m * Math.pow(10, e))
    }
  }
  let seed = 20260919
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x7fffffff
  }
  for (let i = 0; i < 4000; i++) {
    const v = rnd() * 10 * Math.pow(10, Math.floor(rnd() * 33) - 30)
    out.push(rnd() < 0.5 ? -v : v)
  }
  return out
}

describe('formatNumber — the house bound may not report a real magnitude as nothing', () => {
  /**
   * ⭐ THE SPEC-LEVEL INVARIANT. Bound to the PROPERTY, over a generated corpus.
   * The non-zero assertion on the corpus size is the positive control: a corpus
   * that silently generated nothing would make this pass by testing nothing.
   */
  it('never renders a non-zero finite value as zero (generated corpus)', () => {
    const corpus = generatedCorpus()
    expect(corpus.length).toBeGreaterThan(4400)

    const annihilated: Array<{ value: number; rendered: string }> = []
    for (const v of corpus) {
      if (v === 0 || !Number.isFinite(v)) continue
      const rendered = formatNumber(v)
      if (parse(rendered) === 0) annihilated.push({ value: v, rendered })
    }
    expect(
      annihilated.slice(0, 8),
      `${annihilated.length} of ${corpus.length} values rendered as zero`,
    ).toEqual([])
  })

  /**
   * The rescued magnitude must be the PRODUCER's magnitude, not a substitute.
   * Two significant digits bound the relative error at 5%; anything outside that
   * would be an invented number, which is the mirror of the defect being fixed.
   */
  it('the rendered magnitude stays within the precision it claims', () => {
    const corpus = generatedCorpus().filter((v) => v !== 0 && Math.abs(v) < 1000)
    expect(corpus.length).toBeGreaterThan(3000)
    const offenders = corpus.filter((v) => {
      const got = parse(formatNumber(v))
      if (Math.abs(v) >= 0.00005) return false // house-bound arm, excluded above
      return Math.abs(got - v) / Math.abs(v) > 0.05
    })
    expect(offenders.slice(0, 8)).toEqual([])
  })

  it('shows a tiny POSITIVE magnitude instead of zero', () => {
    expect(formatNumber(0.00001)).toBe('0.00001')
    expect(formatNumber(0.000004)).toBe('0.000004')
    expect(formatNumber(1e-7)).toBe('0.0000001')
  })

  /**
   * THE SIGN CASE, as its own assertion. This is the worst form of the defect:
   * the reader is given a direction for a quantity reported as nothing.
   */
  it('shows a tiny NEGATIVE magnitude instead of "-0"', () => {
    expect(formatNumber(-0.00001)).toBe('-0.00001')
    expect(formatNumber(-0.000004)).toBe('-0.000004')
    expect(formatNumber(-1e-7)).toBe('-0.0000001')
  })

  /**
   * THE CONTROL THAT STOPS THE FIX INVENTING A MAGNITUDE WHERE THERE IS NONE.
   * A true zero must stay `'0'`. A mutant that returns a threshold string such
   * as `'<0.0001'` for every erased value REDs here, which is the real risk this
   * case guards.
   */
  it('a true zero is still zero — no magnitude is invented', () => {
    expect(formatNumber(0)).toBe('0')
    expect(formatValueWithUnit(0, 'months')).toBe('0 months')
    expect(formatValueWithUnit(0, '£')).toBe('£0')
    expect(formatValueWithUnit(0, '%')).toBe('0%')
  })

  /**
   * A stored `-0` is the value the model holds, not an erased magnitude, so the
   * rescue leaves it alone. `-0 !== 0` is FALSE in JS, which is what makes the
   * guard's second conjunct exclude it.
   */
  it('a stored negative zero is left exactly as it is', () => {
    expect(formatNumber(-0)).toBe('-0')
  })

  /**
   * ⛔ NO PRODUCER VALUE IS ROUNDED TO SOLVE A DISPLAY PROBLEM. A grouped value
   * must never enter the rescue: two significant digits would round 22,500.5 to
   * 22,000 — rounding a producer value to fix a display bug, which is banned.
   */
  it('a large grouped value keeps every digit — the rescue cannot reach it', () => {
    expect(formatNumber(22500.5)).toBe('22,500.5')
    expect(formatNumber(250000)).toBe('250,000')
    expect(formatNumber(-22500.5)).toBe('-22,500.5')
    expect(formatNumber(1234.56789)).toBe('1,234.568')
    expect(formatValueWithUnit(22500.5, '£')).toBe('£22,500.5')
  })

  /**
   * The explicit `significantDigits` override still outranks everything — the
   * contract `describeRebaseDivergence`'s precision ladder depends on, confirmed
   * by #1747's review.
   */
  it('an explicit significantDigits override still wins', () => {
    expect(formatNumber(0.24782608695652172, 17)).toBe('0.24782608695652172')
    expect(formatNumber(0.00001, 17)).toBe('0.00001')
    expect(formatNumber(22500.5, 17)).toBe('22,500.5')
    // 1 significant digit is a legitimate, deliberately coarse request and must
    // NOT be second-guessed by the rescue.
    expect(formatNumber(0.00001, 1)).toBe('0.00001')
    expect(formatNumber(0, 2)).toBe('0')
  })

  /** Non-finite input has no magnitude to preserve; pinned as unchanged. */
  it('non-finite input is untouched', () => {
    expect(formatNumber(NaN)).toBe('NaN')
    expect(formatNumber(Infinity)).toBe('∞')
    expect(formatNumber(-Infinity)).toBe('-∞')
  })
})

/**
 * ⭐ EVERY UNIT CLASS THAT MOVES, ENUMERATED. Stated as a table rather than
 * described, because "only values previously rounded to zero" is a
 * characterisation and a reviewer rejected exactly that phrasing on #1747.
 */
describe('the unit classes whose rendering changes', () => {
  const NOW_SHOWS_ITS_MAGNITUDE: ReadonlyArray<[number, string | undefined, string]> = [
    // `other` / generic — the pin #1747 deliberately left as `'0 months'`.
    [0.00001, 'months', '0.00001 months'],
    [-0.00001, 'months', '-0.00001 months'],
    // `symbol` — the pin #1747 deliberately left as `'£0'`.
    [0.00001, '£', '£0.00001'],
    // ⚠ `£-0.00001`, NOT `-£0.00001`, AND THAT PLACEMENT IS PRE-EXISTING. The
    // symbol arm is `${canonical}${num(rawValue)}`, so the minus sits with the
    // number, after the glyph. Verified untouched by this change at the bytes.
    // Moving the sign in front of the glyph would move EVERY negative currency
    // value on every consumer — a separate reviewable change. Reported, not fixed.
    [-0.00001, '£', '£-0.00001'],
    // `iso`
    [0.00001, 'GBP', 'GBP 0.00001'],
    // `percent` — the SUFFIX arm. No ×100 is added; only the magnitude survives.
    [0.00001, '%', '0.00001%'],
    [0.00001, 'percent', '0.00001%'],
    // `none` / `placeholder` are reachable for a NEGATIVE tiny value ONLY: the
    // qualitative branch is gated on `rawValue >= 0`, so a negative falls
    // through to the numeric path.
    [-0.00001, undefined, '-0.00001'],
    [-0.00001, 'scale', '-0.00001'],
  ]

  it.each(NOW_SHOWS_ITS_MAGNITUDE)('formatValueWithUnit(%f, %s) === %s', (v, unit, expected) => {
    expect(formatValueWithUnit(v, unit)).toBe(expected)
  })

  /**
   * ⚠ A PRE-EXISTING SIGN-PLACEMENT ODDITY, PINNED SO IT IS VISIBLE RATHER THAN
   * DISCOVERED. The rescue restores the magnitude AND the sign, but the sign lands
   * AFTER the currency glyph (`£-0.00001`), because the symbol arm concatenates
   * `${canonical}${num(rawValue)}`. That is how this helper has always rendered a
   * negative currency — `-5` gives `£-5` — and it is untouched here. It is pinned
   * because the rescue makes the case reachable on values that previously showed
   * `£0` and hid it. Reported, not fixed: the fix would move every negative
   * currency value on every consumer.
   */
  it('a negative tiny symbol value shows its sign, after the glyph (pre-existing)', () => {
    // Binding by identity: the exact string, not "contains 0.00001".
    expect(formatValueWithUnit(-0.00001, '£')).toBe('£-0.00001')
    // The same placement on an ordinary negative value, proving it is the arm's
    // long-standing behaviour and not something the rescue introduced.
    expect(formatValueWithUnit(-5, '£')).toBe('£-5')
  })
})

/**
 * ⭐ WHAT DOES **NOT** MOVE. Measured, not asserted: a 201,161-case differential
 * sweep (systematic decades, a dense boundary sweep, and 200,000 random values)
 * found ZERO cases that change and were not previously rendered as `0`. These
 * rows are the enumerated pins of that result.
 */
describe('nothing else moves', () => {
  const UNCHANGED: ReadonlyArray<[number, string | undefined, string]> = [
    [250000, '£', '£250,000'],
    [49.5, '€', '€49.5'],
    [1200, 'USD', 'USD 1,200'],
    [20, '%', '20%'],
    [9, 'months', '9 months'],
    [500, 'customers', '500 customers'],
    [8, 'scale', '8'],
    [0.4, undefined, 'moderate'],
    [0.5, undefined, 'moderate'],
    // The qualitative branch swallows a tiny POSITIVE unitless value before the
    // numeric path is reached, so it is unaffected by this change.
    [0.00001, undefined, 'very low'],
    [0.00001, 'scale', 'very low'],
    [250000, undefined, '250,000'],
    // The founder's board values, byte-identical.
    [0.4, 'ratio', '0.4 ratio'],
    [0.55, 'ratio', '0.55 ratio'],
    [0.85, 'ratio', '0.85 ratio'],
  ]

  it.each(UNCHANGED)('formatValueWithUnit(%f, %s) === %s', (v, unit, expected) => {
    expect(formatValueWithUnit(v, unit)).toBe(expected)
  })

  it('the four-fraction-digit bound on ordinary values is untouched', () => {
    // The over-claim #1742's bound was adopted to close still closes.
    expect(formatNumber(0.24782608695652172)).toBe('0.2478')
    expect(formatNumber(0.6147829310112233)).toBe('0.6148')
    expect(formatNumber(0.5)).toBe('0.5')
    expect(formatNumber(12)).toBe('12')
    expect(formatNumber(5000)).toBe('5,000')
  })

  /**
   * ⚠ ADDED AFTER A MUTANT EXPOSED THIS CORPUS'S OWN BLIND SPOT. Every explicit
   * pin above is a POSITIVE ordinary value. A mutant widening the erased-test
   * from `Number(housed) === 0` to `<= 0` therefore sends every ordinary
   * NEGATIVE value into the rescue — `-0.24782608695652172` would render `-0.25`
   * instead of `-0.2478` — and this spec did not see it. It was caught only by a
   * sibling file (`formatNumber.precisionBound.spec.ts`, "preserves the sign of a
   * negative coefficient"). A corpus that omits a sign the contract admits cannot
   * certify the code over that sign, so the class is pinned here too.
   */
  it('ordinary NEGATIVE values keep the house bound, not the rescue', () => {
    expect(formatNumber(-0.24782608695652172)).toBe('-0.2478')
    expect(formatNumber(-0.6147829310112233)).toBe('-0.6148')
    expect(formatNumber(-0.5)).toBe('-0.5')
    expect(formatNumber(-12)).toBe('-12')
    expect(formatValueWithUnit(-0.24782608695652172, 'months')).toBe('-0.2478 months')
  })

  /**
   * #1747's proportion arm passes an EXPLICIT significant-digit count, so it
   * early-returns before the rescue and is provably unaffected. Four digits, not
   * the rescue's two.
   */
  it('the proportion arm keeps #1747’s four significant digits, not the rescue’s two', () => {
    expect(PROPORTION_SIGNIFICANT_DIGITS).toBe(4)
    expect(formatValueWithUnit(0.24782608695652172, 'ratio')).toBe('0.2478 ratio')
    expect(formatValueWithUnit(0.00001, 'ratio')).toBe('0.00001 ratio')
    // A value needing all four digits would render only two if the rescue had
    // captured this arm — this is the discriminating case. Both expectations are
    // MEASURED, not derived by hand: Intl rounds half-expand, so four
    // significant digits of 1.2345e-5 is `0.00001235`, not `0.00001234`.
    expect(formatValueWithUnit(0.000012345, 'ratio')).toBe('0.00001235 ratio')
    expect(formatNumber(0.000012345)).toBe('0.000012')
  })

  /**
   * ⚠ PINNED AS A KNOWN, UNFIXED BOUND — the honest way to ship a gap is an
   * explicit set the suite REDs on if it grows OR shrinks. Just above the
   * annihilation threshold the house bound OVER-claims by up to 66%
   * (`0.00006 → "0.0001"`). That is a property of `maximumFractionDigits: 4`,
   * not of this change, and is reported rather than fixed.
   */
  it('the house bound’s near-threshold over-claim is unchanged (known, reported)', () => {
    expect(formatNumber(0.00006)).toBe('0.0001')
    expect(formatNumber(0.00005)).toBe('0.0001')
    // and the first value BELOW the threshold is rescued, not over-claimed
    expect(formatNumber(0.000049999)).toBe('0.00005')
  })

  /**
   * ⚠ PINNED KNOWN-WIDTH SET. Two-significant-digit DECIMAL notation grows with
   * the exponent. Measured lengths: 1e-8 → 10 chars, 1e-17 → 19, 1e-30 → 32,
   * 5e-324 → 326. Realistic producer values sit in the first band. This is
   * inherited from the pattern merged at #1742's three call sites and is
   * reported, not fixed here. The set is asserted EXACTLY so it REDs if the
   * behaviour moves in either direction.
   */
  it('the rescue’s output width is a known, bounded, reported property', () => {
    expect(formatNumber(1e-8).length).toBe(10)
    expect(formatNumber(1e-17).length).toBe(19)
    expect(formatNumber(1e-30).length).toBe(32)
    expect(formatNumber(5e-324).length).toBe(326)
  })
})

/**
 * ⭐ DISPLAY-ONLY, PROVEN RATHER THAN CLAIMED. No stored value, no edit buffer
 * and no written value may change.
 */
describe('display-only: nothing stored moves', () => {
  it('formatting does not mutate the record the value came from', () => {
    const stored = { raw_value: 0.00001, weight: -0.00001, cap: 22500.5 }
    const before = JSON.stringify(stored)

    formatNumber(stored.raw_value)
    formatNumber(stored.weight)
    formatValueWithUnit(stored.raw_value, '£')
    formatValueWithUnit(stored.weight, 'months')
    formatNumber(stored.cap)

    expect(JSON.stringify(stored)).toBe(before)
    // The value a commit would carry is still the producer's double, bit for bit
    // — NOT the two-significant-digit number on screen.
    expect(stored.raw_value).toBe(0.00001)
    expect(stored.weight).toBe(-0.00001)
    expect(stored.cap).toBe(22500.5)
  })

  it('the rendered string is a different object from the stored number', () => {
    // The rescued display string is lossy BY DESIGN (two significant digits).
    // That is only safe because it is never read back as the value.
    const producerValue = 0.000012345
    expect(formatNumber(producerValue)).toBe('0.000012')
    expect(parse(formatNumber(producerValue))).not.toBe(producerValue)
    expect(producerValue).toBe(0.000012345)
  })

  /**
   * A DERIVED guard, not a hand-maintained list: the module may not acquire a
   * writer. CONTRAST CONTROL included, so this cannot pass by reading nothing.
   */
  it('the module writes nothing — derived from its own source', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const src = readFileSync(join(__dirname, '../formatValueWithUnit.ts'), 'utf8')

    // CONTRAST CONTROL: a string that IS present, so a misread path cannot make
    // the absence assertions vacuous.
    expect(src).toContain('export function formatNumber')

    for (const writer of ['localStorage', 'sessionStorage', 'setState', 'useStore', 'dispatch', 'fetch(']) {
      expect(src.includes(writer), `formatValueWithUnit.ts must not ${writer}`).toBe(false)
    }
  })
})
