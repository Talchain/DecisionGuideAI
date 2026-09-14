/**
 * Reasoning tab — the option the run left out gets ONE ACT, and the act ASKS.
 *
 * ## The gap this closes, measured on the served build
 *
 * The tab already knows exactly which options it left out and names them, then
 * offers nothing to do about it:
 *
 *   "Comparing 4 of your 8 options. Buy an AI Triage Tool, Hire Six More Agents
 *    and 2 others were left out."
 *   "Buy an AI Triage Tool  ·  Not analysed  ·  The analysis returned no result
 *    for this option, so it has no rank and no probability."
 *
 * The product names a real alternative the user cared enough to write down,
 * says it could not evaluate it, and stops. This spec pins the act that closes
 * that, and — more importantly — pins the two ways it could lie.
 *
 * ## ⭐ WHAT IT MAY NOT DO, AND WHY THE SUITE IS SHAPED AROUND IT
 *
 * The act sends a QUESTION. It does not add a node, set a value, or re-run, and
 * the reason is measured rather than cautious: `WhatIWasGivenSection.tsx`
 * (~:103-155) records 15 arms over 5 rounds against the live CEE router in
 * which EVERY add phrasing was refused (`ORPHAN_NODE`, `NO_PATH_TO_GOAL`,
 * `PIPELINE_OWNED_FIELD`) and every ASK phrasing was answered with concrete,
 * model-grounded options.
 *
 * ## ⭐⭐ THE HONESTY RULE IS A PAIR, AND BOTH ARMS ARE LIVE
 *
 * The two grounds are not two spellings of one state, and they differ on
 * exactly the axis that can produce a false claim:
 *
 *   · `no_interventions` — NOTHING WAS COMPUTED about this option; it was never
 *     submitted. A question saying the analysis returned nothing for it would
 *     assert a computation that never happened.
 *   · `not_returned` — it WAS submitted and the run returned nothing. Saying
 *     "you have not set this up" here blames the user for an engine outcome.
 *
 * Each arm is asserted to state its own ground AND to refuse the other's, so a
 * mutant that makes either arm claim the other's fact REDs that arm alone. One
 * biting mutant proves sensitivity to something; the pair proves the
 * distinction is real.
 *
 * ## ⚠ THERE IS NO "no reason known" ARM, AND THAT IS A DERIVED FINDING
 *
 * The commissioning brief asked for a GROUNDED form and a TECHNIQUE form (no
 * reason available, copy that never implies computation). At this tip the
 * technique state is UNREACHABLE and the grounded/technique split therefore
 * cannot be told apart at the data:
 *
 *   · `deriveNotAnalysedReason` (`utils/notAnalysedOptions.ts:145`) is TOTAL
 *     over a two-value union — it cannot return undefined.
 *   · The ONLY live producer of `notAnalysed` (`useResultsSectionData.ts:2227`)
 *     sets the flag and the reason in ONE object literal, so they cannot
 *     separate.
 *   · `allOptions` reaches this surface from that producer alone (`:2387`, and
 *     `:1923`'s empty pre-run array).
 *
 * `notAnalysedReason` is optional on `OptionResult`, so the state is reachable
 * at the TYPE — which is why three consumers carry a `?? 'not_returned'`. It is
 * not reachable on a run. Building a technique arm would be shipping code no
 * user can reach and calling it an honesty guarantee, so only the grounded form
 * is built, and the pair below is the REACHABLE distinction it turns on.
 * `technique_arm_is_unreachable` pins THE FIRST BULLET ONLY: that
 * `deriveNotAnalysedReason` is total, so the derivation cannot itself hand this
 * surface a reasonless option. It does NOT cover the other two, and it cannot
 * — a SECOND producer setting `notAnalysed` without a reason would never call
 * the derivation, so no assertion over the derivation can red on it. Bullets two
 * and three rest on the sweep above: a statement about this tip, not a guard.
 * Re-derive them before relying on this premise.
 */

import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))
vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))

import { OptionsComparison } from '../sections/OptionsComparison'
import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { makeData, genuineDecision } from './analysisNewFixtures'
import { deriveNotAnalysedReason } from '../../utils/notAnalysedOptions'
import { BRING_INTO_COMPARISON_LABEL } from '../../utils/notAnalysedCopy'
import type { OptionResult } from '../../types'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'

const LEFT_OUT = 'opt-left-out'
const OTHER_LEFT_OUT = 'opt-other-left-out'
const HEALTHY = 'opt-healthy'
const FAILED = 'opt-failed'

const LEFT_OUT_LABEL = 'Buy an AI Triage Tool'
const OTHER_LABEL = 'Hire Six More Agents'

const TEST_ID = 'analysis-new-options'
/** The act's testid is keyed BY ID — never by label, never by position. */
const actFor = (id: string) => `${TEST_ID}-bring-in-${id}`

function analysed(id: string, winProbability: number): OptionResult {
  return {
    id,
    label: `Label ${id}`,
    expected: 100,
    outcome: { mean: 100, p10: 60, p50: 100, p90: 140 },
    p10: 60,
    p50: 100,
    p90: 140,
    isRecommended: false,
    winProbability,
    nValidSamples: 10000,
    computeStatus: 'computed',
  }
}

function leftOut(id: string, label: string, reason: 'no_interventions' | 'not_returned'): OptionResult {
  return {
    id,
    label,
    expected: null,
    outcome: { mean: null, p10: null, p50: null, p90: null },
    p10: null,
    p50: null,
    p90: null,
    isRecommended: false,
    notAnalysed: true,
    notAnalysedReason: reason,
  }
}

/**
 * Drives the REAL view-model builder, never a hand-shaped section object.
 *
 * ⚠ A FIXTURE YOU WROTE YOURSELF IS NOT EVIDENCE ABOUT THE WIRE (CLAUDE.md trap
 * 16-inverse). Handing `OptionsComparison` a section literal carrying the right
 * `kind` and `reason` would test this file's idea of the view model rather than
 * the view model, and would stay green if `buildAnalysisNewViewModel` stopped
 * carrying the ground at all.
 */
function draw(options: OptionResult[], onSendMessage?: (m: string) => void) {
  const vm = buildAnalysisNewViewModel({
    data: makeData({ recommendation: { allOptions: options, isSingleOption: false } }),
    recommendations: [],
    isPreRun: false,
    isRunning: false,
    isStale: false,
  })
  const r = render(
    <OptionsComparison options={vm.optionsComparison} onSendMessage={onSendMessage} />,
  )
  expand()
  return r
}

/**
 * ⚠⚠ THE SECTION IS COLLAPSED BY DEFAULT, AND THIS IS A VACUITY GUARD, NOT
 * PLUMBING. `SectionShell`'s `defaultOpen` is `false`, so the rows are not in
 * the DOM at all until the toggle is clicked — and EVERY absence assertion in
 * this file ("renders no act when …") would pass against a closed section for
 * the reason that nothing whatsoever is rendered. Measured on the first run of
 * this suite: three tests passed that way before this existed (CLAUDE.md trap
 * 13 — an absence probe with no positive control).
 *
 * It asserts the open state rather than assuming the click worked, so a renamed
 * toggle REDs here instead of silently restoring the vacuum.
 */
function expand() {
  fireEvent.click(screen.getByTestId(`${TEST_ID}-toggle`))
  expect(
    screen.getByTestId(TEST_ID).getAttribute('data-section-open'),
    'the section must be OPEN, or every absence assertion below is vacuous',
  ).toBe('true')
}

/** The one message the act sent, or a failure naming what happened instead. */
function sentBy(id: string, options: OptionResult[]): string {
  const send = vi.fn()
  draw(options, send)
  fireEvent.click(screen.getByTestId(actFor(id)))
  expect(send, 'the act must send exactly one message').toHaveBeenCalledTimes(1)
  return send.mock.calls[0][0] as string
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('the premise this design rests on', () => {
  /**
   * ⚠ THE DECISION NOT TO BUILD A TECHNIQUE ARM IS A CLAIM ABOUT THE PRODUCER,
   * so it is asserted rather than asserted-in-prose. `deriveNotAnalysedReason`
   * is the only thing that answers "why not", and a run cannot reach a surface
   * with a not-analysed option whose ground is missing while this holds.
   *
   * SCOPE: this asserts the DERIVATION is total. It is silent on whether some
   * other producer sets `notAnalysed` without a reason, which is the way the
   * technique state would actually become reachable; that half is a sweep, not
   * this test. If this REDs, the derivation has stopped being total — re-derive
   * the producers before building the second form.
   */
  it('technique_arm_is_unreachable: every derivation yields a stated ground', () => {
    const cases: Array<{ edges: Array<{ source: string; target: string }>; expected: string }> = [
      { edges: [], expected: 'no_interventions' },
      { edges: [{ source: LEFT_OUT, target: 'factor-1' }], expected: 'not_returned' },
      { edges: [{ source: LEFT_OUT, target: OTHER_LEFT_OUT }], expected: 'no_interventions' },
      { edges: [{ source: 'someone-else', target: 'factor-1' }], expected: 'no_interventions' },
    ]
    for (const c of cases) {
      const got = deriveNotAnalysedReason(LEFT_OUT, c.edges, [LEFT_OUT, OTHER_LEFT_OUT])
      expect(got, `edges ${JSON.stringify(c.edges)}`).toBe(c.expected)
      expect(got, 'a ground is always stated').not.toBeUndefined()
    }
  })
})

describe('the act reaches the surface the deployed flags mount', () => {
  /**
   * ⚠⚠ ASSERTED AGAINST THE TAB BODY, NOT THE SECTION. This estate has twice
   * shipped a component whose own tests were green while the deployed surface
   * never mounted it (CLAUDE.md trap 3b). `AnalysisNewTabBody` is the Reasoning
   * tab (`OutputsDock.tsx:3837`, inside `<SectionErrorBoundary section="Reasoning">`)
   * and it is the thing that has to hand the section a writer.
   */
  function drawTab(over: Partial<Record<string, unknown>> = {}) {
    const base = genuineDecision()
    const data: ResultsSectionDataReturn = {
      ...base,
      recommendation: {
        ...base.recommendation,
        allOptions: [
          ...base.recommendation.allOptions,
          leftOut(LEFT_OUT, LEFT_OUT_LABEL, 'not_returned'),
        ],
      },
    } as ResultsSectionDataReturn
    const r = render(
      <AnalysisNewTabBody
        resultsSectionData={data}
        isPreRun={false}
        isRunning={false}
        isStale={false}
        responseHash="run_abc123"
        onSendMessage={vi.fn()}
        {...over}
      />,
    )
    expand()
    return r
  }

  it('is mounted on the reasoning tab beside the option it is about', () => {
    drawTab()
    expect(screen.getByTestId(actFor(LEFT_OUT))).toBeInTheDocument()
  })

  /**
   * ⚠ THE FAIL-CLOSED HALF, and it is the owner's standing complaint. A
   * permanently-greyed control that cannot act is exactly what has been
   * objected to twice. With no writer the ROW still renders its reason — the
   * disclosure is not conditional on the act — and the act is simply absent.
   */
  it('renders NO act when the host offers no writer, and still renders the row', () => {
    drawTab({ onSendMessage: undefined })
    expect(screen.queryByTestId(actFor(LEFT_OUT))).not.toBeInTheDocument()
    expect(screen.getByTestId(`${TEST_ID}-not-analysed-reason`)).toBeInTheDocument()
  })
})

describe('the honesty rule — the discriminating pair on the ground', () => {
  const field = (reason: 'no_interventions' | 'not_returned') => [
    analysed(HEALTHY, 0.6),
    leftOut(LEFT_OUT, LEFT_OUT_LABEL, reason),
  ]

  /**
   * ⭐ ARM A — the run DID submit it and returned nothing. The question names
   * that ground, and must NOT say the user failed to configure it.
   */
  it('not_returned: names the run’s own ground, and does not blame configuration', () => {
    const msg = sentBy(LEFT_OUT, field('not_returned'))
    expect(msg).toContain('The analysis returned no result for Buy an AI Triage Tool')
    expect(msg, 'must not blame the user for an engine outcome').not.toContain('no values set')
  })

  /**
   * ⭐ ARM B — NOTHING WAS COMPUTED about this option. The question must not
   * imply the analysis evaluated it, returned anything about it, or scored it.
   *
   * ⚠ THE NEGATIVE HALF IS THE POINT. A mutant that makes this arm reuse the
   * other's sentence produces a fully grammatical, non-empty message that still
   * renders — so presence of a sentence proves nothing (the sibling lane's
   * measured lesson: one of three arms silently dropped the producer's figure
   * while still returning a non-empty string). These assertions check WHAT THE
   * ARM CARRIES, not that it rendered.
   */
  it('no_interventions: claims no computation about the option', () => {
    const msg = sentBy(LEFT_OUT, field('no_interventions'))
    expect(msg).toContain('Buy an AI Triage Tool has no values set yet')
    expect(msg, 'nothing was computed, so nothing may be reported as returned').not.toContain(
      'returned no result',
    )
    expect(msg, 'must not imply the option was analysed').not.toMatch(/analys/i)
  })

  /** Both arms are the SAME act: one option, one ground, one ask. */
  it('both arms name the option and end in the ask, and neither promises anything', () => {
    for (const reason of ['no_interventions', 'not_returned'] as const) {
      const msg = sentBy(LEFT_OUT, field(reason))
      expect(msg, reason).toContain(LEFT_OUT_LABEL)
      expect(msg, reason).toContain('What would it take to bring it in?')
      expect(msg, `${reason}: no em dashes in product copy`).not.toContain('—')
      expect(msg, `${reason}: never promise an improvement`).not.toMatch(/will (improve|be better|fix)/i)
      cleanup()
      vi.clearAllMocks()
    }
  })

  /** The label is a question, and it promises no outcome the click cannot produce. */
  it('the label asks rather than promising to bring the option in', () => {
    expect(BRING_INTO_COMPARISON_LABEL).toBe('What would bring this in?')
    expect(BRING_INTO_COMPARISON_LABEL).not.toContain('—')
  })
})

describe('bound by identity, never by label and never by the rendered sentence', () => {
  const two = [
    analysed(HEALTHY, 0.6),
    leftOut(LEFT_OUT, LEFT_OUT_LABEL, 'not_returned'),
    leftOut(OTHER_LEFT_OUT, OTHER_LABEL, 'no_interventions'),
  ]

  /**
   * ⭐ THE DISCRIMINATING PAIR. Two left-out options sit side by side with
   * DIFFERENT grounds, so a control bound to "the first not-analysed row" or to
   * the rendered sentence would pass on the wrong one. Clicking each must send
   * ITS OWN option and ITS OWN ground.
   */
  it('each act sends its own option and its own ground', () => {
    expect(sentBy(LEFT_OUT, two)).toContain('The analysis returned no result for Buy an AI Triage Tool')
    cleanup()
    vi.clearAllMocks()
    expect(sentBy(OTHER_LEFT_OUT, two)).toContain('Hire Six More Agents has no values set yet')
  })

  /**
   * ⚠ CLICKS THE **SECOND** LEFT-OUT ROW ON PURPOSE. Measured: with this
   * asserted on the FIRST row, a mutant binding every act to
   * `rows.filter(not_analysed)[0]` stayed GREEN here — the option it wrongly
   * targeted happened to be the one under test, so the assertion agreed with a
   * broken binding. A control that can only catch a defect on the first element
   * is not a control on identity.
   */
  it('never names the sibling option, asserted from the SECOND row', () => {
    const msg = sentBy(OTHER_LEFT_OUT, two)
    expect(msg).toContain(OTHER_LABEL)
    expect(msg, 'the act must not reach for another row').not.toContain(LEFT_OUT_LABEL)
  })

  /**
   * ⚠ THE GREEN HALF of the identity pair. Changing an UNRELATED option must
   * not move this act's message at all — if it does, the binding is positional
   * or value-based rather than by id.
   */
  it('is unmoved by a change to an unrelated option', () => {
    const before = sentBy(LEFT_OUT, two)
    cleanup()
    vi.clearAllMocks()
    const after = sentBy(LEFT_OUT, [
      analysed(HEALTHY, 0.11),
      leftOut(LEFT_OUT, LEFT_OUT_LABEL, 'not_returned'),
      leftOut(OTHER_LEFT_OUT, 'A completely different name', 'not_returned'),
    ])
    expect(after).toBe(before)
  })
})

describe('neither state — nothing to offer, so nothing is rendered', () => {
  it('renders no act when every option was analysed', () => {
    draw([analysed(HEALTHY, 0.6), analysed('opt-second', 0.4)], vi.fn())
    expect(screen.queryByText(BRING_INTO_COMPARISON_LABEL)).not.toBeInTheDocument()
  })

  /**
   * ⛔ NOT ON `not_computed`. That option WAS in the comparison and the
   * computation failed, so there is nothing to bring in and the question would
   * misdescribe the run. Its own reason line must still render — the row is
   * unchanged, only the act is withheld.
   */
  it('renders no act beside an option the analysis ran on and could not compute', () => {
    const failed: OptionResult = {
      ...analysed(FAILED, 0),
      label: 'Migrate to Salesforce',
      expected: null,
      outcome: { mean: null, p10: null, p50: null, p90: null },
      p10: null,
      p50: null,
      p90: null,
      nValidSamples: 0,
      computeStatus: 'failed',
    }
    draw([analysed(HEALTHY, 0.6), failed], vi.fn())
    expect(screen.getByTestId(`${TEST_ID}-not-computed-reason`)).toBeInTheDocument()
    expect(screen.queryByTestId(actFor(FAILED))).not.toBeInTheDocument()
  })
})
