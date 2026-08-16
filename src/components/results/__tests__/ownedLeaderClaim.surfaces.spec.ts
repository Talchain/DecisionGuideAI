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
 * ## SURFACES 3+4 ARE GONE WITH THEIR HOST (V7 retirement) — declared, not silent
 *
 * `buildV7Headline`'s re-anchored leader headline and its numeric subline had a
 * describe here. The builder and its host are DELETED. The equivalent claim on
 * the SURVIVING leader headline — `buildHeroModel`, under both verdicts, with
 * the same withheld/permitted pairing — is pinned in
 * `analysis-hero/__tests__/ownedLeaderClaim.hero.spec.ts`, so the claim did not
 * leave the suite with the builder. Surface 5 below is untouched.
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
  WITHHELD_REPORT,
} from '../../../lib/__fixtures__/ownedLeaderClaim.fixtures'
import { buildCertaintyCopy } from '../utils/certaintyCopy'

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
