/**
 * ⭐⭐ A REVIEW CARD THAT ASSERTS A LEADER OR A RESULT'S STRENGTH OBEYS THE RUN'S
 * CLAIM LICENCE — the same licence the panel's own words already obey.
 *
 * ## The defect, witnessed on the served build (23 Sep 2026)
 *
 * Saved example "Customer Data Platform Selection", guest. The analysis turn's
 * admission is `quantified_provisional`: no option may be called the leader and
 * no result may be called stable or robust. The glance on the same screen obeys
 * that. The producer still sends `review_card` blocks from
 * `decision_review_enricher`, and the phase-3 promotion put three of them into
 * "Strengthen the reasoning" VERBATIM:
 *
 *   ANALYSIS_NARRATIVE — "Adopt RudderStack produced the best outcome in 55% of
 *                         runs…": names and ranks a leader.
 *   PRE_MORTEM         — "the migration to Adopt RudderStack has overrun…":
 *                         presupposes the leader.
 *   FRAGILE_RESULT     — "How robust is this? … rated low on how often the
 *                         ordering holds": a robustness rating.
 *
 * #1881 gated the panel's OWN leader and strength words through
 * `inputs.hasLeadingOption` and `inputs.stabilityLicensed`. The producer's cards
 * reached the same list through a door neither input was consulted at.
 *
 * ## The ruling (olumi-programme-docs#63, Release Control, comment 5787083967)
 *
 * Suppression only. No card is reworded. Keyed on the producer's `signal_code`,
 * never on text. `ASSUMPTION_CHECK` is not a claim and is left alone.
 *
 * ## How this file binds
 *
 * - Every fixture enters as a `GuidanceItem` and goes through
 *   `toStrengthenPhase3Item`, the ONE store→engine mapping, so the codes are
 *   read at the seam production reads them at — not handed to the engine in a
 *   shape the store never produces.
 * - Recommendations are selected BY IDENTITY (`strengthen:phase3:<item_id>`),
 *   never by a title or body another card could share.
 * - Every signal code below is written out longhand. Nothing is compared
 *   against a constant the engine exports, so the engine cannot agree with
 *   itself.
 * - Strict `=== false` on both inputs: an absent value is a legacy or fixture
 *   caller and keeps every card, which is the absence arm both inputs already
 *   document in `strengthenTypes.ts`. Control (b) pins it.
 */
import { describe, expect, it } from 'vitest'
import { buildRecommendations, toStrengthenPhase3Item } from '../buildRecommendations'
import type { StrengthenInputs } from '../strengthenTypes'
import type { GuidanceItem } from '../../../../canvas/stores/guidanceStore'

/**
 * A review card as `deriveGuidance` hands it to the store: `source`, a discuss
 * action, the producer's category and 0.19.0 rank. Review cards carry NO
 * `coaching_kind` — that is the channel marker `isCrossChannelPair` reads — so
 * none is set here.
 */
const reviewCard = (
  item_id: string,
  signal_code: string,
  category: GuidanceItem['category'],
  priorityRank: number,
  title: string,
  detail: string,
): GuidanceItem => ({
  item_id,
  signal_code,
  category,
  source: 'analysis',
  title,
  detail,
  primary_action: { type: 'discuss', prompt: title },
  priority: 50,
  priorityRank,
})

// Ranks and categories are the producer's review-card band, as captured in
// `src/v5/__tests__/fixtures/live-analysis-turn-T3-20260808T155759Z.json`
// (narrative 10 could_fix · pre_mortem 20 should_fix · robustness 50 should_fix
// · assumption 71 could_fix). Bodies are the witnessed CDP run's.
const NARRATIVE = reviewCard(
  'rc-narrative',
  'ANALYSIS_NARRATIVE',
  'could_fix',
  10,
  'How the analysis reads',
  'Adopt RudderStack produced the best outcome in 55% of runs, and Adopt Segment in 36%.',
)
const PRE_MORTEM = reviewCard(
  'rc-pre-mortem',
  'PRE_MORTEM',
  'should_fix',
  20,
  'If things go wrong',
  'Imagine this decision has failed: the migration to Adopt RudderStack has overrun.',
)
const FRAGILE = reviewCard(
  'rc-fragile',
  'FRAGILE_RESULT',
  'should_fix',
  50,
  'How robust is this?',
  'This result is rated low on how often the ordering holds across variations.',
)
const ASSUMPTION = reviewCard(
  'rc-assumption',
  'ASSUMPTION_CHECK',
  'could_fix',
  71,
  'A load-bearing assumption',
  'Integration effort is assumed to stay within current engineering capacity.',
)

const ID = {
  narrative: 'strengthen:phase3:rc-narrative',
  preMortem: 'strengthen:phase3:rc-pre-mortem',
  fragile: 'strengthen:phase3:rc-fragile',
  assumption: 'strengthen:phase3:rc-assumption',
} as const

/**
 * No UI trigger fires on this base (target set, no fragile edges, no factors,
 * robustness unassessed), so every recommendation returned is a phase-3 row and
 * the assertions below see the promotion alone.
 */
const base = (guidance: GuidanceItem[]): StrengthenInputs => ({
  goalThreshold: 62,
  analysisComplete: true,
  flipThresholds: null,
  fragileEdges: [],
  factors: [],
  robustness: { status: null, level: null },
  biasFindingTypes: [],
  phase3Items: guidance.map(toStrengthenPhase3Item),
})

const ALL_FOUR = [NARRATIVE, PRE_MORTEM, FRAGILE, ASSUMPTION]

const phase3Ids = (inputs: StrengthenInputs): string[] =>
  buildRecommendations(inputs)
    .map((r) => r.id)
    .filter((id) => id.startsWith('strengthen:phase3:'))
    .sort()

describe('review cards that assert a leader or a result strength obey the run’s claim licence', () => {
  it('a run that licenses neither claim promotes NONE of the three, and still promotes the assumption', () => {
    const recs = buildRecommendations({
      ...base(ALL_FOUR),
      hasLeadingOption: false,
      stabilityLicensed: false,
    })
    const ids = recs.map((r) => r.id)
    expect(ids).not.toContain(ID.narrative)
    expect(ids).not.toContain(ID.preMortem)
    expect(ids).not.toContain(ID.fragile)
    expect(ids).toContain(ID.assumption)

    // ⚠ NOT REWORDED. The surviving card is the producer's copy, verbatim — the
    // ruling is suppression only, so the fix may not touch what it keeps.
    const kept = recs.find((r) => r.id === ID.assumption)!
    expect(kept.title).toBe('A load-bearing assumption')
    expect(kept.whyNow).toBe(
      'Integration effort is assumed to stay within current engineering capacity.',
    )

    // ⭐ AND NO SENTENCE OF THE THREE REACHES ANY CHANNEL THE ENGINE RETURNS —
    // including the Ask-Olumi prompt, which is the card's title.
    const everyString = recs.flatMap((r) => [
      r.title,
      r.signal,
      r.whyNow,
      r.tryThis ?? '',
      r.action.label,
      r.action.prompt ?? '',
    ])
    for (const s of everyString) {
      expect(s).not.toMatch(/RudderStack|Adopt Segment|How robust is this|ordering holds/)
    }
  })

  it('CONTROL (a): a run that licenses both claims promotes all four', () => {
    expect(
      phase3Ids({ ...base(ALL_FOUR), hasLeadingOption: true, stabilityLicensed: true }),
    ).toEqual([ID.assumption, ID.fragile, ID.narrative, ID.preMortem])
  })

  it('CONTROL (b): a legacy caller that supplies neither input keeps all four (absence is not a withheld licence)', () => {
    const inputs = base(ALL_FOUR)
    // Anti-vacuity: the keys are genuinely ABSENT, not `false` by accident.
    expect('hasLeadingOption' in inputs).toBe(false)
    expect('stabilityLicensed' in inputs).toBe(false)
    expect(phase3Ids(inputs)).toEqual([ID.assumption, ID.fragile, ID.narrative, ID.preMortem])
  })

  it('CONTROL (b2): explicit `undefined` on both reads exactly as absent', () => {
    expect(
      phase3Ids({ ...base(ALL_FOUR), hasLeadingOption: undefined, stabilityLicensed: undefined }),
    ).toEqual([ID.assumption, ID.fragile, ID.narrative, ID.preMortem])
  })

  it('CONTROL (c): leader withheld, stability licensed — narrative and pre-mortem go, the robustness card stays', () => {
    expect(
      phase3Ids({ ...base(ALL_FOUR), hasLeadingOption: false, stabilityLicensed: true }),
    ).toEqual([ID.assumption, ID.fragile])
  })

  it('CONTROL (d): leader licensed, stability withheld — only the robustness card goes', () => {
    expect(
      phase3Ids({ ...base(ALL_FOUR), hasLeadingOption: true, stabilityLicensed: false }),
    ).toEqual([ID.assumption, ID.narrative, ID.preMortem])
  })

  /**
   * ── CONTROL (e): A SUPPRESSED CARD DOES NOT SPEND A DISPLAY SLOT ──────────
   *
   * UI-SEM-075(a) caps phase-3 promotion at four rows. The three claim cards
   * sort AHEAD of every assumption card on the producer's own ladder (should_fix
   * before could_fix; rank 10 before 60+), so on the captured runs they hold
   * three of the four slots. Dropping them AFTER the cap would leave those slots
   * empty and push real findings off the list — the harm the UI-SEM-085 ordering
   * fix exists to prevent one level up.
   *
   * Four legitimate could_fix cards, ranks 60-73, plus one claim card that sorts
   * first. The contrast arm proves the fixture actually exercises the cap: with
   * the licence granted, the claim card IS promoted and exactly one legitimate
   * card is displaced. Without that, "all four legitimate present" could pass on
   * a budget that was never reached.
   */
  describe('CONTROL (e): a suppressed card never displaces a legitimate one from the budget', () => {
    const LEGIT = [
      reviewCard('legit-gap', 'EVIDENCE_GAP', 'could_fix', 60, 'Highest-leverage evidence gap: Integration effort', 'Evidence on integration effort would move this most.'),
      reviewCard('legit-a1', 'ASSUMPTION_CHECK', 'could_fix', 71, 'A load-bearing assumption', 'Vendor pricing is assumed to hold for three years.'),
      reviewCard('legit-a2', 'ASSUMPTION_CHECK', 'could_fix', 72, 'A load-bearing assumption', 'Data volumes are assumed to grow no faster than 20% a year.'),
      reviewCard('legit-a3', 'ASSUMPTION_CHECK', 'could_fix', 73, 'A load-bearing assumption', 'The data team is assumed to keep its current headcount.'),
    ]
    const LEGIT_IDS = LEGIT.map((g) => `strengthen:phase3:${g.item_id}`).sort()

    const cases: Array<[string, GuidanceItem, Partial<StrengthenInputs>, Partial<StrengthenInputs>]> = [
      ['ANALYSIS_NARRATIVE', NARRATIVE, { hasLeadingOption: false }, { hasLeadingOption: true }],
      ['PRE_MORTEM', PRE_MORTEM, { hasLeadingOption: false }, { hasLeadingOption: true }],
      ['FRAGILE_RESULT', FRAGILE, { stabilityLicensed: false }, { stabilityLicensed: true }],
    ]

    it.each(cases)('%s, withheld: all four legitimate cards are promoted', (_code, claim, withheld) => {
      expect(phase3Ids({ ...base([claim, ...LEGIT]), ...withheld })).toEqual(LEGIT_IDS)
    })

    it.each(cases)('%s, licensed (contrast): the claim card takes a slot and one legitimate card is displaced', (_code, claim, _withheld, licensed) => {
      const ids = phase3Ids({ ...base([claim, ...LEGIT]), ...licensed })
      expect(ids).toHaveLength(4)
      expect(ids).toContain(`strengthen:phase3:${claim.item_id}`)
      expect(ids.filter((id) => LEGIT_IDS.includes(id))).toHaveLength(3)
    })
  })

  it('an item the producer sent no signal_code for is never suppressed by either arm', () => {
    // The rule keys on the producer's code. A code-less item is not
    // identifiable as a claim card, and guessing from its text is exactly what
    // the ruling forbids — so it stays.
    const codeless: GuidanceItem = {
      ...NARRATIVE,
      item_id: 'rc-codeless',
      signal_code: undefined,
    }
    const ids = phase3Ids({
      ...base([codeless]),
      hasLeadingOption: false,
      stabilityLicensed: false,
    })
    expect(ids).toEqual(['strengthen:phase3:rc-codeless'])
  })
})
