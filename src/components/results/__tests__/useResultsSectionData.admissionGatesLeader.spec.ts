/**
 * ⭐ THE MODEL'S LICENCE AND THE RESULT'S SEPARATION ARE TWO QUESTIONS.
 *
 * CEE publishes `analysis_ready.analysis_admission.permitted_analysis_mode` —
 * *given how this model was AUTHORED, what may the product CLAIM from a run of
 * it?* Strong separation between two machine-invented estimates is a perfectly
 * good run and still not a licence to say "Robust" or to name a leader.
 *
 * The panel must therefore conjoin TWO answers before designating anything:
 *
 *   Q1  does the MODEL license a comparative claim?   permitted_analysis_mode
 *   Q2  did THIS RESULT separate the arms?            verdict.hasLeadingOption
 *
 * ⚠⚠ THE ARMS BELOW ARE A DISCRIMINATING TRIPLE, AND NO SINGLE ARM WOULD DO.
 * Arm B alone is satisfied by a fix that wires ONLY the mode and ignores the
 * verdict. Arm C alone is satisfied by a fix that wires ONLY the verdict and
 * ignores the mode. Either one-conjunct fix reads as a complete success against
 * a single arm, which is how two questions end up under one name — the defect
 * this estate has paid for twice. The triple is what proves they are COMPOSED.
 *
 * ⚠ AND THE ABSENCE ARM IS NOT DECORATION. `analysis_admission` absent means an
 * OLDER PRODUCER, never "no". If absence were read as a refusal, every legacy
 * payload would silently lose its leader; if a refusal were read as absence, the
 * gate would never fire. Arm A pins absence to today's behaviour, and it is what
 * makes this consumer safe to land BEFORE the CEE half deploys.
 *
 * ID-SPACE PRECONDITION, pinned in-test: `deriveDecisionVerdict` is handed
 * `visibleOptionIds` from the canvas option nodes, so an option carrying a win
 * probability but absent from `nodes` is DROPPED and `hasLeadingOption` goes
 * false for a reason that has nothing to do with admission. Every arm therefore
 * asserts the option list is built first — a RED from the harness is worth no
 * more than a GREEN from a vacuous assertion.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useResultsSectionData } from '../useResultsSectionData'
import type { PermittedAnalysisMode } from '../../../adapters/cee/types'
import { licensesComparativeLeaderClaim } from '../../../canvas/hooks/useAnalysisReady'
import { buildAnalysisNewViewModel } from '../analysisNew/buildAnalysisNewViewModel'

import {
  admission, setStore, render, resetStore, invalidateByLocalEdit,
} from './helpers/admissionGatesHarness'

describe('permitted_analysis_mode gates leader designation — the two questions, composed', () => {
  beforeEach(resetStore)

  it('ARM A — no admission key at all: today’s behaviour, byte for byte', () => {
    setStore({ separated: true })
    const rec = render()
    // The producer has not spoken. The result separated the arms, so the leader
    // stands exactly as it did before this consumer existed.
    expect(rec?.verdict?.hasLeadingOption, 'Q2 must be TRUE, or arms B and D prove nothing').toBe(true)
    expect(rec?.leaderDesignationPermitted).toBe(true)
    expect(rec?.analysisAdmission, 'absence must stay undefined, never coerced to a refusal').toBeUndefined()
  })

  /**
   * ⭐⭐⭐ ARM A2 — ARM A'S DISCRIMINATING PARTNER, AND THE REASON ARM A MUST NOT
   * SIMPLY BE INVERTED.
   *
   * ARM A and this arm present the consumer with the SAME INPUT: a separating
   * result and NO admission. They must come out OPPOSITE, because the absences
   * are not the same absence:
   *
   *   ARM A   the producer never spoke (an older CEE)      -> the leader stands
   *   ARM A2  the producer spoke, and WE nulled it         -> the refusal stands
   *
   * That is why the fix is a second fact and not a flipped default. Inverting ARM
   * A would strip the leader from every legacy payload — the exact harm ARM A's
   * rationale was written to prevent, and that guarantee is still live here.
   *
   * WITNESSED on staging 9eb30b54, 2026-09-10, as a fresh guest: a
   * `quantified_provisional` run rendered "What this run may not conclude" with
   * CEE's refusal; 59ms after ONE factor value was edited the same slot rendered
   * "Most likely to serve your goal / Double Down on SMB", and it stayed for
   * ~1.5s. The refusal's own words are "no option can be called the leader …
   * until you have set at least one of them" — so the product waited for the user
   * to do exactly what it asked and then made the claim it had refused.
   *
   * ⚠ THE ARM DRIVES THE REAL CHOKEPOINT (`invalidateByLocalEdit` → `updateNode`
   * → `invalidateAnalysisReady`). Setting the retained field by hand would leave
   * this green if the store stopped retaining anything at all.
   */
  it('ARM A2 — admission nulled by OUR OWN edit, result still separating: the refusal SURVIVES', () => {
    setStore({ separated: true, admission: admission('quantified_provisional') })
    // Precondition, in-test: the refusal is in force BEFORE the edit. Without
    // this the arm could pass on a build where the gate never licensed anything.
    expect(
      render()?.leaderDesignationPermitted,
      'precondition: the producer’s refusal must be in force before the edit',
    ).toBe(false)

    invalidateByLocalEdit()

    const rec = render()
    // Q2 is UNTOUCHED by the edit — `report` lives in a different store slice and
    // invalidation does not clear it. That is what made the conjunction flip: one
    // conjunct became `true` by absence while the other stayed `true` on merit.
    expect(
      rec?.verdict?.hasLeadingOption,
      'Q2 must still be TRUE, or this arm is the non-separating case the suite already covers',
    ).toBe(true)
    // ⭐ THE RED. Absence that WE caused is not permission.
    expect(
      rec?.leaderDesignationPermitted,
      'a local edit must not license the designation the producer declined',
    ).toBe(false)
    // And the reason travels with it, or the surface withholds with no explanation.
    expect(rec?.analysisAdmission?.permitted_analysis_mode).toBe('quantified_provisional')
  })

  /**
   * ARM A3 — THE OTHER HALF OF THE PAIR, AND IT MUST STAY GREEN.
   *
   * A licensed leader that goes stale on an edit KEEPS its designation, hedged by
   * the staleness ribbon (`AtAGlance.tsx`). Suppressing those would be a product
   * decision about stale runs, not this fix — so the retained admission must be
   * able to carry a LICENCE through invalidation as readily as a refusal, and this
   * arm fails if the fix were implemented as "withhold whenever stale".
   */
  it('ARM A3 — a LICENSED admission nulled by our own edit still licenses the designation', () => {
    setStore({ separated: true, admission: admission('comparative_leader') })
    expect(render()?.leaderDesignationPermitted).toBe(true)

    invalidateByLocalEdit()

    const rec = render()
    expect(rec?.verdict?.hasLeadingOption).toBe(true)
    expect(
      rec?.leaderDesignationPermitted,
      'the fix must not suppress a leader the producer DID license — that is a staleness ' +
      'question, and the ribbon answers it',
    ).toBe(true)
  })

  it('ARM B — the MODEL refuses (mode below comparative_leader) while the RESULT separates', () => {
    setStore({ separated: true, admission: admission('quantified_provisional') })
    const rec = render()
    // ⭐ THIS IS THE RED. Q2 is unchanged and still true — the numbers are real
    // and stay on screen — but the model does not license naming a leader.
    expect(rec?.verdict?.hasLeadingOption, 'Q2 must still be TRUE here, or this arm is testing Q2').toBe(true)
    expect(rec?.leaderDesignationPermitted).toBe(false)
    // The refusal carries its reason, which is the "what would change it" copy.
    expect(rec?.analysisAdmission?.reasons?.length,
      'by contract reasons is NEVER empty on a refusal').toBeGreaterThan(0)
    expect(rec?.analysisAdmission?.reasons?.[0]?.field).toBe('semantic_quality_sufficient')
  })

  it('ARM C — the RESULT refuses (tied arms) while the MODEL licenses a claim', () => {
    setStore({ separated: false, admission: admission('comparative_leader') })
    const rec = render()
    // The mirror of arm B. A fix that wired ONLY the mode would pass arm B and
    // fail here; a fix that wired ONLY the verdict would pass here and fail B.
    expect(rec?.verdict?.hasLeadingOption, 'Q2 must be FALSE here').toBe(false)
    expect(rec?.leaderDesignationPermitted).toBe(false)
  })

  it('ARM D — both permit: the leader is designated, so the gate is not always-refuse', () => {
    setStore({ separated: true, admission: admission('comparative_leader') })
    const rec = render()
    expect(rec?.verdict?.hasLeadingOption).toBe(true)
    expect(rec?.leaderDesignationPermitted).toBe(true)
  })

  /**
   * ⚠ THE GATE MUST REACH THE SURFACES, NOT JUST THE HOOK. `useResultsSectionData`
   * is called ONCE for the whole right panel and its result is threaded to the
   * Analysis tab, the hero and Analysis (New). Asserting only the hook's field
   * would prove the composition and say NOTHING about whether any surface reads
   * it — and a half-gated panel is the exact failure this consumer exists to
   * prevent: one tab honest while its sibling still names a winner.
   *
   * These arms drive the REAL chain — store -> hook -> builder — rather than
   * handing a builder a synthetic recommendation, because a hand-built input
   * encodes my model of the hook rather than the hook.
   */
  /* ARMS E/F/G (the hero's crown) live in
   * `analysis-hero/__tests__/admissionGatesHeroCrown.spec.ts`. `inertness.spec.ts`
   * forbids importing `buildHeroModel` from outside that directory, and the guard
   * is right — so the arms moved rather than the guard being widened. The fixture
   * is shared via `helpers/admissionGatesHarness`, not duplicated. */

  /**
   * ⚠ ARM H EXISTS BECAUSE A MUTANT PROVED THE GAP. Reverting Analysis (New)'s
   * gate to the single conjunct left the whole suite GREEN — the hero had an arm
   * and Analysis (New) did not, which is precisely the half-gated panel this
   * consumer exists to prevent, reproduced inside its own test file.
   */
  const analysisNewImplication = (data: ReturnType<typeof useResultsSectionData>) =>
    buildAnalysisNewViewModel({
      data, recommendations: [], isPreRun: false, isRunning: false, isStale: false,
    }).modelImplication

  it('ARM H — ANALYSIS (NEW) withholds its model implication when the model refuses', () => {
    setStore({ separated: true, admission: admission('quantified_provisional') })
    const r = renderHook(() => useResultsSectionData())
    expect(r.result.current.recommendation?.allOptions?.length, 'harness precondition').toBe(2)
    expect(r.result.current.recommendation?.verdict?.hasLeadingOption,
      'Q2 must still be TRUE, or this arm tests Q2').toBe(true)
    expect(analysisNewImplication(r.result.current).kind).toBe('none')
  })

  it('ARM I — ANALYSIS (NEW) still speaks when both permit (ARM H is not vacuous)', () => {
    // ⚠ `modelImplication` returns {kind:'none'} for SEVERAL reasons — a single
    // option, too few options, mismatched centres. Without this contrast, ARM H
    // would pass on a build where the implication is 'none' for a reason that
    // has nothing to do with admission.
    setStore({ separated: true, admission: admission('comparative_leader') })
    const r = renderHook(() => useResultsSectionData())
    expect(r.result.current.recommendation?.allOptions?.length, 'harness precondition').toBe(2)
    expect(analysisNewImplication(r.result.current).kind,
      'ARM H proves nothing unless this arm is NOT none').not.toBe('none')
  })

  it('every mode BELOW comparative_leader withholds, and only that one permits', () => {
    // Derived over the whole frozen enum rather than the one value arm B uses,
    // so a new mode added upstream cannot quietly land on the permitting side.
    const modes: PermittedAnalysisMode[] = ['none', 'exploratory', 'quantified_provisional', 'comparative_leader']
    const permitted = modes.filter(m => licensesComparativeLeaderClaim(admission(m)))
    expect(permitted).toEqual(['comparative_leader'])
  })

  /**
   * ⭐⭐ THE PRODUCER INVARIANT — asserted here rather than assumed everywhere
   * else. `leaderDesignation.ts` may only WITHHOLD, never LICENSE, when the
   * composed answer is absent; that rule is precautionary ONLY because this
   * hook never emits a verdict without the composed answer beside it. Nothing
   * pinned that. It is a property of ONE object literal — `verdict` and
   * `leaderDesignationPermitted` are sibling keys of the same `return` — and a
   * future exit, a hydrated snapshot, or a second producer could break it in a
   * diff that touches neither file, with no red anywhere.
   *
   * ⚠ EVERY ARM PINS ITS OWN PRECONDITION. Without the verdict assertion an arm
   * whose store produced no run would "pass" by having nothing to check, which
   * is how a completeness guard stops discriminating without going red.
   */
  const PRODUCER_CASES: ReadonlyArray<readonly [string, () => void]> = [
    ['no admission at all', () => setStore({ separated: true })],
    ['model refuses, result separates', () => setStore({ separated: true, admission: admission('quantified_provisional') })],
    ['model permits, result ties', () => setStore({ separated: false, admission: admission('comparative_leader') })],
    ['both permit', () => setStore({ separated: true, admission: admission('comparative_leader') })],
  ]

  it.each(PRODUCER_CASES)(
    'PRODUCER INVARIANT (%s) — a verdict never travels without the composed answer beside it',
    (_label, set) => {
      set()
      const rec = render()
      expect(rec?.verdict, 'precondition: this case must produce a verdict, or the invariant is vacuous here').toBeTruthy()
      expect(
        typeof rec?.leaderDesignationPermitted,
        'a verdict without the composed answer is the shape leaderDesignation.ts can only withhold on',
      ).toBe('boolean')
    },
  )

  it('PRODUCER INVARIANT — the pre-run exit carries NEITHER field, so absence never means "a run with no licence"', () => {
    // The hook's other exit (`!hasCompletedFirstRun || !report`). It publishes
    // no verdict, so `undefined` from the reader keeps meaning NO AUTHORITY AT
    // ALL rather than an unlicensed run — which is why collapsing that third
    // state to `false` would turn every pre-run render into an active
    // withholding.
    resetStore()
    const r = renderHook(() => useResultsSectionData())
    expect(r.result.current.recommendation?.verdict, 'the pre-run exit must publish no verdict').toBeFalsy()
    expect(r.result.current.recommendation?.leaderDesignationPermitted).toBeUndefined()
  })

  it('absence is not a refusal — undefined and null both keep today’s behaviour', () => {
    // The two ways "the producer has not spoken" can reach this predicate. If
    // either were read as a refusal, every legacy payload would lose its leader.
    expect(licensesComparativeLeaderClaim(undefined)).toBe(true)
    expect(licensesComparativeLeaderClaim(null)).toBe(true)
    // …and a PRESENT refusal is distinguishable from absence, by type not sentinel.
    expect(licensesComparativeLeaderClaim(admission('none'))).toBe(false)
  })
})
