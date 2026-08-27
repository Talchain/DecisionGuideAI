/**
 * Analysis (New) — the adapter's SEMANTIC contract.
 *
 * These cases pin the rules that make this surface honest, not the rules that
 * make it pretty. Each one is derived from the PRODUCER's declared field
 * semantics (CLAUDE.md trap 13c — an expectation written from the author's own
 * reading of what a field ought to mean is a perfect score on the wrong exam),
 * and each names the field it is answerable to.
 */

import { describe, expect, it } from 'vitest'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import type { Recommendation } from '../../strengthen/strengthenTypes'
import {
  decisionWithLeaderWithheld,
  evidenceGapWithNullConfidence,
  genuineDecision,
  highUncertainty,
  makeData,
  makeDriver,
  openStrategicChallenge,
} from './analysisNewFixtures'

const rec = (over: Partial<Recommendation> & { id: string }): Recommendation =>
  ({
    helpType: 'challenge',
    title: 'Challenge this assumption',
    signal: 'One factor carries most of the influence.',
    whyNow: 'The conclusion rests on it.',
    tryThis: 'State what would have to be true for it to be wrong.',
    sourceLine: 'From the influence concentration check.',
    action: { kind: 'ai-dialogue', label: 'Challenge this assumption' },
    targetId: null,
    priority: 1,
    ...over,
  }) as Recommendation

const build = (
  data: ReturnType<typeof makeData>,
  recommendations: Recommendation[] = [],
  over: Partial<Parameters<typeof buildAnalysisNewViewModel>[0]> = {},
) =>
  buildAnalysisNewViewModel({
    data,
    recommendations,
    recommendationCandidateCount: recommendations.length,
    isPreRun: false,
    isRunning: false,
    isStale: false,
    ...over,
  })

describe('leader entitlement (§13) — recommendation.verdict.hasLeadingOption', () => {
  it('names a leader ONLY when the verdict entitles it, and never says "wins"', () => {
    const vm = build(genuineDecision())
    const comparative = vm.keyInsights.insights.find((i) => i.id === 'insight:comparative')
    expect(comparative, 'a genuine decision with an entitled verdict must offer the comparative insight').toBeDefined()
    expect(comparative!.headline).toBe('Raise price currently scores higher')
    // The forbidden vocabulary, checked across the WHOLE surface rather than
    // just this row — a leader claim leaking through another section would be
    // the same defect in a different place.
    const allText = JSON.stringify(vm)
    expect(allText).not.toMatch(/\bwins\b/i)
    expect(allText).not.toMatch(/\bwinner\b/i)
    expect(allText).not.toMatch(/\bbest option\b/i)
  })

  it('WITHHOLDS the comparative insight when the producer withheld the entitlement', () => {
    // Identical data, one boolean flipped. This is the discriminating pair: if
    // the surface gated on `analysisStatus === "computed"` (a lifecycle fact)
    // instead of the verdict (an entitlement), this case would still name a
    // leader — which is exactly the conflation the single verdict exists to
    // prevent.
    const vm = build(decisionWithLeaderWithheld())
    expect(vm.keyInsights.insights.map((i) => i.id)).not.toContain('insight:comparative')
  })

  it('an open strategic challenge produces insights WITHOUT any option framing', () => {
    const vm = build(openStrategicChallenge())
    expect(vm.keyInsights.insights.length).toBeGreaterThan(0)
    expect(vm.keyInsights.insights.map((i) => i.id)).not.toContain('insight:comparative')
    // The section is NOT empty just because there is no decision — that is the
    // failure mode a decision-first ladder produces.
    expect(vm.keyInsights.insights.map((i) => i.id)).toContain('insight:robustness')
    expect(vm.keyInsights.insights.map((i) => i.id)).toContain('insight:dominant-factor')
  })
})

describe('robustness (§4) — display-safe verdict only', () => {
  it("renders the producer's own reason verbatim and never authors robustness prose", () => {
    const vm = build(openStrategicChallenge())
    const r = vm.keyInsights.insights.find((i) => i.id === 'insight:robustness')!
    expect(r.implication).toBe(
      'Small changes in supplier lead time change which direction looks better.',
    )
  })

  it('omits the robustness insight entirely when no display-safe verdict arrived', () => {
    // `robustnessLevel` alone must NOT produce a headline — it is structured
    // data, not a display-safe verdict.
    const vm = build(makeData({ recommendation: { robustnessLevel: 'low' } }))
    expect(vm.keyInsights.insights.map((i) => i.id)).not.toContain('insight:robustness')
  })

  it('covers ALL FOUR vocabulary members distinctly, and turns none of them into a claim it did not receive', () => {
    // ⭐ THE BREADTH CASE. `RobustnessDisplayVerdict` has four members and an
    // earlier draft split them binary — so 'moderate' read as "sensitive" and
    // 'not_assessed', the producer's own stated absence, read as a measurement.
    // Turning "we did not measure this" into a verdict is the single worst
    // thing this surface could do, so it gets its own case.
    const insightFor = (verdict: string) =>
      build(
        makeData({
          recommendation: {
            robustnessVerdict: verdict as never,
            robustnessVerdictReason: 'Producer reason.',
          },
        }),
      ).keyInsights.insights.find((i) => i.id === 'insight:robustness')
    const headlineFor = (verdict: string) => insightFor(verdict)?.headline

    expect(headlineFor('robust')).toBe('This result holds up under uncertainty')
    expect(headlineFor('moderate')).toBe('This result holds up, but not strongly')
    expect(headlineFor('fragile')).toBe('This result is sensitive to uncertainty')

    // ⚠⚠ ASSERT THE ROW IS ABSENT, NOT THAT ITS HEADLINE IS UNDEFINED — and the
    // difference is the whole case. A mutant that drops the vocabulary lookup
    // from the guard still PUSHES an insight for 'not_assessed'; its headline is
    // merely `undefined`, so `?.headline` reads undefined either way and the
    // weaker assertion passed on a row that would render a BLANK HEADLINE to a
    // user. Caught by the mutation battery, not by review.
    expect(insightFor('not_assessed')).toBeUndefined()
    // …and the three that DO render each have a real, non-empty headline, so
    // "absent" and "present but blank" can never be confused here again.
    for (const v of ['robust', 'moderate', 'fragile']) {
      expect(insightFor(v)?.headline, `${v} rendered a blank headline`).toBeTruthy()
    }
    // …and the three that do render are genuinely distinct, so a future
    // collapse back to a binary split REDs here.
    expect(new Set([headlineFor('robust'), headlineFor('moderate'), headlineFor('fragile')]).size).toBe(3)
  })
})

describe('influence basis (§16) — displayProvenance decides, not taste', () => {
  it('flags a set-relative basis and makes NO absolute causal-share claim', () => {
    const vm = build(highUncertainty())
    expect(vm.drivers.influenceIsSetRelative).toBe(true)
    const d = vm.drivers.findings[0]
    expect(d.implication).toContain('Among the strongest influences in this run')
    // The absolute claim must be absent. A percentage here would assert a share
    // of the outcome the normalised basis does not license.
    expect(d.implication).not.toMatch(/\d+%/)
    expect(d.groundedIn).toBe('factor sensitivity, ranked within this run')
  })

  it('renders a DIRECTION only for the two members that are one — never for mixed or unknown', () => {
    // ⚠ The producer's union is positive | negative | mixed | unknown, and the
    // last two are NOT directions. A surface that falls back to "lowers" for
    // them invents a direction the producer explicitly declined to resolve.
    // This case was absent until the mutation battery found a fallback mutant
    // surviving: nothing asserted on a mixed-direction row at all.
    const implicationFor = (direction: string) =>
      build(
        makeData({
          drivers: {
            drivers: [
              makeDriver({ factorKey: 'f_x', factorLabel: 'X', direction: direction as never }),
            ],
          },
        }),
      ).drivers.findings[0].implication

    expect(implicationFor('positive')).toContain('raises the outcome')
    expect(implicationFor('negative')).toContain('lowers the outcome')
    // Neither of the two real direction verbs may appear for an unresolved one.
    for (const undecided of ['mixed', 'unknown']) {
      const text = implicationFor(undecided)
      expect(text, `${undecided} was rendered as a direction`).toContain('moves the outcome')
      expect(text).not.toContain('raises')
      expect(text).not.toContain('lowers')
    }
    // An absent direction is the same case as an unresolved one.
    expect(implicationFor(undefined as never)).toContain('moves the outcome')
  })

  it('states structural influence numerically ONLY on the producer influence scale', () => {
    const vm = build(openStrategicChallenge())
    expect(vm.drivers.influenceIsSetRelative).toBe(false)
    expect(vm.drivers.findings[0].implication).toContain('Structural influence 60%')
  })
})

describe('absence is not zero (§4)', () => {
  it('a null evidence-gap confidence renders NO confidence row and marks it unassessed', () => {
    const vm = build(evidenceGapWithNullConfidence())
    const gap = vm.uncertainty.findings.find((f) => f.id === 'gap:f_churn')!
    expect(gap.marker).toBe('not_assessed')
    expect(gap.inspect.map((r) => r.label)).not.toContain('Confidence')
    // The specific fabrication this guards: a rendered 0 the user cannot tell
    // apart from a measured zero.
    expect(JSON.stringify(gap.inspect)).not.toContain('0%')
  })

  it('a defaulted factor confidence is suppressed rather than shown as evidence', () => {
    const vm = build(highUncertainty())
    const d = vm.drivers.findings[0]
    expect(d.marker).toBe('not_assessed')
    expect(d.inspect.find((r) => r.label === 'Confidence')).toBeUndefined()
  })
})

describe('assessed vs never-assessed (§17, §19)', () => {
  it('carries the producer distinction so the empty state can differ', () => {
    expect(build(highUncertainty()).uncertainty.evidenceAssessed).toBe(false)
    expect(build(evidenceGapWithNullConfidence()).uncertainty.evidenceAssessed).toBe(true)
    // The two empty-state strings must actually be different, or carrying the
    // distinction buys nothing.
    expect(COPY.empty.uncertaintyAssessed).not.toBe(COPY.empty.uncertaintyUnassessed)
  })
})

describe('coverage is not readiness (§17)', () => {
  it('discloses partial completeness as provenance without any readiness claim', () => {
    const vm = build(highUncertainty())
    expect(vm.status.isProvisional).toBe(true)
    const text = JSON.stringify(vm)
    // Nothing on this surface may assert or deny that analysis may run —
    // `RunAdmission` owns that and this adapter never reads it.
    expect(text).not.toMatch(/not ready|cannot run|blocked from running|readiness/i)
  })

  it('never blocks or empties the analysis just because uncertainty is high', () => {
    const vm = build(highUncertainty())
    expect(vm.uncertainty.findings.length).toBeGreaterThan(0)
    expect(vm.drivers.findings.length).toBeGreaterThan(0)
    expect(vm.keyInsights.insights.length).toBeGreaterThan(0)
  })
})

describe('humanised producer text (§4)', () => {
  it('prefers the sanitised display text and never reaches past it to the raw message', () => {
    const vm = build(highUncertainty())
    expect(JSON.stringify(vm)).not.toContain('RAW_TOKEN_SHOULD_NOT_RENDER')
    expect(
      vm.uncertainty.findings.some((f) => f.implication.includes('Test the adoption assumption')),
    ).toBe(true)
  })
})

describe('whole-decision VOI (§4) — verdict only, never the number', () => {
  it("passes 'not_computed' through as its own state, distinct from a measured zero", () => {
    expect(build(makeData()).uncertainty.decisionVoi).toBe('not_computed')
    expect(build(highUncertainty()).uncertainty.decisionVoi).toBe('measured_non_zero')
  })
})

describe('interventions (§14, §3B)', () => {
  it('caps the prioritised list at three and discloses how many there were', () => {
    const many = [1, 2, 3, 4, 5].map((n) => rec({ id: `strengthen:r${n}`, priority: n }))
    const vm = build(openStrategicChallenge(), many)
    expect(vm.strengthen.interventions).toHaveLength(3)
    expect(vm.strengthen.candidateCount).toBe(5)
    // The cap preserves the engine's order — it never re-ranks.
    expect(vm.strengthen.interventions.map((r) => r.id)).toEqual([
      'strengthen:r1',
      'strengthen:r2',
      'strengthen:r3',
    ])
  })

  it('renders a single grounded intervention', () => {
    const vm = build(openStrategicChallenge(), [rec({ id: 'strengthen:only' })])
    expect(vm.strengthen.interventions.map((r) => r.id)).toEqual(['strengthen:only'])
  })

  it('renders NONE rather than manufacturing one when the engine emitted nothing', () => {
    const vm = build(openStrategicChallenge(), [])
    expect(vm.strengthen.interventions).toHaveLength(0)
    expect(vm.strengthen.candidateCount).toBe(0)
  })

  it('attaches a contextual intervention to a finding BY TARGET ID, never by label', () => {
    // The discriminating pair. First: a recommendation whose targetId matches
    // the dominant factor attaches to that finding.
    const matching = rec({ id: 'strengthen:dominant', targetId: 'f_leadtime' })
    const attached = build(openStrategicChallenge(), [matching])
    const dominant = attached.keyInsights.insights.find((i) => i.id === 'insight:dominant-factor')!
    expect(dominant.intervention?.recommendationId).toBe('strengthen:dominant')

    // Second: the SAME recommendation with a different targetId must NOT
    // attach — even though its title, signal and label are byte-identical. A
    // value-predicate join would still match here and this case would pass
    // vacuously (CLAUDE.md trap 19).
    const mismatched = rec({ id: 'strengthen:dominant', targetId: 'f_something_else' })
    const detached = build(openStrategicChallenge(), [mismatched])
    const dominant2 = detached.keyInsights.insights.find((i) => i.id === 'insight:dominant-factor')!
    expect(dominant2.intervention).toBeUndefined()
  })
})

describe('key insights (§13) — a small number, and the cap is disclosed', () => {
  it('never exceeds four and reports the true candidate count', () => {
    const vm = build(highUncertainty())
    expect(vm.keyInsights.insights.length).toBeLessThanOrEqual(4)
    expect(vm.keyInsights.candidateCount).toBeGreaterThanOrEqual(vm.keyInsights.insights.length)
  })

  it('drops an insight whose implication sentence is empty rather than rendering a bare headline', () => {
    // A robustness verdict with no producer reason has nothing to say.
    const vm = build(makeData({ recommendation: { robustnessVerdict: 'robust' } }))
    expect(vm.keyInsights.insights.map((i) => i.id)).not.toContain('insight:robustness')
  })
})

describe('staleness (§20)', () => {
  it('marks every insight as from an earlier run, and says the MODEL changed', () => {
    const vm = build(genuineDecision(), [], { isStale: true })
    expect(vm.status.isStale).toBe(true)
    expect(vm.keyInsights.insights.every((i) => i.marker === 'stale')).toBe(true)
    // Freshness, not correctness: the copy must not call the result wrong.
    expect(COPY.status.stale).toBe('The model has changed since this analysis ran.')
  })
})

describe('withheld fields (ROADMAP 2.1273) — never read, never rendered', () => {
  it('renders neither recommendation stability nor ranking stability, on any fixture', () => {
    // ⛔ PLoT WITHHOLDS `recommendation_stability`: ISL derives it as the
    // leader's win probability RELABELLED, carrying "zero independent
    // information". `ranking_stability` was never emitted. Printing either
    // beside the honest win probability is the same quantity twice, the second
    // time under a name implying an independent robustness measurement.
    //
    // An earlier draft of the comparative insight printed BOTH. The estate-wide
    // `withheldFieldReadBan.spec.ts` caught it; this case makes the surface
    // answerable for it in its own suite too.
    for (const fixture of [genuineDecision(), highUncertainty(), openStrategicChallenge()]) {
      const text = JSON.stringify(build(fixture))
      expect(text).not.toMatch(/stability/i)
    }
  })

  it('still renders the HONEST statistic it was standing beside', () => {
    // The discriminating half: without this, deleting the whole comparative
    // insight would satisfy the case above and prove nothing.
    const vm = build(genuineDecision())
    const comparative = vm.keyInsights.insights.find((i) => i.id === 'insight:comparative')!
    expect(comparative.inspect.map((r) => r.label)).toContain('Win probability')
  })
})

describe('the refuted EVPI-in-percentage-points display', () => {
  it('is absent from every rendered row', () => {
    const vm = build(highUncertainty())
    expect(JSON.stringify(vm)).not.toMatch(/percentage point/i)
    expect(JSON.stringify(vm)).not.toMatch(/evpiPp|evpi_percentage_points/)
  })
})
