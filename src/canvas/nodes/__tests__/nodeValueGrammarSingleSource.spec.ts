/**
 * ⭐⭐ A NUMBER ON A NODE CARD IS RENDERED BY A SHARED FORMATTER, NEVER BY HAND.
 *
 * ## The defect this exists to stop
 *
 * A founder's board showed four grammars in one card family: `0.5 scale`,
 * `0.4 ratio`, `4%`, `£200,000`. The estate answers "how do I print a value
 * with its unit?" in one place per input contract — `formatFactorDisplayValue`
 * (card body), `formatInterventionValue` (normalised 0-1 + cap),
 * `formatRawValueWithUnit` (already-denormalised raw) and
 * `canvas/utils/formatValueWithUnit` (raw, with the qualitative rule). Every
 * one of them routes its unit through `classifyUnit`, so a fix to the
 * classifier reaches all of them at once.
 *
 * A LOCAL formatter is what breaks that. It cannot be reached by a central
 * fix, it drifts silently, and it reads as correct forever. This directory has
 * already paid for one: `factorPriorRange` carried a local `fmt()` with its own
 * hardcoded currency list that leaked `Range: 20 scale to 80 scale`.
 *
 * ## Why a SOURCE SCAN, and what it can and cannot claim
 *
 * The claim is about the SHAPE OF THE CODE — "no surface under
 * `src/canvas/nodes/**` composes a value-plus-unit grammar itself" — not about
 * any one rendered string. A render assertion proves one path on one fixture;
 * this proves the property over the whole directory, including files no spec
 * mounts. It is deliberately the weaker kind of evidence about any single
 * screen and the stronger kind about drift.
 *
 * It CANNOT see a hand-rolled formatter that lives outside this directory and
 * is merely called from inside it. That is a real residual gap and it is named
 * rather than papered over: `FactorNode` reaches `formatInterventionValue`'s
 * placeholder arm through `canvas/utils/factorOptionSetting`, and that arm is
 * the literal source of `0.5 scale` (its own comment says so). Fixing it is
 * outside this directory's ownership; this guard stops a SECOND copy appearing
 * inside it.
 *
 * ## The rules, and why each is derived rather than listed
 *
 * A file-and-count manifest would be a hand-maintained mirror — the dominant
 * defect class here. Each rule below is instead a predicate over the source,
 * so a new file is covered the moment it is added and nobody has to remember
 * anything:
 *
 *   A. No local number formatter: `toFixed` / `toLocaleString` /
 *      `Intl.NumberFormat`. These are the primitives a hand-rolled grammar is
 *      built from, and the shared formatters are where they belong.
 *   B. No currency glyph anywhere in the directory. Currency placement (prefix,
 *      no space; ISO prefix WITH a space) is `classifyUnit`'s to decide.
 *   C. Every percent-suffixed render site is a MODEL QUANTITY being scaled into
 *      percentage points. This is the one rule that permits something rather
 *      than forbidding it, and it needs care: a probability of 0.62 rendered as
 *      `62%` is correct and `formatValueWithUnit(0.62, '%')` would render
 *      `0.62%`, because that formatter appends the glyph and does NOT multiply.
 *      So the sites are legitimate — but only while the interpolated expression
 *      is provably a percentage. The predicate is exactly that: the expression
 *      must carry an explicit `* 100` or be bound to a percent-named value.
 *      A bare `{rawValue}%` fails it.
 *   D. No local unit concatenation: a number interpolated next to a
 *      `unit`-named binding is the hand-rolled grammar itself.
 *
 * ## Proving it can fail
 *
 * A scan that silently matches nothing agrees with a clean tree and with a
 * broken one. Every rule below therefore has a POSITIVE CONTROL that plants the
 * violation in a synthetic source and asserts the same detector catches it, and
 * the manifest has a CONTRAST CONTROL: a symbol that IS present must read
 * non-zero in the same walk that reports the zeros. A zero is only evidence
 * beside a non-zero from the same instrument.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { stripComments } from '../../../../tests/helpers/stripSourceComments'
import { resolveFactorPriorRange } from '../shared/factorPriorRange'

const NODES_DIR = path.resolve(__dirname, '..')

/**
 * Production sources under `src/canvas/nodes/**`, derived by walking the tree.
 *
 * `__tests__` is excluded because a spec legitimately writes the very literals
 * the rules forbid — this file does, a few lines below, to control its own
 * detectors. Specs are the instrument, never the surface.
 */
function walkProdSources(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir).sort()) {
    const p = path.join(dir, entry)
    if (statSync(p).isDirectory()) {
      if (entry !== '__tests__') walkProdSources(p, out)
      continue
    }
    if (!/\.(ts|tsx)$/.test(entry)) continue
    if (/\.(spec|test)\.(ts|tsx)$/.test(entry)) continue
    out.push(p)
  }
  return out
}

const PROD_FILES = walkProdSources(NODES_DIR)

/**
 * Comments only — NOT `blankNonCode`.
 *
 * Every pattern here legitimately lives inside a string or template literal
 * (a currency glyph, a `%` after an interpolation), and `blankNonCode` erases
 * literal bodies. Using it would make this guard blind to exactly the
 * violations it exists to catch, which is the failure mode the helper's own
 * header warns about. Comments still go, so the prose above cannot fire.
 */
function codeOf(file: string): string {
  return stripComments(readFileSync(file, 'utf8'), file)
}

const rel = (f: string): string => path.relative(path.resolve(NODES_DIR, '../../..'), f)

/** Rule A — the primitives a local number formatter is built from. */
const LOCAL_NUMBER_FORMATTER = /\.toFixed\s*\(|\.toLocaleString\s*\(|\bIntl\.NumberFormat\b/

/**
 * Rule B — currency glyphs.
 *
 * `$` is deliberately EXCLUDED from the class and matched separately: in TS
 * source a bare `$` is overwhelmingly a template interpolation (`${x}`), and a
 * naive class containing it matches every template literal in the directory —
 * measured, it produced hundreds of hits across `BaseNode` alone. The narrow
 * form below requires the glyph to sit in quotes, which is what a hardcoded
 * currency list actually looks like.
 */
const CURRENCY_GLYPH = /[£€¥₹₩₽฿₫₪₴₸₺₼₾]|['"`]\$['"`]/

/** Rule C — an interpolation immediately suffixed by a percent sign. */
const PERCENT_SITE = /([^{}`'"][^{}`'"]{0,160}?)\}\s*%/g

/**
 * Rule C's permission predicate: the interpolated expression is provably a
 * percentage, either by scaling explicitly or by being bound to a
 * percent-named value.
 */
const IS_PERCENTAGE_EXPRESSION = /\*\s*100\b|[Pp]ct\b|[Pp]ercent/

/** Rule D — a number interpolated directly beside a `unit`-named binding. */
const LOCAL_UNIT_CONCAT = /\}\s*\$\{\s*(?:\w+\.)?(?:unit|canonical|unitCanonical)\b/

function linesMatching(code: string, re: RegExp): number[] {
  const out: number[] = []
  code.split('\n').forEach((line, i) => {
    if (re.test(line)) out.push(i + 1)
  })
  return out
}

function percentSites(code: string): { expr: string; ok: boolean }[] {
  const out: { expr: string; ok: boolean }[] = []
  const re = new RegExp(PERCENT_SITE.source, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(code)) !== null) {
    const expr = m[1].trim()
    out.push({ expr, ok: IS_PERCENTAGE_EXPRESSION.test(expr) })
  }
  return out
}

describe('node value grammar has a single source', () => {
  it('CONTRAST CONTROL: the walk sees a real directory and a symbol that IS present', () => {
    // Without this, every `toEqual([])` below is equally satisfied by a scan
    // that walked nothing. The magnitude matters too, not just the sign: this
    // directory is dozens of files, so a walk returning three would be a
    // blind instrument agreeing with a clean tree.
    expect(PROD_FILES.length).toBeGreaterThan(30)

    // The shared classifier IS used in here — if the reader cannot find it,
    // the reader is broken, not the tree.
    const usingSharedClassifier = PROD_FILES
      .filter(f => /\bclassifyUnit\b/.test(codeOf(f)))
      .map(rel)
    expect(usingSharedClassifier.length,
      'CONTRAST CONTROL: scan cannot see a symbol it is standing next to').toBeGreaterThan(0)
  })

  it('A: no surface carries its own number formatter', () => {
    const offenders = PROD_FILES.flatMap(f =>
      linesMatching(codeOf(f), LOCAL_NUMBER_FORMATTER).map(n => `${rel(f)}:${n}`),
    )
    expect(offenders,
      'a local toFixed/toLocaleString/Intl.NumberFormat is a formatter a central fix cannot reach — '
      + 'route it through the shared chain (formatRawValueWithUnit / formatValueWithUnit)').toEqual([])
  })

  it('B: no surface hardcodes a currency glyph', () => {
    const offenders = PROD_FILES.flatMap(f =>
      linesMatching(codeOf(f), CURRENCY_GLYPH).map(n => `${rel(f)}:${n}`),
    )
    expect(offenders,
      'currency placement is classifyUnit\'s decision (symbol prefixes with no space, '
      + 'ISO prefixes WITH one) — a hardcoded glyph is a second answer to a settled question').toEqual([])
  })

  it('C: every percent render site is a model quantity scaled into percentage points', () => {
    const bare = PROD_FILES.flatMap(f =>
      percentSites(codeOf(f)).filter(s => !s.ok).map(s => `${rel(f)} :: ${s.expr}`),
    )
    expect(bare,
      'a percent sign appended to an expression that is neither scaled by 100 nor percent-named: '
      + 'if it is a RAW value with a percent unit it must go through the shared formatter, and if it '
      + 'is a model quantity it must scale explicitly').toEqual([])
  })

  it('C: and the permitted sites are really there, so the rule is not vacuous', () => {
    // Rule C permits rather than forbids, so "zero violations" is also what an
    // empty scan returns. The population it is permitting must be non-empty and
    // of a plausible size, or the rule is passing by finding nothing at all.
    const permitted = PROD_FILES.flatMap(f => percentSites(codeOf(f)).filter(s => s.ok))
    expect(permitted.length,
      'no percent render sites found at all — the detector has stopped seeing them').toBeGreaterThan(15)
  })

  it('D: no surface concatenates a unit onto a number itself', () => {
    const offenders = PROD_FILES.flatMap(f =>
      linesMatching(codeOf(f), LOCAL_UNIT_CONCAT).map(n => `${rel(f)}:${n}`),
    )
    expect(offenders,
      'composing `${value} ${unit}` locally is the hand-rolled grammar itself — '
      + 'the shared formatters already place the unit by its classified kind').toEqual([])
  })
})

describe('the detectors can fail (positive controls)', () => {
  // Each control plants the violation in a synthetic source and asserts the
  // SAME predicate used above catches it. Without these, all four rules could
  // be regexes that match nothing and the suite would be green for the wrong
  // reason — an absence assertion that has never seen a presence.

  it('A fires on a planted local number formatter', () => {
    expect(LOCAL_NUMBER_FORMATTER.test('const s = v.toFixed(2)')).toBe(true)
    expect(LOCAL_NUMBER_FORMATTER.test('const s = n.toLocaleString("en-GB")')).toBe(true)
    expect(LOCAL_NUMBER_FORMATTER.test('const f = new Intl.NumberFormat("en-GB")')).toBe(true)
    expect(LOCAL_NUMBER_FORMATTER.test('const s = formatRawValueWithUnit(v, unit)')).toBe(false)
  })

  it('B fires on a planted currency glyph and not on a template interpolation', () => {
    expect(CURRENCY_GLYPH.test("const PREFIXES = ['£', '€']")).toBe(true)
    expect(CURRENCY_GLYPH.test('return `£${value}`')).toBe(true)
    expect(CURRENCY_GLYPH.test("if (unit === '$') return true")).toBe(true)
    // The exclusion that keeps the rule usable: a plain interpolation is not a
    // currency literal, and treating it as one would make this rule unadoptable.
    expect(CURRENCY_GLYPH.test('const s = `${label}: ${value}`')).toBe(false)
  })

  it('C fires on a bare value suffixed with a percent sign, and passes a scaled one', () => {
    const bad = percentSites('return `${rawValue}%`')
    expect(bad).toHaveLength(1)
    expect(bad[0].ok, 'a raw value suffixed with % must not be permitted').toBe(false)

    const scaled = percentSites('return `${Math.round(probability * 100)}%`')
    expect(scaled).toHaveLength(1)
    expect(scaled[0].ok).toBe(true)

    const named = percentSites('return `${confidencePct}%`')
    expect(named).toHaveLength(1)
    expect(named[0].ok).toBe(true)
  })

  it('D fires on a planted unit concatenation', () => {
    expect(LOCAL_UNIT_CONCAT.test('return `${value} ${unit}`')).toBe(true)
    expect(LOCAL_UNIT_CONCAT.test('return `${num(v)} ${canonical}`')).toBe(true)
    expect(LOCAL_UNIT_CONCAT.test('return `${label} ${suffix}`')).toBe(false)
  })

  it('C fires when the permitted population empties out', () => {
    // The vacuity check above asserts a floor of permitted sites. This proves
    // that floor can be crossed — a detector that stopped recognising percent
    // sites would report an empty population, not a violation, and rule C would
    // go green by seeing nothing at all.
    expect(percentSites('const x = 1')).toHaveLength(0)
  })

  it('the comment stripper is applied, so this file\'s own prose cannot fire', () => {
    // The header above names `toFixed` and prints a currency glyph. If the
    // stripper were dropped, the rules would redden on their own documentation
    // — which is how a guard gets weakened into uselessness.
    const stripped = stripComments('/* £ and v.toFixed(2) */ const ok = 1', 'x.ts')
    expect(LOCAL_NUMBER_FORMATTER.test(stripped)).toBe(false)
    expect(CURRENCY_GLYPH.test(stripped)).toBe(false)
    expect(stripped).toContain('const ok = 1')
  })
})

/**
 * The one behavioural pin behind the source scan.
 *
 * A source scan proves no LOCAL formatter exists; it cannot prove the shared
 * one is reached. This block does, and it binds by IDENTITY — exact rendered
 * strings from the one function in this directory that renders a value with a
 * unit, on inputs chosen so the shared formatter and the old local one DISAGREE.
 * A test that only checked a 0-1 prior would pass either way: the two are
 * byte-identical there, which is exactly why the refactor was safe and exactly
 * why such a test would be worthless as evidence.
 */
describe('the prior-range line renders through the shared formatter', () => {
  const external = (
    prior: { range_min: number; range_max: number },
    observedState?: { unit?: string | null; cap?: number | null },
  ) => resolveFactorPriorRange({
    data: { prior } as Record<string, unknown>,
    nodeCategory: 'external',
    observedState,
    valueDisplay: null,
  })

  it('separates thousands on the UNCALIBRATED arm, as the calibrated arm already did', () => {
    // ⭐ THE DISCRIMINATOR. A currency factor with no usable cap lands on the
    // uncalibrated arm (the unit is withheld because nothing calibrates it),
    // and the old local formatter printed "20000 to 80000" there while the
    // calibrated arm three lines down printed "£20,000". One card, two
    // grammars, decided by a cap the reader cannot see.
    expect(external({ range_min: 20000, range_max: 80000 }, { unit: '£', cap: null }))
      .toBe('Range: 20,000 to 80,000')
  })

  it('and the calibrated arm is unchanged, so the two arms now agree', () => {
    // The other half of the claim. Without this, the pin above is consistent
    // with having broken the arm that was already correct.
    expect(external({ range_min: 0.2, range_max: 0.8 }, { unit: '£', cap: 100000 }))
      .toBe('Range: £20,000 to £80,000')
  })

  it('leaves the 0-1 contract domain byte-identical', () => {
    // Measured before and after the adoption; these are the values the branch
    // actually sees, and none of them moved.
    expect(external({ range_min: 0.2, range_max: 0.8 })).toBe('Range: 0.2 to 0.8')
    expect(external({ range_min: 0, range_max: 1 })).toBe('Range: 0 to 1')
    expect(external({ range_min: 0.25, range_max: 0.75 }, { unit: 'scale', cap: null }))
      .toBe('Range: 0.25 to 0.75')
    expect(external({ range_min: 1.5, range_max: 9.25 }, { unit: 'months', cap: null }))
      .toBe('Range: 1.5 to 9.25')
    // A CEE rescale float, bounded to two decimals exactly as before — the
    // shared formatter must not widen the precision this line claims.
    expect(external({ range_min: 0.24782608695652172, range_max: 0.8 }))
      .toBe('Range: 0.25 to 0.8')
  })

  it('withholds the unit on the uncalibrated arm, which is why null is passed', () => {
    // Binds the `null` argument by its OBSERVABLE consequence. Passing `unit`
    // through would re-attach the suffix and read as a measurement — the
    // "Range: 20 scale to 80 scale" leak this module was built to stop.
    const rendered = external({ range_min: 0.25, range_max: 0.75 }, { unit: 'scale', cap: null })
    expect(rendered).not.toContain('scale')
    expect(external({ range_min: 20000, range_max: 80000 }, { unit: '£', cap: null }))
      .not.toContain('£')
  })
})
