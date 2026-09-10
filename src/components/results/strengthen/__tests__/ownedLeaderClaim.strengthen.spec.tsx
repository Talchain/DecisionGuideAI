/**
 * ROADMAP 1.243 — the Strengthen engine gates its leader claims on the OWNED
 * verdict (`DecisionVerdict.hasLeadingOption`), the same signal #491/#493/#494
 * consume. No second source is invented here.
 *
 * THE DEFECT. `buildRecommendations` had ZERO references to the verdict, so on
 * a withheld run — one where the producer explicitly declined to put an option
 * forward — it still emitted "Challenge the leader" with the prompt
 * "Build the strongest case against the current leading option." A user who
 * clicked it got the assistant asserting, as established fact, a leader the
 * system had just said it could not name. The label was mild; the PROMPT was
 * the leak.
 *
 * WHY THE PROMPT SURFACE IS FIVE FIELDS WIDE, NOT ONE. `StrengthenContainer`
 * (verified at the bytes, a79683e4) hands the assistant:
 *   · `rec.action.prompt ?? rec.title`  -> `_dispatchAction({ message })`
 *                                          / `_sendMessage(...)`
 *   · `rec.action.parameters`           -> forwarded VERBATIM on the same call
 *   · `rec.whyNow`                      -> `openAskOlumi({ context })`
 *   · `rec.title`                       -> `COPY.workThroughDraft(rec.title)`
 * So auditing `action.prompt` alone would have cleared the flip rec, whose
 * `action.prompt` is clean and whose TITLE says "change the leader". Every
 * assertion below sweeps all of them.
 *
 * TRAP 13 (a positive control, or the absence assertion is vacuous). Every
 * withheld case has a PERMITTED twin. The designating-form table asserts each
 * form is ABSENT on the withheld run and PRESENT on the permitted one — so an
 * over-suppressing fix fails just as loudly as an ungated one. Over-suppression
 * is an equal failure and this arc has already produced one (#493's
 * single-option regression).
 */
import { describe, expect, it, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { buildRecommendations } from '../buildRecommendations'
import type { Recommendation, StrengthenInputs } from '../strengthenTypes'
import { resolveFactorConfidenceDisplay } from '../../driverConfidenceDisplayPolicy'
import { StrengthenContainer } from '../StrengthenContainer'
import { useCanvasStore } from '../../../../canvas/store'
import { useGuidanceStore } from '../../../../canvas/stores/guidanceStore'
import { selectActive, useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import { useAskOlumiStore } from '../../coaching/askOlumiStore'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'

/** The label the producer would name as the option a flip switches TO. It is a
 *  distinctive string so its presence/absence is unambiguous evidence. */
const ALT_WINNER = 'Rebuild in-house'

/** The label of the option this run DESIGNATES — the identity a permitted
 *  trigger must use as its subject instead of a rank position. Distinctive for
 *  the same reason `ALT_WINNER` is, and deliberately a DIFFERENT string, so a
 *  sweep cannot confuse "names the leader" with "names the alternative". */
const LEADER_LABEL = 'Adopt Segment'

/**
 * A fixture that reaches EVERY branch of the engine at once (TESTING-DISCIPLINE
 * #1: name the branch each fixture must reach). `level` selects between the two
 * mutually exclusive robustness branches — 'low' fires the challenge rec,
 * 'high' fires the commit rec — so both are exercised rather than one being
 * silently unreached.
 */
function everyBranch(
  level: 'low' | 'high',
  hasLeadingOption?: boolean,
): StrengthenInputs {
  return {
    goalThreshold: null, // -> strengthen:success-measure
    analysisComplete: true,
    // IDENTITY, threaded on every arm. Permission varies below; the NAME does
    // not, so a rec that goes silent on the withheld arm does so because the
    // gate fired and never because the fixture withheld the label too.
    leadingOptionLabel: LEADER_LABEL,
    flipThresholds: null,
    fragileEdges: [
      {
        edgeId: 'edge_9',
        factorLabel: 'Churn rate',
        switchProbability: 0.27,
        alternativeWinnerLabel: ALT_WINNER,
      },
    ], // -> strengthen:flip:edge_9
    factors: [
      {
        factorId: 'fac_churn',
        label: 'Churn rate',
        influence: 0.82,
        // The policy module's documented `displaySafe` test seam, so the
        // fixture cannot claim a shape production would never emit.
        confidenceDisplay: resolveFactorConfidenceDisplay({ confidence: 0.2 }, true),
        canFocus: true,
      }, // -> strengthen:lehi:fac_churn
      {
        factorId: 'fac_price',
        label: 'Price elasticity',
        influence: 0.3,
        confidenceDisplay: resolveFactorConfidenceDisplay({ confidence: null }, true),
        worthInvestigating: true,
        canFocus: true,
      }, // -> strengthen:voi:fac_price
    ],
    robustness: { status: 'computed', level }, // -> robustness (low) / commit (high)
    biasFindingTypes: ['narrow_framing'], // -> strengthen:broaden
    phase3Items: [
      {
        id: 'blk_1',
        title: 'Name the assumption behind the cost estimate',
        body: 'The cost figure carries no stated basis.',
        targetIds: [],
        priorityRank: 12,
      },
    ], // -> strengthen:phase3:blk_1
    ...(hasLeadingOption === undefined ? {} : { hasLeadingOption }),
  }
}

const ids = (input: StrengthenInputs) => buildRecommendations(input).map((r) => r.id)

/**
 * Every string the engine hands the ASSISTANT or renders, per rec — the five
 * channels enumerated in the header. `action.parameters` is serialised because
 * it rides the dispatch verbatim and carried `{ topic: 'challenge_leader' }`.
 */
function assistantBoundStrings(rec: Recommendation): string[] {
  return [
    rec.title,
    rec.signal,
    rec.whyNow,
    // ⚠ `?? ''` IS NOT A SHRUG — `tryThis` is nullable now, and an ABSENT
    // instruction contributes no string, so there is nothing in this channel to
    // leak. The channel stays enumerated so a future non-null value is swept;
    // dropping the line would silently narrow this leak sweep instead.
    rec.tryThis ?? '',
    rec.action.label,
    rec.action.prompt ?? '',
    JSON.stringify(rec.action.parameters ?? {}),
  ]
}

const allStrings = (input: StrengthenInputs): string =>
  buildRecommendations(input).flatMap(assistantBoundStrings).join('\n')

/**
 * DESIGNATING forms only — a definite reference to an option that is ahead.
 * The distinction is principled, not an allowlist: an INDEFINITE, modal phrase
 * ("comparing near-identical routes CAN crown A winner") describes a
 * methodology risk and designates nobody, whereas "THE current leader"
 * designates. Gating the former would be the over-suppression class.
 *
 * STATED LIMIT: this table is a NET, not a completeness proof. It cannot
 * enumerate every English form of a leader claim, so it is the SECONDARY
 * instrument; the per-rec assertions above it are the primary ones.
 */
const DESIGNATING_FORMS: ReadonlyArray<readonly [string, RegExp]> = [
  ['the leader', /\bthe (current )?leader\b/i],
  ['the leading option', /\bthe (current )?leading option\b/i],
  ['the current lead', /\bthe current lead\b/i],
  ['the ranking', /\bthe ranking\b/i],
  ['the option that scored highest', /\bthe option that scored highest\b/i],
  // ⭐ THE REFERENT ROW, AND IT IS THE ONE A VOCABULARY NET CANNOT PROVIDE.
  // Every other entry here is a FORM OF WORDS; this is an IDENTITY. A permitted
  // trigger now names the designated option, so the withheld arm has to prove
  // that name does not reach any channel — the same argument the `ALT_WINNER`
  // pair makes one describe over.
  ['the designated option BY NAME', new RegExp(`\\b${LEADER_LABEL}\\b`)],
  ['flips to <option>', /\bflips to\b/i],
  ['topic: challenge_leader', /challenge_leader/],
]

/**
 * ⭐ THE SUBSET THE PERMITTED CONTROL MAY ASSERT, AND WHY IT IS A SUBSET.
 *
 * The table above is the WITHHELD net: nothing in it may be emitted on a run
 * that withholds. It cannot double as the PERMITTED control, because Paul's
 * terminology ruling (8 Sep 2026) retired the race vocabulary from the copy
 * ENTIRELY — "the leader", "the leading option", "the current lead" are gone
 * from permitted runs too. Asserting a permitted run still emits them would be
 * a control that CANNOT PASS.
 *
 * ⚠ AND THE OPPOSITE ERROR IS THE REAL HAZARD: deleting the permitted control
 * would leave the withheld sweep unable to prove it can SEE a presence, i.e. a
 * net that passes because it is blind. So the control is kept and RE-POINTED at
 * the designating forms the copy now genuinely uses.
 *
 * The two questions are named apart on purpose: the withheld net asks *is any
 * designating form present?*, this asks *can the sweep see one when there is
 * one?* — they are not the same list and merging them is how one of them dies.
 */
const PERMITTED_DESIGNATING_FORMS: ReadonlyArray<readonly [string, RegExp]> = [
  // ⚠⚠ `'the option that scored highest'` HAS LEFT THIS TABLE BECAUSE THE
  // PRODUCT NO LONGER EMITS IT, not because the control was narrowed. That
  // phrase WAS the defect: a rank description as the subject of a sentence, true
  // of one option, false of the rest, naming none — and invisible to every
  // vocabulary net in this file, since it contains no banned word. A permitted
  // run now says the option's NAME, so the row below replaces it with a
  // strictly stronger discriminator: an identity the sweep can bind to.
  // The withheld net above KEEPS the retired phrase, so its return is still red.
  ['the designated option BY NAME', new RegExp(`\\b${LEADER_LABEL}\\b`)],
  // ⭐ RESTORED after an independent reviewer measured that I dropped it without
  // needing to: `buildRecommendations.ts:467` still emits "the ranking" on a
  // permitted run, so this arm passes and the control keeps its discriminating
  // power. Narrowing a control further than the change requires is the quiet way
  // a guard stops proving anything — the reviewer proved 27/27 with it present.
  ['the ranking', /\bthe ranking\b/i],
  ['flips to <option>', /\bflips to\b/i],
  ['topic: challenge_leader', /challenge_leader/],
]

describe('1.243 R1 — "Challenge the leader" (strengthen:robustness)', () => {
  it('WITHHELD: the chip does not render', () => {
    expect(ids(everyBranch('low', false))).not.toContain('strengthen:robustness')
  })

  it('PERMITTED (positive control): the chip renders, prompt and parameters intact', () => {
    const rec = buildRecommendations(everyBranch('low', true)).find(
      (r) => r.id === 'strengthen:robustness',
    )
    expect(rec).toBeDefined()
    expect(rec!.action.label).toBe('Challenge this result')
    // ⭐ THE SUBJECT IS THE OPTION'S NAME, NOT ITS PLACING. Asserted as an exact
    // string so a silent return to a rank description cannot pass by substring.
    expect(rec!.title).toBe(`Pressure-test ${LEADER_LABEL}`)
    expect(rec!.action.prompt).toBe(`Build the strongest case against ${LEADER_LABEL}.`)
    expect(rec!.action.parameters).toEqual({ topic: 'challenge_leader' })
  })

  it('PERMITTED but NO label resolves: the copy addresses the RUN, never the ranking', () => {
    // The degenerate arm. Production resolves a label wherever it resolves a
    // leader, so this is a fixture/legacy path — but the wrong answer here is
    // the whole defect coming back through a fallback, which is why it is
    // pinned rather than left to judgement.
    const rec = buildRecommendations({
      ...everyBranch('low', true),
      leadingOptionLabel: null,
    }).find((r) => r.id === 'strengthen:robustness')
    expect(rec, 'a real producer finding must not be deleted for want of a name').toBeDefined()
    expect(rec!.title).toBe('Pressure-test this result')
    expect(rec!.action.prompt).toBe('Build the strongest case against this result.')
    for (const s of assistantBoundStrings(rec!)) {
      expect(s, `rank description in: ${s}`).not.toMatch(/\bscored? highest\b/i)
      expect(s, `rank description in: ${s}`).not.toMatch(/\bscores highest\b/i)
    }
    // ⚠ AND AN EMPTY / WHITESPACE LABEL IS ABSENT, NOT A NAME — otherwise the
    // title renders "Pressure-test " with nothing after it.
    const blank = buildRecommendations({
      ...everyBranch('low', true),
      leadingOptionLabel: '   ',
    }).find((r) => r.id === 'strengthen:robustness')
    expect(blank!.title).toBe('Pressure-test this result')
  })

  it('WITHHELD: the prompt is not CONSTRUCTIBLE — no emitted string carries it', () => {
    const withheld = allStrings(everyBranch('low', false))
    expect(withheld).not.toContain(`Build the strongest case against ${LEADER_LABEL}.`)
    expect(withheld).not.toContain('challenge_leader')
    expect(withheld).not.toContain('Challenge this result')
    // REGRESSION GUARD: the retired race wording must not come back either.
    expect(withheld).not.toContain('Build the strongest case against the option that scored highest.')
    expect(withheld).not.toContain('Build the strongest case against the current leading option.')
    expect(withheld).not.toContain('Challenge the leader')
  })

  it('the retired RANK DESCRIPTION is emitted on NEITHER run (the referent defect)', () => {
    // ⭐ THE GUARD THE VOCABULARY NETS COULD NOT BE. "the option that scored
    // highest" carries no banned word, so `DESIGNATING_FORMS` above passed it on
    // the permitted arm by design — the frame was in the REFERENT. Both arms are
    // swept here, and the permitted arm is the one that used to be green.
    for (const has of [true, false, undefined] as const) {
      const strings = allStrings(everyBranch('low', has))
      expect(strings, `hasLeadingOption=${has}`).not.toMatch(/\bthe option that scored highest\b/i)
      expect(strings, `hasLeadingOption=${has}`).not.toMatch(/\bwhich option scores highest\b/i)
    }
  })

  it('LEGACY: an absent hasLeadingOption leaves the chip untouched (no drift to silence)', () => {
    // Same concession certaintyCopy / buildV7Headline / OptionCards already
    // make. Production ALWAYS supplies a verdict (useResultsSectionData:1742 is
    // unconditional), so this covers fixture and legacy callers only — but it
    // is pinned so the default cannot silently become suppression.
    expect(ids(everyBranch('low', undefined))).toContain('strengthen:robustness')
  })
})

describe('1.243 R2 — the flip rec (strengthen:flip)', () => {
  it('WITHHELD: the rec does not render', () => {
    expect(ids(everyBranch('low', false)).some((i) => i.startsWith('strengthen:flip:'))).toBe(false)
  })

  it('PERMITTED (positive control): the rec renders and names the alternative winner', () => {
    const rec = buildRecommendations(everyBranch('low', true)).find((r) =>
      r.id.startsWith('strengthen:flip:'),
    )
    expect(rec).toBeDefined()
    expect(rec!.signal).toContain(ALT_WINNER)
    // ⭐ THE TITLE NAMES THE ASSUMPTION IT IS ABOUT. It used to be an argmax
    // description wrapped around a ranking assertion ("the assumption most
    // likely to change which option scores highest"), which named neither the
    // assumption nor an option. The selection rule survives in `signal`.
    expect(rec!.title).toBe('Test the assumption about Churn rate')
  })

  it('WITHHELD: the alternative winner label appears in NO emitted string', () => {
    // The sharpest non-lexicon pair in this file. `alternative_winner_label`
    // designates by elimination — naming what the result would flip TO asserts
    // that something else is currently ahead (#494 residual 1's reasoning).
    expect(allStrings(everyBranch('low', false))).not.toContain(ALT_WINNER)
    expect(allStrings(everyBranch('low', true))).toContain(ALT_WINNER)
  })

  it('LEGACY: an absent hasLeadingOption leaves the flip rec untouched', () => {
    expect(ids(everyBranch('low', undefined)).some((i) => i.startsWith('strengthen:flip:'))).toBe(
      true,
    )
  })
})

describe('1.243 R3 — over-suppression controls: the leader-INDEPENDENT recs survive', () => {
  it('WITHHELD: success-measure, lehi, voi, broaden and phase-3 all still render', () => {
    const withheld = ids(everyBranch('low', false))
    expect(withheld).toContain('strengthen:success-measure')
    expect(withheld).toContain('strengthen:lehi:fac_churn')
    expect(withheld).toContain('strengthen:voi:fac_price')
    expect(withheld).toContain('strengthen:broaden')
    expect(withheld).toContain('strengthen:phase3:blk_1')
  })

  it('WITHHELD + robustness high: the commit rec still renders (a run-level grade is not comparative)', () => {
    // #494 kept "Analysis complete (robust)" on the timeline for exactly this
    // reason. `robustness.level` is PLoT's own run-level grade; the commit rec
    // designates no option ("the chosen option" is the USER's choice), so
    // gating it would delete a producer finding to remove a claim it never made.
    expect(ids(everyBranch('high', false))).toContain('strengthen:commit')
  })

  it('WITHHELD: the broaden rec keeps its INDEFINITE, modal risk sentence', () => {
    const rec = buildRecommendations(everyBranch('low', false)).find(
      (r) => r.id === 'strengthen:broaden',
    )
    expect(rec!.whyNow).toContain('can settle on one without testing the real alternatives')
  })
})

describe('1.243 R4 — designating-form sweep (secondary net, with its control)', () => {
  const withheld = () => allStrings(everyBranch('low', false))
  const permitted = () => allStrings(everyBranch('low', true))

  it.each(DESIGNATING_FORMS)('WITHHELD emits no "%s"', (_name, pattern) => {
    expect(withheld()).not.toMatch(pattern)
  })

  it.each(PERMITTED_DESIGNATING_FORMS)(
    'PERMITTED still emits "%s" (control: the sweep can SEE a presence)',
    (_name, pattern) => {
      expect(permitted()).toMatch(pattern)
    },
  )
})

describe('1.243 R5 — the two unconditional relabels (both directions)', () => {
  it('voi no longer points the user at "the ranking", on EITHER run', () => {
    for (const has of [true, false]) {
      const voi = buildRecommendations(everyBranch('low', has)).find((r) =>
        r.id.startsWith('strengthen:voi:'),
      )
      expect(voi, `voi must render on hasLeadingOption=${has}`).toBeDefined()
      const strings = assistantBoundStrings(voi!).join('\n')
      expect(strings).not.toMatch(/\bthe ranking\b/i)
      // The producer's own finding is NOT lost — only the comparative framing.
      expect(voi!.sourceLine).toContain('flagged by the engine')
      expect(voi!.title).toContain('Price elasticity')
    }
  })

  it('success-measure no longer says "which is ahead", on EITHER run', () => {
    for (const has of [true, false]) {
      const sm = buildRecommendations(everyBranch('low', has)).find(
        (r) => r.id === 'strengthen:success-measure',
      )
      expect(sm, `success-measure must render on hasLeadingOption=${has}`).toBeDefined()
      expect(assistantBoundStrings(sm!).join('\n')).not.toMatch(/\bwhich is ahead\b/i)
      // The rec still explains why a target matters — no data deleted.
      expect(sm!.whyNow).toContain('how likely each option is to succeed')
    }
  })
})

// ── R6. The container must SUPPLY the signal ────────────────────────────────
// The engine suite proves `buildRecommendations` HONOURS `hasLeadingOption`;
// it passes the flag itself, so it cannot prove anything supplies it. #493's
// mutation MB1 deleted the `hasLeadingOption={...}` line from ResultsBody and
// the whole suite stayed green with the fix dead in production — the
// guarantee-theatre class. This pins the wiring past the boundary.

const makeData = (over: {
  hasLeadingOption?: boolean
  robustnessLevel?: string | null
}): ResultsSectionDataReturn =>
  ({
    recommendation: {
      goalThreshold: 62,
      analysisStatus: 'computed',
      ...(over.hasLeadingOption === undefined
        ? {}
        : {
            verdict: {
              leaderId: 'opt_a',
              separation: over.hasLeadingOption ? 'clear' : 'unknown',
              hasLeadingOption: over.hasLeadingOption,
              gapPp: over.hasLeadingOption ? 40 : null,
              source: over.hasLeadingOption ? 'producer_near_tie' : 'none',
            },
          }),
    },
    confidence: {
      challengeFragileEdges: [],
      robustnessStatus: 'computed',
      robustnessLevel: over.robustnessLevel ?? 'low',
    },
    drivers: { drivers: [] },
  }) as unknown as ResultsSectionDataReturn

beforeEach(() => {
  useStrengthenStore.getState()._reset()
  try { sessionStorage.clear() } catch { /* jsdom */ }
  useGuidanceStore.setState({ guidanceItems: [], _dispatchAction: null, _sendMessage: null } as never)
  useAskOlumiStore.setState({ isOpen: false, context: '', draft: '', label: '', targetId: null })
  useCanvasStore.setState({
    currentStage: null,
    draftCoaching: null,
    results: { ...useCanvasStore.getState().results, hash: 'h-1243' },
  } as never)
})

describe('1.243 R6 — StrengthenContainer threads the verdict into the engine', () => {
  const activeIds = () => selectActive(useStrengthenStore.getState()).map((r) => r.id)

  it('PERMITTED (positive control): the challenge rec reaches the store', () => {
    render(<StrengthenContainer data={makeData({ hasLeadingOption: true })} />)
    expect(activeIds()).toContain('strengthen:robustness')
  })

  it('WITHHELD: it does not — so the threading line cannot be deleted unnoticed', () => {
    render(<StrengthenContainer data={makeData({ hasLeadingOption: false })} />)
    expect(activeIds()).not.toContain('strengthen:robustness')
  })

  it('WITHHELD: the panel renders at all (trap 13 — the absence is not a dead mount)', () => {
    const { getByLabelText } = render(
      <StrengthenContainer data={makeData({ hasLeadingOption: false })} />,
    )
    expect(getByLabelText('Strengthen your model')).toBeTruthy()
  })
})
