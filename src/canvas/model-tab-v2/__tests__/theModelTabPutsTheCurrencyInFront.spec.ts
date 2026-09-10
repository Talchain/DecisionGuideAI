/**
 * ⭐⭐ THE MODEL TAB PUTS A PREFIX CURRENCY IN FRONT OF THE NUMBER.
 *
 * ⚠ MEASURED ON A REAL USER'S SCREEN, 10 Sep 2026, 02:03–02:05Z. Fresh-guest
 * drive of `https://staging--olumi.netlify.app`, Netlify deploy
 * `6aa1fdec0d71200008252154` = UI commit `9eb30b54b5c4532014a4573331a8e47ee5feb0a6`
 * (executing bundle bound to `/version.json` and to the deploy-pinned asset by
 * sha256). The wire carried `goal_threshold_raw: 250000`,
 * `goal_threshold_unit: "£"`, and ONE turn produced TWO renderings of ONE figure:
 *
 *     canvas goal node          Target: £250,000     ← correct
 *     Model tab → Goal, open    250,000 £            ← this defect
 *
 * The defect is `adapters.ts`'s goal branch, which suffixed EVERY unit with a
 * space regardless of class:
 *
 *     `${formatSmartNumber(target.raw)}${target.unit ? ` ${target.unit}` : ''}`
 *
 * ⭐ THIS IS THE THIRD SURFACE TO SHIP THE SAME DEFECT, WHICH IS WHY THE FIX
 * REUSES AND DOES NOT REBUILD. `GoalNode` had the correct mapping inline;
 * Inspector v2's `GoalPanel` had none and printed "800000 £" (ROADMAP 2.315(c),
 * fixed by extracting `formatGoalTarget`); the Model tab outline was the surface
 * that extraction did not reach. A fourth hand-written currency rule here is how
 * a fifth surface gets it wrong — so the fix delegates to
 * `components/model-tab/utils.formatValueWithUnit`, the Model tab suite's OWN
 * value+unit composer, which already prefixes `£`/`$`/`€` with no space and an
 * ISO code with one, gated by that same module's `isCurrencyUnit`.
 *
 * ⭐⭐ WHAT THIS FILE PINS, AND WHY THE NON-CURRENCY ROWS ARE THE LOAD-BEARING
 * HALF. A currency-only assertion cannot tell "the currency moved" from "the
 * composer was swapped wholesale". `formatValueWithUnit` DROPS the suffix for
 * the `placeholder` class ("8 scale" → "8"), so applying it unconditionally
 * would silently change a second unit class with no red anywhere. Every class
 * therefore gets a row, and the corpus's COVERAGE OF THE CLASSES IS DERIVED
 * FROM THE `UnitClass` UNION IN THE SOURCE rather than from a literal list
 * here — a hand-listed manifest has been short three separate times in this
 * estate, and a corpus that omits a class the classifier admits cannot certify
 * the code over that class (CLAUDE.md trap 13d(c)).
 *
 * Expectations are LITERAL strings, never values rebuilt with the helper under
 * test: an assertion of the form `expect(out).toBe(formatValueWithUnit(...))`
 * passes against a byte-identical copy and proves nothing about coupling.
 * Rows are found by their node id, never by a value predicate another row
 * could satisfy (trap 19).
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Node } from '@xyflow/react'
import { classifyUnit, type UnitClass } from '../../../utils/unitClassifier'
import { toModelRows, type ModelProjectionInput } from '../adapters'

const GOAL_ID = 'goal-under-test'

/**
 * A goal node shaped like the PRODUCER's, derived at the bytes from
 * `domain/goalTarget.ts` (`GoalTargetSource`) and from the live wire capture
 * above: CEE's brief-extraction path writes `goal_threshold_raw` +
 * `goal_threshold_unit` onto the node, with no `threshold_source`.
 */
function goalWithTarget(raw: string | number, unit?: string): Node {
  return {
    id: GOAL_ID,
    type: 'goal',
    position: { x: 0, y: 0 },
    data: {
      label: 'grow monthly recurring revenue',
      type: 'goal',
      goal_threshold_raw: raw,
      ...(unit === undefined ? {} : { goal_threshold_unit: unit }),
    },
  }
}

function projection(over: Partial<ModelProjectionInput> = {}): ModelProjectionInput {
  return { nodes: [], edges: [], goalThreshold: null, ...over }
}

/** The Model tab's rendered target for one goal, found BY ID. */
function targetTextFor(node: Node): string | null {
  const rows = toModelRows(projection({ nodes: [node] }))
  const row = rows.find(r => r.id === GOAL_ID)
  expect(row, `no row with id ${GOAL_ID}`).toBeDefined()
  return row!.primaryValue
}

/**
 * ⭐ THE MANIFEST, DERIVED FROM THE `UnitClass` UNION IN THE SOURCE.
 *
 * The union is a TYPE and is erased at runtime, so it is read out of
 * `unitClassifier.ts` itself. If a seventh class is ever added, the coverage
 * assertion below REDs and this corpus must grow — which is the whole point:
 * the list cannot go quietly short.
 */
function unitClassesDeclaredInSource(): ReadonlySet<string> {
  const src = readFileSync(join(__dirname, '../../../utils/unitClassifier.ts'), 'utf8')
  const decl = /export type UnitClass\s*=\s*([^\n]+)/.exec(src)
  expect(decl, 'UnitClass union not found in unitClassifier.ts').not.toBeNull()
  const members = decl![1].match(/'([^']+)'/g)?.map(m => m.slice(1, -1)) ?? []
  expect(members.length, 'UnitClass union parsed as empty — the regex has drifted').toBeGreaterThan(0)
  return new Set(members)
}

/**
 * One row per unit class. `expected` is what the Model tab must print AFTER the
 * fix; `unchangedByThisFix` records whether that string is also what it printed
 * BEFORE it, which is what makes the mutant table below readable.
 */
const CORPUS: ReadonlyArray<{
  unit: string | undefined
  raw: number
  expected: string
  unchangedByThisFix: boolean
}> = [
  // ── symbol: THE MEASURED DEFECT. Was "250,000 £". ─────────────────────────
  { unit: '£', raw: 250000, expected: '£250,000', unchangedByThisFix: false },
  { unit: '$', raw: 1200, expected: '$1,200', unchangedByThisFix: false },
  { unit: '€', raw: 49.5, expected: '€49.5', unchangedByThisFix: false },
  // ── iso: also a PREFIX currency, and it takes a space. Was "1,200 USD". ────
  { unit: 'USD', raw: 1200, expected: 'USD 1,200', unchangedByThisFix: false },
  // ── percent: MUST NOT MOVE. The Model tab echoes the producer's spelling. ──
  { unit: '%', raw: 20, expected: '20 %', unchangedByThisFix: true },
  { unit: 'percent', raw: 20, expected: '20 percent', unchangedByThisFix: true },
  // ── placeholder: MUST NOT MOVE. `formatValueWithUnit` would DROP "scale". ──
  { unit: 'scale', raw: 8, expected: '8 scale', unchangedByThisFix: true },
  { unit: 'index', raw: 8, expected: '8 index', unchangedByThisFix: true },
  // ── other: real units, and CEE's 'count' placeholder. MUST NOT MOVE. ───────
  { unit: 'months', raw: 9, expected: '9 months', unchangedByThisFix: true },
  { unit: 'customers', raw: 500, expected: '500 customers', unchangedByThisFix: true },
  { unit: 'count', raw: 250000, expected: '250,000 count', unchangedByThisFix: true },
  // ── none: no unit at all. MUST NOT MOVE. ──────────────────────────────────
  { unit: undefined, raw: 250000, expected: '250,000', unchangedByThisFix: true },
]

describe('⭐ the Model tab renders a prefix currency in front of the number', () => {
  it('the corpus covers every UnitClass the classifier declares in source', () => {
    const declared = unitClassesDeclaredInSource()
    const covered = new Set<UnitClass>(CORPUS.map(c => classifyUnit(c.unit ?? null).kind))
    expect([...covered].sort()).toEqual([...declared].sort())
  })

  // ── THE DEFECT ────────────────────────────────────────────────────────────
  it('the measured case: £250,000 renders with the symbol in front, not behind', () => {
    expect(targetTextFor(goalWithTarget(250000, '£'))).toBe('£250,000')
  })

  it.each(CORPUS.filter(c => !c.unchangedByThisFix))(
    'prefix currency $unit — $raw renders as "$expected"',
    ({ unit, raw, expected }) => {
      expect(targetTextFor(goalWithTarget(raw, unit))).toBe(expected)
    },
  )

  // ── THE OTHER HALF: everything that must NOT move ─────────────────────────
  it.each(CORPUS.filter(c => c.unchangedByThisFix))(
    'non-currency unit $unit is untouched — $raw still renders as "$expected"',
    ({ unit, raw, expected }) => {
      expect(targetTextFor(goalWithTarget(raw, unit))).toBe(expected)
    },
  )

  /**
   * ⚠ SCOPE PIN, NOT AN ENDORSEMENT. `ResolvedGoalTarget.raw` is
   * `string | number`. `formatValueWithUnit` takes a number, so a string raw
   * stays on the pre-existing path and still suffixes. Every WRITER measured at
   * the bytes sends a number — `store.ts` guards `success_threshold` for
   * finiteness and CEE's capture sent `250000` — so this is a defensive branch,
   * not the user-visible defect. It is pinned so the change's blast radius is
   * provable rather than asserted, and so a later widening is a decision.
   */
  it('a non-numeric raw is left on the existing path (scope pin)', () => {
    expect(targetTextFor(goalWithTarget('200k', '£'))).toBe('200k £')
  })

  /**
   * The legacy store scalar has no unit at all, so no class decision applies.
   * Pinned because the goal branch's fallback arm shares the edited expression.
   */
  it('the legacy store-scalar fallback is untouched', () => {
    const rows = toModelRows(
      projection({
        nodes: [{ id: GOAL_ID, type: 'goal', position: { x: 0, y: 0 }, data: { label: 'g', type: 'goal' } }],
        goalThreshold: 2000000,
      }),
    )
    expect(rows.find(r => r.id === GOAL_ID)?.primaryValue).toBe('2,000,000')
  })
})
