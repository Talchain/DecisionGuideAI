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
import { useCanvasStore } from '../../../canvas/store'
import { licensesComparativeLeaderClaim } from '../../../canvas/hooks/useAnalysisReady'
import { buildHeroModel } from '../analysis-hero/buildHeroModel'
import { buildAnalysisNewViewModel } from '../analysisNew/buildAnalysisNewViewModel'
import type { AnalysisAdmissionV1, PermittedAnalysisMode } from '../../../adapters/cee/types'

const OPT_HEDGE = 'opt_hedge'
const OPT_BOLD = 'opt_bold'

const NODES = [
  { id: OPT_HEDGE, type: 'option', position: { x: 0, y: 0 }, data: { kind: 'option', label: 'Hedge and stage the rollout' } },
  { id: OPT_BOLD, type: 'option', position: { x: 0, y: 0 }, data: { kind: 'option', label: 'Go big in one step' } },
  { id: 'goal_1', type: 'goal', position: { x: 0, y: 0 }, data: { kind: 'goal', label: 'Reach £30k MRR' } },
]

const admission = (mode: PermittedAnalysisMode): AnalysisAdmissionV1 => ({
  permitted_analysis_mode: mode,
  reasons: mode === 'comparative_leader'
    ? []
    : [{ field: 'semantic_quality_sufficient',
         message: 'Every confidence-bearing number in this model was estimated by Olumi, not stated by you.' }],
})

/** `separated: false` ties the arms, so Q2 refuses while Q1 is untouched. */
function setStore(opts: { separated: boolean; admission?: AnalysisAdmissionV1 }) {
  const mk = (win: number, mean: number) => ({
    confidence: 0.5, win_probability: win, expected: mean,
    outcome: { mean, p10: mean - 0.2, p50: mean, p90: mean + 0.2 },
  })
  useCanvasStore.setState({
    results: {
      status: 'complete', progress: 100,
      report: {
        option_probabilities: opts.separated
          ? { [OPT_HEDGE]: mk(0.78, 0.62), [OPT_BOLD]: mk(0.22, 0.41) }
          : { [OPT_HEDGE]: mk(0.50, 0.50), [OPT_BOLD]: mk(0.50, 0.50) },
        // ⚠ THE PRODUCER SIGNAL IS REQUIRED, AND OMITTING IT MADE EVERY ARM
        // VACUOUS. `deriveDecisionVerdict` deleted its residual "band the win
        // probabilities myself" fallback: with no `near_tie` and no
        // `headline_banded`, the verdict is NO CLAIM however wide the gap. A
        // first draft of this harness set only `option_probabilities`, so Q2
        // was false in EVERY arm and B/C/D would all have "passed" while
        // testing nothing. The precondition assertion in each arm is what
        // caught it — which is exactly why it is there.
        robustness: {
          near_tie: {
            is_tie: !opts.separated,
            top_option_id: OPT_HEDGE,
            second_option_id: OPT_BOLD,
            gap: opts.separated ? 0.56 : 0.0,
            threshold: 0.1,
          },
        },
      },
    } as never,
    runMeta: {} as never,
    nodes: NODES as never,
    edges: [],
    hasCompletedFirstRun: true,
    rawV2Response: null,
    ceeAnalysisReady: (opts.admission
      ? { status: 'ready', options: [], goal_node_id: 'goal_1', analysis_admission: opts.admission }
      : null) as never,
  } as never)
}

function render() {
  const r = renderHook(() => useResultsSectionData())
  // HARNESS PRECONDITION — the ID-space trap. If the hook built no options, every
  // assertion below is about an empty view model rather than about admission.
  expect(
    r.result.current.recommendation?.allOptions?.length,
    'harness precondition: the hook must build both options, or the ID space did not line up',
  ).toBe(2)
  return r.result.current.recommendation
}

describe('permitted_analysis_mode gates leader designation — the two questions, composed', () => {
  beforeEach(() => {
    useCanvasStore.setState({ results: null, nodes: [], edges: [], ceeAnalysisReady: null } as never)
  })

  it('ARM A — no admission key at all: today’s behaviour, byte for byte', () => {
    setStore({ separated: true })
    const rec = render()
    // The producer has not spoken. The result separated the arms, so the leader
    // stands exactly as it did before this consumer existed.
    expect(rec?.verdict?.hasLeadingOption, 'Q2 must be TRUE, or arms B and D prove nothing').toBe(true)
    expect(rec?.leaderDesignationPermitted).toBe(true)
    expect(rec?.analysisAdmission, 'absence must stay undefined, never coerced to a refusal').toBeUndefined()
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
  /**
   * ⚠ THESE ARMS ASSERT `leaders`, NOT AN INTERNAL FLAG, AND THAT MATTERS.
   * A first draft asserted `hero.designationsWithheld`. It passed, and a mutant
   * even reddened it — but `HeroModel` does not DECLARE that property (it is
   * returned untyped), so the typecheck gate caught an assertion reaching into
   * a shape the type says cannot exist. `leaders` is the typed, user-visible
   * outcome: `Record<HeroLens, string | null>`, nulled when the designation is
   * withheld. Binding to the crown the user actually sees is strictly better
   * than binding to the boolean behind it.
   */
  const heroLeaders = (data: ReturnType<typeof useResultsSectionData>) => {
    const hero = buildHeroModel(data)
    // The union has arms without `leaders`; reaching one of those would make
    // every assertion below vacuous, so it is a hard failure rather than a skip.
    expect('leaders' in hero, 'the hero returned a shape with no `leaders` — arm is vacuous').toBe(true)
    return (hero as Extract<typeof hero, { leaders: unknown }>).leaders
  }

  it('ARM E — the HERO withholds its crown when the model refuses', () => {
    setStore({ separated: true, admission: admission('quantified_provisional') })
    const r = renderHook(() => useResultsSectionData())
    const rec = r.result.current.recommendation
    expect(rec?.allOptions?.length, 'harness precondition').toBe(2)
    // Precondition pinned IN-ARM: Q2 is still true, so a withheld crown below is
    // the MODEL's refusal and not a tied result.
    expect(rec?.verdict?.hasLeadingOption, 'Q2 must still be TRUE, or this arm tests Q2').toBe(true)

    const leaders = heroLeaders(r.result.current)
    expect(Object.values(leaders).filter(Boolean),
      'the hero still crowns an option the model does not license').toEqual([])
  })

  it('ARM F — the HERO still crowns when both permit (ARM E is not vacuous)', () => {
    setStore({ separated: true, admission: admission('comparative_leader') })
    const r = renderHook(() => useResultsSectionData())
    expect(r.result.current.recommendation?.allOptions?.length, 'harness precondition').toBe(2)
    const leaders = heroLeaders(r.result.current)
    // Bound by IDENTITY to the option the fixture separates, not to "some leader".
    expect(Object.values(leaders)).toContain(OPT_HEDGE)
  })

  it('ARM G — the HERO is unchanged when the producer has not spoken', () => {
    setStore({ separated: true })
    const r = renderHook(() => useResultsSectionData())
    expect(r.result.current.recommendation?.allOptions?.length, 'harness precondition').toBe(2)
    expect(Object.values(heroLeaders(r.result.current)),
      'absence must keep today’s behaviour on every surface, not just the hook').toContain(OPT_HEDGE)
  })

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

  it('absence is not a refusal — undefined and null both keep today’s behaviour', () => {
    // The two ways "the producer has not spoken" can reach this predicate. If
    // either were read as a refusal, every legacy payload would lose its leader.
    expect(licensesComparativeLeaderClaim(undefined)).toBe(true)
    expect(licensesComparativeLeaderClaim(null)).toBe(true)
    // …and a PRESENT refusal is distinguishable from absence, by type not sentinel.
    expect(licensesComparativeLeaderClaim(admission('none'))).toBe(false)
  })
})
