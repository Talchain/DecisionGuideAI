/**
 * ⭐⭐ THE REFUSAL IS LEGIBLE. NOW IT IS ACTIONABLE.
 *
 * `refusalIsLegible.spec.tsx` closed the first half: a run whose model declined
 * to license a comparative claim renders the producer's own sentence saying why,
 * instead of the silence that is indistinguishable from an ordinary run. The
 * sentence, live from CEE on `staging--olumi.netlify.app`:
 *
 *   "Every estimate this comparison rests on is Olumi's, not yours. Figures can
 *    be shown as provisional, but no option can be called the leader and no
 *    result can be called stable or robust until you have set at least one of
 *    them."
 *
 * That is TRUE, it names a remedy in words, and it leaves the reader nowhere to
 * go. It is `honestSentenceHasAMove.spec.tsx`'s complaint exactly — "the panel
 * was optimised for truthfulness and never for usefulness" — one slot further
 * down. This file is that spec's sibling: the ACT half.
 *
 * ── WHAT THE CONTROL MAY AND MAY NOT SAY ──────────────────────────────────
 * ⛔⛔ IT MAY NOT PROMISE A BETTER ANSWER, AND THIS IS A MEASUREMENT, NOT A
 * PREFERENCE. Measured on the live wire: ONE user-stated value out of twenty
 * flips CEE from `quantified_provisional` to `comparative_leader`, while the
 * other nineteen estimates remain Olumi's own. So a control captioned "set a
 * value to get a confident answer" would be describing a real state transition
 * and still lying about what it means — the model licenses the CLAIM because a
 * human has entered the loop, not because the evidence got stronger.
 *
 * ⛔ AND IT MAY NOT COACH A RUBBER-STAMP. "Confirm these figures" on a panel
 * whose whole complaint is that the figures are Olumi's own is an instruction to
 * launder a machine estimate into a user-stated one. The offer is to REVIEW OR
 * SET, which is the only honest description of what the destination does.
 *
 * The third test below is a copy CEILING over those two rules, with a positive
 * control proving it can fail on a plausible breach (CLAUDE.md trap 13 — an
 * absence assertion with no demonstrated presence asserts nothing).
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn(() => true) }))

import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { AtAGlance } from '../sections/AtAGlance'
import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import { decisionWithLeaderWithheld, genuineDecision } from './analysisNewFixtures'

const SENTENCE = 'analysis-new-glance-withheld-reason'
const CONTROL = 'analysis-new-glance-withheld-review-estimates'

/**
 * The live capture, verbatim — the same payload `refusalIsLegible.spec.tsx`
 * carries, for the same reason: a hand-written stand-in would encode this
 * author's model of the producer rather than the producer.
 */
const CAPTURED_REFUSAL = {
  structurally_analysable: true,
  missing_important_inputs: [],
  semantic_quality_sufficient: false,
  permitted_analysis_mode: 'quantified_provisional',
  reasons: [
    {
      field: 'structurally_analysable',
      code: 'READY_TO_COMPARE',
      message: 'Analysis can run on this model as it stands.',
    },
    {
      field: 'semantic_quality_sufficient',
      code: 'CONFIDENCE_PARAMETERS_ALL_MACHINE_AUTHORED',
      message:
        'Every estimate this comparison rests on is Olumi’s, not yours. Figures can be shown as provisional, but no option can be called the leader and no result can be called stable or robust until you have set at least one of them.',
    },
    {
      field: 'permitted_analysis_mode',
      code: 'CONFIDENCE_PARAMETERS_ALL_MACHINE_AUTHORED',
      message:
        'Every estimate this comparison rests on is Olumi’s, not yours. Figures can be shown as provisional, but no option can be called the leader and no result can be called stable or robust until you have set at least one of them.',
    },
  ],
}

/**
 * ⭐⭐⭐ THE OTHER CAUSES THAT REACH THE SAME SENTENCE SLOT — the corpus, and the
 * reason this file is no longer a guard agreeing with itself.
 *
 * `CAPTURED_REFUSAL` above is ONE cell. The slot it fills is the
 * `permitted_analysis_mode` reason, and CEE pushes that reason on EVERY verdict,
 * so six distinct codes can occupy it — of which only TWO name an estimate as the
 * remedy. A corpus containing only the cell the act was written for would pass
 * while the act was wrong for four of the others: trap 22, the corpus omitting a
 * class the contract admits.
 *
 * ── PROVENANCE, AND ITS HONEST SCOPE ──────────────────────────────────────────
 * These are the producer's own strings, read at CEE `staging` `8449e54e`,
 * `src/orchestrator-v5/admission/analysis-admission.ts` — `SEMANTIC_REASON`
 * (:945-968) and `MODE_REASON` (:979-995), pushed at :1131-1134. Derived twice and
 * independently: a static read of both tables, and a runtime probe over 29 graph
 * members (8 purpose-built topologies, 5 synthetic, 16 real captures) which
 * witnessed five of the six live.
 *
 * ⚠ WHAT THAT IS AND IS NOT. It is a derivation from the PRODUCER, which is the
 * standard these sentences must be held to — a stand-in written here would encode
 * this author's model of CEE rather than CEE (trap 16-inverse: a fixture you wrote
 * yourself is not evidence about the wire). It is NOT a live wire capture of each
 * cell on `staging--olumi.netlify.app`; only `ALL_MACHINE_AUTHORED` has one, in
 * `cee-normal-start-graphless-fallback-wire-20260907.json`. So these pin THE UI'S
 * TREATMENT of each producer cause, not that every cause has been seen on the wire.
 *
 * ⚠ `Olumi’s` IS U+2019, NOT AN ASCII APOSTROPHE, in the producer's user-facing
 * strings (verified at the bytes). These are copied, not retyped.
 */
const ADMISSION_BASE = {
  structurally_analysable: true,
  missing_important_inputs: [],
  semantic_quality_sufficient: false,
} as const

/** Builds the slot under test, plus the affirmative conjunct the live wire sends. */
const admissionWithModeReason = (
  mode: string,
  reason: { code?: string; message: string },
  extraReasons: ReadonlyArray<{ field: string; code?: string; message: string }> = [],
) => ({
  ...ADMISSION_BASE,
  permitted_analysis_mode: mode,
  reasons: [
    {
      field: 'structurally_analysable',
      code: 'READY_TO_COMPARE',
      message: 'Analysis can run on this model as it stands.',
    },
    ...extraReasons,
    { field: 'permitted_analysis_mode', ...reason },
  ],
})

/**
 * ⭐ THE SECOND ESTIMATE CAUSE — and the one a `CONFIDENCE_PARAMETERS_` PREFIX
 * TEST SILENTLY LOSES. It carries no such prefix and it is unambiguously an
 * estimate refusal ("until you have set a value on a factor…"), so the gate must
 * be an explicit allowlist. This case is what discriminates the allowlist from the
 * prefix shortcut; without it, the prefix version passes everything here.
 */
const REFUSAL_USER_STATED_NOT_MATERIAL = admissionWithModeReason(
  'quantified_provisional',
  {
    code: 'USER_STATED_PARAMETERS_NOT_MATERIAL',
    message:
      'The values you have set sit outside what this comparison turns on, so every estimate behind it is still Olumi’s. Figures can be shown as provisional, but no option can be called the leader until you have set a value on a factor one of the options changes, or somewhere on the chain from there to your goal.',
  },
)

/** ⛔ NAMES AN OPTION, NOT AN ESTIMATE. Factors cannot invent a second option. */
const REFUSAL_NOTHING_TO_COMPARE = admissionWithModeReason('exploratory', {
  code: 'NOTHING_TO_COMPARE',
  message:
    'There is nothing to compare yet, so no figures can be produced. Name at least two different options you are weighing.',
})

/** ⛔ NAMES NO ACT AT ALL — a pure diagnosis. An estimate cannot clear a blocker. */
const REFUSAL_MODEL_HAS_BLOCKERS = admissionWithModeReason('none', {
  code: 'MODEL_HAS_BLOCKERS',
  message: 'This model cannot be analysed yet.',
})

/**
 * ⛔ NAMES NO ACT; the missing object is a RELATIONSHIP, which Factors cannot add.
 * ⚠ TYPE-REACHABLE BUT MEASURED-ABSENT in this slot: 8 topologies built to force
 * it all collapsed to `none`. Pinned anyway — "we could not reach it" is not
 * "it cannot happen", and the fail-closed branch must hold if it ever arrives.
 */
const REFUSAL_NO_COMPARISON_SUBSTRATE = admissionWithModeReason('quantified_provisional', {
  code: 'NO_COMPARISON_SUBSTRATE',
  message:
    'Nothing in this model connects the options to your goal, so there is no comparison to draw a leader from.',
})

/**
 * ⭐⭐⭐ THE MEASURED (field, code) TRAP, AND THE SHARPEST CASE IN THIS FILE.
 *
 * The two ESTIMATE codes ALSO ride the `semantic_quality_sufficient` reason, which
 * CEE pushes unconditionally (`:1124-1128`). This payload is the shape the runtime
 * probe actually measured: the mode slot says "name two different options" while a
 * SIBLING conjunct carries `CONFIDENCE_PARAMETERS_ALL_MACHINE_AUTHORED`.
 *
 * A gate that searched `reasons[]` for an estimate code — rather than reading the
 * code off the `permitted_analysis_mode` conjunct it is rendering — would offer
 * "review or set an estimate" to a user whose actual next move is to name a second
 * option. Every other test in this file passes under that defect. This one does not.
 */
const REFUSAL_OPTION_CAUSE_WITH_ESTIMATE_SIBLING = admissionWithModeReason(
  'exploratory',
  {
    code: 'NOTHING_TO_COMPARE',
    message:
      'There is nothing to compare yet, so no figures can be produced. Name at least two different options you are weighing.',
  },
  [
    {
      field: 'semantic_quality_sufficient',
      code: 'CONFIDENCE_PARAMETERS_ALL_MACHINE_AUTHORED',
      message:
        'Every estimate this comparison rests on is Olumi’s, not yours. Figures can be shown as provisional, but no option can be called the leader and no result can be called stable or robust until you have set at least one of them.',
    },
  ],
)

/**
 * ⛔ A CAUSE THIS BUILD DOES NOT KNOW, and the absence arm. CEE types `code` as a
 * bare `z.string()` with no published enum, so a renamed or newly-minted cause is
 * a real deploy state rather than a hypothetical — and a pre-`code` producer is
 * the reason the field is optional. Both must lose the act, not inherit one.
 */
const REFUSAL_UNRECOGNISED_CODE = admissionWithModeReason('quantified_provisional', {
  code: 'SOME_CAUSE_MINTED_AFTER_THIS_BUILD',
  message: 'A sentence this build has never seen, refusing for a reason it cannot classify.',
})

const REFUSAL_NO_CODE_AT_ALL = admissionWithModeReason('quantified_provisional', {
  message:
    'Every estimate this comparison rests on is Olumi’s, not yours. Figures can be shown as provisional, but no option can be called the leader and no result can be called stable or robust until you have set at least one of them.',
})

const withAdmission = (
  data: ResultsSectionDataReturn,
  admission: unknown,
): ResultsSectionDataReturn =>
  ({
    ...data,
    recommendation: { ...data.recommendation, analysisAdmission: admission },
  }) as ResultsSectionDataReturn

const glanceOf = (data: ResultsSectionDataReturn) =>
  buildAnalysisNewViewModel({
    data,
    recommendations: [],
    isPreRun: false,
    isRunning: false,
    isStale: false,
  }).atAGlance

const renderGlance = (data: ResultsSectionDataReturn, over: Record<string, unknown> = {}) =>
  render(
    <AtAGlance
      glance={glanceOf(data)}
      isRunning={false}
      reanalyseBlocked={false}
      reanalyseBlockedReason={null}
      onReanalyse={vi.fn()}
      {...over}
    />,
  )

/** The withheld state, pinned in-test everywhere it is used. */
const withheld = () => withAdmission(decisionWithLeaderWithheld(), CAPTURED_REFUSAL)

afterEach(() => cleanup())

describe('the withheld-designation sentence carries the act that answers it', () => {
  it('offers the control beside the sentence, and it calls the handler', async () => {
    // ⚠ PRECONDITION PINNED IN-TEST. If this fixture stopped withholding, every
    // assertion below would be about a state the surface never reaches, and the
    // whole file would pass by testing nothing (CLAUDE.md trap 13b).
    expect(glanceOf(withheld()).headline).toBeNull()
    expect(glanceOf(withheld()).designationWithheldReason).toBeTruthy()

    const onReviewEstimates = vi.fn()
    renderGlance(withheld(), { onReviewEstimates })

    expect(screen.getByTestId(SENTENCE)).toBeInTheDocument()
    await userEvent.click(screen.getByTestId(CONTROL))
    expect(onReviewEstimates).toHaveBeenCalledTimes(1)
  })

  /**
   * ⭐ BESIDE THE SENTENCE, NOT MERELY SOMEWHERE ON THE PANEL — bound by
   * CONTAINMENT rather than by co-presence. Two testids both being in the
   * document is satisfied by a control rendered anywhere at all, including in a
   * block that states something else (CLAUDE.md trap 19: an assertion must bind
   * to its object by identity, never by a predicate another object satisfies).
   * The refusal block carries `role="status"`; a control that drifted out of it
   * would be an orphaned button under a heading it no longer answers.
   */
  it('renders INSIDE the refusal block, not merely elsewhere on the panel', () => {
    renderGlance(withheld(), { onReviewEstimates: vi.fn() })
    const sentence = screen.getByTestId(SENTENCE)
    const control = screen.getByTestId(CONTROL)
    const block = sentence.closest('[role="status"]')
    expect(block, 'the refusal block lost its role="status"').not.toBeNull()
    expect(block!.contains(control)).toBe(true)
  })

  /**
   * ⚠ FAIL-CLOSED, AND IT IS THE DISCRIMINATING HALF. Without this, the cases
   * above pass on a component that renders the control unconditionally —
   * including on every host that supplies no handler, where pressing it does
   * nothing. `AtAGlance`'s own `onReanalyse` prop already states the rule for
   * this surface: "a staleness sentence with a dead button beside it is worse
   * than the sentence alone."
   */
  it('renders the sentence ALONE when no handler is supplied', () => {
    renderGlance(withheld(), { onReviewEstimates: undefined })
    expect(screen.getByTestId(SENTENCE)).toBeInTheDocument()
    expect(screen.queryByTestId(CONTROL)).not.toBeInTheDocument()
  })

  /**
   * ⚠ THE OPPOSITE-DIRECTION TWIN (CLAUDE.md trap 22b). A control gated on the
   * HANDLER alone renders on every run, including the ones that concluded — an
   * offer to go and fix estimates on a panel that just named a leading option,
   * under no heading at all, because the refusal block is not rendered there.
   */
  it('renders NO control on a run that DID conclude', () => {
    const data = genuineDecision()
    expect(glanceOf(data).designationWithheldReason).toBeFalsy()
    renderGlance(data, { onReviewEstimates: vi.fn() })
    expect(screen.queryByTestId(SENTENCE)).not.toBeInTheDocument()
    expect(screen.queryByTestId(CONTROL)).not.toBeInTheDocument()
  })
})

/**
 * ⭐⭐⭐ THE ACT MUST ANSWER THE SENTENCE IT SITS UNDER — the breadth of the render
 * predicate, which is the half a single-cell corpus cannot see.
 *
 * The tests above establish that the control appears, is contained in the refusal
 * block, fires its handler, and is absent without one. ALL OF THEM PASS while the
 * control is offered under a refusal that asks for something else entirely,
 * because all of them use one cell: `quantified_provisional` +
 * `ALL_MACHINE_AUTHORED`. What would make every test pass while the property
 * fails? Precisely that. So here is the rest of the slot's domain.
 *
 * ⛔ THE PROPERTY, STATED ONCE: the sentence is ALWAYS rendered — the refusal stays
 * legible under every cause, which is the first half of this lane and must not
 * regress — and the ACT is rendered ONLY where the producer's own words ask for an
 * estimate. A cause that names an option, names no act, is unrecognised, or arrives
 * without a code gets the sentence ALONE.
 */
describe('the act is offered only where the refusal asks for an estimate', () => {
  /**
   * Each row names the cause, the payload, and whether the act applies. The
   * `expectAct` column is derived from the PRODUCER'S SENTENCE, not from the
   * implementation — which is the whole point, since a mutant kit measures whether
   * a test can detect a change and never whether the expectation is right
   * (trap 13c). Read the `message` in each payload above and ask: can setting a
   * factor estimate do what this sentence asks?
   */
  const CAUSES: ReadonlyArray<{
    name: string
    admission: unknown
    expectAct: boolean
    why: string
  }> = [
    {
      name: 'CONFIDENCE_PARAMETERS_ALL_MACHINE_AUTHORED',
      admission: CAPTURED_REFUSAL,
      expectAct: true,
      why: '"until you have set at least one of them" — an estimate is exactly the ask',
    },
    {
      name: 'USER_STATED_PARAMETERS_NOT_MATERIAL',
      admission: REFUSAL_USER_STATED_NOT_MATERIAL,
      expectAct: true,
      why: '"until you have set a value on a factor one of the options changes" — an estimate',
    },
    {
      name: 'NOTHING_TO_COMPARE',
      admission: REFUSAL_NOTHING_TO_COMPARE,
      expectAct: false,
      why: '"Name at least two different options" — Factors cannot invent an option',
    },
    {
      name: 'MODEL_HAS_BLOCKERS',
      admission: REFUSAL_MODEL_HAS_BLOCKERS,
      expectAct: false,
      why: '"This model cannot be analysed yet" — names no act an estimate could be',
    },
    {
      name: 'NO_COMPARISON_SUBSTRATE',
      admission: REFUSAL_NO_COMPARISON_SUBSTRATE,
      expectAct: false,
      why: 'the missing object is a relationship to the goal, not an estimate',
    },
    {
      name: 'NOTHING_TO_COMPARE with an ESTIMATE code on a sibling conjunct',
      admission: REFUSAL_OPTION_CAUSE_WITH_ESTIMATE_SIBLING,
      expectAct: false,
      why: 'the act must follow the rendered conjunct, never any estimate code in reasons[]',
    },
    {
      name: 'a cause minted after this build',
      admission: REFUSAL_UNRECOGNISED_CODE,
      expectAct: false,
      why: 'fail-closed: an unknown cause must not inherit another cause’s act',
    },
    {
      name: 'no code at all (pre-code producer)',
      admission: REFUSAL_NO_CODE_AT_ALL,
      expectAct: false,
      why: 'fail-closed on absence, even though this message IS the estimate sentence',
    },
  ]

  /**
   * ⭐ THE CORPUS MUST CONTAIN BOTH DIRECTIONS, AND THIS ASSERTS IT (trap 22b). A
   * table that had drifted to all-negative would make every "no act" case below
   * pass while proving nothing about the act ever appearing — and all-positive
   * would be the original defect restored. A guard over a table needs the table
   * pinned, or it is a guard over whatever the table happens to say today.
   */
  it('the corpus covers both directions, and spans the producer’s causes', () => {
    expect(CAUSES.filter((c) => c.expectAct).length).toBeGreaterThanOrEqual(2)
    expect(CAUSES.filter((c) => !c.expectAct).length).toBeGreaterThanOrEqual(5)
    // The five codes measured live in the slot are all represented by name.
    const named = CAUSES.map((c) => c.name).join(' ')
    for (const code of [
      'CONFIDENCE_PARAMETERS_ALL_MACHINE_AUTHORED',
      'USER_STATED_PARAMETERS_NOT_MATERIAL',
      'NOTHING_TO_COMPARE',
      'MODEL_HAS_BLOCKERS',
      'NO_COMPARISON_SUBSTRATE',
    ]) {
      expect(named, `the corpus lost its ${code} case`).toContain(code)
    }
  })

  for (const { name, admission, expectAct, why } of CAUSES) {
    it(`${name}: sentence always, act ${expectAct ? 'OFFERED' : 'WITHHELD'} — ${why}`, () => {
      const data = withAdmission(decisionWithLeaderWithheld(), admission)

      // ⚠ PRECONDITION PINNED IN-TEST. Every cause here must actually reach the
      // refusal block; a payload that stopped withholding would make the
      // control's absence below true for the wrong reason, and the case would
      // pass by testing nothing (trap 13b).
      const glance = glanceOf(data)
      expect(glance.headline, `${name} stopped withholding the headline`).toBeNull()
      expect(
        glance.designationWithheldReason,
        `${name} produced no refusal sentence, so this case proves nothing`,
      ).toBeTruthy()

      renderGlance(data, { onReviewEstimates: vi.fn() })

      // The refusal stays LEGIBLE under every cause — the first half of this lane.
      expect(screen.getByTestId(SENTENCE)).toBeInTheDocument()

      if (expectAct) {
        expect(glance.designationWithheldRemedy).toBe('estimate')
        expect(screen.getByTestId(CONTROL)).toBeInTheDocument()
      } else {
        expect(glance.designationWithheldRemedy).toBeNull()
        expect(
          screen.queryByTestId(CONTROL),
          `"Review or set an estimate" was offered under a refusal that asks for ` +
            `something else (${name}). Setting an estimate cannot answer it, so the ` +
            `act is futile under a true sentence — the harm CEE's cause split exists ` +
            `to prevent.`,
        ).not.toBeInTheDocument()
      }
    })
  }

  /**
   * ⭐ THE OVER-SUPPRESSION TWIN, THROUGH THE TAB BODY. The gate added here could
   * be satisfied by never rendering the act at all, and every negative case above
   * would applaud. This is the positive direction end-to-end, so a fix that
   * silenced the control entirely REDs rather than passing as a clean sweep.
   */
  it('still renders the act through the tab body on the second estimate cause', async () => {
    render(
      <AnalysisNewTabBody
        resultsSectionData={withAdmission(
          decisionWithLeaderWithheld(),
          REFUSAL_USER_STATED_NOT_MATERIAL,
        )}
        isPreRun={false}
        isRunning={false}
        isStale={false}
        responseHash="run_abc123"
        canRunAnalysis
        runBlockedReason={null}
        onReviewEstimates={vi.fn()}
      />,
    )
    expect(screen.getByTestId(SENTENCE)).toBeInTheDocument()
    expect(screen.getByTestId(CONTROL)).toBeInTheDocument()
  })
})

describe('the control offers a review, and promises nothing', () => {
  /**
   * ⛔ THE CEILING. Hand-written, and deliberately so: a guard DERIVED from the
   * label could only prove the label agrees with itself (CLAUDE.md trap 12d —
   * derivation stops consumers drifting, only a corpus notices the list is
   * wrong). Its power therefore rests entirely on the positive control below.
   */
  const PROMISES_A_BETTER_RESULT: ReadonlyArray<RegExp> = [
    /\bmore (?:confident|reliable|accurate|certain|robust|stable)\b/i,
    /\b(?:improve|strengthen|increase|boost|raise)s?\b.*\b(?:confidence|certainty|reliability|accuracy)\b/i,
    /\b(?:unlock|enable|get|receive|reach)\b.*\b(?:leader|leading option|answer|verdict|conclusion|result)\b/i,
    /\bto (?:see|get|reveal)\b.*\b(?:which|the)\b.*\b(?:leading|best|top)\b/i,
    /\bbetter\b.*\b(?:answer|result|analysis|verdict)\b/i,
  ]

  /** ⛔ Rubber-stamping: an instruction to accept the machine's figure as-is. */
  const COACHES_A_RUBBER_STAMP: ReadonlyArray<RegExp> = [
    /\b(?:confirm|accept|approve|agree with|sign off|ok)\b.*\b(?:these|the|olumi|our)\b.*\b(?:figures?|estimates?|values?|numbers?)\b/i,
    /\b(?:looks? right|as[- ]is|keep (?:these|them))\b/i,
  ]

  const LABEL = COPY.glance.reviewEstimates

  /**
   * ⭐⭐ THE LOAD-BEARING TEST. A ceiling that cannot fail on the sentence it
   * exists to forbid is theatre, and every "the label is clean" assertion below
   * would then be passing by testing nothing. These two breaches are the ones
   * that were genuinely tempting to ship: the first is what the measurement
   * makes true-sounding, the second is what an author reaches for to keep the
   * label short.
   */
  it('the ceiling can FAIL on the two breaches it exists to forbid', () => {
    const PROMISE_BREACH = 'Set an estimate to get a more confident answer'
    const STAMP_BREACH = 'Confirm these estimates'
    expect(
      PROMISES_A_BETTER_RESULT.some((p) => p.test(PROMISE_BREACH)),
      'the ceiling must be capable of failing the sentence it is cited for',
    ).toBe(true)
    expect(
      COACHES_A_RUBBER_STAMP.some((p) => p.test(STAMP_BREACH)),
      'the ceiling must be capable of failing the rubber-stamp sentence',
    ).toBe(true)
  })

  it('the label promises no better result', () => {
    const hit = PROMISES_A_BETTER_RESULT.find((p) => p.test(LABEL))
    expect(
      hit ? `${LABEL} matched ${hit}` : null,
      'One user-stated value out of twenty flips the model from ' +
        'quantified_provisional to comparative_leader while nineteen estimates ' +
        'stay Olumi’s own. The claim licensed by that transition is that a human ' +
        'entered the loop — never that the answer got better.',
    ).toBeNull()
  })

  it('the label does not coach a rubber-stamp', () => {
    const hit = COACHES_A_RUBBER_STAMP.find((p) => p.test(LABEL))
    expect(
      hit ? `${LABEL} matched ${hit}` : null,
      'Confirming an Olumi figure as-is launders a machine estimate into a ' +
        'user-stated one, which is the precise thing the producer’s sentence is ' +
        'complaining about.',
    ).toBeNull()
  })

  it('the label offers a review or a change, in words', () => {
    // Identity, not vibes: the offer must actually name the act.
    expect(LABEL).toMatch(/\b(?:review|set|change|edit)\b/i)
  })
})

describe('the tab actually threads the handler', () => {
  /**
   * ⭐⭐ THE PROP EXISTING IS NOT THE PROP ARRIVING. `AtAGlance` is fail-closed,
   * so a tab body that accepts the handler and forgets to pass it down renders
   * the sentence alone and every component-level test above still passes — the
   * estate's first chronic failure ("we build more than we plug in") reproduced
   * at one component boundary.
   */
  it('renders the control when AnalysisNewTabBody is given the handler', async () => {
    const onReviewEstimates = vi.fn()
    render(
      <AnalysisNewTabBody
        resultsSectionData={withheld()}
        isPreRun={false}
        isRunning={false}
        isStale={false}
        responseHash="run_abc123"
        canRunAnalysis
        runBlockedReason={null}
        onReviewEstimates={onReviewEstimates}
      />,
    )
    expect(screen.getByTestId(SENTENCE)).toBeInTheDocument()
    await userEvent.click(screen.getByTestId(CONTROL))
    expect(onReviewEstimates).toHaveBeenCalledTimes(1)
  })

  it('renders the sentence alone through the tab body when no handler is given', () => {
    render(
      <AnalysisNewTabBody
        resultsSectionData={withheld()}
        isPreRun={false}
        isRunning={false}
        isStale={false}
        responseHash="run_abc123"
        canRunAnalysis
        runBlockedReason={null}
      />,
    )
    expect(screen.getByTestId(SENTENCE)).toBeInTheDocument()
    expect(screen.queryByTestId(CONTROL)).not.toBeInTheDocument()
  })
})
