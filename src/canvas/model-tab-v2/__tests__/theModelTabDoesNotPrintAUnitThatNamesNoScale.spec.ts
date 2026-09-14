/**
 * ⭐⭐ THE MODEL TAB DOES NOT PRINT A UNIT THAT NAMES NO SCALE.
 *
 * ROADMAP 2.315(c) limb (c). `adapters.ts`'s goal branch suffixed the unit on a
 * test of the FIELD — `target.unit ? ` ${target.unit}` : ''` — which asks
 * whether the producer sent a string, not whether that string means anything to
 * a reader. CEE's digit-string brief form mints `goal_threshold_unit: "count"`
 * for "a plain number of things" (the wire type documents it at
 * `adapters/cee/types.ts:587`, `e.g. "count", "USD"`), so the Model tab's goal
 * row rendered:
 *
 *     800,000 count        ← the defect
 *     800,000              ← what `formatGoalTarget` produced for the same input
 *
 * ⭐ THE FIX IS THE CLASS, NOT THE SPELLING. A guard written as `!== 'count'`
 * is a hand-maintained mirror — the estate already had FOUR of those — and the
 * next sentinel repeats the defect. The class is "a unit that names no
 * real-world scale", it has nine known members, and this row printed every one
 * of them verbatim: `count`, plus the generic placeholders `scale`, `index`,
 * `score`, `norm`, `normalised`, `normalized`, `unit` and `units` ("8 scale").
 * The membership is therefore DERIVED from the exported sets below rather than
 * hand-listed here, so a tenth member cannot arrive unnoticed (trap 12d).
 *
 * ⭐⭐ AND THE OPPOSITE-DIRECTION TWIN IS THE LOAD-BEARING HALF. A fix that
 * suppressed every unit would satisfy the paragraph above completely and be the
 * mirror defect: `£`, `USD`, `%`, `percent`, `months` and `customers` must
 * STILL print. Both directions are asserted, as LITERAL strings — never values
 * rebuilt with the helper under test, which passes against a byte-identical
 * copy and proves nothing about coupling. Rows are found by node id, never by a
 * value predicate another row could satisfy (trap 19).
 */

import { describe, it, expect } from 'vitest'
import type { Node } from '@xyflow/react'
import {
  GENERIC_PLACEHOLDER_UNITS,
  BARE_MAGNITUDE_UNITS,
  unitIsDisplayable,
} from '../../../utils/unitClassifier'
import { formatGoalTarget } from '../../../components/results/utils/formatGoalTarget'
import { toModelRows, type ModelProjectionInput } from '../adapters'

const GOAL_ID = 'goal-under-test'

/**
 * A goal node shaped like the PRODUCER's, derived at the bytes from
 * `domain/goalTarget.ts` (`resolveGoalTarget` reads `goal_threshold_raw` +
 * `goal_threshold_unit` when there is no user-set `success_threshold`).
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
function targetTextFor(raw: string | number, unit?: string): string | null {
  const rows = toModelRows(projection({ nodes: [goalWithTarget(raw, unit)] }))
  const row = rows.find(r => r.id === GOAL_ID)
  expect(row, `no row with id ${GOAL_ID}`).toBeDefined()
  return row!.primaryValue
}

/**
 * Every unit the estate says names no scale, derived from the two exported
 * sets. Hand-listing it here is how the list goes quietly short.
 */
const UNITS_THAT_NAME_NO_SCALE: readonly string[] = [
  ...GENERIC_PLACEHOLDER_UNITS,
  ...BARE_MAGNITUDE_UNITS,
]

describe('⭐ the Model tab goal row prints no unit that names no scale', () => {
  // ── THE MEASURED DEFECT ───────────────────────────────────────────────────
  it('the measured case: a "count" target renders the number and no dangling word', () => {
    expect(targetTextFor(800000, 'count')).toBe('800,000')
  })

  it('the number itself survives — the defect was the word, never the magnitude', () => {
    // 800,000 must still read as 800,000. A "fix" that dropped or rounded the
    // figure would pass a naive "no longer says count" assertion.
    const rendered = targetTextFor(800000, 'count')
    expect(rendered).toBe('800,000')
    expect(rendered).toContain('800,000')
  })

  it('is case- and whitespace-insensitive, as the producer is not guaranteed to be', () => {
    expect(targetTextFor(42, 'Count')).toBe('42')
    expect(targetTextFor(42, '  count ')).toBe('42')
    expect(targetTextFor(42, 'COUNT')).toBe('42')
  })

  // ── THE CLASS, DERIVED ────────────────────────────────────────────────────
  it('the derived corpus is non-empty and contains the measured spelling', () => {
    // A corpus that silently became empty would make every row below vacuous.
    expect(UNITS_THAT_NAME_NO_SCALE.length).toBeGreaterThanOrEqual(9)
    expect(UNITS_THAT_NAME_NO_SCALE).toContain('count')
    expect(UNITS_THAT_NAME_NO_SCALE).toContain('scale')
  })

  it.each(UNITS_THAT_NAME_NO_SCALE)(
    'a "%s" target renders the bare magnitude, with no unit word',
    unit => {
      expect(targetTextFor(8, unit)).toBe('8')
    },
  )

  // ── THE OPPOSITE-DIRECTION TWIN: a real unit MUST still print ─────────────
  const DISPLAYABLE: ReadonlyArray<{ unit: string; raw: number; expected: string }> = [
    // Currency keeps the 10 Sep prefix fix — this change must not undo it.
    { unit: '£', raw: 250000, expected: '£250,000' },
    { unit: '$', raw: 1200, expected: '$1,200' },
    { unit: '€', raw: 49.5, expected: '€49.5' },
    { unit: 'USD', raw: 1200, expected: 'USD 1,200' },
    // Percent, in BOTH spellings the producer uses. The Model tab echoes the
    // producer's spelling; it does not canonicalise to the glyph.
    { unit: '%', raw: 20, expected: '20 %' },
    { unit: 'percent', raw: 20, expected: '20 percent' },
    // Real units.
    { unit: 'months', raw: 9, expected: '9 months' },
    { unit: 'customers', raw: 500, expected: '500 customers' },
    { unit: 'FTE', raw: 2.5, expected: '2.5 FTE' },
  ]

  it.each(DISPLAYABLE)(
    'a genuinely displayable unit $unit still prints — $raw renders as "$expected"',
    ({ unit, raw, expected }) => {
      expect(targetTextFor(raw, unit)).toBe(expected)
    },
  )

  it('no unit in the suppressed corpus is also in the displayable corpus', () => {
    // Without this the two tables above could disagree and both stay green.
    const suppressed = new Set(UNITS_THAT_NAME_NO_SCALE.map(u => u.toLowerCase()))
    for (const { unit } of DISPLAYABLE) {
      expect(suppressed.has(unit.toLowerCase()), `${unit} is in both corpora`).toBe(false)
    }
  })

  // ── THE SECOND TWIN: the two formatters agree on the UNIT DECISION ────────
  /**
   * ⭐⭐ WHAT IS CONVERGED IS THE DECISION, NOT THE GRAMMAR — and asserting the
   * grammar would be wrong.
   *
   * `formatGoalTarget` and this adapter answer the same question ("how do I
   * show this goal target to a reader?") but carry deliberately different,
   * separately-pinned house style: `formatGoalTarget` rounds a percent and
   * renders the canonical glyph ("20%"), prefixes an ISO code with NO space
   * ("GBP800,000", a declared inheritance from the canvas card) and returns
   * null for a non-finite value; the Model tab echoes the producer's percent
   * spelling ("20 percent"), spaces an ISO code ("USD 1,200", fixed 10 Sep
   * 2026 after a witnessed defect) and carries a string-raw arm. Asserting
   * string equality would therefore demand a regression.
   *
   * What must never diverge again is WHETHER THE UNIT WORD APPEARS AT ALL.
   * That is measured here as "the output is a bare magnitude", which is
   * readable off the rendered string itself and needs no knowledge of either
   * composer.
   */
  const BARE_MAGNITUDE = /^-?[\d.,]+$/

  const AGREEMENT_CORPUS: readonly string[] = [
    ...UNITS_THAT_NAME_NO_SCALE,
    '£', '$', 'USD', 'GBP', '%', 'percent', 'percentage', 'months', 'customers', 'FTE',
  ]

  it('the agreement corpus discriminates — it contains both bare and suffixed outcomes', () => {
    // A corpus that landed entirely on one side would let the agreement
    // assertion below pass while measuring nothing (trap 13).
    const bare = AGREEMENT_CORPUS.filter(u => !unitIsDisplayable(u))
    const shown = AGREEMENT_CORPUS.filter(u => unitIsDisplayable(u))
    expect(bare.length, 'no suppressed units in the corpus').toBeGreaterThan(0)
    expect(shown.length, 'no displayable units in the corpus').toBeGreaterThan(0)
  })

  it.each(AGREEMENT_CORPUS)(
    'the Model tab and formatGoalTarget make the same call on whether "%s" prints a word',
    unit => {
      const modelTab = targetTextFor(800000, unit)
      const goalTarget = formatGoalTarget(800000, unit)
      expect(modelTab, `Model tab rendered nothing for ${unit}`).not.toBeNull()
      expect(goalTarget, `formatGoalTarget rendered nothing for ${unit}`).not.toBeNull()
      expect(
        BARE_MAGNITUDE.test(modelTab!),
        `Model tab rendered "${modelTab}" but formatGoalTarget rendered "${goalTarget}"`,
      ).toBe(BARE_MAGNITUDE.test(goalTarget!))
    },
  )

  // ── SCOPE PINS: what this change deliberately does NOT move ───────────────
  it('a non-numeric raw stays on the pre-existing path', () => {
    // `ResolvedGoalTarget.raw` is `string | number`. Pinned so the blast radius
    // is provable rather than asserted.
    expect(targetTextFor('200k', '£')).toBe('200k £')
  })

  it('a non-numeric raw still drops a unit that names no scale', () => {
    // The suffix arm is shared by both raw shapes, so the decision applies here
    // too — this is the case a `typeof raw === 'number'` guard would miss.
    expect(targetTextFor('200k', 'count')).toBe('200k')
  })

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
