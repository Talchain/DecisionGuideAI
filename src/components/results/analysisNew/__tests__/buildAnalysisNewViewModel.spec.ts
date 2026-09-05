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
  manyFragileEdges,
  openStrategicChallenge,
  uncertaintyDerivedFindings,
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
    isPreRun: false,
    isRunning: false,
    isStale: false,
    ...over,
  })

describe('leader entitlement (§13) — recommendation.verdict.hasLeadingOption', () => {
  it('names a leader ONLY when the verdict entitles it, and never says "wins"', () => {
    // The comparative read moved to "At a glance" — it is the surface that
    // states it now, so that is where the entitlement is asserted. The
    // vocabulary sweep below still covers the WHOLE view model.
    const vm = build(genuineDecision())
    expect(vm.atAGlance.headline).toBe('Raise price currently scores higher')
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
    expect(vm.atAGlance.headline).toBeNull()
    expect(vm.atAGlance.winShare, 'a win share with no entitled leader is a number about a withheld option').toBeNull()
  })

  it('an open strategic challenge produces insights WITHOUT any option framing', () => {
    const vm = build(openStrategicChallenge())
    expect(vm.atAGlance.headline).toBeNull()
    // The surface is NOT empty just because there is no decision — that is the
    // failure mode a decision-first ladder produces. The glance leads with
    // drivers, and the ladder still carries the structural findings.
    expect(vm.atAGlance.drivers.length).toBeGreaterThan(0)
    expect(vm.keyInsights.insights.map((i) => i.id)).toContain('insight:dominant-factor')
  })
})

describe('robustness (§4) — display-safe verdict only', () => {
  it("renders the producer's own reason verbatim and never authors robustness prose", () => {
    // Robustness is stated by "At a glance" now — one surface, and it is the
    // one that carries the producer's sentence.
    expect(build(openStrategicChallenge()).atAGlance.verdict?.reason).toBe(
      'Small changes in supplier lead time change which direction looks better.',
    )
  })

  it('says nothing about robustness when no display-safe verdict arrived', () => {
    // `robustnessLevel` alone must NOT produce a verdict — it is structured
    // data, not a display-safe one.
    expect(build(makeData({ recommendation: { robustnessLevel: 'low' } })).atAGlance.verdict).toBeNull()
  })

  it('covers ALL FOUR vocabulary members distinctly, and turns none of them into a claim it did not receive', () => {
    // ⭐ THE BREADTH CASE, now against the glance's word map. Four members; a
    // binary split made 'moderate' read as sensitive and turned 'not_assessed'
    // — the producer's own stated absence — into a measurement.
    const wordFor = (verdict: string) =>
      build(makeData({ recommendation: { robustnessVerdict: verdict as never, robustnessVerdictReason: 'r' } }))
        .atAGlance.verdict

    expect(wordFor('robust')?.label).toBe('Stable')
    expect(wordFor('moderate')?.label).toBe('Mixed')
    expect(wordFor('fragile')?.label).toBe('Sensitive')
    expect(wordFor('not_assessed')).toBeNull()
    expect(new Set(['robust', 'moderate', 'fragile'].map((v) => wordFor(v)!.label)).size).toBe(3)
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

  /**
   * ⚠⚠ THIS INVARIANT MOVED, IT DID NOT DIE — and moving it is the whole point.
   *
   * The row's sentence used to carry the direction verb, and this case pinned
   * that `mixed`/`unknown` never got one. The influence chart now DRAWS the
   * direction (`← Lowers the goal | Raises the goal →`), so the row saying it
   * again put every driver on screen twice — witnessed on deployed `1be7c0b8`.
   * The verb was removed from the sentence; the guarantee moved to the surface
   * that now makes the claim.
   *
   * ⚠ AND IT IS STRONGER THERE. The row's neutral verb `'moves'` was silence
   * about the producer's refusal; the chart states it — a centred bar plus
   * "Direction not established" (`driverInfluenceChart.spec.tsx`), with the
   * narrowing itself pinned in `influenceRowsDirection.spec.ts` including the
   * `mixed`/`unknown`/absent cases this used to own.
   *
   * What stays HERE is the half the chart cannot draw: that the row makes no
   * directional claim at all any more.
   */
  it('the row makes NO directional claim — the chart owns that, and owns it for every member', () => {
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

    for (const anyMember of ['positive', 'negative', 'mixed', 'unknown', undefined]) {
      const text = implicationFor(anyMember as never)
      expect(text, `${anyMember} leaked a direction into the row`).not.toMatch(
        /raises|lowers|moves/,
      )
    }
  })

  /**
   * ⚠ THE OPPOSITE-DIRECTION TWIN, in the same file, so the removal cannot be
   * read as "the row lost its content". The figure is what a BAR LENGTH cannot
   * state — a bar is a rank comparison, never a number — so it must survive.
   */
  it('…and still states the figure, which the bar cannot', () => {
    const vm = build(
      makeData({
        drivers: {
          drivers: [makeDriver({ factorKey: 'f_x', factorLabel: 'X', displayInfluence: 0.6 })],
        },
      }),
    )
    expect(vm.drivers.findings[0].implication).toMatch(/\d+%/)
  })

  it('states the figure ONLY on the producer influence scale, and states it as RELATIVE', () => {
    /**
     * ⚠⚠ THIS ASSERTED `false` UNTIL 6 Sep 2026, AND THAT PIN RATIFIED THE
     * DEFECT. `influenceIsSetRelative` was `rows.some(d => d.displayProvenance
     * !== 'influence_score')` — false exactly when every row IS the producer
     * basis, which is the ordinary run. So the panel took its ABSOLUTE arm on
     * precisely the runs whose basis is set-relative for every row, and printed
     * "Structural influence 100%" — the string Paul witnessed on the deployed
     * build. Every capture in this repo maxes at exactly 1.0, because the
     * producer divides by `max|influence|`.
     *
     * Evidence and the full ruling: `theScaleClaimMatchesTheScale.spec.ts`.
     */
    const vm = build(openStrategicChallenge())
    expect(vm.drivers.influenceIsSetRelative).toBe(true)
    // The figure survives — a bar length cannot state a number — but the noun
    // no longer claims a share of the outcome.
    expect(vm.drivers.findings[0].implication).toContain('Relative influence 60%')
    expect(vm.drivers.findings[0].implication).not.toContain('Structural influence')
  })
})

describe('absence is not zero (§4)', () => {
  it('a null evidence-gap confidence renders NO confidence row and marks it unassessed', () => {
    const vm = build(evidenceGapWithNullConfidence())
    const gap = uncertaintyDerivedFindings(vm).find((f) => f.id === 'gap:f_churn')!
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
    expect(uncertaintyDerivedFindings(vm).length).toBeGreaterThan(0)
    expect(vm.drivers.findings.length).toBeGreaterThan(0)
    // The glance still has a read to give even on a fragile, partial run.
    expect(vm.atAGlance.verdict).not.toBeNull()
    expect(vm.atAGlance.drivers.length).toBeGreaterThan(0)
  })
})

describe('humanised producer text (§4)', () => {
  it('prefers the sanitised display text and never reaches past it to the raw message', () => {
    const vm = build(highUncertainty())
    expect(JSON.stringify(vm)).not.toContain('RAW_TOKEN_SHOULD_NOT_RENDER')
    expect(
      // The producer's suggestion still reaches the screen — additive on
      // `detail`, never a replacement for the finding.
      //
      // ⚠ THIS COMMENT USED TO END "a generic constant is dropped instead of
      // promoted". FALSE, and it was the spec twin of the same false claim in
      // the builder: there is no generic detection, so the producer's constant
      // 'Review this assumption' is DEMOTED to `detail` on every fragile-edge
      // row. Corrected rather than implemented — see the builder for why
      // detecting it would mean hardcoding a producer literal.
      uncertaintyDerivedFindings(vm).some((f) =>
        [f.headline, f.implication, f.detail ?? ''].some((field) =>
          field.includes('Test the adoption assumption'),
        ),
      ),
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
  /**
   * ⚠ THIS TEST USED TO ASSERT THE OPPOSITE, AND IT WAS NAMED "caps the
   * prioritised list at three and discloses how many there were". It passed.
   * Nothing disclosed anything: `candidateCount` had no render consumer
   * anywhere in the tree, so the second half of that name was a property of
   * the view model and never of the product — five of eight findings were
   * unreachable on a measured staging run.
   *
   * The preview is now applied at the mount, where the remainder can be
   * offered, so what this layer owes the section is the WHOLE ordered list.
   */
  it('hands the section the full list, in engine order, and never re-ranks it', () => {
    const many = [1, 2, 3, 4, 5].map((n) => rec({ id: `strengthen:r${n}`, priority: n }))
    const vm = build(openStrategicChallenge(), many)
    expect(vm.strengthen.interventions.map((r) => r.id)).toEqual([
      'strengthen:r1',
      'strengthen:r2',
      'strengthen:r3',
      'strengthen:r4',
      'strengthen:r5',
    ])
  })

  it('renders a single grounded intervention', () => {
    const vm = build(openStrategicChallenge(), [rec({ id: 'strengthen:only' })])
    expect(vm.strengthen.interventions.map((r) => r.id)).toEqual(['strengthen:only'])
  })

  it('renders NONE rather than manufacturing one when the engine emitted nothing', () => {
    const vm = build(openStrategicChallenge(), [])
    expect(vm.strengthen.interventions).toHaveLength(0)
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

describe('key insights (§13) — the whole list, and the count that survives the dedupe', () => {
  /**
   * ⚠ THIS TEST WAS 'never exceeds four and reports the true candidate count',
   * AND IT COULD NOT FAIL. Four branches could push, so `insights.length <= 4`
   * held whatever the code did — a bound the implementation could not reach is
   * a guard agreeing with itself (CLAUDE.md trap 13b), and it read as coverage
   * of a `KEY_INSIGHT_CAP` that was in fact slicing the DATA. The cap is gone;
   * the tail is now reached by the mount's preview, and the unbounded case is
   * pinned in `insightsDriversUncertaintyDepth.spec.ts`.
   *
   * What is left here is the claim that still has content: `candidateCount`
   * reports what the RUN produced, so an empty list with a non-zero count means
   * "already shown above" rather than "nothing was found".
   */
  it('reports what the run produced, never fewer than the list it hands over', () => {
    const vm = build(highUncertainty())
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
    // The discriminating half: without this, deleting the win share outright
    // would satisfy the absence case above and prove nothing.
    expect(build(genuineDecision()).atAGlance.winShare).toBe('Ahead in 69% of simulated futures')
  })
})

describe('the refuted EVPI-in-percentage-points display', () => {
  it('is absent from every rendered row', () => {
    const vm = build(highUncertainty())
    expect(JSON.stringify(vm)).not.toMatch(/percentage point/i)
    expect(JSON.stringify(vm)).not.toMatch(/evpiPp|evpi_percentage_points/)
  })
})

describe('finding identity (CLAUDE.md trap 19) — one row, one id', () => {
  /**
   * ⚠ DERIVED FROM THE PRODUCER, NOT IMAGINED. `useResultsSectionData.ts:3197`
   * pushes a row PER DEDUPED FRAGILE EDGE, each carrying the literal
   * `code: 'SENSITIVE_ASSUMPTION'`. An id minted as `uncertainty:${code}` is
   * therefore identical across every one of them.
   *
   * Measured on the deployed build at `a9fc1564`: three rendered rows all
   * carrying `data-finding-id="uncertainty:SENSITIVE_ASSUMPTION"`. That makes
   * the React key ambiguous (so `DisclosureRow`'s open state can attach to the
   * wrong row on any reorder) and makes the surface's own identity-binding
   * doctrine unenforceable — a test binding a row by id binds to three.
   */
  it('gives same-code uncertainties distinct ids', () => {
    const vm = build(manyFragileEdges())
    const sensitive = uncertaintyDerivedFindings(vm).filter((f) => f.id.startsWith('uncertainty:'))
    expect(sensitive.length, 'fixture must emit several same-code rows or this is vacuous').toBeGreaterThan(1)
    expect(new Set(sensitive.map((f) => f.id)).size).toBe(sensitive.length)
  })

  it('gives every finding on the surface a unique id, across all producers', () => {
    const vm = build(manyFragileEdges())
    const ids = [
      ...vm.keyInsights.insights,
      ...vm.drivers.findings,
      ...uncertaintyDerivedFindings(vm),
    ].map((f) => f.id)
    expect(ids.length, 'no findings — this assertion would be vacuous').toBeGreaterThan(3)
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i)
    expect(dupes, `duplicate finding ids: ${dupes.join(', ')}`).toEqual([])
  })
})

describe('producer prose is never cut (ROADMAP 2.1330)', () => {
  /**
   * ⚠ THE LOSS IS UNRECOVERABLE ANYWHERE ON THE PAGE, WHICH IS WHY A CUT HERE
   * IS NOT COSMETIC. `implication` is `u.suggestion || text`, and the producer
   * sends `suggestion` as the CONSTANT 'Review this assumption' on every
   * fragile-edge row — so the implication carries a remedy, never the sentence.
   * `detail` is undefined and `inspect` is numeric. Measured on the deployed
   * build: three rows cut at 80 characters, each BEFORE ITS VERB, each with the
   * identical body 'Review this assumption'.
   */
  it('carries each uncertainty sentence in full somewhere on the finding', () => {
    const data = manyFragileEdges()
    const vm = build(data)
    const texts = (data.confidence.uncertainties ?? []).map((u) => u.displayText || u.message)
    expect(texts.length).toBeGreaterThan(0)
    for (const text of texts) {
      expect(text.length, 'fixture text must exceed the cut or this is vacuous').toBeGreaterThan(80)
      const carried = uncertaintyDerivedFindings(vm).some((f) =>
        [f.headline, f.implication, f.detail ?? ''].some((field) => field.includes(text)),
      )
      expect(carried, `no field carries the full sentence: "${text.slice(0, 60)}…"`).toBe(true)
    }
  })

  it('never states the same sentence as both headline and body', () => {
    // ⚠ THE OTHER SIDE OF THE SAME RULE, and it is not hypothetical: the first
    // draft of this fix carried the full text unconditionally and an
    // uncertainty shorter than the cut rendered it TWICE. Truthfulness and
    // non-repetition are one requirement, not two, and a fix for either that
    // breaks the other is not a fix.
    for (const data of [manyFragileEdges(), highUncertainty()]) {
      const vm = build(data)
      expect(uncertaintyDerivedFindings(vm).length).toBeGreaterThan(0)
      for (const f of uncertaintyDerivedFindings(vm)) {
        if (f.implication) expect(f.implication).not.toBe(f.headline)
      }
    }
  })

  it('keeps the headline a LABEL rather than growing it into the whole sentence', () => {
    // The density half. A fix that simply stopped cutting would put 300
    // characters of header type at the top of every row.
    const vm = build(manyFragileEdges())
    const long = uncertaintyDerivedFindings(vm).filter((f) => f.implication.length > 80)
    expect(long.length, 'no long findings — this case would be vacuous').toBeGreaterThan(0)
    for (const f of long) expect(f.headline.length).toBeLessThanOrEqual(85)
  })
})

describe('identity survives a reorder — for the population that has a discriminator', () => {
  /**
   * ⭐ THE PROPERTY THAT SEPARATES A REAL FIX FROM A SILENCED WARNING.
   *
   * An index makes ids unique and REINTRODUCES the harm: reorder the producer's
   * list and the same finding acquires a different id, so `DisclosureRow`'s open
   * and inspect state migrates to the wrong row — the exact failure duplicate
   * keys could cause. This is the case that would have caught that, and it is
   * the reason the ids are built from `affectedNodes` / `threshold.variable`.
   */
  /**
   * ⚠ THE SCOPE OF THIS CLAIM, STATED SO IT IS NOT READ WIDER THAN IT IS.
   * Reorder-stability is asserted for uncertainties that carry a producer
   * DISCRIMINATOR (`affectedNodes` or `threshold.variable`) — which is the
   * measured SENSITIVE_ASSUMPTION population, one row per fragile edge. A row
   * bearing only a bare `code` still falls back to position, because the
   * producer has given us nothing to tell two such rows apart; that fallback is
   * REACHABLE and is not claimed to be stable. Do not generalise this case into
   * "the surface has reorder-stable identity".
   */
  it('gives a finding the SAME id wherever it sits in the producer list', () => {
    const forward = manyFragileEdges()
    const reversed = {
      ...forward,
      confidence: {
        ...forward.confidence,
        uncertainties: [...(forward.confidence.uncertainties ?? [])].reverse(),
      },
    } as typeof forward

    const idsOf = (d: typeof forward) =>
      uncertaintyDerivedFindings(build(d)).filter((f) => f.id.startsWith('uncertainty:')).map((f) => f.id)

    const a = idsOf(forward)
    const b = idsOf(reversed)
    expect(a.length, 'no uncertainties — vacuous').toBeGreaterThan(1)
    // Same SET of identities, and every one still distinct.
    expect(new Set(a).size).toBe(a.length)
    expect([...a].sort()).toEqual([...b].sort())
    // The discriminating half: an INDEX-based id would satisfy the line above
    // (both lists yield :0,:1,:2) while binding a different row each time. So
    // assert the id travels WITH its content.
    const first = uncertaintyDerivedFindings(build(forward)).find((f) => f.id.startsWith('uncertainty:'))!
    // ⚠ PIN THE PRECONDITION THIS LOOKUP DEPENDS ON. Finding the row by its
    // rendered text is a VALUE PREDICATE, and trap 19 is that another object can
    // satisfy one. It is correct only while these keys are distinct — a fact
    // nothing asserted before, so a fixture edit giving two rows the same text
    // would silently turn this into a match against the wrong row while staying
    // green.
    //
    // ⭐ THE KEY IS BOTH SLOTS, NOT `headline` ALONE — AND THIS ASSERTION IS WHY.
    // It was `headline`, and it went RED the moment the builder stopped putting a
    // truncated copy of the body in that slot (the deployed `19fe8710` stutter
    // fix): all three fragile-edge rows now carry an EMPTY headline and their
    // distinguishing content lives in `implication`. The precondition did exactly
    // what it was written to do — it failed loudly instead of quietly matching the
    // wrong row — so the fix is to key on the row's whole rendered content, which
    // discriminates wherever the builder chooses to put it. A NUL joiner keeps
    // two rows from colliding by straddling the slot boundary.
    const contentKey = (f: { headline: string; implication: string }) =>
      `${f.headline}\u0000${f.implication}`
    const keys = uncertaintyDerivedFindings(build(forward))
      .filter((f) => f.id.startsWith('uncertainty:'))
      .map(contentKey)
    expect(
      new Set(keys).size,
      'rendered content must be unique or the lookup below can match the wrong row',
    ).toBe(keys.length)

    const same = uncertaintyDerivedFindings(build(reversed)).find(
      (f) => contentKey(f) === contentKey(first),
    )!
    expect(same.id).toBe(first.id)
  })

  it('states plainly which rows fall back to position, rather than implying none do', () => {
    // The honest half. A row with only a `code` has no producer discriminator,
    // so its id ends in an index — and a reviewer must be able to see that from
    // the test suite rather than having to read the builder to discover it.
    const bare = makeData({
      confidence: {
        uncertainties: [
          { code: 'LONE', message: 'One.', displayText: 'One.' },
          { code: 'LONE', message: 'Two.', displayText: 'Two.' },
        ],
      } as never,
    })
    const ids = uncertaintyDerivedFindings(build(bare)).map((f) => f.id)
    expect(new Set(ids).size, 'they must still be unique').toBe(ids.length)
    expect(ids.every((id) => /:\d+$/.test(id)), 'these fall back to POSITION').toBe(true)
  })

  it('handles an EMPTY affectedNodes array, not just a missing one', () => {
    // ⚠ THE SUBTLE HALF, and the one a reader of the producer would miss.
    // `useResultsSectionData.ts:3197` ALWAYS assigns `affectedNodes` — but as
    // `[fromId, toId].filter(Boolean)`, and `parseEdgeId` returns `{}` for any
    // edge id that does not split on '::' into two non-empty parts, so both ids
    // can be undefined and the array is then EMPTY.
    //
    // ⚠ REACHABLE BY CONSTRUCTION, NOT OBSERVED IN A CAPTURE. No producer
    // payload has been inspected for this state; what is established is that
    // the producer code can emit it. The weaker claim is the true one.
    //
    // "The field is always assigned" is not "the field always discriminates",
    // and a key built from
    // `affectedNodes.join('>')` on an empty array would collapse two rows to
    // one id.
    const emptyNodes = makeData({
      confidence: {
        uncertainties: [
          { code: 'SENSITIVE_ASSUMPTION', message: 'A.', displayText: 'A.', affectedNodes: [] },
          { code: 'SENSITIVE_ASSUMPTION', message: 'B.', displayText: 'B.', affectedNodes: [] },
        ],
      } as never,
    })
    const ids = uncertaintyDerivedFindings(build(emptyNodes)).map((f) => f.id)
    expect(ids.length).toBe(2)
    expect(new Set(ids).size, 'an empty discriminator must not collapse two rows').toBe(2)
  })
})

describe('engine diagnostics are not strategic uncertainty', () => {
  it('keeps inference warnings OUT of "Uncertainty and gaps"', () => {
    // Measured on the deployed build: three of six rows were inference
    // warnings, all with the identical headline and bodies carrying raw node
    // ids ("root node 'e4ec3415'").
    const vm = build(manyFragileEdges())
    expect(uncertaintyDerivedFindings(vm).some((f) => f.id.startsWith('inference-warning:'))).toBe(false)
    expect(JSON.stringify(vm.uncertainty)).not.toContain('e4ec3415')
  })

  it('keeps them AVAILABLE in Deeper analysis rather than deleting them', () => {
    // The discriminating twin. Demoting is honest; dropping producer provenance
    // on the floor is not.
    const vm = build(manyFragileEdges(), [], { responseHash: 'run_x' })
    const group = vm.deeper.groups.find((g) => g.title === 'Model gaps the analysis worked around')
    expect(group, 'the warnings were dropped, not demoted').toBeTruthy()
    expect(group!.rows.length).toBe(3)
  })
})

describe('influence never mixes two bases (types.ts:638-644)', () => {
  it('claims no percentage for a driver the producer gave no comparable basis', () => {
    // `types.ts` tells consumers NOT to fall back to
    // `influenceScore ?? normalisedInfluence`. Absence suppresses the claim; it
    // does not resurrect a basis the contract bans.
    const vm = build(manyFragileEdges())
    const noBasis = vm.drivers.findings.find((f) => f.id === 'driver:f_nobasis')
    expect(noBasis, 'fixture must carry a driver with no displayInfluence').toBeTruthy()
    expect(noBasis!.implication).not.toMatch(/Structural influence \d/)
    expect(noBasis!.inspect.find((r) => r.label === 'Influence')).toBeUndefined()
  })
})

describe('the producer suggestion, pinned to what the code ACTUALLY does', () => {
  /**
   * ⚠ THESE EXIST BECAUSE A COMMENT AND A SPEC BOTH DESCRIBED BEHAVIOUR THE
   * CODE DID NOT IMPLEMENT, and independent review caught it by executing the
   * path rather than reading it. Both claimed the producer's generic constant
   * was "dropped rather than promoted"; there is no generic detection, so it is
   * DEMOTED TO `detail` on every fragile-edge row.
   *
   * The prose is now correct. These pin the behaviour so prose and code cannot
   * drift apart again silently — which is the only durable fix for that class.
   */
  it('demotes the producer suggestion to detail — it does not drop it', () => {
    const vm = build(manyFragileEdges())
    const rows = uncertaintyDerivedFindings(vm).filter((f) => f.id.startsWith('uncertainty:'))
    expect(rows.length, 'no fragile-edge rows — vacuous').toBeGreaterThan(1)
    // The producer sends this literal on every such row (useResultsSectionData:3197).
    for (const f of rows) expect(f.detail).toBe('Review this assumption')
    // And it is NOT in the slot the finding owns.
    for (const f of rows) expect(f.implication).not.toBe('Review this assumption')
  })

  it('drops any suggestion when a threshold owns the detail slot', () => {
    // The discriminating twin: `detail` has one slot and the threshold sentence
    // wins it, so a suggestion is dropped there — which is the only case in
    // which anything is dropped at all.
    const withThreshold = makeData({
      confidence: {
        uncertainties: [{
          code: 'SENSITIVE_ASSUMPTION',
          message: 'Long enough to exceed the label cut so the sentence rides the implication slot properly.',
          displayText: 'Long enough to exceed the label cut so the sentence rides the implication slot properly.',
          suggestion: 'Review this assumption',
          threshold: { variable: 'Customer demand', direction: 'positive' as const, value: 0.3007492161730507 },
        }],
      } as never,
    })
    const f = uncertaintyDerivedFindings(build(withThreshold))[0]
    expect(f.detail).not.toBe('Review this assumption')
    expect(f.detail).toContain('The ordering changes around')
  })

  it('formats the threshold value rather than printing the raw float', () => {
    // ⚠ The third threshold-printing site. #925 fixed the other two after the
    // deployed build showed a 16-significant-figure split; this one was still
    // interpolating `.value` raw and no spec pinned it.
    const withThreshold = makeData({
      confidence: {
        uncertainties: [{
          code: 'SENSITIVE_ASSUMPTION',
          message: 'Long enough to exceed the label cut so the sentence rides the implication slot properly.',
          displayText: 'Long enough to exceed the label cut so the sentence rides the implication slot properly.',
          threshold: { variable: 'Customer demand', direction: 'positive' as const, value: 0.3007492161730507 },
        }],
      } as never,
    })
    const detail = uncertaintyDerivedFindings(build(withThreshold))[0].detail ?? ''
    expect(detail, 'the raw float reached the surface').not.toContain('0.3007492161730507')
    expect(detail).toContain('0.3')
  })
})

/**
 * ⭐⭐ THE ONE ASSUMED RELATIONSHIP WORTH PINNING DOWN.
 *
 * Computed for every run and rendered only on the OLD Analysis tab. Measured
 * live on `a75cdf8a`, both tabs, one guest session, one run: the old tab carried
 * it, this one carried nothing, and `assumedStrength` had ZERO references across
 * the whole `analysisNew` tree (contrast control: `data.drivers`, 8).
 *
 * Every assertion binds to the EDGE by identity, never to a position or a count
 * another finding could satisfy.
 */
describe('the assumed relationship worth pinning down', () => {
  const selection = {
    edgeId: 'edge_residency_to_gdpr',
    fromLabel: 'EU Data Residency Compliance',
    toLabel: 'GDPR Non-Compliance Risk',
    switchProbability: 0.41,
    alternativeWinnerLabel: 'RudderStack',
    strengthProvenance: 'ai_inferred' as const,
  }
  const withSelection = (assumedFragileCount: number) =>
    makeData({ assumedStrength: { selected: selection, refusalReason: null, assumedFragileCount } })
  const found = (vm: ReturnType<typeof build>) =>
    uncertaintyDerivedFindings(vm).find((f) => f.id === `uncertainty:assumed-strength:${selection.edgeId}`)

  it('names the relationship, what wins when it is wrong, and how often', () => {
    const f = found(build(withSelection(3)))
    expect(f).toBeDefined()
    // The team's own words for their own model — both ends named.
    expect(f!.implication).toContain('EU Data Residency Compliance')
    expect(f!.implication).toContain('GDPR Non-Compliance Risk')
    // The measured consequence, which is the reasoning content that was dark.
    expect(f!.detail).toContain('RudderStack')
    expect(f!.detail).toContain('41%')
    // The edge is the focus target, so "Show on canvas" lands on the thing.
    expect(f!.targetId).toBe(selection.edgeId)
  })

  /**
   * ⚠ THE OPPOSITE DIRECTION. A build that pushed unconditionally would pass
   * every assertion above while inventing a finding on runs where the producer
   * declined to name one.
   */
  it('renders NOTHING when the producer selected none', () => {
    const vm = build(
      makeData({
        assumedStrength: { selected: null, refusalReason: 'no_robustness_data', assumedFragileCount: 0 },
      }),
    )
    expect(uncertaintyDerivedFindings(vm).some((f) => f.id.startsWith('uncertainty:assumed-strength:'))).toBe(
      false,
    )
  })

  /**
   * ⚠ The "and others" clause is the copy module's own rule — it counts the
   * SAME population the selection came from. Pinned here only to prove it flows
   * through rather than being dropped or restated.
   */
  it('mentions other unconfirmed strengths only when there is another', () => {
    expect(found(build(withSelection(1)))!.detail).not.toContain('other sensitive')
    expect(found(build(withSelection(3)))!.detail).toContain('2 other sensitive relationships')
  })
})

/**
 * ⭐ THE PARTIAL WARNING NAMES WHAT DID NOT COME BACK.
 *
 * Witnessed on the deployed build: this ribbon renders in amber ABOVE the
 * result, and on a run where the producer sent no `statusReason` it said only
 * "some results are missing" — a caveat with no content in the most prominent
 * position on the panel. `completeness.missing` already carried the answer.
 */
describe('the partial-analysis warning', () => {
  const withMissing = (missing: string[]) =>
    build(
      makeData({
        completeness: { status: 'partial', missing, reasons: [] } as never,
      }),
    )

  it("names the producer's own missing REQUIRED keys, in this surface's words", () => {
    const vm = withMissing(['win_probability', 'robustness_level'])
    expect(vm.status.missingResults).toEqual(['the win share', 'the robustness check'])
  })

  /**
   * ⭐⭐ THE PAIR THAT MATTERS, AND THE DEFECT THAT PRODUCED IT.
   *
   * ⚠ MEASURED on deployed `fc46e7ee`, a real completed guest run: the drivers
   * the producer actually sends carry no sensitivity field at all, and the
   * decision review is skipped by configuration on staging — so BOTH were in
   * `completeness.missing` on a perfectly healthy analysis, and the tab's first
   * line read "This analysis is partial — the sensitivity check, the decision
   * review did not come back" while the canvas rendered a sensitivity chip and
   * the chat rendered the review's own prose.
   *
   * These two assertions are OPPOSITE-DIRECTION TWINS and must stay that way:
   * the first proves optional enrichment cannot raise the warning, the second
   * proves closing that gap did not swallow a genuine missing result. One alone
   * would let the fix slide into either failure.
   */
  it('does NOT call an analysis partial for OPTIONAL enrichment the live path never sends', () => {
    const vm = withMissing(['sensitivity', 'decision_review', 'top_drivers'])
    expect(vm.status.missingResults).toEqual([])
    expect(vm.status.isProvisional).toBe(false)
  })

  it('STILL calls it partial when a required result is missing alongside that enrichment', () => {
    const vm = withMissing(['sensitivity', 'decision_review', 'expected_outcome'])
    expect(vm.status.missingResults).toEqual(['the expected outcome'])
    expect(vm.status.isProvisional).toBe(true)
  })

  /**
   * ⚠ THE DIRECTION THAT KEEPS IT HONEST. The vocabulary is closed today, but a
   * producer that adds a key must never put a raw token on screen — an
   * unrecognised name is worse than the generic sentence it would displace.
   */
  it('DROPS a key this build does not recognise rather than showing it raw', () => {
    const vm = withMissing(['win_probability', 'some_future_key'])
    expect(vm.status.missingResults).toEqual(['the win share'])
  })

  it('names nothing when every key is unrecognised, so the generic sentence stands', () => {
    expect(withMissing(['only_unknown_keys']).status.missingResults).toEqual([])
  })

  it('names nothing when the producer named nothing', () => {
    expect(withMissing([]).status.missingResults).toEqual([])
  })
})
