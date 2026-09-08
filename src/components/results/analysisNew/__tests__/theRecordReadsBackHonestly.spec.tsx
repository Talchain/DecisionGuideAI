/**
 * ⭐⭐ THE READ-BACK STATES WHAT THE RECORD HOLDS, AND NOTHING ELSE.
 *
 * A decision record is a user-authored object read back weeks later, out of a
 * browser store, possibly written by an older build. Three things can go wrong,
 * and all three are the same failure — the surface asserting something the
 * producer did not supply:
 *
 *   1. AN ABSENT FIELD RENDERED AS AN EMPTY LABELLED ROW. "Expected:" over
 *      nothing reads as "they left it blank", which is a different claim from
 *      "this record predates that field" (`expectation` is optional on the type
 *      for exactly that reason). Withholding the row asserts nothing.
 *   2. A STORAGE CLAIM THE RECORD DOES NOT LICENSE. `remote.recordId` is CEE's
 *      own proof the durable half landed; without it the surface may not say
 *      "on your account", and — the direction that is easier to get wrong — it
 *      may not name a CAUSE either. The store documents three routes to a
 *      local-only record (guest, offline, a failed commit), so "sign in to keep
 *      this" would be false for the signed-in user whose commit failed.
 *   3. AN INVENTED DATE OR AN INVENTED OPTION NUMBER. `savedAt` comes back out
 *      of storage; `optionNumber` is null whenever the option set was not
 *      wholly numbered, and a fabricated "Option 1" would make the record name
 *      an option the canvas does not.
 *
 * ⚠ EVERY ASSERTION BINDS BY TESTID AND BY THE RECORD'S OWN VALUES, never by a
 * value predicate another field could satisfy (CLAUDE.md trap 19). The
 * discriminating pair in `THE OPTION LINE IS BOUND TO THE OPTION` is what
 * proves it: one mutant must RED it, its twin must leave it GREEN.
 */

import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { DecisionRecorded, formatRecordedOn, recordedOptionText } from '../sections/DecisionRecorded'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import type { DecisionRecord } from '../../modals'

afterEach(cleanup)

const T = 'rec'

/** 7 Sep 2026, 09:00 UTC — a fixed instant, so the rendered date is a literal. */
const SAVED_AT = Date.UTC(2026, 8, 7, 9, 0, 0)

const RECORD: DecisionRecord = {
  optionId: 'opt-a',
  optionLabel: 'Phase the rollout by segment',
  optionNumber: 2,
  confidence: 65,
  expectation: 'churn stays under 4% through Q1',
  rationale: 'It keeps the renewal cohort intact while we learn.',
  assumptionToWatch: 'Enterprise accounts accept usage pricing.',
  revisitTrigger: 'churn crosses 4%',
  analysisHash: 'run_abc123',
  savedAt: SAVED_AT,
  remote: null,
}

/**
 * ⚠ THE DEFAULTS ARE THE STATE THIS FILE IS ABOUT: a real scenario and a
 * capturable option set. The `false` sides of both are exercised deliberately
 * — `isScenarioScoped` in `THE SCENARIO IS ONLY NAMED WHEN THERE IS ONE`
 * below, `canRecord` at the panel level in `theDoorIsNeverDecorative.spec.tsx`,
 * where the mount that produced the defect actually lives.
 */
const draw = (over: Partial<React.ComponentProps<typeof DecisionRecorded>> = {}) =>
  render(
    <DecisionRecorded
      isPreRun={false}
      record={RECORD}
      isScenarioScoped
      canRecord
      onRecord={vi.fn()}
      testId={T}
      {...over}
    />,
  )

const withRecord = (patch: Partial<DecisionRecord>) => draw({ record: { ...RECORD, ...patch } })

describe('THE OPTION LINE IS BOUND TO THE OPTION', () => {
  /**
   * ⭐⭐ THE DISCRIMINATING ASSERTION. `toHaveTextContent` with a substring
   * would pass on a line that printed the whole record, and an assertion on
   * "some element contains the label" would pass if the label appeared in the
   * rationale. This binds the OPTION TESTID to the EXACT composed string, so
   * the only way to satisfy it is to render that field, at that place.
   *
   * The mutant pair that proves it: swap the option line's source to another of
   * the record's own fields → this must RED; change any OTHER row's source →
   * this must stay GREEN. A single biting mutant proves sensitivity to
   * something; the pair proves sensitivity to the named object.
   */
  it('prints the recorded option, exactly, at the option row', () => {
    draw()
    expect(screen.getByTestId(`${T}-option`)).toHaveTextContent(
      /^Option 2 — Phase the rollout by segment$/,
    )
  })

  /** The twin: a different record must produce a different line. */
  it('prints a DIFFERENT record’s option, not a remembered one', () => {
    withRecord({ optionNumber: 5, optionLabel: 'Hold the current plan' })
    expect(screen.getByTestId(`${T}-option`)).toHaveTextContent(/^Option 5 — Hold the current plan$/)
  })

  /**
   * ⚠ NO NUMBER, NO PREFIX. `optionNumbering` is all-or-nothing, so a null
   * number means the canvas numbers NO option — inventing one here would name
   * an option the rest of the product does not.
   */
  it('invents no number when the option set was not numbered', () => {
    withRecord({ optionNumber: null })
    const line = screen.getByTestId(`${T}-option`)
    expect(line).toHaveTextContent(/^Phase the rollout by segment$/)
    expect(line.textContent).not.toMatch(/Option/)
  })

  it('falls back to the option id rather than rendering an empty line', () => {
    expect(recordedOptionText({ ...RECORD, optionLabel: '   ', optionNumber: null })).toBe('opt-a')
  })
})

describe('an absent field renders NOTHING — not a blank, not a zero', () => {
  /**
   * ⭐ THE CASE THE TYPE ITSELF ANTICIPATES. `expectation` is optional because
   * records persisted before the field existed are still readable. Rendering a
   * labelled row over `undefined` would tell their author they left it blank.
   */
  it('withholds the whole expectation row when the record carries none', () => {
    withRecord({ expectation: undefined })
    expect(screen.queryByTestId(`${T}-expectation`)).toBeNull()
    expect(screen.queryByText(COPY.decisionRecord.expectationLabel)).toBeNull()
  })

  /** The twin — the row is genuinely capable of rendering, so the absence means absence. */
  it('renders it, verbatim, when the record does carry one', () => {
    draw()
    expect(screen.getByTestId(`${T}-expectation`)).toHaveTextContent(
      'churn stays under 4% through Q1',
    )
  })

  it.each([
    ['expectation', 'expectation'],
    ['rationale', 'rationale'],
    ['assumption', 'assumptionToWatch'],
    ['revisit', 'revisitTrigger'],
  ] as const)('withholds the %s row when the value is blank whitespace', (row, field) => {
    withRecord({ [field]: '   \n ' } as Partial<DecisionRecord>)
    expect(screen.queryByTestId(`${T}-${row}`)).toBeNull()
  })

  it('renders every free-text row the record does carry', () => {
    draw()
    expect(screen.getByTestId(`${T}-rationale`)).toHaveTextContent(RECORD.rationale)
    expect(screen.getByTestId(`${T}-assumption`)).toHaveTextContent(RECORD.assumptionToWatch)
    expect(screen.getByTestId(`${T}-revisit`)).toHaveTextContent(RECORD.revisitTrigger)
  })
})

describe('the confidence keeps the unit it was captured in', () => {
  /**
   * ⚠ "of 100", NOT "%". The capture field is labelled "Confidence, 0–100" and
   * the value is the user's own typed number. A percent sign is a unit nobody
   * supplied — small, and exactly the class of invention this panel exists to
   * refuse.
   */
  it('prints the number with the captured scale and no percent sign', () => {
    draw()
    const el = screen.getByTestId(`${T}-confidence`)
    expect(el).toHaveTextContent('65 of 100')
    expect(el.textContent).not.toMatch(/%/)
  })

  /** Zero is a REAL confidence and must not be swallowed by a falsiness check. */
  it('prints a confidence of zero rather than dropping the row', () => {
    withRecord({ confidence: 0 })
    expect(screen.getByTestId(`${T}-confidence`)).toHaveTextContent('0 of 100')
  })
})

describe('where the record lives is stated from the record, never inferred', () => {
  /**
   * ⚠⚠ THE HALF THAT IS EASY TO GET WRONG IS THE CAUSE, NOT THE FACT. A
   * local-only record has three documented routes (guest, offline, a failed
   * commit), so the sentence may state that there is no account copy and must
   * NOT tell the reader to sign in — that instruction is false for the
   * signed-in user whose commit failed.
   */
  it('a local-only record says so, and names no cause and no remedy', () => {
    withRecord({ remote: null })
    const line = screen.getByTestId(`${T}-storage`)
    expect(line).toHaveTextContent(COPY.decisionRecord.storedLocal(true))
    // No remedy: the store documents three routes to a local-only record and
    // this sentence cannot tell them apart, so it may not prescribe one.
    expect(line.textContent).not.toMatch(/sign (?:in|up)/i)
    // No cause: not "because you are signed out", not "offline".
    expect(line.textContent).not.toMatch(/signed out|offline|guest/i)
    /**
     * ⚠ AND NO POSITIVE ACCOUNT CLAIM. Written as the affirmative phrasings
     * rather than as `/account\.$/` — the first draft used that and RED'd on
     * the sentence's own honest ending, "It is not on your account." A negative
     * assertion has to ban the CLAIM, not a substring the true sentence shares
     * with the false one.
     */
    expect(line.textContent).not.toMatch(/(?:saved|stored|kept) to your account/i)
    expect(line.textContent).not.toMatch(/(?:are|is) on your account/i)
  })

  it('the local sentence is not the account sentence', () => {
    withRecord({ remote: null })
    expect(screen.getByTestId(`${T}-storage`).textContent).not.toBe(
      COPY.decisionRecord.storedRemote({
        hasExpectation: true,
        reviewDate: '2026-12-01T00:00:00.000Z',
        reviewDateSource: 'user_set',
      }),
    )
  })

  /**
   * ⭐ THE ONLY THING THAT LICENSES AN ACCOUNT CLAIM IS THE RECORD ID. It is
   * CEE's own proof the durable write landed — anything softer would let the
   * surface say "on your account" about a write that did not happen.
   */
  it('a record with a CEE record id names the split, in the modal’s own words', () => {
    withRecord({
      remote: {
        recordId: 'dr_123',
        reviewDate: '2026-12-01T00:00:00.000Z',
        reviewDateSource: 'user_set',
      },
    })
    expect(screen.getByTestId(`${T}-storage`)).toHaveTextContent(
      COPY.decisionRecord.storedRemote({
        hasExpectation: true,
        reviewDate: '2026-12-01T00:00:00.000Z',
        reviewDateSource: 'user_set',
      }),
    )
  })

  /**
   * ⚠ THE DISCRIMINATION. A `remote` object without a `recordId` is not proof
   * of anything, and a truthiness check on `remote` alone would treat it as if
   * it were.
   */
  it('a remote object with no record id does NOT license the account claim', () => {
    withRecord({
      remote: {
        recordId: '',
        reviewDate: '2026-12-01T00:00:00.000Z',
        reviewDateSource: 'default_horizon',
      },
    })
    expect(screen.getByTestId(`${T}-storage`)).toHaveTextContent(COPY.decisionRecord.storedLocal(true))
  })
})

describe('the date is the record’s own, or there is no date', () => {
  /**
   * ⚠ THE MONTH ABBREVIATION IS NOT PINNED AS A LITERAL, AND THE FIRST DRAFT
   * WAS. It asserted 'Recorded 7 Sep 2026' and RED'd: Node 20's `en-GB` CLDR
   * data renders September as "Sept", not "Sep". Pinning the exact abbreviation
   * makes this suite a hostage to the CI runner's ICU version rather than a
   * test of the component.
   *
   * ⚠⚠ BUT IT IS NOT LOOSENED INTO A TAUTOLOGY EITHER. The obvious "fix" —
   * asserting the element equals `formatRecordedOn(RECORD.savedAt)` — is
   * `f(x) === f(x)` and cannot fail. So the DAY and the YEAR are pinned as
   * literals off the fixture, the month is pinned to September specifically,
   * and the twin below proves a different `savedAt` produces a different line.
   * A component rendering today's date, or another record's, fails all three.
   */
  it('prints the captured date — day, month and year from the record', () => {
    draw()
    expect(screen.getByTestId(`${T}-savedat`).textContent).toMatch(
      /^Recorded 7 Sept? 2026$/,
    )
  })

  it('a different savedAt prints a different date — the twin', () => {
    withRecord({ savedAt: Date.UTC(2025, 0, 23, 12, 0, 0) })
    expect(screen.getByTestId(`${T}-savedat`).textContent).toMatch(/^Recorded 23 Jan 2025$/)
  })

  /**
   * ⭐⭐ THE THIRD CASE WAS ADDED BY A SURVIVING MUTANT, AND IT IS THE ONE THAT
   * MATTERED. `formatRecordedOn` has TWO guards — `!Number.isFinite(savedAt)`
   * and `Number.isNaN(d.getTime())` — and the first two cases here reach only
   * the first, because `NaN` and `Infinity` are both non-finite. Breaking the
   * SECOND guard (returning a fabricated date instead of null) therefore left
   * all 27 tests GREEN.
   *
   * ⚠ AND IT IS NOT DEAD CODE, WHICH IS WHY THE FIX IS A CASE AND NOT A
   * DELETION. `Date`'s range is ±8.64e15 ms, so `1e16` is a perfectly finite
   * number that yields an Invalid Date — measured, not assumed. A `savedAt`
   * read back out of a browser store the user can edit is exactly where such a
   * value comes from.
   *
   * The corpus omitted a value class the input admits, so it could not certify
   * the code over that class (CLAUDE.md trap 22 — check what your corpus
   * EXCLUDES, not what it covers).
   */
  it.each([
    ['NaN — first guard', Number.NaN],
    ['Infinity — first guard', Number.POSITIVE_INFINITY],
    ['1e16: finite, but outside Date range — SECOND guard', 1e16],
  ])('withholds the line entirely on an unreadable timestamp (%s)', (_name, savedAt) => {
    withRecord({ savedAt })
    expect(screen.queryByTestId(`${T}-savedat`)).toBeNull()
  })

  it('the formatter returns null rather than a fallback string', () => {
    expect(formatRecordedOn(Number.NaN)).toBeNull()
    expect(formatRecordedOn(Number.POSITIVE_INFINITY)).toBeNull()
    // Finite, and still not a date — the second guard, at the unit.
    expect(formatRecordedOn(1e16)).toBeNull()
    expect(formatRecordedOn(-1e16)).toBeNull()
    // The positive half: it must return a real date, not merely "not null".
    expect(formatRecordedOn(SAVED_AT)).toMatch(/^7 Sept? 2026$/)
  })
})

describe('the two states are exclusive', () => {
  it('with no record: the door, and none of the read-back rows', () => {
    draw({ record: null })
    expect(screen.getByTestId(`${T}-none`)).toHaveTextContent(COPY.decisionRecord.none(true))
    expect(screen.getByTestId(`${T}-open`)).toHaveTextContent(COPY.decisionRecord.open)
    for (const row of ['option', 'confidence', 'expectation', 'storage', 'savedat', 'update']) {
      expect(screen.queryByTestId(`${T}-${row}`), `${row} rendered with no record`).toBeNull()
    }
  })

  it('with a record: the read-back and an update control, and no first-time door', () => {
    draw()
    expect(screen.queryByTestId(`${T}-none`)).toBeNull()
    expect(screen.queryByTestId(`${T}-open`)).toBeNull()
    expect(screen.getByTestId(`${T}-update`)).toHaveTextContent(COPY.decisionRecord.update)
  })

  it('renders nothing at all pre-run, in either state', () => {
    draw({ isPreRun: true })
    expect(screen.queryByTestId(T)).toBeNull()
    cleanup()
    draw({ isPreRun: true, record: null })
    expect(screen.queryByTestId(T)).toBeNull()
  })
})

describe('both controls open the capture modal', () => {
  it('the first-time door calls onRecord once', async () => {
    const onRecord = vi.fn()
    draw({ record: null, onRecord })
    await userEvent.click(screen.getByTestId(`${T}-open`))
    expect(onRecord).toHaveBeenCalledTimes(1)
  })

  /**
   * ⚠ THE UPDATE CONTROL IS HONEST BECAUSE THE MODAL PREFILLS. `DecisionRecordModal`
   * hydrates from `selectDecisionRecord` on open, so "Update this record" edits
   * rather than replacing from blank — if that hydration is ever removed, this
   * label becomes a lie and the modal's own suite is where it must be caught.
   */
  it('the update control calls onRecord once', async () => {
    const onRecord = vi.fn()
    draw({ onRecord })
    await userEvent.click(screen.getByTestId(`${T}-update`))
    expect(onRecord).toHaveBeenCalledTimes(1)
  })
})

/**
 * ⭐⭐⭐ ABSENCE OF PROOF IS NOT PROOF OF ABSENCE — the repair to PR #1272's
 * one BLOCKING finding.
 *
 * The shipped sentence was "On this device only, for this scenario. It is not
 * on your account." The reasoning behind it was half right and the half it got
 * wrong is the whole defect: `remote.recordId` is indeed the ONLY thing that
 * licenses the positive claim — and its ABSENCE was then treated as licensing
 * the negative one.
 *
 * It does not. The store documents three routes to `remote === null`, and on
 * the third — a FAILED COMMIT — the POST was dispatched and CEE may already
 * have written the row. `clientCommitId` dedupe exists precisely because that
 * is reachable. This UI has no read path to `decision_records`, so it cannot
 * know either way; "It is not on your account" was the product stating as fact
 * something it does not know, to the one user for whom it is most likely false.
 */
describe('THE LOCAL SENTENCE CLAIMS NO KNOWLEDGE OF THE ACCOUNT', () => {
  it('does not assert the record is absent from the account', () => {
    withRecord({ remote: null })
    const text = screen.getByTestId(`${T}-storage`).textContent ?? ''
    expect(text).not.toMatch(/not on your account/i)
    expect(text).not.toMatch(/(?:isn't|is not|was not|wasn't) (?:on|saved to|in) your account/i)
  })

  /**
   * ⚠ THE POSITIVE HALF, so this is not a test that passes on an empty
   * sentence. It must actually SAY the unconfirmed thing, in the words the
   * commit service already uses for the same fact.
   */
  it('states the limit of our evidence instead', () => {
    withRecord({ remote: null })
    expect(screen.getByTestId(`${T}-storage`)).toHaveTextContent(/could not confirm/i)
  })

  /**
   * ⚠ "only" WAS ALSO AN EXCLUSIVITY CLAIM — "on this device ONLY" says no
   * other copy exists, which is the same unknown wearing a shorter word.
   */
  it('does not claim this device is the only place it lives', () => {
    withRecord({ remote: null })
    expect(screen.getByTestId(`${T}-storage`).textContent ?? '').not.toMatch(
      /this device only|only on this device/i,
    )
  })

  /** The pre-existing guarantees, re-asserted against the new wording. */
  it('still names no cause and prescribes no remedy', () => {
    withRecord({ remote: null })
    const text = screen.getByTestId(`${T}-storage`).textContent ?? ''
    expect(text).not.toMatch(/sign (?:in|up)/i)
    expect(text).not.toMatch(/signed out|offline|guest/i)
  })
})

/**
 * ⭐⭐ THE ACCOUNT SENTENCE NAMES ONLY WHAT THIS RECORD HAS.
 *
 * Two over-claims lived in the old constant, and both are the same defect as
 * the one above pointing the other way:
 *
 *   · it named `expectation`, which is OPTIONAL on `DecisionRecord` and which
 *     `Field` withholds when blank — so the panel refused to show a row and
 *     then told the reader it was on their account;
 *   · it said "YOUR … review date", claiming the user authored a date that
 *     `remote.reviewDateSource` may record as `default_horizon` — CEE's own
 *     90-day fallback after an unparsed trigger.
 */
describe('THE ACCOUNT SENTENCE NAMES ONLY THE FIELDS THE RECORD HAS', () => {
  const REMOTE_USER_SET = {
    recordId: 'dr_777',
    reviewDate: '2026-12-01T00:00:00.000Z',
    reviewDateSource: 'user_set' as const,
  }

  it('names the expectation when the record carries one', () => {
    withRecord({ expectation: 'churn stays under 4%', remote: REMOTE_USER_SET })
    expect(screen.getByTestId(`${T}-storage`)).toHaveTextContent(/expectation/i)
  })

  /**
   * ⭐ THE DISCRIMINATING TWIN. Same remote, same everything — only the
   * expectation removed. If the sentence were still a constant this would RED,
   * which is exactly what it did before the repair.
   */
  it('does NOT name the expectation when the record carries none — the twin', () => {
    withRecord({ expectation: undefined, remote: REMOTE_USER_SET })
    expect(screen.getByTestId(`${T}-storage`).textContent ?? '').not.toMatch(/expectation/i)
  })

  it('a whitespace-only expectation is treated as absent, like Field treats it', () => {
    withRecord({ expectation: '   ', remote: REMOTE_USER_SET })
    expect(screen.getByTestId(`${T}-storage`).textContent ?? '').not.toMatch(/expectation/i)
    // …and the row itself is withheld too, so the two agree.
    expect(screen.queryByTestId(`${T}-expectation`)).toBeNull()
  })

  /**
   * ⭐⭐ THE AUTHORSHIP PAIR. `reviewDateSource` had ZERO readers in any render
   * path before this; the sentence claimed the user's authorship of the date
   * on nothing at all. These two cases are the wiring that earns the field.
   */
  it('claims the user set the review date ONLY when reviewDateSource says so', () => {
    withRecord({ remote: REMOTE_USER_SET })
    expect(screen.getByTestId(`${T}-storage`)).toHaveTextContent(/review date you set/i)
  })

  it('a defaulted review date is NOT called the user’s — the twin', () => {
    withRecord({
      remote: { ...REMOTE_USER_SET, reviewDateSource: 'default_horizon' },
    })
    const text = screen.getByTestId(`${T}-storage`).textContent ?? ''
    expect(text).not.toMatch(/review date you set/i)
    expect(text).toMatch(/a review date we set/i)
  })

  it('a review date defaulted after an unparsed trigger is also not the user’s', () => {
    withRecord({
      remote: {
        ...REMOTE_USER_SET,
        reviewDateSource: 'default_horizon_after_unparsed_trigger',
      },
    })
    expect(screen.getByTestId(`${T}-storage`).textContent ?? '').not.toMatch(
      /review date you set/i,
    )
  })

  /**
   * ⚠ `reviewDate` COMES BACK AS `''` WHEN CEE OMITTED IT — the commit service
   * maps a missing `review_date` to an empty string. An absent date is named
   * by omission, never asserted.
   */
  it('names no review date at all when the remote carries none', () => {
    withRecord({ remote: { ...REMOTE_USER_SET, reviewDate: '' } })
    expect(screen.getByTestId(`${T}-storage`).textContent ?? '').not.toMatch(/review date/i)
  })

  /** The account claim itself is unchanged — this must still be said. */
  it('still says the durable half is on the account', () => {
    withRecord({ remote: REMOTE_USER_SET })
    expect(screen.getByTestId(`${T}-storage`)).toHaveTextContent(/are on your account/i)
  })
})

/**
 * ⭐ THE SCENARIO IS ONLY NAMED WHEN THERE IS ONE.
 *
 * `resolveScenarioKey` falls back to the single shared `__unscoped__` literal
 * before the first scenario exists, so on an unsaved canvas "for this scenario"
 * named an object the model does not have — a wrong-object claim of the same
 * class as every other finding here.
 */
describe('THE SCENARIO IS ONLY NAMED WHEN THERE IS ONE', () => {
  it('scoped: the storage line says "for this scenario"', () => {
    draw({ record: { ...RECORD, remote: null }, isScenarioScoped: true })
    expect(screen.getByTestId(`${T}-storage`)).toHaveTextContent(/for this scenario/i)
  })

  it('unscoped: it does not — the twin', () => {
    draw({ record: { ...RECORD, remote: null }, isScenarioScoped: false })
    expect(screen.getByTestId(`${T}-storage`).textContent ?? '').not.toMatch(
      /for this scenario/i,
    )
  })

  it('scoped: the empty line says "for this scenario"', () => {
    draw({ record: null, isScenarioScoped: true })
    expect(screen.getByTestId(`${T}-none`)).toHaveTextContent(/for this scenario/i)
  })

  it('unscoped: it does not — the twin', () => {
    draw({ record: null, isScenarioScoped: false })
    expect(screen.getByTestId(`${T}-none`).textContent ?? '').not.toMatch(/for this scenario/i)
  })
})

/**
 * ⭐ THE UNIT IS NEVER PRINTED OVER A NUMBER NOBODY SUPPLIED.
 *
 * The confidence was composed into `"${confidence} of 100"` BEFORE `Field`'s
 * blank check, so the check could never withhold it — `"undefined of 100"` is
 * not blank. `parseConfidence` validates at CAPTURE, but this value is read
 * back out of `localStorage`, where an older build or a hand-edited store can
 * put anything.
 */
describe('the confidence row is withheld when the number is unreadable', () => {
  it('renders the row for a real number', () => {
    withRecord({ confidence: 65 })
    expect(screen.getByTestId(`${T}-confidence`)).toHaveTextContent('65 of 100')
  })

  it('renders it for zero — zero is a real answer', () => {
    withRecord({ confidence: 0 })
    expect(screen.getByTestId(`${T}-confidence`)).toHaveTextContent('0 of 100')
  })

  it('withholds the row when the stored value is missing', () => {
    withRecord({ confidence: undefined as unknown as number })
    expect(screen.queryByTestId(`${T}-confidence`)).toBeNull()
  })

  it('withholds the row when the stored value is not finite', () => {
    withRecord({ confidence: NaN })
    expect(screen.queryByTestId(`${T}-confidence`)).toBeNull()
  })

  it('withholds the row when the stored value is not a number at all', () => {
    withRecord({ confidence: 'seventy' as unknown as number })
    expect(screen.queryByTestId(`${T}-confidence`)).toBeNull()
  })
})
