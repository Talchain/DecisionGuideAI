/**
 * ⭐⭐ A WIRE ENUM REACHED THE USER AS THE STATED BASIS OF A ROBUSTNESS CLAIM.
 *
 * Measured on the served build `475ee1c7`, the Reasoning tab rendered, visibly:
 *
 *     Tested against: is_robust
 *
 * The producer bytes, captured from `POST /proxy/v5/turn` on that same build:
 *
 *     "robustness_caveat": {
 *       "text": "This run was fragile under the changes we tested. …",
 *       "basis": "is_robust", … }
 *
 * ## Why the guard that was there did not see it
 *
 * `readRobustnessCaveat` screened both fields with `containsRawIdentifier`,
 * which is `RAW_ID_PATTERN` (a hand-maintained alternation of NODE-ID PREFIXES:
 * `opt_ fac_ goal_ dec_ out_ risk_ con_ factor_ option_ decision_ outcome_
 * constraint_`) plus a supplemental UUID / `gc-` / hex-run pattern. `is_robust`
 * begins `is_`, which is in neither. The token that leaked is a WIRE ENUM — a
 * different category the predicate was never given, so no amount of care with
 * that predicate would have caught it.
 *
 * ⚠ THE PRODUCER'S OBSERVED DOMAIN FOR THIS FIELD IS A SINGLE ENUM. Censused by
 * parent path across every JSON capture in the tree: `robustness_caveat.basis`
 * takes exactly ONE value, `is_robust`, in 11 occurrences. (The 72 `domain_prior`
 * / 39 `structural_inference` values in the same tree belong to
 * `edges[].validation.pass2.basis` — a different field answering a different
 * question under the same name, trap 21. They are not this field's domain.)
 * So the honest statement is that on every payload anyone has captured, this
 * label is unrenderable and the correct screen omits it.
 *
 * ⚠⚠ AND THE SUITE CERTIFIED THE LEAK. `decisionBriefRobustnessCaveat.spec.tsx`
 * asserted `.toEqual({ text: HELD, basis: 'is_robust' })` — the real producer
 * value, pinned as correct at the view model. Meanwhile the tab spec's
 * "CONTROL: the legitimate basis … still renders" used `2,000 simulated
 * futures`, a value the producer has never been observed to send. One test
 * proved the enum passes the parser and the other proved an invented phrase
 * renders, and between them NO test ever put the real value on a screen. That is
 * trap 16-inverse: a fixture you wrote yourself is not evidence about the wire.
 *
 * ## What this file pins, in both directions
 *
 * The sentence is the load-bearing content — it is what tells the user how far
 * to trust the ranking. So the label line is suppressed and THE SENTENCE
 * SURVIVES. Dropping the whole caveat because its label is unusable is the worse
 * harm, and `decisionBriefViewModel.ts` argues exactly that for the glossary
 * case. Both directions are asserted here, because a guard that suppresses
 * everything would pass the leak cases alone.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

vi.mock('../../../../canvas/ToastContext', () => ({ useShowToastSafe: () => vi.fn() }))
vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { RobustnessCaveat } from '../sections/RobustnessCaveat'
import { useCanvasStore } from '../../../../canvas/store'
import { readDecisionBriefViewModel } from '../../decision-brief/decisionBriefViewModel'

const TID = 'analysis-new-robustness-caveat'

/**
 * ⚠ THE PRODUCER'S BYTES, NOT A PARAPHRASE. Copied from the wire capture on
 * `475ee1c7`. If this string is ever "tidied", the case stops being about the
 * defect that shipped.
 */
const SERVED_TEXT =
  'This run was fragile under the changes we tested. '
  + 'Small changes to your assumptions could change which option is most likely to achieve your goal.'
const SERVED_BASIS = 'is_robust'

/**
 * ⚠ THE PREFIX IS WRITTEN OUT, NOT IMPORTED FROM `analysisNewCopy`. Importing
 * the constant makes both sides of the assertion move together, so a rename
 * could never turn this red — the test would agree with whatever the component
 * happened to say. This is the literal sentence a user reads.
 */
const RENDERED_LEAK = 'Tested against: is_robust'

const briefWith = (basis: unknown, text: string = SERVED_TEXT) => ({
  version: '1',
  brief_id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  created_at: '2026-09-08T12:00:00.000Z',
  robustness_caveat: basis === undefined ? { text } : { text, basis },
})

/**
 * ⚠ THE PARSER CASES CARRY A TOP DRIVER, AND THAT IS NOT DECORATION.
 * `readDecisionBriefViewModel` returns null for the WHOLE brief when every
 * member is empty, so a brief whose only member is a withheld caveat yields
 * `undefined` for `vm?.robustnessCaveat` rather than `null`. A control that
 * failed that way would be failing for a reason that has nothing to do with the
 * screen under test. The driver keeps the brief alive so an absent caveat is
 * attributable to the caveat reader.
 */
const parserBrief = (basis: unknown, text: string = SERVED_TEXT) => ({
  ...briefWith(basis, text),
  top_drivers: [{ factor_label: 'Churn Trend', sensitivity: 0.4, direction: 'positive' }],
})

const setBrief = (decision_brief: unknown) => {
  useCanvasStore.setState({
    results: { ...useCanvasStore.getState().results, report: { decision_brief } },
  } as never)
}

const draw = (basis: unknown, text?: string) => {
  setBrief(briefWith(basis, text))
  return render(<RobustnessCaveat leaderClaimPermitted verdictReason={null} />)
}

afterEach(cleanup)

describe('the robustness basis is screened as DISPLAY TEXT, not as a known id shape', () => {
  /**
   * ⭐⭐ THE DEFECT, AT THE PRODUCER'S OWN BYTES. This is the assertion that was
   * RED at pristine `475ee1c7`: the served build rendered `Tested against:
   * is_robust` and this case names the exact sentence a user could read.
   */
  it('⛔ the served basis "is_robust" never reaches the screen', () => {
    draw(SERVED_BASIS)
    expect(screen.queryByTestId(`${TID}-basis`)).toBeNull()
    expect(screen.queryByText(RENDERED_LEAK)).toBeNull()
  })

  /**
   * ⭐⭐ AND THE HALF THAT MUST NOT BE LOST WITH IT. The caveat sentence is the
   * one line telling the user how far to trust the ranking. A fix that dropped
   * the whole caveat would pass the case above and cause the worse harm, so the
   * two are asserted on the SAME render.
   */
  it('⭐ the caveat SENTENCE survives when its basis is suppressed', () => {
    draw(SERVED_BASIS)
    expect(screen.getByTestId(TID)).toBeInTheDocument()
    expect(screen.getByTestId(`${TID}-text`)).toHaveTextContent(SERVED_TEXT)
  })

  /**
   * ⚠ THE OPPOSITE-DIRECTION TWIN. Without this, a predicate that rejected every
   * basis ever sent would pass every case above — the mirror defect, inverted.
   * This value is the one the pre-existing tab spec already treats as the
   * legitimate shape, so the twin is not invented for this file.
   */
  it('CONTROL: a human-readable basis still renders, prefix and all', () => {
    draw('2,000 simulated futures')
    expect(screen.getByTestId(`${TID}-basis`)).toHaveTextContent('Tested against: 2,000 simulated futures')
  })

  /** A second legitimate phrase, so the control is not one memorised string. */
  it('CONTROL: an ordinary descriptive phrase renders', () => {
    draw('the sensitivity sweep over tested factors')
    expect(screen.getByTestId(`${TID}-basis`)).toHaveTextContent(
      'Tested against: the sensitivity sweep over tested factors',
    )
  })

  /**
   * ⛔ NO REGRESSION ON THE SHAPE THE OLD GUARD DID CATCH. An id-shaped basis was
   * already rejected; it must still never reach the screen. What CHANGES is the
   * blast radius: the label goes, the sentence stays.
   */
  it('⛔ an id-shaped basis is still refused, and now keeps the sentence', () => {
    draw('node_9f1c2a44-3b5e-4c7a-9d21-77aa10ff2b3c')
    expect(screen.queryByTestId(`${TID}-basis`)).toBeNull()
    expect(screen.queryByText(/node_9f1c2a44/)).toBeNull()
    expect(screen.getByTestId(`${TID}-text`)).toHaveTextContent(SERVED_TEXT)
  })

  /** The prefix must not render as a dangling label with nothing after it. */
  it('⛔ the "Tested against:" prefix never renders without a basis', () => {
    draw(SERVED_BASIS)
    expect(screen.queryByText(/Tested against/)).toBeNull()
  })
})

describe('the shared parser is where the judgement is made', () => {
  /**
   * ⚠ BOUND AT THE PARSER, because both surfaces inherit it. The parked
   * decision-brief tab reads `.text` only; the Reasoning tab reads both.
   */
  it('⛔ readDecisionBriefViewModel nulls a wire-enum basis and keeps the text', () => {
    const vm = readDecisionBriefViewModel(parserBrief(SERVED_BASIS))
    expect(vm?.robustnessCaveat).toEqual({ text: SERVED_TEXT, basis: null })
  })

  it('CONTROL: a display-text basis is carried through verbatim', () => {
    const vm = readDecisionBriefViewModel(parserBrief('2,000 simulated futures'))
    expect(vm?.robustnessCaveat).toEqual({ text: SERVED_TEXT, basis: '2,000 simulated futures' })
  })

  /**
   * ⚠ UNCHANGED, AND DELIBERATELY SO. An ABSENT basis and an UNRENDERABLE basis
   * are two different questions (trap 21). Absent means the producer attested
   * nothing, and the existing ruling withholds the whole caveat for it. Present
   * but not display text means the producer DID attest and we cannot show the
   * token. Only the second case degrades to a null label.
   */
  it('CONTROL: an ABSENT basis still withholds the whole caveat, as before', () => {
    expect(readDecisionBriefViewModel(parserBrief(undefined))?.robustnessCaveat).toBeNull()
  })

  /** An id-shaped SENTENCE is still rejected outright — that screen is untouched. */
  it('CONTROL: an id-shaped TEXT still withholds the whole caveat', () => {
    const vm = readDecisionBriefViewModel(
      parserBrief('2,000 simulated futures', 'The ordering held except for risk_budget_overrun.'),
    )
    expect(vm?.robustnessCaveat).toBeNull()
  })
})
