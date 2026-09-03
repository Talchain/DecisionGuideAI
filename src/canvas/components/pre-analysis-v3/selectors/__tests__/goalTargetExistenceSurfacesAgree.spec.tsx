/**
 * ⭐⭐⭐ ONE GOAL, ONE ANSWER TO "DOES THIS HAVE A TARGET AT ALL?"
 *
 * The canvas goal card and the hero success field read the SAME goal node and
 * disagreed about whether it carries a target — not about the formatting, about
 * the EXISTENCE. Given one node carrying `goal_threshold_raw: '11'`:
 *
 *     canvas card   Target: 11
 *     hero field    (empty) · "success needs setting"
 *
 * ⚠ THE RUNG, STATED HONESTLY (and narrowed after review). This is DERIVED at
 * the two predicates and REPRODUCED here through the real rendered card and the
 * real selector. It is **not** a deployed witness, and the earlier draft of this
 * header implied one. The field is typed `number | null` in every repo, so how
 * often a string reaches it in production is a separate, unmeasured question —
 * what is measured is that when one does, the product contradicts itself. The
 * NON-FINITE half of the same defect IS driven end-to-end: see
 * `AdvancedField.finiteGuard.spec.tsx`, where the writer that produces those
 * magnitudes is exercised directly.
 *
 * ── THE TWO PREDICATES, WRITTEN DOWN BEFORE THE ASSERTIONS (trap 21) ───────
 *   GoalNode.tsx:117           thresholdRaw != null && String(thresholdRaw).trim() !== ''
 *   computeSuccessState.ts:124 typeof data.goal_threshold_raw === 'number'
 *
 * ⚠ AND THE REASON THIS IS A DEFECT RATHER THAN A DIFFERENCE. Trap 21 says to
 * write down the question each authority answers before reconciling them, and
 * where the questions differ the fix is to NAME THEM APART, never to align the
 * defaults. That is what the sibling panel lane did, correctly, for the model
 * strip: the strip additionally demands EXPRESSIBILITY, so it is entitled to a
 * narrower answer than the coaching card. **These two are not that pair.** Both
 * are answering the *same* question — has this goal got a success target — and
 * `SuccessState.isSet` feeds "success needs setting" copy and a warning pill,
 * which is an existence claim in as many words. So the harm here is a genuine
 * self-contradiction, and the remedy is the same SPLIT rather than a widening:
 * existence is decided non-numerically and shared, the number stays strict, and
 * `rawValue == null` means "no NUMBER", never "no target".
 *
 * ── WHY THIS FILE, AND NOT TWO PER-SURFACE FILES ──────────────────────────
 * A per-surface spec CANNOT SEE A DISAGREEMENT. Each surface was internally
 * consistent and each had passing tests while the product contradicted itself.
 * So one payload goes into BOTH real predicates here — the REAL `GoalNode`
 * rendered, and the REAL `computeSuccessState` called — and the assertion is
 * that the two answers are equal.
 *
 * ⚠ THE PRECONDITION IS PINNED IN-TEST, on every disagreement case: each
 * asserts that the payload is one the OLD hero predicate would have refused
 * (`typeof raw !== 'number'`) while the card accepts it. Without that, these
 * cases could silently become shapes on which the two agreed anyway, and the
 * file would go green having tested nothing about the defect it names.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import type { Node } from '@xyflow/react'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

const makeStoreState = (overrides: Record<string, unknown> = {}) => ({
  results: { status: 'idle', report: null },
  highlightedNodes: new Set(),
  dimmedNodeIds: new Set(),
  lens: { _dimmedNodeIds: new Set() },
  goalThreshold: null,
  goalConstraints: [],
  nodes: [],
  edges: [],
  ceeAnalysisReady: null,
  viewMode: 'expert',
  ...overrides,
})

vi.mock('../../../../store', () => ({
  useCanvasStore: vi.fn((selector) => selector(makeStoreState())),
}))

vi.mock('../../../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null,
    influence: null,
    confidence: null,
    inSensitivityAnalysis: false,
    achievementProbability: null,
    stabilityPercentage: null,
    winRate: null,
    isResultsMode: false,
    predictedOutcome: null,
    valueOfInformation: null,
    voiRank: null,
  })),
}))

import { GoalNode } from '../../../../nodes/GoalNode'
import { useCanvasStore } from '../../../../store'
import { computeSuccessState } from '../computeSuccessState'

const baseProps = {
  id: 'goal-1',
  type: 'goal',
  selected: false,
  isConnectable: true,
  position: { x: 0, y: 0 },
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  dragging: false,
  zIndex: 0,
  deletable: true,
  selectable: true,
  draggable: true,
}

const LABEL = 'Grow Total ARR Materially Within 12 Months'

/**
 * THE CARD'S ANSWER, READ FROM ITS OWN DOM — never from a copy of its
 * predicate. `goal-node-no-target-chip` is the affordance the card renders on
 * `!hasThreshold`, so its absence IS the card saying a target exists. A
 * re-implementation of `hasThreshold` here would be a third copy of the rule
 * these surfaces already disagreed about (trap 12).
 */
function cardSaysTargetExists(data: Record<string, unknown>): boolean {
  vi.mocked(useCanvasStore).mockImplementation((selector) =>
    selector(makeStoreState() as never),
  )
  const { container, unmount } = render(
    <ReactFlowProvider>
      <GoalNode {...baseProps} data={{ label: LABEL, type: 'goal', ...data }} />
    </ReactFlowProvider>,
  )
  // ⛔ The card must have RENDERED before its silence means anything — an
  // unmounted card has no chip either (trap 13).
  expect(container.textContent ?? '').toContain(LABEL)
  const chip = container.querySelector('[data-testid="goal-node-no-target-chip"]')
  unmount()
  return chip === null
}

/** THE HERO'S ANSWER, from the real selector on the same node data. */
function heroSaysTargetExists(
  data: Record<string, unknown>,
  analysisReady: Record<string, unknown> | null = null,
): boolean {
  const node = { id: 'goal-1', type: 'goal', position: { x: 0, y: 0 }, data } as unknown as Node
  return computeSuccessState(node, analysisReady, null).isSet
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useCanvasStore).mockImplementation((selector) => selector(makeStoreState() as never))
})

/**
 * ⭐⭐ THE DISAGREEMENT CORPUS. Every row is a shape the card accepts and the
 * old hero predicate refused, and every row asserts BOTH surfaces now say the
 * target EXISTS.
 *
 * ⚠ IT IS A FAMILY, NOT THE INSTANCE THAT WAS NOTICED. The one found was a
 * numeric string. `'200k'`, `'£11M'`, `'11%'` and `'≥ £1,000'` are the same
 * class — a target stated in words a `number | null` cannot hold — and a fix
 * anchored on `'11'` alone (parse it, done) would have left every one of them
 * contradicting the card. Checking what a corpus EXCLUDES is the point.
 */
const DISAGREED: Array<[string, Record<string, unknown>]> = [
  ['a numeric string from CEE', { goal_threshold_raw: '11', goal_threshold_unit: '£M ARR' }],
  ['a padded numeric string', { goal_threshold_raw: ' 11 ' }],
  ['a shorthand magnitude', { goal_threshold_raw: '200k' }],
  ['a currency magnitude', { goal_threshold_raw: '£11M' }],
  ['a percentage', { goal_threshold_raw: '11%' }],
  ['a thousands separator', { goal_threshold_raw: '1,100' }],
  ['a comparator and currency', { goal_threshold_raw: '≥ £1,000' }],
  ['a user-stated percentage', { success_threshold: '20%', threshold_source: 'user' }],
  ['a user-stated numeric string', { success_threshold: '150000', threshold_source: 'user' }],
]

describe('one goal, one answer — the card and the hero agree that a target EXISTS', () => {
  it.each(DISAGREED)('%s', (_name, data) => {
    /**
     * ⭐ PRECONDITION, PINNED IN-TEST. This payload must be one the OLD hero
     * predicate would refuse — otherwise the case has drifted into a shape the
     * two surfaces agreed on anyway and proves nothing about the defect.
     */
    const oldHeroWouldRefuse =
      typeof data.goal_threshold_raw !== 'number' &&
      !(data.threshold_source === 'user' && typeof data.success_threshold === 'number')
    expect(oldHeroWouldRefuse).toBe(true)

    const card = cardSaysTargetExists(data)
    const hero = heroSaysTargetExists(data)

    // The antecedent: the card is the surface that was right, so it must be
    // saying YES or this case is not the disagreement it claims to be.
    expect(card).toBe(true)
    // THE CLAIM.
    expect(hero).toBe(card)
  })
})

/**
 * ⭐⭐ THE OPPOSITE-DIRECTION TWINS. Agreement on "yes" is half a guard: a hero
 * that returned `true` unconditionally would pass every case above. These are
 * the shapes on which BOTH must say NO, and they are also this file's positive
 * control — the chip probe is shown FINDING the chip it asserts the absence of.
 *
 * ⚠ THE BLANK IS THE ONE THAT MATTERS. `Number('')` is `0`, so a fix that
 * simply coerced would have made the hero claim a `0` target here — the exact
 * fabricated-zero harm, traded in while closing the contradiction.
 */
const AGREED_ABSENT: Array<[string, Record<string, unknown>]> = [
  ['nothing at all', {}],
  ['a blank goal_threshold_raw', { goal_threshold_raw: '' }],
  ['whitespace', { goal_threshold_raw: '   ' }],
  ['a newline', { goal_threshold_raw: '\n' }],
  ['an explicit null', { goal_threshold_raw: null }],
  ['a blank user-stated threshold', { success_threshold: '', threshold_source: 'user' }],
  [
    'a success_threshold nobody marked as user-set',
    { success_threshold: 0.6 },
  ],
  [
    'a normalised-only threshold, which the user was never shown',
    { goal_threshold: 0.73 },
  ],
  /**
   * ⭐⭐⭐ THE NON-FINITE FAMILY, AND WHY IT LIVES HERE RATHER THAN IN THE
   * GENERATED CENSUS BELOW.
   *
   * ⚠⚠ FOUND BY A SURVIVING MUTANT, AND IT IS A HOLE THIS PR'S OWN FIX OPENED.
   * Once BOTH surfaces route through `isStatedTargetValue`, a mutation that
   * widens that ONE predicate to admit `NaN` and `±Infinity` widens both of
   * them together — so they still AGREE, and the agreement census below stays
   * green while the product renders a target nobody could have set. Sharing the
   * predicate closed the divergence and, in the same move, cost the relative
   * guard its ability to see a wrong SHARED answer.
   *
   * That is the same defect one level up, so the answer is the same as trap
   * 12d's: **ship both kinds of guard.** The generated census answers *do these
   * two agree?*; these rows answer *is the agreed answer RIGHT?* — as literal
   * expectations that no widening of the predicate can satisfy.
   *
   * ⚠ BOTH SIGNS, BY CONSTRUCTION OF THE POINT RATHER THAN BY MEMORY.
   * `Number.isFinite` is sign-symmetric; the hand list that missed this defect
   * the first time was not.
   */
  ['a bare NaN, which nobody states', { goal_threshold_raw: Number.NaN }],
  ['a bare +Infinity', { goal_threshold_raw: Number.POSITIVE_INFINITY }],
  ['a bare -Infinity', { goal_threshold_raw: Number.NEGATIVE_INFINITY }],
  ['a user-stated NaN', { success_threshold: Number.NaN, threshold_source: 'user' }],
  ['a user-stated +Infinity', { success_threshold: Number.POSITIVE_INFINITY, threshold_source: 'user' }],
  ['a user-stated -Infinity', { success_threshold: Number.NEGATIVE_INFINITY, threshold_source: 'user' }],
]

describe('one goal, one answer — the card and the hero agree that NO target exists', () => {
  it.each(AGREED_ABSENT)('%s', (_name, data) => {
    const card = cardSaysTargetExists(data)
    const hero = heroSaysTargetExists(data)
    // Positive control for the probe: it must FIND the chip here, or its
    // absence in the block above measured nothing.
    expect(card).toBe(false)
    expect(hero).toBe(card)
  })
})

/**
 * ⭐ THE NUMBER STAYS STRICT, and this is the half a widening would quietly
 * lose. A stated target with no number must report EXISTENCE without handing a
 * numeric consumer anything to do arithmetic on.
 */
describe('existence is broad; the number is strict', () => {
  it.each([
    ['a shorthand magnitude', { goal_threshold_raw: '200k' }],
    ['a percentage', { goal_threshold_raw: '11%' }],
    ['a currency magnitude', { goal_threshold_raw: '£11M' }],
  ])('%s is SET and carries no number', (_name, data) => {
    const node = { id: 'goal-1', type: 'goal', position: { x: 0, y: 0 }, data } as unknown as Node
    const state = computeSuccessState(node, null, null)
    expect(state.isSet).toBe(true)
    expect(state.rawValue).toBeNull()
    // ⚠ THE COUPLING `DecisionOverviewCard` DEPENDS ON. It derives its own
    // `successIsSet` from `displayText !== null` and nothing else, so an
    // `isSet` branch with a null displayText would make that card claim the
    // measure is missing beside a rendered value.
    expect(state.displayText).not.toBeNull()
  })

  it.each([
    ['a numeric string', { goal_threshold_raw: '11' }, 11],
    ['a padded numeric string', { goal_threshold_raw: ' 11 ' }, 11],
    ['a real zero, which IS a target', { goal_threshold_raw: 0 }, 0],
    ['hex notation is NOT a stated decimal', { goal_threshold_raw: '0x10' }, null],
  ])('%s → rawValue %s', (_name, data, expected) => {
    const node = { id: 'goal-1', type: 'goal', position: { x: 0, y: 0 }, data } as unknown as Node
    expect(computeSuccessState(node, null, null).rawValue).toBe(expected)
  })

  it('CONTRAST CONTROL — `0x10` is refused as a NUMBER while still counting as a stated target', () => {
    // Proves the two predicates are genuinely separate rather than one wearing
    // two names: the same value gets opposite answers from them.
    const node = {
      id: 'goal-1', type: 'goal', position: { x: 0, y: 0 },
      data: { label: LABEL, goal_threshold_raw: '0x10' },
    } as unknown as Node
    const state = computeSuccessState(node, null, null)
    expect(state.isSet).toBe(true)
    expect(state.rawValue).toBeNull()
  })
})

/**
 * ⭐⭐⭐ THE COMPLETENESS HALF — AND WHY THE FIRST VERSION OF IT WAS WORTHLESS.
 *
 * ⚠⚠ THIS BLOCK REPLACES A TEST NAMED *"the set is EXACTLY these two — a third
 * divergence REDs here"* THAT PASSED WITH A THIRD DIVERGENCE PRESENT. It
 * censused `[...DISAGREED, ...AGREED_ABSENT, ...KNOWN_DIVERGENT]` — the union of
 * this file's own hand lists — so its universe was my enumeration, and it could
 * only ever confirm that my enumeration agreed with itself. An independent
 * 35-shape corpus found **three** divergences where it pinned two: I had listed
 * `NaN` and `+Infinity` and not `-Infinity`. `Number.isFinite` is
 * SIGN-SYMMETRIC; my list was not. A closed set checked against itself is a
 * guard agreeing with itself, and it is the same defect this whole file exists
 * to close, one level up.
 *
 * ⚠ SO THE FIX IS NOT "ADD `-Infinity`". That would restore the same guard with
 * one more item in it, and the next asymmetry would be invisible in exactly the
 * same way. **The universe is GENERATED, from axes rather than from cases**, so
 * a blind spot about a DIMENSION is structurally impossible:
 *
 *   · SIGN is an axis (`+` and `-` applied to every magnitude), so `-Infinity`,
 *     `-0` and `-11` exist here because the generator makes them, not because
 *     anybody remembered them.
 *   · CARRIER is an axis (each magnitude as a bare number AND as its string),
 *     because `11` and `'11'` reach different branches of both predicates.
 *   · LEG is an axis, and it includes the two legs POPULATED TOGETHER — which
 *     is how the PRECEDENCE divergence was found. This card selected the user
 *     leg on `!= null`, so a BLANK user threshold beside a real CEE raw made it
 *     say "no target" while the hero fell through and said there was one. Same
 *     opposite answers, arrived at through the SELECTION rather than the test;
 *     a predicate-only corpus cannot see it. The review's note that "the same
 *     16 shapes diverge via the `success_threshold` user leg" is answered here.
 *
 * ── AND THE CLAIM IS NOW ZERO, NOT TWO ────────────────────────────────────
 * The residual divergence is not pinned, it is CLOSED: `GoalNode` routes its
 * existence question through the same `isStatedTargetValue`, and the reachable
 * writer that was producing non-finite magnitudes in the first place
 * (`AdvancedField`, guarding with `isNaN` instead of `Number.isFinite`) is
 * fixed in this PR. Pinning the new number would have left a reachable
 * self-contradiction on screen with a test blessing it.
 *
 * ⚠⚠ SCOPE, STATED PRECISELY — AND THE TRADE THIS FIX MAKES, STATED RATHER
 * THAN LEFT IMPLICIT.
 *
 * What is pinned here is **equal inputs ⇒ equal answers**. Every shape below is
 * fed to both surfaces through the NODE, with `analysisReady` null, so no case
 * in this file can pass or fail on the source question.
 *
 * The two surfaces read different SOURCES: the card sees only the node, the
 * hero also consults `analysis_ready`. That asymmetry is PRE-EXISTING and out
 * of this file's reach — but **this fix DOUBLES it, and that is intrinsic to
 * the fix rather than incidental.** Widening the hero to `isStatedTargetValue`
 * makes it accept STRINGS, and a string target arriving only on
 * `analysis_ready.goal_threshold_raw` is one the card structurally cannot see.
 *
 * Measured on this file's own 61-value corpus, held fixed across both runs
 * (value on `analysis_ready` only, node empty, so the card always says "no"):
 *
 *     base bd18bace   17 hero-only shapes   all BARE NUMBERS, incl. NaN/±Infinity
 *     head            41 hero-only shapes
 *
 * ⚠ AND IT IS NOT PURELY ADDITIVE, which a bare "+24" would hide: the fix
 * REMOVES 3 (`NaN`, `±Infinity` as numbers — the hero no longer claims those)
 * and ADDS 27 (every string form). An independent review measured the same
 * direction and cause on its own fixed corpus (6 → 12); the two numbers differ
 * because the corpora differ, and both are floors on the same effect.
 *
 * ⚠ DELIBERATELY NOT CLOSED HERE, AND DELIBERATELY NOT PINNED. Closing it means
 * deciding whether the canvas card should read `analysis_ready` at all, which is
 * a question about SOURCES rather than predicates and belongs with the owner of
 * `GoalNode.goalTargetAgreement.spec.tsx` — whose header names the asymmetry in
 * one prose line and pins nothing. **Rowed.** Doubling a pre-existing asymmetry
 * while closing 77 divergences is a good trade, but it is only an honest one if
 * it is a STATED trade — which is what this paragraph is.
 */

type Shape = { name: string; data: Record<string, unknown> }

/** ⭐ SIGN AS AN AXIS. This is the line that makes `-Infinity` unforgettable. */
const SIGNS: Array<[string, number]> = [['+', 1], ['-', -1]]
const MAGNITUDES: Array<[string, number]> = [
  ['0', 0],
  ['1', 1],
  ['11', 11],
  ['0.5', 0.5],
  ['1e5', 1e5],
  ['MAX_VALUE', Number.MAX_VALUE],
  ['MIN_VALUE', Number.MIN_VALUE],
  ['Infinity', Number.POSITIVE_INFINITY],
]
/** ⭐ CARRIER AS AN AXIS — the same magnitude as a number and as its string. */
const CARRIERS: Array<[string, (n: number) => unknown]> = [
  ['number', (n) => n],
  ['string', (n) => String(n)],
]

/** Values that are not sign-bearing magnitudes, so they are listed rather than generated. */
const NON_MAGNITUDE_VALUES: Array<[string, unknown]> = [
  ['NaN (number)', Number.NaN],
  ["'NaN' (string)", 'NaN'],
  ["blank ''", ''],
  ["space ' '", ' '],
  ['newline', '\n'],
  ['tab', '\t'],
  ['non-breaking space', ' '],
  ['BOM', '﻿'],
  ['hex 0x10', '0x10'],
  ['thousands 1,000', '1,000'],
  ['shorthand 200k', '200k'],
  ['currency £11M', '£11M'],
  ['percent 11%', '11%'],
  ['comparator ≥ £1,000', '≥ £1,000'],
  ['trailing units 11px', '11px'],
  ['overflow literal 1e400', '1e400'],
  ['arabic-indic digits', '١١'],
  ['fullwidth digits', '１１'],
  ['null', null],
  ['undefined', undefined],
  ['true', true],
  ['false', false],
  ['empty array', []],
  ['array of one number', [1]],
  ['plain object', {}],
  ['boxed Number', new Number(11)],
  ['valueOf object', { valueOf: () => 11 }],
  ['toString object', { toString: () => '11' }],
  ['BigInt', BigInt(11)],
]

/** ⭐ LEG AS AN AXIS, including the two legs populated TOGETHER. */
const LEGS: Array<[string, (v: unknown) => Record<string, unknown>]> = [
  ['raw', (v) => ({ goal_threshold_raw: v })],
  ['user', (v) => ({ success_threshold: v, threshold_source: 'user' })],
  ['user-ungated', (v) => ({ success_threshold: v })],
  // The precedence case: a REAL raw sits beside the varying user value, so a
  // surface that selects the wrong leg answers differently from one that does not.
  ['user-over-raw', (v) => ({ success_threshold: v, threshold_source: 'user', goal_threshold_raw: 11 })],
]

const GENERATED: Shape[] = (() => {
  const values: Array<[string, unknown]> = []
  for (const [sName, sign] of SIGNS) {
    for (const [mName, mag] of MAGNITUDES) {
      for (const [cName, carry] of CARRIERS) {
        values.push([`${sName}${mName} as ${cName}`, carry(sign * mag)])
      }
    }
  }
  values.push(...NON_MAGNITUDE_VALUES)
  const shapes: Shape[] = []
  for (const [lName, build] of LEGS) {
    for (const [vName, value] of values) {
      shapes.push({ name: `${lName} / ${vName}`, data: { label: LABEL, ...build(value) } })
    }
  }
  return shapes
})()

/**
 * The card's answer for every generated shape, computed ONCE. The controls
 * below re-use this map rather than re-rendering, so they are measuring the
 * same observations the claim is made from.
 */
const cardAnswers = new Map<string, boolean>()

function census(oracle: (shape: Shape) => boolean): string[] {
  return GENERATED.filter((s) => cardAnswers.get(s.name) !== oracle(s)).map((s) => s.name)
}

describe('the divergence set over a GENERATED corpus — axes, not a hand list', () => {
  beforeEach(() => {
    for (const shape of GENERATED) {
      if (!cardAnswers.has(shape.name)) {
        cardAnswers.set(shape.name, cardSaysTargetExists(shape.data))
      }
    }
  })

  /**
   * ⛔⛔ THE GENERATOR'S SELF-CHECK — REWRITTEN, BECAUSE THE FIRST ONE FAILED AT
   * THE EXACT JOB ITS OWN COMMENT ASSIGNED IT.
   *
   * ⚠⚠ MEASURED BY INDEPENDENT REVIEW, WITH A DISCRIMINATING TRIPLE. The
   * previous version said it existed so a generator that "lost an axis in a
   * refactor" could not pass, and the file header claimed a dimensional blind
   * spot was "structurally impossible". Deleting one axis at a time:
   *
   *     drop the `-` SIGN        → RED     (the only one it caught)
   *     drop the `user-over-raw` LEG → GREEN 34/34
   *     drop the `string` CARRIER    → GREEN 34/34
   *
   * ⚠ THE CAUSE IS CIRCULARITY, NOT AN OVERSIGHT, and it is worth naming
   * precisely because it is this estate's oldest defect arriving INSIDE the
   * mechanism built to abolish it. `toHaveLength(LEGS.length * perLeg)`
   * computed `perLeg` FROM THE VERY ARRAYS UNDER TEST, so it re-derived itself
   * to match whatever survived; and `for (const [legName] of LEGS)` iterated the
   * MUTATED `LEGS`, so it asked the shortened list whether the shortened list
   * was complete. Only the hand-listed `named(...)` values were independent —
   * which is exactly why SIGN RED and the other two did not. `> 150` caught two
   * dropped legs (122) but not one (183). **A derived guard proves the copies
   * agree and can never prove the list is complete.**
   *
   * ⚠⚠ AND THE AXIS IT COULD NOT SEE IS THE ONE THAT MATTERED. Delete LEG and
   * the 7 PRECEDENCE divergences — the finding of this whole round, the class
   * nobody had enumerated — go invisible again, unguarded by the guard written
   * to make that impossible.
   *
   * So every number below is a LITERAL, and every axis has an INDEPENDENT
   * WITNESS with an exact count. Nothing here is computed from the arrays it is
   * checking. Change an axis deliberately and this test REDs and tells you the
   * new number to write down — which is the point: the edit becomes visible.
   */
  it('GENERATOR SELF-CHECK — every axis has an independent witness, and no number is derived from the arrays under test', () => {
    // ── AXIS CARDINALITIES, AS LITERALS ────────────────────────────────────
    expect(SIGNS).toHaveLength(2)
    expect(MAGNITUDES).toHaveLength(8)
    expect(CARRIERS).toHaveLength(2)
    expect(NON_MAGNITUDE_VALUES).toHaveLength(29)
    expect(LEGS).toHaveLength(4)
    // 4 legs x (2 signs x 8 magnitudes x 2 carriers + 29 non-magnitudes) = 4 x 61
    expect(GENERATED).toHaveLength(244)

    const named = (needle: string) => GENERATED.filter((s) => s.name.includes(needle)).length
    /**
     * ⚠ LEGS ARE MATCHED BY PREFIX, NOT BY `includes` — `'user-over-raw / '`
     * CONTAINS `'raw / '`, so a substring witness for the raw leg would be
     * satisfied by the precedence leg and vice versa. That is the same
     * "a guard satisfied by the wrong object" shape as trap 19, in a filter.
     */
    const leg = (prefix: string) => GENERATED.filter((s) => s.name.startsWith(prefix)).length

    // ── LEG: the axis the old check could not see. One witness each, exact. ──
    expect(leg('raw / ')).toBe(61)
    expect(leg('user / ')).toBe(61)
    expect(leg('user-ungated / ')).toBe(61)
    expect(leg('user-over-raw / ')).toBe(61) // ← the precedence leg, guarded now

    // ── CARRIER: the other axis it could not see. ──────────────────────────
    expect(named('as string')).toBe(64) // 2 signs x 8 magnitudes x 4 legs
    expect(named('as number')).toBe(64)

    // ── SIGN: both directions, because Number.isFinite is sign-symmetric. ───
    expect(named(' / +')).toBe(64)
    expect(named(' / -')).toBe(64)
    expect(named('+Infinity')).toBe(8) // 2 carriers x 4 legs
    expect(named('-Infinity')).toBe(8)
    expect(named('-0 as')).toBe(8)

    // ── Families that carry no sign, spot-witnessed. ───────────────────────
    expect(named('NaN')).toBe(8) // the bare NaN and the string 'NaN', x 4 legs
    expect(named('BigInt')).toBe(4)
    expect(named("blank ''")).toBe(4)
    expect(named('overflow literal 1e400')).toBe(4)

    // ── And the corpus genuinely SPLITS the two answers, so an "all agree"
    //    result below cannot come from a corpus where nothing has a target.
    const yes = [...cardAnswers.values()].filter(Boolean).length
    expect(yes).toBeGreaterThan(0)
    expect(yes).toBeLessThan(GENERATED.length)
  })

  /**
   * ⛔ THE CENSUS'S POSITIVE CONTROLS, IN BOTH DIRECTIONS. `census(...)`
   * returning `[]` proves nothing unless the same function can be shown to
   * REPORT divergences. Two deliberately-wrong oracles, because an instrument
   * that only ever answers one way is not discriminating — it agrees.
   */
  it('CENSUS CONTROL — a deliberately wrong oracle is reported, in both directions', () => {
    const alwaysNo = census(() => false)
    const alwaysYes = census(() => true)
    expect(alwaysNo.length).toBeGreaterThan(0)
    expect(alwaysYes.length).toBeGreaterThan(0)
    // Every shape is caught by exactly one of the two — so the census sees the
    // whole corpus, not a subset of it.
    expect(alwaysNo.length + alwaysYes.length).toBe(GENERATED.length)
  })

  /**
   * ⭐⭐ THE CLAIM: ZERO. Not "exactly these two" — the residual divergence is
   * closed at both ends (the shared predicate in `GoalNode`, and the reachable
   * writer in `AdvancedField`) rather than blessed by a pinned number.
   */
  it('the real card and the real selector NEVER disagree, across the whole generated corpus', () => {
    const divergent = census((s) => heroSaysTargetExists(s.data))
    expect(divergent).toEqual([])
  })
})
