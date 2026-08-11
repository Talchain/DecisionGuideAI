/**
 * OWNED LEADER CLAIM — the cross-surface half (ROADMAP 1.223, gate G-CEE-1).
 *
 * `src/lib/__tests__/ownedLeaderClaim.spec.ts` pins the VERDICT. This file
 * pins the SURFACES: on a withheld turn none of them may render comparative
 * leader language, and on a permitted turn every one of them must still
 * render it.
 *
 * Both halves drive the same wire fixture pair
 * (`src/lib/__fixtures__/ownedLeaderClaim.fixtures.ts`), so the two suites are
 * provably describing one run.
 *
 * ## Scope of the claim these tests make
 *
 * These are TEXT-level assertions on pure builders. They prove which strings
 * are composed, and nothing about layout — jsdom cannot prove visibility
 * (CLAUDE.md trap 3), and no assertion here should be read as one.
 *
 * ## The over-suppression control is not optional
 *
 * Every `WITHHELD` case below has a `PERMITTED` twin. A change that silences
 * the withheld turn by silencing the permitted one too is a failure, not a
 * fix — it would cost the user the product's single most useful sentence.
 */
import { describe, expect, it } from 'vitest'
import { COMPARATIVE_COPY } from '../utils/goalAnchorCopy'
import { deriveDecisionVerdict } from '../../../lib/decisionVerdict'
import {
  LEADER_ID,
  LEADER_LABEL,
  PERMITTED_REPORT,
  RUNNER_UP_ID,
  RUNNER_UP_LABEL,
  WIN_LEADER,
  WIN_RUNNER_UP,
  WITHHELD_REPORT,
} from '../../../lib/__fixtures__/ownedLeaderClaim.fixtures'
import { buildV7Headline } from '../v7/buildV7Headline'
import { buildCertaintyCopy } from '../utils/certaintyCopy'
import type { DecisionResultData, OptionResult } from '../types'

const WITHHELD_VERDICT = deriveDecisionVerdict(WITHHELD_REPORT)
const PERMITTED_VERDICT = deriveDecisionVerdict(PERMITTED_REPORT)

/**
 * Comparative leader LANGUAGE. Deliberately not a catch-all "any mention of
 * the leader's label" — the label may legitimately appear as a row label, and
 * the win probabilities themselves stay on screen. Data is not a claim;
 * comparative language is.
 */
const LEADER_LANGUAGE: ReadonlyArray<[string, RegExp]> = [
  ['is slightly ahead', /is slightly ahead/i],
  ['is clearly/most likely strongest', /most likely to be strongest|clearly ahead of/i],
  ['currently leads', /currently leads/i],
  // SUPERSEDED 2026-07-31: 'performs best' is retired; the leader surface
  // now emits the comparative claim with its magnitude.
  ['the re-anchored leader headline', /came out ahead in .+ of simulated scenarios/i],
  ['leading option', /leading option/i],
  ['leads by N points', /leads by \d+ point/i],
  ['leads in N% of scenarios', /leads in \d+% of scenarios/i],
  ['leads slightly more often', /leads slightly more often/i],
  ['highest expected outcome', /highest expected outcome/i],
]

function expectNoLeaderLanguage(where: string, ...strings: Array<string | null | undefined>) {
  const joined = strings.filter(Boolean).join(' • ')
  for (const [name, re] of LEADER_LANGUAGE) {
    expect(re.test(joined), `${where} must not render "${name}" — got: ${joined}`).toBe(false)
  }
}

// ── Surface 3 + 4: the V7 hero ("performs best", "Leads by N points") ──────

function v7(verdict: ReturnType<typeof deriveDecisionVerdict>) {
  const winner = { id: LEADER_ID, label: LEADER_LABEL, winProbability: WIN_LEADER, isRecommended: true } as unknown as OptionResult
  const rival = { id: RUNNER_UP_ID, label: RUNNER_UP_LABEL, winProbability: WIN_RUNNER_UP } as unknown as OptionResult
  return buildV7Headline(
    { recommendedOption: winner, allOptions: [winner, rival], verdict } as unknown as DecisionResultData,
    'robust',
  )
}

describe('V7 hero — the re-anchored leader headline / "Leads by N points" (SUPERSEDED: "performs best" retired 2026-07-31)', () => {
  it('WITHHELD: renders nothing rather than asserting or denying a leader', () => {
    const m = v7(WITHHELD_VERDICT)
    expectNoLeaderLanguage('v7 hero', m.headline, m.subline)
    // The old gate was `separation === 'tied'`, which is false for 'unknown',
    // so a withheld turn fell straight through to "{winner} performs best".
    expect(m.headline).toBe('')
    expect(m.subline).toBeNull()
  })

  it('PERMITTED: both the headline and the numeric subline survive', () => {
    const m = v7(PERMITTED_VERDICT)
    expect(m.headline).toBe(`${LEADER_LABEL} ${COMPARATIVE_COPY.clause('66%')}`)
    // ⭐ SUPERSEDED 2026-08-10: was `'Leads by 35 points'`, the percentage-point
    // gap between two win frequencies. Retired — the subline now states the
    // runner-up's OWN probability. The ENTITLEMENT this spec exists to pin (a
    // permitted verdict still gets a numeric subline) is unchanged.
    expect(m.subline).toBe(`Next: ${RUNNER_UP_LABEL}, 31%`)
    expect(m.subline).not.toMatch(/leads?\s+by\s+\d+\s+points?/i)
  })
})

// ── Surface 5: the results-panel certainty headline ────────────────────────

function certainty(verdict: ReturnType<typeof deriveDecisionVerdict>) {
  return buildCertaintyCopy({
    winnerLabel: LEADER_LABEL,
    confidenceTier: 'strong',
    coachingReadiness: 'ready',
    recommendationStability: 0.9,
    analysisStatus: 'computed',
    optionCount: 3,
    verdict,
  })
}

describe('results-panel certainty headline', () => {
  it('WITHHELD: makes no leader claim on ANY of its assertion branches', () => {
    const c = certainty(WITHHELD_VERDICT)
    expectNoLeaderLanguage('certaintyCopy', c.headline, c.sub, c.caveat)
    expect(c.headline).toBe('the analysis did not put an option forward')
    expect(c.conservative).toBe(true)
  })

  it('PERMITTED: the definitive leader headline still fires', () => {
    const c = certainty(PERMITTED_VERDICT)
    expect(c.headline).toBe(`${LEADER_LABEL} ${COMPARATIVE_COPY.phraseNoMagnitude}`)
  })

  it('PERMITTED: a producer TIE still gets its denial — withholding is not tying', () => {
    // The two no-leader states must stay distinguishable at the copy layer.
    const tied = deriveDecisionVerdict({
      ...WITHHELD_REPORT,
      robustness: { recommended_option_id: LEADER_ID, near_tie: { is_tie: true, top_option_id: LEADER_ID } },
    })
    const c = certainty(tied)
    expect(c.headline).toContain('no clear leading option')
  })
})

// ── The verdict every surface quotes ──────────────────────────────────────

describe('one verdict, quoted everywhere', () => {
  it('WITHHELD: hasLeadingOption is false, so every gated surface agrees', () => {
    expect(WITHHELD_VERDICT.hasLeadingOption).toBe(false)
    expect(PERMITTED_VERDICT.hasLeadingOption).toBe(true)
  })
})
