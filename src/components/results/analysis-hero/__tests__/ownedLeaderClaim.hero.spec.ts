/**
 * OWNED LEADER CLAIM — the analysis-hero surfaces (ROADMAP 1.223, gate G-CEE-1).
 *
 * Lives inside the module because `inertness.spec.ts` guards the analysis-hero
 * boundary: only `ResultsBody` may import it from outside. The sibling half of
 * this suite (V7 hero + results-panel certainty copy) is at
 * `src/components/results/__tests__/ownedLeaderClaim.surfaces.spec.ts`, and the
 * verdict itself at `src/lib/__tests__/ownedLeaderClaim.spec.ts`. All three
 * drive the SAME wire fixture pair, so they are provably one run.
 *
 * CLAUDE.md trap 3: these are TEXT-level assertions on a pure builder. jsdom
 * cannot prove visibility and nothing here claims it does.
 *
 * Every WITHHELD case has a PERMITTED twin: over-suppression is a failure, not
 * a fix.
 */
import { describe, expect, it } from 'vitest'
import { deriveDecisionVerdict } from '../../../../lib/decisionVerdict'
import {
  LEADER_ID,
  LEADER_LABEL,
  PERMITTED_REPORT,
  RUNNER_UP_ID,
  RUNNER_UP_LABEL,
  WIN_LEADER,
  WIN_RUNNER_UP,
  WITHHELD_REPORT,
} from '../../../../lib/__fixtures__/ownedLeaderClaim.fixtures'
import { buildHeroModel } from '../buildHeroModel'
import { HERO_COPY } from '../heroCopy'
import { makeHeroData, makeOption } from '../__fixtures__/hero.fixtures'
import type { OptionResult } from '../../types'

const WITHHELD_VERDICT = deriveDecisionVerdict(WITHHELD_REPORT)
const PERMITTED_VERDICT = deriveDecisionVerdict(PERMITTED_REPORT)

/**
 * Comparative leader LANGUAGE. Deliberately not a catch-all "any mention of
 * the leader's label" — the label legitimately appears as a row label, and the
 * win probabilities stay on screen. Data is not a claim; comparative language
 * is. (Kept in sync with the sibling suite by being the same short list of
 * literal production strings, each of which a test also asserts positively.)
 */
const LEADER_LANGUAGE: ReadonlyArray<[string, RegExp]> = [
  ['is slightly ahead', /is slightly ahead/i],
  ['most likely to be strongest', /most likely to be strongest/i],
  ['currently leads', /currently leads/i],
  ['performs best', /performs best/i],
  ['leading option', /leading option/i],
  ['leads by N points', /leads by \d+ point/i],
  ['highest expected outcome', /highest expected outcome/i],
]

function expectNoLeaderLanguage(where: string, ...strings: Array<string | null | undefined>) {
  const joined = strings.filter(Boolean).join(' \u2022 ')
  for (const [name, re] of LEADER_LANGUAGE) {
    expect(re.test(joined), `${where} must not render "${name}" — got: ${joined}`).toBe(false)
  }
}

function heroOptions(): OptionResult[] {
  return [
    makeOption({
      id: LEADER_ID,
      label: LEADER_LABEL,
      expected: 68,
      outcome: { mean: 68, p10: 54, p50: 67, p90: 82 },
      winProbability: WIN_LEADER,
      isRecommended: true,
    }),
    makeOption({
      id: RUNNER_UP_ID,
      label: RUNNER_UP_LABEL,
      expected: 41,
      outcome: { mean: 41, p10: 30, p50: 40, p90: 52 },
      winProbability: WIN_RUNNER_UP,
    }),
  ]
}

function hero(verdict: ReturnType<typeof deriveDecisionVerdict>) {
  const model = buildHeroModel(
    makeHeroData({
      options: heroOptions(),
      // No user goal target: UI-SEM-071 suppresses the goal-fit crown, so the
      // headline falls to the analysis-leader branch — the branch under test.
      recommendation: { verdict, goalThreshold: null },
    }),
  )
  expect(model.kind).toBe('chart')
  return model as Extract<typeof model, { kind: 'chart' }>
}

describe('analysis hero — headline + subline', () => {
  it('WITHHELD: names no leader, and does not relocate the claim into the subline', () => {
    const m = hero(WITHHELD_VERDICT)
    expectNoLeaderLanguage('hero', m.headline, m.subline)
    // Silence, not a denial: the producer withheld the claim, it did not say
    // the options are close. `noClearLeader` stays reserved for a positive
    // producer tie.
    expect(m.headline).toBe(HERO_COPY.headline.noLeader)
    expect(m.headline).not.toBe(HERO_COPY.headline.noClearLeader)
    expect(m.subline).toBe(HERO_COPY.subline.compareTop)
  })

  it('PERMITTED: the producer-owned band still selects the leader headline', () => {
    const m = hero(PERMITTED_VERDICT)
    expect(m.headline).toBe(HERO_COPY.headline.mostLikelyStrongest(LEADER_LABEL))
  })

  it('WITHHELD: the win probabilities are still rendered — we suppress the CLAIM, not the data', () => {
    const m = hero(WITHHELD_VERDICT)
    const leaderRow = m.rows.find(r => r.id === LEADER_ID)
    expect(leaderRow).toBeDefined()
    // Positive control for the suppression tests above: if the hero stopped
    // rendering rows at all they would pass vacuously.
    expect(m.rows).toHaveLength(2)
    expect(leaderRow!.label).toBe(LEADER_LABEL)
  })
})

