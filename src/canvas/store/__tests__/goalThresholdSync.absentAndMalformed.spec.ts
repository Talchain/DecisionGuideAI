/**
 * ⭐⭐ THE STORE SCALAR IS THE NUMBER, AND THE COERCION THAT FILLED IT COULD
 * FABRICATE ONE.
 *
 * `setCeeAnalysisReady`'s goal-threshold sync read
 *
 *     typeof ceeThreshold === 'number' ? ceeThreshold : Number(ceeThreshold)
 *
 * and wrote the result into `store.goalThreshold` — the scalar the PLoT request
 * boundary normalises and `SuccessTargetLine` prints with `String(...)`. Two
 * holes, and the quieter one is the worse one:
 *
 *   · the `typeof number` arm has NO FINITENESS GUARD, so `NaN` and `±Infinity`
 *     went through verbatim and reached a screen as the literal "NaN".
 *   · the `Number()` arm FABRICATES A ZERO for every falsy non-number the field
 *     can hold. **A fabricated `0` is worse than a `NaN`**: `NaN` announces
 *     itself, a `0` target reads as one somebody set — and it is the value the
 *     analysis would then be asked to hit.
 *
 * ── THE ENUMERATION, AND THE CORRECTION IT FORCED ─────────────────────────
 * ⚠⚠ ABSENCE WAS NEVER THE HOLE. The brief that opened this lane said
 * `Number(undefined)` is `NaN` and `Number(null)` is `0`, and asked which of
 * those shapes reach the call. **NEITHER DOES.** The write is gated on
 * `ceeThreshold != null`, which filters `null` AND `undefined`, so every absent
 * shape correctly writes nothing at all. That is asserted below rather than
 * asserted away, because it is the commonest case on the wire (28 live nulls in
 * tonight's contract probe) and a later widening of this gate would silently
 * reopen it.
 *
 * The reachable-wrong shapes are PRESENT-BUT-NOT-A-STATED-NUMBER, and the table
 * below is the family rather than the instance that was noticed: blanks,
 * whitespace, `[]` and `false` all coerce to `0`; `'0x10'` to `16`; `true` to
 * `1`; `'Infinity'` to `Infinity`; every stated-but-non-decimal target
 * (`'11%'`, `'200k'`, `'£11M'`) to `NaN`. A guard special-casing the blank
 * would have closed one member and left its siblings open.
 *
 * ⚠ SCOPE, STATED PRECISELY (trap 20). This is DEFENCE IN DEPTH, not a witness.
 * Tonight's cross-repo contract probe found no CEE writer that can put a
 * non-number at this address, and JSON cannot encode `NaN` or `Infinity` at
 * all — so no shape in the table below is demonstrated to arrive over the wire.
 * What IS demonstrated is that the code contained a coercion branch whose
 * entire purpose is non-number input and whose every non-number input produced
 * a wrong answer. The anchor that keeps those shapes off the wire lives in
 * another repo on another schema pin; this consumer must not be able to
 * manufacture a target if it loosens — the same reasoning the norm × cap
 * removal is already documented with, six lines above the call site.
 *
 * ⚠ AND THE FIX IS NOT "REFUSE NON-NUMBERS EVERYWHERE". `'200k'` IS a target
 * somebody stated; it simply has no number. Existence is answered separately
 * and non-numerically (`isStatedTargetValue`), and `goalThreshold == null` here
 * means "no NUMBER", never "no target".
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useCanvasStore } from '../../store'
import type { CEEAnalysisReady } from '../../../adapters/cee/types'

function analysisReady(extra: Record<string, unknown>): CEEAnalysisReady {
  return {
    goal_node_id: 'goal_node',
    options: [{ id: 'option_a', label: 'Option A', status: 'ready', interventions: {} }],
    ...extra,
  } as CEEAnalysisReady
}

const read = () => ({
  value: useCanvasStore.getState().goalThreshold,
  representation: useCanvasStore.getState().goalThresholdRepresentation,
})

describe('setCeeAnalysisReady goal-threshold sync — the absent shapes', () => {
  beforeEach(() => {
    useCanvasStore.getState().reset()
    useCanvasStore.setState({ goalThreshold: null, goalThresholdRepresentation: null })
  })

  /**
   * ⭐ THE COMMON CASE, PINNED AS A CASE. A goal with no target at all is what
   * every model opens in, and 28 of the 49 captured payloads carrying this key
   * carry `null`. The gate must write NOTHING — not a `0`, not a `NaN`.
   */
  it.each([
    ['both keys absent', {}],
    ['raw null, normalised null', { goal_threshold_raw: null, goal_threshold: null }],
    ['raw undefined, normalised undefined', { goal_threshold_raw: undefined, goal_threshold: undefined }],
    ['raw null, normalised absent', { goal_threshold_raw: null }],
    ['raw absent, normalised null', { goal_threshold: null }],
  ])('%s → no write at all, and NO representation tag', (_name, payload) => {
    useCanvasStore.getState().setCeeAnalysisReady(analysisReady(payload))
    expect(read()).toEqual({ value: null, representation: null })
  })

  /**
   * ⛔ POSITIVE CONTROL (trap 13). Every assertion above is an ABSENCE, and an
   * absence proves nothing unless the same reducer, on the same fixture shape,
   * can be shown to WRITE. Without this, a `setCeeAnalysisReady` that threw on
   * entry would make all five cases pass forever.
   */
  it('POSITIVE CONTROL — the same reducer and fixture DO write a real target', () => {
    useCanvasStore.getState().setCeeAnalysisReady(analysisReady({ goal_threshold_raw: 11 }))
    expect(read()).toEqual({ value: 11, representation: 'raw' })
  })
})

describe('setCeeAnalysisReady goal-threshold sync — present, but not a stated number', () => {
  beforeEach(() => {
    useCanvasStore.getState().reset()
    useCanvasStore.setState({ goalThreshold: null, goalThresholdRepresentation: null })
  })

  /**
   * ⭐⭐ THE FAMILY, WITH THE OLD OUTPUT NAMED PER ROW so a reviewer can see
   * what each one used to put on screen. Every row asserts the SAME thing now —
   * no number, no tag — because "not a stated number" is one answer, not nine.
   *
   * ⚠ `.each` so a failure names the shape. A loop that fails on row two hides
   * the other eight.
   */
  const NOT_A_STATED_NUMBER: Array<[string, unknown, string]> = [
    ['a blank string', '', 'was 0 — a fabricated target that reads as a real one'],
    ['whitespace', '   ', 'was 0'],
    ['a newline', '\n', 'was 0'],
    ['an empty array', [], 'was 0'],
    ['false', false, 'was 0'],
    ['true', true, 'was 1'],
    ['hex notation', '0x10', 'was 16 — a magnitude nobody wrote'],
    ['the word Infinity', 'Infinity', 'was Infinity'],
    ['a bare NaN', Number.NaN, 'was NaN — rendered as the literal "NaN"'],
    ['a bare Infinity', Number.POSITIVE_INFINITY, 'was Infinity'],
    ['a thousands separator', '1,000', 'was NaN'],
    ['a shorthand magnitude', '200k', 'was NaN'],
    ['a percentage', '11%', 'was NaN'],
    ['an object', {}, 'was NaN'],
    /**
     * ⭐⭐ THE THREE THAT PASS THE GRAMMAR AND STILL OVERFLOW — the rows that
     * make `statedTargetNumber`'s TRAILING `Number.isFinite(parsed)` re-check
     * load-bearing rather than belt-and-braces.
     *
     * ⚠ ADDED AFTER A SURVIVING MUTANT. Deleting that trailing check left the
     * whole suite green: every other refused shape is caught by the decimal
     * grammar, and these are the only ones that satisfy the grammar and then
     * overflow to `Infinity` under `Number()`. Without them the re-check was
     * untested code that looked redundant, which is how it gets deleted.
     * `9e999` is a fat-finger, not an adversarial input.
     */
    ['an overflowing exponent', '1e400', 'was Infinity'],
    ['a fat-finger exponent', '9e999', 'was Infinity'],
    ['a negative overflow', '-1e400', 'was -Infinity'],
  ]
  it.each(NOT_A_STATED_NUMBER)('%s (%#) writes no number — %s', (_name, raw) => {
    useCanvasStore.getState().setCeeAnalysisReady(analysisReady({ goal_threshold_raw: raw }))
    expect(read()).toEqual({ value: null, representation: null })
  })

  /** The normalised leg carries the same coercion and gets the same guard. */
  it.each([
    ['a blank string', ''],
    ['a bare NaN', Number.NaN],
    ['a bare Infinity', Number.POSITIVE_INFINITY],
  ])('the NORMALISED leg refuses %s too', (_name, norm) => {
    useCanvasStore.getState().setCeeAnalysisReady(analysisReady({ goal_threshold: norm }))
    expect(read()).toEqual({ value: null, representation: null })
  })

  /**
   * ⭐ THE ACCEPTED HALF, so the guard cannot degenerate into "refuse
   * everything" and pass this file by writing nothing ever. A stated decimal is
   * a target however it is spelled.
   */
  it.each([
    ['a real zero, which IS a target somebody set', 0, 0],
    ['a decimal string', '11', 11],
    ['a padded decimal string', ' 11 ', 11],
    ['a negative', '-3.5', -3.5],
    ['scientific notation', '1e5', 100000],
    ['a leading-dot decimal', '.5', 0.5],
    ['a plain number', 11, 11],
  ])('ACCEPTED — %s', (_name, raw, expected) => {
    useCanvasStore.getState().setCeeAnalysisReady(analysisReady({ goal_threshold_raw: raw }))
    expect(read()).toEqual({ value: expected, representation: 'raw' })
  })

  /**
   * ⚠⚠ A REFUSED SHAPE MUST NOT CLOBBER A TARGET THE STORE ALREADY HOLDS —
   * and it must not clobber it with `null` either. The old code wrote `0` over
   * a stored `20` whenever the gate was armed; refusing must leave the stored
   * value exactly where it was.
   */
  it('a refused shape leaves an existing stored target untouched', () => {
    useCanvasStore.setState({ goalThreshold: 20, goalThresholdRepresentation: 'normalised' })
    // The gate IS armed here — 'raw' supersedes the store's own normalised
    // guess — so this is the case where the old coercion could overwrite.
    useCanvasStore.getState().setCeeAnalysisReady(analysisReady({ goal_threshold_raw: '' }))
    expect(read()).toEqual({ value: 20, representation: 'normalised' })
  })

  it('PRECONDITION CONTROL — that same armed gate DOES supersede with a real raw', () => {
    // Pins the case above as a genuine refusal rather than a gate that was shut
    // anyway. Without this, the assertion could pass on a payload that could
    // never have written whatever it carried.
    useCanvasStore.setState({ goalThreshold: 20, goalThresholdRepresentation: 'normalised' })
    useCanvasStore.getState().setCeeAnalysisReady(analysisReady({ goal_threshold_raw: 11 }))
    expect(read()).toEqual({ value: 11, representation: 'raw' })
  })
})

/**
 * ⭐⭐ THE SECOND WRITER OF THE SAME SCALAR — and it had no test at all.
 *
 * ⚠ FOUND BY A SURVIVING MUTANT, after an independent review rowed it.
 * `deriveGoalThresholdFromNode` writes `store.goalThreshold` from the goal
 * node, and gated on `typeof success_threshold === 'number'` it admitted the
 * exact magnitudes `setCeeAnalysisReady`'s sync was just guarded against.
 * Reverting its guard left the whole suite green — a defect surviving its own
 * fix because only one of two writers was closed.
 *
 * ⚠ AND IT IS REACHABLE, WHICH IS WHY IT IS NOT MERELY TIDINESS: `AdvancedField`
 * was committing `Infinity` / `-Infinity` / `1e400` / `9e999` onto the node
 * through `setThreshold` (driven in `AdvancedField.finiteGuard.spec.tsx`), and
 * `setOutcomeNode(..., { rederiveThreshold: true })` — the user re-selecting
 * their goal — is a public path straight into this function.
 */
describe('deriveGoalThresholdFromNode — the OTHER writer of store.goalThreshold', () => {
  const seedGoal = (data: Record<string, unknown>) => {
    useCanvasStore.getState().reset()
    useCanvasStore.setState({
      nodes: [{ id: 'g1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Goal', ...data } }],
      goalThreshold: null,
      goalThresholdRepresentation: null,
    } as never)
  }

  it('POSITIVE CONTROL — a real user target on the node IS adopted on re-selection', () => {
    // Without this, every refusal below could pass on a path that never writes.
    seedGoal({ success_threshold: 20, threshold_source: 'user' })
    useCanvasStore.getState().setOutcomeNode('g1', { rederiveThreshold: true })
    expect(read()).toEqual({ value: 20, representation: 'raw' })
  })

  it.each([
    ['NaN', Number.NaN],
    ['+Infinity', Number.POSITIVE_INFINITY],
    ['-Infinity', Number.NEGATIVE_INFINITY],
  ])('refuses a %s user target rather than adopting it', (_name, value) => {
    seedGoal({ success_threshold: value, threshold_source: 'user' })
    useCanvasStore.getState().setOutcomeNode('g1', { rederiveThreshold: true })
    expect(read()).toEqual({ value: null, representation: null })
  })

  it('CONTRAST CONTROL — a real zero IS a target and is still adopted', () => {
    // Proves the guard refuses non-finite values rather than falsy ones.
    seedGoal({ success_threshold: 0, threshold_source: 'user' })
    useCanvasStore.getState().setOutcomeNode('g1', { rederiveThreshold: true })
    expect(read()).toEqual({ value: 0, representation: 'raw' })
  })
})
