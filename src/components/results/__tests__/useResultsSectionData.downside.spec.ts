/**
 * ROADMAP 2.449 — the report→view-model seam for the DOWNSIDE / tail-risk block.
 *
 * WHY THIS SEAM NEEDS ITS OWN SUITE, and it is not the plumbing. `cvar_10` and
 * `p05` are declared by the producer to be in the SAME units and on the SAME
 * axis as `outcome.mean`/`p10`, with no normalisation of their own. This hook
 * DENORMALISES the percentile family by a per-option scale (`goalThresholdCap`
 * when the run is on model scale). A tail that skipped that scale — or took a
 * different one — would be plotted against a different ruler than the range it
 * is the tail OF, and "the worst decile sits at or below p10" would stop being
 * true ON SCREEN while remaining true in the data. That is a display defect
 * that reads as a science defect, and no amount of plumbing coverage catches
 * it.
 *
 * The scale arms below are therefore written as a DISCRIMINATING PAIR: the
 * same downside block is driven through a scaled run and an unscaled run, and
 * the tail is asserted to move exactly with `outcome.p10` in both. A test that
 * only ever ran at scale 1 would agree with a hook that applied no scale at
 * all (trap 13b — a guard agreeing with itself).
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useResultsSectionData } from '../useResultsSectionData'
import { useCanvasStore } from '../../../canvas/store'

const OPT_HEDGE = 'opt_hedge'
const OPT_BOLD = 'opt_bold'

const NODES = [
  { id: OPT_HEDGE, type: 'option', position: { x: 0, y: 0 }, data: { kind: 'option', label: 'Hedge and stage the rollout' } },
  { id: OPT_BOLD, type: 'option', position: { x: 0, y: 0 }, data: { kind: 'option', label: 'Go big in one step' } },
]

/** Goal node carrying an explicit cap, which is what turns denormalisation on. */
function goalNode(cap: number | null) {
  return {
    id: 'goal',
    type: 'goal',
    position: { x: 0, y: 0 },
    data: {
      kind: 'goal',
      label: 'Programme value',
      ...(cap !== null ? { goal_threshold_cap: cap } : {}),
    },
  }
}

type Downside = { cvar_10: number; p05: number; expected_regret: number }

/**
 * Drive the hook from a V5-shaped report. Values are on MODEL scale (0–1) so
 * the hook's `alreadyDenormalized` heuristic (any |value| > 2) does not fire
 * and the cap is genuinely applied — otherwise the "scaled" arm would silently
 * be a second copy of the unscaled arm.
 */
function setStore(opts: {
  cap: number | null
  downsideByOption: Partial<Record<string, Downside>>
}) {
  const mk = (id: string, mean: number, downside?: Downside) => ({
    confidence: 0.5,
    win_probability: id === OPT_HEDGE ? 0.65 : 0.35,
    expected: mean,
    outcome: { mean, p10: mean - 0.2, p50: mean, p90: mean + 0.2 },
    ...(downside !== undefined ? { downside } : {}),
  })

  useCanvasStore.setState({
    results: {
      status: 'complete',
      progress: 100,
      report: {
        option_probabilities: {
          [OPT_HEDGE]: mk(OPT_HEDGE, 0.62, opts.downsideByOption[OPT_HEDGE]),
          [OPT_BOLD]: mk(OPT_BOLD, 0.41, opts.downsideByOption[OPT_BOLD]),
        },
      },
    } as never,
    runMeta: {} as never,
    nodes: [...NODES, goalNode(opts.cap)] as never,
    edges: [],
    hasCompletedFirstRun: true,
    rawV2Response: null,
  } as never)
}

function optionById(
  result: ReturnType<typeof renderHook<ReturnType<typeof useResultsSectionData>, unknown>>,
  id: string,
) {
  const opts = result.result.current.recommendation?.allOptions ?? []
  // HARNESS PRECONDITION. Without this, a store shape the hook cannot read
  // would produce an empty option list and every assertion below would fail
  // for a reason that has nothing to do with the code under test — a RED that
  // comes from the harness rather than from the defect is worth no more than a
  // GREEN that comes from a vacuous assertion.
  expect(opts.length, 'harness precondition: the hook must build both options').toBe(2)
  const found = opts.find((o) => o.id === id)
  expect(found, `option ${id} must be in the view model`).toBeDefined()
  return found!
}

const HEDGE_DOWNSIDE: Downside = { cvar_10: 0.21, p05: 0.29, expected_regret: 0.04 }
const BOLD_DOWNSIDE: Downside = { cvar_10: -0.37, p05: -0.18, expected_regret: 0.19 }

describe('2.449 — downside/tail-risk at the report→view-model seam', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      results: null,
      rawV2Response: null,
      nodes: [],
      edges: [],
      hasCompletedFirstRun: false,
    } as never)
  })

  it('exposes EACH option its OWN tail block on OptionResult', () => {
    setStore({ cap: null, downsideByOption: { [OPT_HEDGE]: HEDGE_DOWNSIDE, [OPT_BOLD]: BOLD_DOWNSIDE } })
    const r = renderHook(() => useResultsSectionData())

    // Bound by id; the two fixtures differ so neither assertion can be
    // satisfied by the other option's block.
    expect(optionById(r, OPT_HEDGE).downside).toEqual({ cvar10: 0.21, p05: 0.29, expectedRegret: 0.04 })
    expect(optionById(r, OPT_BOLD).downside).toEqual({ cvar10: -0.37, p05: -0.18, expectedRegret: 0.19 })
  })

  it('POSITIVE CONTROL — present on one option and absent on its sibling, same render', () => {
    setStore({ cap: null, downsideByOption: { [OPT_HEDGE]: HEDGE_DOWNSIDE } })
    const r = renderHook(() => useResultsSectionData())

    // PRESENT arm — the harness can see a block arrive.
    expect(optionById(r, OPT_HEDGE).downside).toBeDefined()
    // ABSENT arm — and can see one NOT arrive, on an option that is otherwise
    // fully built (it still has its outcome and win probability).
    const bold = optionById(r, OPT_BOLD)
    expect(bold.downside).toBeUndefined()
    expect(bold, 'precondition: the absent-arm option is otherwise populated').toHaveProperty('outcome')
    expect(bold.outcome.p10).not.toBeNull()
  })

  // =========================================================================
  // THE SCALE SEAM — a discriminating pair
  // =========================================================================

  it('UNSCALED RUN: the tail sits on the same axis as p10, untouched', () => {
    setStore({ cap: null, downsideByOption: { [OPT_HEDGE]: HEDGE_DOWNSIDE } })
    const hedge = optionById(renderHook(() => useResultsSectionData()), OPT_HEDGE)

    // Precondition: no cap ⇒ scale 1 ⇒ p10 is the raw model value.
    expect(hedge.outcome.p10).toBeCloseTo(0.42, 6)
    expect(hedge.downside?.cvar10).toBeCloseTo(0.21, 6)
    expect(hedge.downside?.p05).toBeCloseTo(0.29, 6)
  })

  it('SCALED RUN: the tail moves by the SAME factor as p10 — same ruler, one decision', () => {
    const CAP = 250_000
    setStore({ cap: CAP, downsideByOption: { [OPT_HEDGE]: HEDGE_DOWNSIDE } })
    const hedge = optionById(renderHook(() => useResultsSectionData()), OPT_HEDGE)

    // PRECONDITION PIN: denormalisation actually fired on this run. Without
    // this the two arms would be indistinguishable and the whole pair vacuous.
    expect(hedge.outcome.p10).toBeCloseTo(0.42 * CAP, 3)

    expect(hedge.downside?.cvar10).toBeCloseTo(0.21 * CAP, 3)
    expect(hedge.downside?.p05).toBeCloseTo(0.29 * CAP, 3)

    // The relationship the reader depends on survives the scaling: the mean of
    // the worst decile sits at or below the tenth-percentile boundary.
    expect(hedge.downside!.cvar10).toBeLessThanOrEqual(hedge.outcome.p10!)
    // And the ratio is EXACTLY the ratio in the source data — i.e. one scale
    // decision was applied to both, not two independent ones.
    expect(hedge.downside!.cvar10 / hedge.outcome.p10!).toBeCloseTo(0.21 / 0.42, 6)
  })

  it('carries a GENUINE zero through the scale — a measured 0 is not an absence', () => {
    const winner: Downside = { cvar_10: 0.55, p05: 0.58, expected_regret: 0 }
    setStore({ cap: 250_000, downsideByOption: { [OPT_HEDGE]: winner } })
    const hedge = optionById(renderHook(() => useResultsSectionData()), OPT_HEDGE)
    expect(hedge.downside).toBeDefined()
    expect(hedge.downside!.expectedRegret).toBe(0)
  })
})
