/**
 * ⭐⭐⭐ A FACTOR THAT RECORDS NO RANGE ACCEPTS A BARE AMOUNT IN SILENCE, AND THE
 * MODEL IS THEN PERMANENTLY UNANALYSABLE WITH NO WAY OUT THROUGH THE UI.
 *
 * ── THE MEASURED DEFECT (served build, 10 Sep 2026) ──────────────────────────
 * On a drafted factor declaring no prior range ("Tier-1 Outsource Quality
 * Control"), every link measured:
 *
 *  1. this row editor accepted a bare `70` with NO warning at any beat;
 *  2. propose then Confirm reported `Applied`, and the node then carried
 *     `observedState = {raw_value: 70, source: 'user', value: 70}`;
 *  3. Analyse then refused, every time and correctly: "recorded as a bare amount
 *     with no range for me to measure it against ... I've stopped rather than
 *     show you a confident wrong answer";
 *  4. the `Analyse first pass` control was ENABLED when clicked
 *     (`disabled === false`), because CEE's `graph-readiness` separately reported
 *     `can_run_analysis: true, issues: []`;
 *  5. no range editor is reachable anywhere: all four non-test `prior_range_edit`
 *     mount paths are dead, and `model-tab-v2/contracts.ts` declares
 *     `proposePriorRange` with zero implementations;
 *  6. the applied value cannot be cleared. Emptying the input disables
 *     `Review change`, and no unset affordance exists.
 *
 * ── WHY (6) IS NOT A MISSING BUTTON ──────────────────────────────────────────
 * Derived BY EXECUTION against the vendored `@talchain/schemas@0.54.0`, this
 * repo's own pin, with a passing positive control and a discriminating result
 * (3 of 11 payloads accepted, so the instrument was not answering uniformly):
 *
 *      value: null           REFUSED   value: Expected number, received null
 *      value omitted         REFUSED   value: Required
 *      value: NaN            REFUSED   value: Expected number, received nan
 *      { ..., clear: true }  REFUSED   Unrecognized key(s) in object: 'clear'
 *      chip_click + params   REFUSED   Unrecognized key(s) in object: 'params'
 *
 * `FactorValueEditEvent.value` is `z.number().finite()`, REQUIRED, inside a
 * `.strict()` object, and the contract says so in its own words: "an edit with
 * no value is a `direct_graph_edit` notification, not this event". `chip_click`
 * is `{kind, chip_id}` strict at this version and carries no target, so it cannot
 * address a factor either. THERE IS NO WIRE ROUTE THAT RETURNS A FACTOR TO NO
 * VALUE. A clear is not a UI omission; it is unexpressible, and closing it needs
 * `olumi-schemas` first, then a CEE reader, then this client, in that order (the
 * reader-first sequencing the member's own comment mandates).
 *
 * ── SO WHAT THIS SPEC PINS ───────────────────────────────────────────────────
 * The one beat at which a user can still avoid the trap: BEFORE they commit.
 *
 * ⛔⛔ IT IS A STATEMENT OF FACT AND MUST NEVER BECOME A REFUSAL, AND NO RANGE MAY
 * BE SYNTHESISED. #1428's own source states the binding principle: "ABSENCE IS
 * THE DEFAULT AND IT FAILS OPEN. A factor that declares no usable range gains NO
 * refusal from this. A guard that invents a bound is a worse defect." Here that
 * is sharper still: a refusal would demand a repair route the product does not
 * have. Section (b) below is the assertion that REDs if anyone turns this into a
 * block, and it is the reason this file is worth more than its longest test.
 *
 * ⚠ CEE'S REFUSAL SENTENCE IS NOT TOUCHED, NOT COPIED AND NOT ASSERTED HERE. It
 * is CEE-owned and it is good. This is the client stating what it can see about
 * the node in front of it, at a beat CEE never reaches.
 *
 * ── THE TRAP-21 SECTION IS THE LOAD-BEARING ONE ──────────────────────────────
 * `resolveFactorValueAdmission` (#1428) and `factorDeclaresNoRange` (here) look
 * like one question and are two:
 *
 *   admission → "does this prior's SUPPORT admit the number being typed?"
 *               `null` on three grounds: no range · inverted bounds · a
 *               magnitude-scaled factor whose prior is not the support of `value`.
 *   this one  → "has anyone RECORDED a range for this factor?"
 *
 * An inverted declaration and a magnitude-scaled factor carrying both ends are
 * `null` for the first and `false` for the second. Reading one as the negation of
 * the other prints a falsehood on those rows, on screen, to the user. Section (c)
 * exists so that folding them RED-lines instead of staying green.
 *
 * ── WHAT THIS SPEC CANNOT CLAIM ──────────────────────────────────────────────
 * jsdom performs no layout, so nothing here is a claim about legibility or
 * position. Nothing here is a claim about CEE, about `graph-readiness`, or about
 * whether the analysis runs. It asserts DOM presence bound by testid, the exact
 * rendered bytes, and the fact that the advance control is untouched.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, cleanup, fireEvent, screen } from '@testing-library/react'
import type { Node, Edge } from '@xyflow/react'

import { factorDeclaresNoRange } from '../../conversation/factorValueEdit'
import { toModelRows } from '../adapters'

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

import * as ModelRowViewModule from '../ModelRowView'
import { ModelTabV2Panel } from '../ModelTabV2Panel'
import { useCanvasStore } from '../../store'
import { openOutlineGroups } from './openOutlineGroups'

// ─────────────────────────────────────────────────────────────────────────────
// THE SENTENCE, SPELLED OUT
//
// ⛔ DELIBERATELY NOT IMPORTED FROM THE COMPONENT. A spec that compared the
// render against the component's own constant would pass on ANY wording,
// including wording that breaks the copy rules, and would be a guard agreeing
// with itself (CLAUDE.md trap 13b). These are the bytes a user reads.
// ─────────────────────────────────────────────────────────────────────────────
const NOTICE =
  'This factor records no range. An amount entered here has nothing to measure it against, and once applied it cannot be removed.'

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures — shapes enumerated from `PriorSchema`, not from a grep of payloads
// ─────────────────────────────────────────────────────────────────────────────

/** The witness: no `prior` key at all. This is the measured live shape. */
const NO_PRIOR_ID = 'fac_no_prior'

/** A prior that is a bare probability (the number arm of the union). No range. */
const SCALAR_PRIOR_ID = 'fac_scalar_prior'

/** A distribution object carrying NEITHER end. No range. */
const EMPTY_PRIOR_ID = 'fac_empty_prior'

/**
 * ⭐ THE DISCRIMINATING TWIN, and without it every assertion below is satisfied
 * by a component that renders the sentence unconditionally.
 */
const RANGED_ID = 'fac_ranged'

/**
 * ⭐⭐ TRAP 21, ARM ONE. `min > max`. `resolveFactorValueAdmission` returns `null`
 * here (refuse nothing, correctly). This factor DOES record a range, so the
 * sentence would be a lie.
 */
const INVERTED_ID = 'fac_inverted_range'

/**
 * ⭐⭐ TRAP 21, ARM TWO. A declared unit and NO cap, carrying BOTH range ends.
 * `resolveFactorValueAdmission` returns `null` because a 0-1 prior is not the
 * support of a magnitude-scaled `value`. It still RECORDS a range.
 */
const MAGNITUDE_ID = 'fac_magnitude_scaled'

/** ONE end only. A record, however partial, so the sentence must not fire. */
const HALF_PRIOR_ID = 'fac_half_prior'

const UNIT_PRIOR = { distribution: 'uniform', range_min: 0, range_max: 1 }

function factor(id: string, data: Record<string, unknown>): Node {
  return {
    id,
    type: 'factor',
    position: { x: 0, y: 0 },
    data: { label: `Label ${id}`, kind: 'factor', category: 'observable', ...data },
  } as unknown as Node
}

/** The measured observed state of the witness row: a bare amount, user-set. */
const BARE = { value: 70, raw_value: 70, source: 'user' }

const allNodes = (): Node[] => [
  factor(NO_PRIOR_ID, { observedState: { ...BARE } }),
  factor(SCALAR_PRIOR_ID, { prior: 0.5, observedState: { ...BARE } }),
  factor(EMPTY_PRIOR_ID, { prior: { distribution: 'uniform' }, observedState: { ...BARE } }),
  factor(RANGED_ID, { prior: { ...UNIT_PRIOR }, observedState: { value: 0.5, raw_value: 5, cap: 10 } }),
  factor(INVERTED_ID, {
    prior: { distribution: 'uniform', range_min: 1, range_max: 0 },
    observedState: { value: 0.5, raw_value: 5, cap: 10 },
  }),
  factor(MAGNITUDE_ID, {
    prior: { ...UNIT_PRIOR },
    observedState: { value: 40000, raw_value: 40000, unit: '£' },
  }),
  factor(HALF_PRIOR_ID, {
    prior: { distribution: 'uniform', range_min: 0 },
    observedState: { ...BARE },
  }),
]
const allEdges = (): Edge[] => []

function seedStore() {
  useCanvasStore.setState({ nodes: allNodes(), edges: allEdges() } as never, false)
}

function renderPanel() {
  render(<ModelTabV2Panel nodes={allNodes()} edges={allEdges()} goalThreshold={null} />)
  openOutlineGroups()
}

/** Open the editor on one row and type `draft` into it. */
function typeInto(id: string, draft: string): HTMLElement {
  fireEvent.click(screen.getByTestId(`model-row-v2-${id}-value`))
  const input = screen.getByTestId(`model-row-v2-${id}-value-input`)
  fireEvent.change(input, { target: { value: draft } })
  return input
}

const noticeText = (id: string): string | null =>
  screen.queryByTestId(`model-row-v2-${id}-no-range`)?.textContent ?? null

const blockedText = (id: string): string | null =>
  screen.queryByTestId(`model-row-v2-${id}-value-blocked`)?.textContent ?? null

const reviewButton = (id: string): HTMLElement =>
  screen.getByTestId(`model-row-v2-${id}-review`)

/**
 * The rows the REAL adapter produces from the REAL nodes — not hand-written
 * `ModelRow` literals. A fixture I wrote myself would encode my model of the
 * producer rather than the producer (CLAUDE.md trap 16-inverse), and the whole
 * question here is what the adapter derives from a node's `prior`.
 */
const rows = () => toModelRows({ nodes: allNodes(), edges: [], goalThreshold: null })
const rowFor = (id: string) => rows().find(r => r.id === id)

beforeEach(() => {
  vi.clearAllMocks()
  seedStore()
})
afterEach(() => cleanup())

// ─────────────────────────────────────────────────────────────────────────────
// PRECONDITIONS — pinned in-test, so a pass can never be the fixture failing
// ─────────────────────────────────────────────────────────────────────────────

describe('PRECONDITIONS — the producer and the fixture really are what is claimed', () => {
  it('POSITIVE CONTROL: the predicate DISCRIMINATES, so an absence below is a verdict', () => {
    // Both directions in one assertion. A predicate that answered uniformly
    // would satisfy every "no notice" test in this file (trap 20: when a
    // per-item probe returns the same answer for every item, suspect the probe).
    expect(factorDeclaresNoRange({ observedState: { value: 70 } })).toBe(true)
    expect(factorDeclaresNoRange({ prior: { ...UNIT_PRIOR } })).toBe(false)
  })

  it('the ADAPTER carries the fact onto the row, and only onto the rows that lack a range', () => {
    // The chain node.prior -> toModelRows -> ModelRow is asserted here rather
    // than assumed, so a render failure below cannot be a silently-absent field.
    expect(rowFor(NO_PRIOR_ID)?.declaresNoRange).toBe(true)
    expect(rowFor(SCALAR_PRIOR_ID)?.declaresNoRange).toBe(true)
    expect(rowFor(EMPTY_PRIOR_ID)?.declaresNoRange).toBe(true)
    // Absent, not `false`: the contract's absences are load-bearing.
    expect(rowFor(RANGED_ID)?.declaresNoRange).toBeUndefined()
    expect('declaresNoRange' in (rowFor(RANGED_ID) ?? {})).toBe(false)
  })

  it('the witness row really opens an editor when its value is clicked', () => {
    renderPanel()
    typeInto(NO_PRIOR_ID, '70')
    // If the click did not open the editor, every assertion in (a) would be
    // asserting about a row that is not in the `editing` beat at all.
    expect(screen.getByTestId(`model-row-v2-${NO_PRIOR_ID}-value-input`)).toHaveValue('70')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// (a) THE FACT IS STATED, BEFORE THE COMMIT
// ─────────────────────────────────────────────────────────────────────────────

describe('⭐ (a) a factor with no recorded range says so beside its editor', () => {
  it('⭐ renders the sentence, bound by testid, with the exact bytes a user reads', () => {
    renderPanel()
    typeInto(NO_PRIOR_ID, '70')
    // Bound to THIS row by id, never to "some element containing prose" — an
    // assertion another element could satisfy is trap 19.
    expect(noticeText(NO_PRIOR_ID)).toBe(NOTICE)
  })

  it('⭐ THE DISCRIMINATING TWIN: a factor that DOES record a range says nothing', () => {
    renderPanel()
    typeInto(RANGED_ID, '5')
    expect(noticeText(RANGED_ID)).toBeNull()
    // ...while the witness, in the same render, still speaks. Without this half,
    // a component that rendered nothing at all would pass the line above.
    typeInto(NO_PRIOR_ID, '70')
    expect(noticeText(NO_PRIOR_ID)).toBe(NOTICE)
  })

  it('every no-range SHAPE the prior union admits gets the sentence', () => {
    renderPanel()
    for (const id of [NO_PRIOR_ID, SCALAR_PRIOR_ID, EMPTY_PRIOR_ID]) {
      typeInto(id, '70')
      expect(noticeText(id), `no-range shape ${id}`).toBe(NOTICE)
    }
  })

  it('says nothing until the user is actually editing', () => {
    renderPanel()
    // An idle row is not about to commit anything, and a sentence on every
    // unranged row at rest is the wall of inert strings this tab removed.
    expect(noticeText(NO_PRIOR_ID)).toBeNull()
    typeInto(NO_PRIOR_ID, '70')
    expect(noticeText(NO_PRIOR_ID)).toBe(NOTICE)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// (b) ⛔ IT STATES, IT DOES NOT REFUSE — the assertion that must never go green
//     for the wrong reason
// ─────────────────────────────────────────────────────────────────────────────

describe('⛔ (b) the sentence is a statement of fact and refuses nothing', () => {
  it('⛔ `Review change` stays ENABLED on the row that carries the sentence', () => {
    renderPanel()
    typeInto(NO_PRIOR_ID, '70')
    // The measured entry, on the measured row, still advances. If anyone turns
    // this notice into a block, THIS is the line that goes red.
    expect(noticeText(NO_PRIOR_ID)).toBe(NOTICE)
    expect(reviewButton(NO_PRIOR_ID)).not.toBeDisabled()
  })

  it('⛔ and no refusal sentence is invented beside it', () => {
    renderPanel()
    typeInto(NO_PRIOR_ID, '70')
    // The host's own guard owns that string and has nothing to say about a
    // parseable number. A second sentence here would be a second verdict.
    expect(blockedText(NO_PRIOR_ID)).toBeNull()
  })

  it('the host\'s existing refusal is untouched and still fires on its own terms', () => {
    renderPanel()
    typeInto(NO_PRIOR_ID, 'not a number')
    // Both are on screen at once and they are different elements answering
    // different questions: one about the FACTOR, one about the DRAFT.
    expect(blockedText(NO_PRIOR_ID)).toBe('Enter a number to review this change')
    expect(noticeText(NO_PRIOR_ID)).toBe(NOTICE)
    expect(reviewButton(NO_PRIOR_ID)).toBeDisabled()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// (c) ⭐⭐ TRAP 21 — this is NOT `resolveFactorValueAdmission` with the sign
//     flipped, and folding the two must RED here
// ─────────────────────────────────────────────────────────────────────────────

describe('⭐⭐ (c) recording a range and admitting a number are different questions', () => {
  it('⭐⭐ an INVERTED declaration records a range, so the sentence must not fire', () => {
    renderPanel()
    typeInto(INVERTED_ID, '5')
    // `resolveFactorValueAdmission` returns `null` here. Reading that as "no
    // range" would tell the user this factor records nothing, which is false:
    // it records `{range_min: 1, range_max: 0}`.
    expect(noticeText(INVERTED_ID)).toBeNull()
    expect(rowFor(INVERTED_ID)?.declaresNoRange).toBeUndefined()
  })

  it('⭐⭐ a MAGNITUDE-SCALED factor carrying both ends records a range too', () => {
    renderPanel()
    typeInto(MAGNITUDE_ID, '40000')
    // Same shape of error, second arm: admission is `null` because a 0-1 prior
    // is not the support of a £ magnitude, not because nothing was recorded.
    expect(noticeText(MAGNITUDE_ID)).toBeNull()
    expect(rowFor(MAGNITUDE_ID)?.declaresNoRange).toBeUndefined()
  })

  it('ONE recorded end is still a record', () => {
    renderPanel()
    typeInto(HALF_PRIOR_ID, '70')
    expect(noticeText(HALF_PRIOR_ID)).toBeNull()
  })

  it('the predicate itself holds the same line, away from the DOM', () => {
    expect(factorDeclaresNoRange({ prior: { range_min: 1, range_max: 0 } })).toBe(false)
    expect(factorDeclaresNoRange({ prior: { range_min: 0, range_max: 1 }, observedState: { unit: '£', value: 40000 } })).toBe(false)
    expect(factorDeclaresNoRange({ prior: { range_min: 0 } })).toBe(false)
    expect(factorDeclaresNoRange({ prior: { range_max: 1 } })).toBe(false)
    // Fails OPEN into silence on every shape it cannot read.
    expect(factorDeclaresNoRange({ prior: 'uniform(0,1)' })).toBe(false)
    expect(factorDeclaresNoRange({ prior: { range_min: NaN, range_max: NaN } })).toBe(true)
    expect(factorDeclaresNoRange({ prior: null })).toBe(true)
    expect(factorDeclaresNoRange(undefined)).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// (d) THE COPY RULES, ASSERTED ON THE RENDERED BYTES
// ─────────────────────────────────────────────────────────────────────────────

describe('(d) the sentence obeys the standing copy rules', () => {
  it('the component does NOT export the string, so no spec can assert it against itself', () => {
    // Structural, not a convention: while this holds, the only way to assert the
    // wording is to spell it out, which is the only way an assertion about copy
    // means anything (trap 13b).
    expect('NO_RANGE_NOTICE' in ModelRowViewModule).toBe(false)
  })

  it('carries no em dash and no race framing', () => {
    renderPanel()
    typeInto(NO_PRIOR_ID, '70')
    const text = noticeText(NO_PRIOR_ID) ?? ''
    // POSITIVE CONTROL for the matcher: it can see a dash when one is present.
    expect(`a ${'—'} b`).toMatch(/—/)
    expect(text).not.toMatch(/—/)
    for (const banned of ['winner', 'wins', 'leads', 'leading', 'beats', 'ahead of']) {
      expect(text.toLowerCase(), `banned framing: ${banned}`).not.toContain(banned)
    }
  })

  it('promises no improvement and states no outcome it cannot know', () => {
    renderPanel()
    typeInto(NO_PRIOR_ID, '70')
    const text = noticeText(NO_PRIOR_ID)?.toLowerCase() ?? ''
    // It says what the node records and what the wire can express. It does not
    // tell the user the analysis will then succeed, nor how to fix it: the fix
    // (a range editor) is not reachable in the product, and naming a route that
    // does not exist is worse than naming none.
    for (const banned of ['will improve', 'better', 'try again', 'add a range', 'set a range']) {
      expect(text, `banned promise: ${banned}`).not.toContain(banned)
    }
    // And it DOES carry the two facts, so the assertions above are not passing
    // on an empty string.
    expect(text).toContain('records no range')
    expect(text).toContain('cannot be removed')
  })
})
