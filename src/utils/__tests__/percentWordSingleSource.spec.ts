/**
 * U2 — the percent WORD gets ONE recogniser, and it is `classifyUnit`.
 *
 * ─── THE DEFECT ────────────────────────────────────────────────────────────
 * CEE spells the percent unit as the WORD (`goal_threshold_unit: 'percent'`).
 * `classifyUnit` — which calls itself "Unit classification — single source of
 * truth" and ALREADY carries a `'percent'` member in its `UnitClass` union —
 * matched the GLYPH only (`if (trimmed === '%')`). So every surface that needed
 * the word grew its own local recogniser, and by 26 Jul there were SIX,
 * disagreeing with each other:
 *
 *   1. computeSuccessState.ts:47          'percent' | 'percentage'          (trim+lower)
 *   2. useResultsSectionData.ts:1267      '%' | 'percent' | 'percentage'    (lower, no trim)
 *   3. GoalNode.tsx:137                   '%' | 'percent' | 'percentage'    (lower, no trim)
 *   4. NodeInspector.tsx:340              '%' | 'percent' | 'percentage'    (lower, no trim)
 *   5. ComparisonCanvasLayout.tsx:32      '%' | 'percent' | 'percentage'    (exact case!)
 *   6. v5GraphPatchDescription.ts:118     '%' | 'percent'  ← NO 'percentage'
 *
 * Copy 6 is the proof that the mirror had already drifted: a CEE
 * `unit: 'percentage'` rendered `20%` on five surfaces and `20 percentage` in
 * the graph-patch receipt. Copy 5 diverged too — it never lowercased, so
 * `'Percent'` fell through to the trailing-suffix branch.
 *
 * ─── THE FIX ───────────────────────────────────────────────────────────────
 * Widen `classifyUnit` ONCE — into the `kind: 'percent'` branch it already had
 * — and delete all six local copies. #486's stated reason for not widening ("a
 * primitive with many other consumers and its own tests") is the argument for
 * widening it once WITH TESTS rather than adding a seventh unguarded copy.
 *
 * ─── EVIDENCE TYPE ─────────────────────────────────────────────────────────
 * MEASURED for every assertion here: these are pure functions and rendered
 * components, both fully observable in jsdom. Nothing about layout or paint is
 * claimed.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

import { classifyUnit } from '../unitClassifier'
import { formatRawValueWithUnit } from '../../canvas/utils/labelUtils'
import { formatConstraintValue } from '../../v5/blocks/v5GraphPatchDescription'
import { computeSuccessState } from '../../canvas/components/pre-analysis-v3/selectors/computeSuccessState'

/**
 * Every spelling of the percent unit that has ever been observed on the wire or
 * defended against by one of the six copies, plus the case/whitespace drift the
 * copies handled inconsistently.
 */
const PERCENT_SPELLINGS = ['%', 'percent', 'percentage', 'Percent', 'PERCENT', 'Percentage', ' percent ', '  %  ']

/** Units that must NOT be swept into the percent branch by the widening. */
const NON_PERCENT_UNITS = [
  '£', '$', '€', 'GBP', 'USD', 'chf', 'kr', 'R$',
  'scale', 'index', 'score', 'normalised',
  'months', 'engineers', 'FTE', 'percentile', 'percentage points', 'per cent',
]

describe('U2: classifyUnit is the ONE recogniser of the percent unit', () => {
  it('classifies every observed spelling of percent as kind percent, canonical %', () => {
    for (const unit of PERCENT_SPELLINGS) {
      expect(classifyUnit(unit), `classifyUnit(${JSON.stringify(unit)})`).toEqual({
        kind: 'percent',
        canonical: '%',
      })
    }
  })

  // NEGATIVE CONTROL for the widening. Without this, the assertion above could
  // pass because classifyUnit had been made to return 'percent' for everything.
  it('NEGATIVE CONTROL: does not sweep other units into the percent branch', () => {
    for (const unit of NON_PERCENT_UNITS) {
      expect(classifyUnit(unit).kind, `classifyUnit(${JSON.stringify(unit)})`).not.toBe('percent')
    }
    // And the pre-existing classes are untouched.
    expect(classifyUnit('£').kind).toBe('symbol')
    expect(classifyUnit('chf').kind).toBe('iso')
    expect(classifyUnit('scale').kind).toBe('placeholder')
    expect(classifyUnit('months').kind).toBe('other')
    expect(classifyUnit(null).kind).toBe('none')
    expect(classifyUnit('   ').kind).toBe('none')
  })
})

describe('U2: every surface renders the percent word the same way', () => {
  // Copy 6's drift, directly. `PERCENT_UNITS` never contained 'percentage'.
  it('formatConstraintValue (v5 graph-patch receipt) renders the word forms as %', () => {
    for (const unit of PERCENT_SPELLINGS) {
      expect(formatConstraintValue(20, unit), `unit ${JSON.stringify(unit)}`).toBe('20%')
    }
  })

  it('formatConstraintValue POSITIVE CONTROL: non-percent units still suffix, currencies still prefix', () => {
    expect(formatConstraintValue(50000, 'GBP')).toBe('£50,000')
    expect(formatConstraintValue(50000, '£')).toBe('£50,000')
    expect(formatConstraintValue(12, 'months')).toBe('12 months')
    expect(formatConstraintValue(12, null)).toBe('12')
  })

  // The shared raw formatter every canvas/results value display routes through.
  it('formatRawValueWithUnit renders the word forms as %', () => {
    for (const unit of PERCENT_SPELLINGS) {
      expect(formatRawValueWithUnit(20, unit), `unit ${JSON.stringify(unit)}`).toBe('20%')
    }
  })

  it('formatRawValueWithUnit POSITIVE CONTROL: other kinds unchanged', () => {
    expect(formatRawValueWithUnit(500, '£')).toBe('£500')
    expect(formatRawValueWithUnit(500, 'CHF')).toBe('CHF 500')
    expect(formatRawValueWithUnit(12, 'months')).toBe('12 months')
  })

  // Copy 1 — tonight's addition, the one that prompted this change.
  it('computeSuccessState renders the word forms as % (no local normaliser)', () => {
    for (const unit of PERCENT_SPELLINGS) {
      const s = computeSuccessState(
        {
          id: 'g1',
          type: 'goal',
          position: { x: 0, y: 0 },
          data: { threshold_source: 'user', success_threshold: 20, goal_threshold_unit: unit },
        } as never,
        null,
        null,
        null,
      )
      expect(s.displayText, `unit ${JSON.stringify(unit)}`).toBe('20%')
    }
  })

  it('computeSuccessState POSITIVE CONTROL: a currency measure is unaffected', () => {
    const s = computeSuccessState(
      {
        id: 'g1',
        type: 'goal',
        position: { x: 0, y: 0 },
        data: { goal_threshold_raw: 150000, goal_threshold_unit: 'GBP' },
      } as never,
      null,
      null,
      null,
    )
    expect(s.displayText).toBe('GBP 150,000')
  })
})

/**
 * ─── THE FOUR REMAINING SURFACES ───────────────────────────────────────────
 * `GoalNode`, `NodeInspector`, `ComparisonCanvasLayout` and
 * `useResultsSectionData` keep their local percent BRANCH but now decide it with
 * `classifyUnit`. That swap is behaviour-identical BY COMPOSITION for every
 * input, which the assertions below establish directly rather than by rendering
 * four components:
 *
 *   - for the three literals each site already tested (`'%'`, `'percent'`,
 *     `'percentage'`), `classifyUnit(...).kind === 'percent'` is TRUE, so the
 *     branch is taken exactly as before;
 *   - for every other unit those sites can receive, it is FALSE, so control
 *     falls through to the same subsequent branch as before.
 *
 * The second half is the one that could regress, so it is enumerated over the
 * units those four surfaces actually handle in their LATER branches. Labelled
 * honestly: this is an ANALYTICAL argument about a boolean substitution, backed
 * by a measured truth table. It is not a render test of those four surfaces.
 */
describe('U2: the boolean substitution at the four remaining call sites is total', () => {
  it('is TRUE for exactly the literals the retired copies matched', () => {
    for (const unit of ['%', 'percent', 'percentage']) {
      expect(classifyUnit(unit).kind === 'percent', `unit ${JSON.stringify(unit)}`).toBe(true)
    }
  })

  it('is FALSE for every unit those sites route to a LATER branch', () => {
    // GoalNode: `u === 'count' || u === ''` → plain; isCurrencyUnit → currency;
    // else suffix. NodeInspector: `unitStr && unitStr !== 'count'` → currency;
    // else plain. ComparisonCanvasLayout: £/GBP, $/USD, €/EUR, else suffix.
    // useResultsSectionData: currency substring match, else count.
    const laterBranchUnits = [
      'count', '', '£', 'GBP', '$', 'USD', '€', 'EUR', 'pts', 'months', 'users',
      'engineers', 'dollar', 'pound', 'euro', 'scale', 'index',
    ]
    for (const unit of laterBranchUnits) {
      expect(classifyUnit(unit).kind === 'percent', `unit ${JSON.stringify(unit)}`).toBe(false)
    }
  })
})

/**
 * ─── THE DRIFT ALARM ───────────────────────────────────────────────────────
 * DERIVED from the filesystem, not from a maintained list of known offenders
 * (CLAUDE.md trap 12). The fingerprint is precise: the literal `'percentage'`
 * appears in `src/` ONLY when someone has hand-rolled a wire-unit percent-word
 * recogniser. The many `units === 'percent'` comparisons across the repo are
 * over an already-narrowed `'currency' | 'percent' | 'count'` ENUM and never
 * mention `'percentage'` — measured: at 585d26cb the literal occurred in
 * exactly the five files listed at the top of this file and nowhere else.
 *
 * SCOPE OF THE CLAIM, stated precisely: this fails when a surface reintroduces
 * a local recogniser IN THE `'percentage'` FORM. It cannot catch copy 6's form
 * (a set omitting `'percentage'`) — that class is covered by the parity
 * assertions above, per surface. It is not a proof that no seventh copy can
 * ever exist in any form.
 */
const ALLOWED_PERCENTAGE_LITERAL_FILES = new Set([
  // The single source of truth is allowed to name what it recognises.
  join('src', 'utils', 'unitClassifier.ts'),
])

/**
 * Strip comments so the alarm is about CODE, not prose. Retiring the six copies
 * means writing about them — every retirement site carries a note naming the
 * literal it removed — and an alarm that fired on those notes would push the
 * next author to delete the explanation rather than keep the code honest.
 *
 * Deliberately crude, and its blind spot is stated: a `//` inside a string
 * literal truncates the rest of that line, so a `'percentage'` sitting AFTER a
 * URL on the same line would be missed. The positive control below proves the
 * stripper discriminates in BOTH directions — it removes comment occurrences and
 * still sees code occurrences — so it cannot silently degrade into a scan that
 * strips everything and passes vacuously.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
}

function listSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '__fixtures__') continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__') continue
      listSourceFiles(full, acc)
    } else if (/\.tsx?$/.test(entry) && !/\.(spec|test|stories)\.tsx?$/.test(entry)) {
      acc.push(full)
    }
  }
  return acc
}

describe('U2 drift alarm: no surface may hand-roll a percent-word recogniser', () => {
  const files = listSourceFiles('src')

  it('PREMISE: the scan actually reads the tree it claims to (positive control)', () => {
    // A vacuous scan is the failure mode this guards (CLAUDE.md trap 13). Prove
    // the walker sees a real, known file AND that the stripper discriminates:
    // it must still SEE the code occurrence and must NOT see the comment ones.
    expect(files.length).toBeGreaterThan(1000)
    expect(
      files.map((f) => relative('.', f)).some((f) => f === join('src', 'utils', 'unitClassifier.ts')),
    ).toBe(true)

    const source = readFileSync(join('src', 'utils', 'unitClassifier.ts'), 'utf8')
    const rawHits = source.match(/(['"])percentage\1/g) ?? []
    const codeHits = stripComments(source).match(/(['"])percentage\1/g) ?? []
    // Comment occurrences exist and are removed; the PERCENT_UNIT_SPELLINGS
    // occurrence is code and survives. If the stripper ever strips everything,
    // codeHits goes to 0 and this fails rather than the alarm going quiet.
    expect(rawHits.length).toBeGreaterThan(codeHits.length)
    expect(codeHits.length).toBe(1)
  })

  it("no non-test src file outside unitClassifier.ts contains the CODE literal 'percentage'", () => {
    const offenders: string[] = []
    for (const file of files) {
      const rel = relative('.', file).split(sep).join(sep)
      if (ALLOWED_PERCENTAGE_LITERAL_FILES.has(rel)) continue
      const source = stripComments(readFileSync(file, 'utf8'))
      if (/(['"])percentage\1/.test(source)) offenders.push(rel)
    }
    expect(
      offenders,
      'Route the percent unit through classifyUnit() instead of matching the word locally — ' +
        'see src/utils/__tests__/percentWordSingleSource.spec.ts for why there were six copies.',
    ).toEqual([])
  })
})
