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
    rec.tryThis,
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
    expect(rec!.action.label).toBe('Challenge the leader')
    expect(rec!.action.prompt).toBe('Build the strongest case against the current leading option.')
    expect(rec!.action.parameters).toEqual({ topic: 'challenge_leader' })
  })

  it('WITHHELD: the prompt is not CONSTRUCTIBLE — no emitted string carries it', () => {
    const withheld = allStrings(everyBranch('low', false))
    expect(withheld).not.toContain('Build the strongest case against the current leading option.')
    expect(withheld).not.toContain('challenge_leader')
    expect(withheld).not.toContain('Challenge the leader')
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
    expect(rec!.title).toContain('the leader')
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
    expect(rec!.whyNow).toContain('can crown a winner')
  })
})

describe('1.243 R4 — designating-form sweep (secondary net, with its control)', () => {
  const withheld = () => allStrings(everyBranch('low', false))
  const permitted = () => allStrings(everyBranch('low', true))

  it.each(DESIGNATING_FORMS)('WITHHELD emits no "%s"', (_name, pattern) => {
    expect(withheld()).not.toMatch(pattern)
  })

  it.each(DESIGNATING_FORMS)(
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
