/**
 * ⭐⭐⭐ A FACTOR VALUE OUTSIDE THE FACTOR'S OWN DECLARED RANGE IS ACCEPTED, AND
 * THE ANALYSIS THEN RUNS ON IT.
 *
 * ── THE MEASURED DEFECT (staging `67b04e5b`, 10 Sep 2026) ────────────────────
 * Every factor in the drafted model carries `prior: {range_min: 0, range_max: 1}`.
 *
 *  · Typing `40` into such a factor is accepted at INPUT, REVIEW *and* CONFIRM.
 *    It stores `value: 4` — four times the declared ceiling.
 *  · The analysis RUNS ON IT. Proven by a discriminating pair: the in-range twin
 *    (`10` → `value: 1`, exactly `range_max`) and the out-of-range run give
 *    DIFFERENT results (-0.2377 vs -0.7047). A clamp would have made them
 *    identical, so nothing downstream is bounding this.
 *  · A rerun on an unchanged graph reproduces the option means bit-identically
 *    to 17 significant figures, so the noise band is ZERO — none of that
 *    movement is sampling.
 *  · `+250` reversed the ranking outright.
 *  · There is no bounds check anywhere: `4` and `50` complete with
 *    `leader_claim.permitted: true`. `-50` fails only INCIDENTALLY, via scale
 *    resolution, giving the wrong reason.
 *  · The user is told nothing, and the result screen reads "Analysis reflects
 *    the current model."
 *
 * ── WHAT THIS SPEC PINS, AND IN WHICH SPACE ──────────────────────────────────
 * `prior.range_min/range_max` are MODEL-SCALE (normalised) numbers — stated at
 * `nodes/shared/factorPriorRange.ts` ("Lane C3: prior.range_min/max are
 * NORMALISED 0–1 values"). The number the user TYPES may be in USER UNITS: the
 * commit stores `normaliseRawFactorValue(typed, cap)` (`factorValueEdit.ts`),
 * which is exactly why `40` on a cap-10 factor lands as `4`.
 *
 * ⭐ SO THE INVARIANT IS WRITTEN AGAINST THE SPEC, NOT AGAINST THE SYMPTOM:
 *
 *      the value the commit WOULD STORE must lie within [range_min, range_max]
 *
 * — never "the typed number must be ≤ 1", which is the failure mode I happened
 * to arrive through and which would refuse the legitimate `10`. The guard runs
 * the SAME forward transform the emitter runs, so it admits exactly what the
 * model can hold; no bound is ever inverted to reach a verdict (the inverse is
 * used for the SENTENCE only, after the verdict — the discipline
 * `unproposableDraftReason` already follows for the goal arm).
 *
 * ⚠ THE NEGATIVE CASE IS FIRST-CLASS, because the sign asymmetry is exactly how
 * this hid: `-50` "failed" already, for an unrelated reason, and a guard written
 * as `> range_max` would look correct against every symptom in hand while
 * leaving the whole lower half open (CLAUDE.md trap 13d).
 *
 * ⚠ BOUNDARY IS ACCEPTANCE, NOT REFUSAL. `10` → `value: 1` IS `range_max` and is
 * legitimate; a guard that refuses its own ceiling is a new defect, not a fix.
 *
 * ⛔ SCOPE. UI input guard only. Nothing here asserts anything about the engine,
 * the projection or CEE, and the fix is correct whether the engine consumes the
 * raw or the normalised figure, because the value is stopped at ENTRY.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, cleanup, fireEvent, screen } from '@testing-library/react'
import type { Node, Edge } from '@xyflow/react'

const sendSystemEvent = vi.fn()

// Trap 12: spread the real module rather than hand-listing its exports.
vi.mock('../../conversation/ConversationContext', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, useOptionalConversationContext: () => ({ sendSystemEvent }) }
})

vi.mock('../../utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusEdgeById: vi.fn(),
}))

import { ModelTabV2Panel } from '../ModelTabV2Panel'
import { useCanvasStore } from '../../store'
import { openOutlineGroups } from './openOutlineGroups'

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures — the LIVE shape, not one invented here
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The witness factor. `cap: 10` with `raw_value` present is what makes the input
 * USER-UNIT (`resolveValueInputSeed` → `inUserUnits: true`), which is the arm the
 * measured `40 → 4` came down. Its prior is the measured `{0, 1}`.
 */
const BOUNDED_ID = 'fac_bounded'

/**
 * ⭐ THE DISCRIMINATING TWIN. Same shape, same bound, DIFFERENT identity.
 * Without a second bounded factor, "loosen the guard for a DIFFERENT factor
 * only" is not a mutation anyone can apply, and the pair that proves the
 * assertions bind BY IDENTITY rather than to "some row somewhere refused"
 * cannot exist (CLAUDE.md trap 19).
 */
const OTHER_BOUNDED_ID = 'fac_other_bounded'

/** No prior at all — the declared-range-absent case. Must gain NO refusal. */
const NO_PRIOR_ID = 'fac_no_prior'

/** A prior that is a bare probability, not a distribution — no range. */
const SCALAR_PRIOR_ID = 'fac_scalar_prior'

/** A distribution with only ONE end declared — not a range either. */
const HALF_PRIOR_ID = 'fac_half_prior'

/**
 * ⭐ A DISTRIBUTION OBJECT WITH NEITHER END. Added because a mutant SURVIVED
 * without it: inventing a default bound on the missing-`range_min` arm changed
 * nothing, since no fixture reached that arm — the object-prior rows all
 * declared a `range_min`. A corpus that omits a shape the type admits cannot
 * certify the code over that shape (CLAUDE.md trap 13d).
 */
const EMPTY_PRIOR_ID = 'fac_empty_prior'

/**
 * ⭐⭐ THE FACTOR WHOSE MODEL SCALE *IS* A REAL-WORLD MAGNITUDE — a declared unit
 * and NO cap. `isMagnitudeScaledFactor`'s own header records the measured shape
 * (`{value: 40000, unit: '£', raw_value: 40000}`): CEE stores raw and model
 * IDENTICALLY there, so a 0–1 prior is NOT the support of `value` and refusing
 * £40,000 against it would be a brand-new false refusal.
 */
const MAGNITUDE_ID = 'fac_magnitude_scaled'

/** An INVERTED range (min > max). Degenerate: must refuse nothing, not everything. */
const INVERTED_ID = 'fac_inverted_range'

const UNIT_PRIOR = { distribution: 'uniform', range_min: 0, range_max: 1 }

function factor(id: string, data: Record<string, unknown>): Node {
  return {
    id,
    type: 'factor',
    position: { x: 0, y: 0 },
    data: { label: `Label ${id}`, kind: 'factor', category: 'observable', ...data },
  } as unknown as Node
}

const allNodes = (): Node[] => [
  factor(BOUNDED_ID, {
    prior: { ...UNIT_PRIOR },
    observedState: { value: 0.5, raw_value: 5, cap: 10, source: 'cee_inference' },
  }),
  factor(OTHER_BOUNDED_ID, {
    prior: { ...UNIT_PRIOR },
    observedState: { value: 0.5, raw_value: 5, cap: 10, source: 'cee_inference' },
  }),
  factor(NO_PRIOR_ID, {
    observedState: { value: 0.5, raw_value: 5, cap: 10, source: 'cee_inference' },
  }),
  factor(SCALAR_PRIOR_ID, {
    prior: 0.5,
    observedState: { value: 0.5, raw_value: 5, cap: 10, source: 'cee_inference' },
  }),
  factor(HALF_PRIOR_ID, {
    prior: { distribution: 'uniform', range_min: 0 },
    observedState: { value: 0.5, raw_value: 5, cap: 10, source: 'cee_inference' },
  }),
  factor(EMPTY_PRIOR_ID, {
    prior: { distribution: 'uniform' },
    observedState: { value: 0.5, raw_value: 5, cap: 10, source: 'cee_inference' },
  }),
  factor(MAGNITUDE_ID, {
    prior: { ...UNIT_PRIOR },
    observedState: { value: 40000, raw_value: 40000, unit: '£', source: 'cee_inference' },
  }),
  factor(INVERTED_ID, {
    prior: { distribution: 'uniform', range_min: 1, range_max: 0 },
    observedState: { value: 0.5, raw_value: 5, cap: 10, source: 'cee_inference' },
  }),
]
const allEdges = (): Edge[] => []

function seedStore() {
  useCanvasStore.setState({ nodes: allNodes(), edges: allEdges() } as never, false)
}

function observed(id: string): Record<string, unknown> {
  const n = useCanvasStore.getState().nodes.find(x => x.id === id)
  return ((n?.data as Record<string, unknown> | undefined)?.observedState ?? {}) as Record<string, unknown>
}

function renderPanel() {
  render(<ModelTabV2Panel nodes={allNodes()} edges={allEdges()} goalThreshold={null} />)
  openOutlineGroups()
}

/** Open the editor on one row and type `draft` into it. Returns the input. */
function typeInto(id: string, draft: string): HTMLElement {
  fireEvent.click(screen.getByTestId(`model-row-v2-${id}-value`))
  const input = screen.getByTestId(`model-row-v2-${id}-value-input`)
  fireEvent.change(input, { target: { value: draft } })
  return input
}

const blockedText = (id: string): string | null =>
  screen.queryByTestId(`model-row-v2-${id}-value-blocked`)?.textContent ?? null

beforeEach(() => {
  vi.clearAllMocks()
  seedStore()
})
afterEach(() => cleanup())

// ─────────────────────────────────────────────────────────────────────────────
// PRECONDITIONS — pinned in-test, so a pass can never be the fixture failing
// ─────────────────────────────────────────────────────────────────────────────

describe('PRECONDITIONS — the fixture really is the measured shape', () => {
  it('the witness factor is editable and seeds from its USER-UNIT raw value', () => {
    renderPanel()
    fireEvent.click(screen.getByTestId(`model-row-v2-${BOUNDED_ID}-value`))
    // `raw_value: 5`, not the model-scale `0.5` — so a typed number on this row
    // is a user-unit magnitude and the cap is live. Without this, the whole
    // scale argument below would be about a row that never took that arm.
    expect(screen.getByTestId(`model-row-v2-${BOUNDED_ID}-value-input`)).toHaveValue('5')
  })

  it('the discriminating twin is a SEPARATE row with the SAME bound', () => {
    renderPanel()
    fireEvent.click(screen.getByTestId(`model-row-v2-${OTHER_BOUNDED_ID}-value`))
    expect(screen.getByTestId(`model-row-v2-${OTHER_BOUNDED_ID}-value-input`)).toHaveValue('5')
    expect(OTHER_BOUNDED_ID).not.toBe(BOUNDED_ID)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// ⭐ THE DEFECT: a value outside the declared range is REFUSED, and SAYS SO
// ─────────────────────────────────────────────────────────────────────────────

describe('⭐⭐ a draft outside the factor\'s own declared range is refused at INPUT', () => {
  it('⭐ THE MEASURED CASE — `40` on a cap-10 factor would store 4, four times `range_max`', () => {
    renderPanel()
    typeInto(BOUNDED_ID, '40')
    // (ii) the words are RENDERED, not promised by a title — the same bar the
    // goal-editor refusals are held to.
    expect(blockedText(BOUNDED_ID)).toBe('Enter a value between 0 and 10 to review this change')
    const why = screen.getByTestId(`model-row-v2-${BOUNDED_ID}-value-blocked`)
    expect(why.getAttribute('title')).toBeNull()
  })

  it('⭐ and the advance control is honestly disabled — the review step is not reached', () => {
    renderPanel()
    typeInto(BOUNDED_ID, '40')
    expect(screen.getByTestId(`model-row-v2-${BOUNDED_ID}-review`)).toBeDisabled()
  })

  it('⭐⭐ ENTER IS REFUSED BY THE HOST — the disabled button is not the guard', () => {
    // The ungated route. `onKeyDown` calls `onProposeEdit` unconditionally, so
    // this is the only assertion that says anything about the PANEL. A mutant
    // that deletes the host guard walks straight through everything else.
    renderPanel()
    const input = typeInto(BOUNDED_ID, '40')
    expect(input).toBeEnabled()
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(screen.getByTestId(`model-row-v2-${BOUNDED_ID}-value-input`)).toBeInTheDocument()
    expect(screen.queryByTestId(`model-row-v2-${BOUNDED_ID}-confirm`)).not.toBeInTheDocument()
    expect(observed(BOUNDED_ID).raw_value).toBe(5)
    expect(sendSystemEvent).not.toHaveBeenCalled()
  })

  it('⭐ THE NEGATIVE CASE — `-50` is refused for the RIGHT reason, not incidentally', () => {
    // Measured: `-50` already failed on staging, but via scale resolution, so
    // the user was told something else entirely. A guard written as `> max`
    // passes every positive case above and leaves this whole half open.
    renderPanel()
    typeInto(BOUNDED_ID, '-50')
    expect(blockedText(BOUNDED_ID)).toBe('Enter a value between 0 and 10 to review this change')
    expect(screen.getByTestId(`model-row-v2-${BOUNDED_ID}-review`)).toBeDisabled()
  })

  it('⭐ `250` — the ranking-reversal magnitude — is refused too', () => {
    renderPanel()
    typeInto(BOUNDED_ID, '250')
    expect(screen.getByTestId(`model-row-v2-${BOUNDED_ID}-review`)).toBeDisabled()
  })

  it('⛔ NOTHING IS SILENTLY CLAMPED — the input still holds what the user typed', () => {
    // A silently corrected value is the same class of defect as a silently
    // corrupted one. Refuse and say why; never rewrite the user's number.
    renderPanel()
    typeInto(BOUNDED_ID, '40')
    expect(screen.getByTestId(`model-row-v2-${BOUNDED_ID}-value-input`)).toHaveValue('40')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// ⭐ THE BOUNDARY IS ACCEPTED — a guard that refuses its own ceiling is a defect
// ─────────────────────────────────────────────────────────────────────────────

describe('⭐⭐ the boundary is ACCEPTED — `range_max` is admissible, not refused', () => {
  it('⭐ `10` → `value: 1`, EXACTLY `range_max`, reaches the review step', () => {
    renderPanel()
    typeInto(BOUNDED_ID, '10')
    expect(blockedText(BOUNDED_ID)).toBeNull()
    expect(screen.getByTestId(`model-row-v2-${BOUNDED_ID}-review`)).toBeEnabled()
    fireEvent.click(screen.getByTestId(`model-row-v2-${BOUNDED_ID}-review`))
    expect(screen.getByTestId(`model-row-v2-${BOUNDED_ID}-confirm`)).toBeInTheDocument()
  })

  it('⭐ `0` → `value: 0`, EXACTLY `range_min`, is admissible too', () => {
    renderPanel()
    typeInto(BOUNDED_ID, '0')
    expect(blockedText(BOUNDED_ID)).toBeNull()
    expect(screen.getByTestId(`model-row-v2-${BOUNDED_ID}-review`)).toBeEnabled()
  })

  it('⛔ CONTRAST CONTROL — an ordinary in-range draft is untouched', () => {
    renderPanel()
    typeInto(BOUNDED_ID, '5')
    expect(blockedText(BOUNDED_ID)).toBeNull()
    expect(screen.getByTestId(`model-row-v2-${BOUNDED_ID}-review`)).toBeEnabled()
  })

  it('⛔ THE EXISTING REFUSAL IS UNCHANGED — an unparseable draft keeps ITS message', () => {
    // A range guard that swallowed the parse refusal would be a second
    // vocabulary for one question. The messages must still discriminate.
    renderPanel()
    typeInto(BOUNDED_ID, 'abc')
    expect(blockedText(BOUNDED_ID)).toBe('Enter a number to review this change')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// ⛔ NO DECLARED RANGE MUST NOT BECOME A NEW REFUSAL
// ─────────────────────────────────────────────────────────────────────────────

describe('⛔ a factor with NO declared range gains no refusal whatsoever', () => {
  it('no `prior` at all — a large value is still admissible', () => {
    renderPanel()
    typeInto(NO_PRIOR_ID, '400')
    expect(blockedText(NO_PRIOR_ID)).toBeNull()
    expect(screen.getByTestId(`model-row-v2-${NO_PRIOR_ID}-review`)).toBeEnabled()
  })

  it('a BARE-NUMBER prior is a probability, not a range — no refusal', () => {
    // `PriorSchema = z.union([z.number().min(0).max(1), PriorDistributionSchema])`.
    // Enumerated from the TYPE, not from a grep of live payloads.
    renderPanel()
    typeInto(SCALAR_PRIOR_ID, '400')
    expect(blockedText(SCALAR_PRIOR_ID)).toBeNull()
  })

  it('a HALF-DECLARED range (`range_min` only) is not a range — no refusal', () => {
    // Both ends are `.optional()` in `PriorDistributionSchema`.
    renderPanel()
    typeInto(HALF_PRIOR_ID, '400')
    expect(blockedText(HALF_PRIOR_ID)).toBeNull()
  })

  it('a distribution object with NEITHER end declared is not a range — no refusal', () => {
    // The shape a surviving mutant proved the corpus was missing.
    renderPanel()
    typeInto(EMPTY_PRIOR_ID, '400')
    expect(blockedText(EMPTY_PRIOR_ID)).toBeNull()
    expect(screen.getByTestId(`model-row-v2-${EMPTY_PRIOR_ID}-review`)).toBeEnabled()
  })

  it('an INVERTED range refuses NOTHING rather than everything', () => {
    // A degenerate declaration must fail OPEN here: refusing every value on a
    // malformed prior would lock the user out of a row they can still fix.
    renderPanel()
    typeInto(INVERTED_ID, '400')
    expect(blockedText(INVERTED_ID)).toBeNull()
  })

  it('⭐⭐ a MAGNITUDE-SCALED factor (unit, no cap) is not bounded by a 0–1 prior', () => {
    // `isMagnitudeScaledFactor`: CEE stores `value` and `raw_value` identically
    // when a factor declares a unit and no cap, so the prior's 0–1 range is not
    // the support of `value` there. Refusing £40,000 against it would be a new
    // false refusal invented by this change.
    renderPanel()
    typeInto(MAGNITUDE_ID, '40000')
    expect(blockedText(MAGNITUDE_ID)).toBeNull()
    expect(screen.getByTestId(`model-row-v2-${MAGNITUDE_ID}-review`)).toBeEnabled()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// ⭐ THE DISCRIMINATING PAIR — the refusal binds to THIS factor, by identity
// ─────────────────────────────────────────────────────────────────────────────

describe('⭐⭐ the refusal is bound to the row that declares the bound', () => {
  it('the twin refuses INDEPENDENTLY — each row is judged against its own prior', () => {
    renderPanel()
    typeInto(OTHER_BOUNDED_ID, '40')
    expect(blockedText(OTHER_BOUNDED_ID)).toBe(
      'Enter a value between 0 and 10 to review this change',
    )
    // And the untouched row says nothing — a refusal rendered on every row at
    // once would satisfy every assertion above.
    expect(blockedText(BOUNDED_ID)).toBeNull()
  })

  it('⛔ the unbounded rows are silent while a bounded row refuses', () => {
    renderPanel()
    typeInto(BOUNDED_ID, '40')
    expect(blockedText(BOUNDED_ID)).not.toBeNull()
    expect(blockedText(NO_PRIOR_ID)).toBeNull()
    expect(blockedText(MAGNITUDE_ID)).toBeNull()
  })
})
