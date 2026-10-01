/**
 * ⭐ AFTER A RUN, OLUMI'S ACCEPTED FIGURE IS STILL AN ESTIMATE — never "not estimated" (the user's own) (52f8cd; the
 * named morning row of DGAI #2377/#2380, AIQ census 5922532335).
 *
 * The drivers oracle (`driverValueProvenance`) classified the run's own `value_source` string. For the approved
 * adoption that string is the bare `user_assumption`, which alone means the user's own declared guess, so an
 * adopted Olumi figure read `not_estimated` on the Reasoning glance and the hero's `est.` tag. The hooks now build the
 * accepted ids (`buildAcceptedNodeIds`, the same `isAcceptedOlumiFigure` rule as the card) beside the source map.
 *
 * ⛔ BOUND TO THE DISPLAYED RUN (CODEX UI BUDDY CR 5923625039). The stamp has two writers, and the live node only
 * describes the Run that consumed it — the current one. Two contrasts the CR named, through the real consumers:
 *   · an OLDER human-assumption Run, with a newer acceptance on the live node → never `estimated`;
 *   · an OLDER accepted-figure Run, with a later human replacement on the live node → never `not_estimated`.
 * Both read `undetermined`: the Run's own fact is absent, so neither side is claimed.
 */
import { describe, expect, it } from 'vitest'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { buildAcceptedNodeIds, buildNodeValueSourceMap, driverValueProvenance, type AcceptedFigureBinding } from '../../driverValueProvenance'
import { makeData, makeDriver } from './analysisNewFixtures'

const AT = '2026-10-01T00:38:30.155Z'
/** Canvas nodes as the store holds them: the served adopted pair (guest `9cec5206`) and the user's own bare literal. */
const ADOPTED = { id: 'warm', data: { observedState: { value: 0.04, raw_value: 2, source: 'user_assumption', reviewed_by_user: { intent: 'confirm', at: AT } } } }
const BARE = { id: 'brief', data: { observedState: { value: 0.3, raw_value: 30, source: 'user_assumption' } } }
/** The same node after a later HUMAN replacement of the accepted figure. */
const REPLACED = { id: 'warm', data: { observedState: { value: 0.05, raw_value: 5, source: 'user_override' } } }
/** The same node id holding the human's own bare assumption (before any acceptance). */
const WARM_BARE = { id: 'warm', data: { observedState: { value: 0.04, raw_value: 2, source: 'user_assumption' } } }

const bind = (nodes: unknown[], runIsCurrent: boolean): AcceptedFigureBinding => ({ ids: buildAcceptedNodeIds(nodes), runIsCurrent })
const CURRENT_WARM: AcceptedFigureBinding = { ids: new Set(['warm']), runIsCurrent: true }

const glance = (nodes: unknown[], runSource: string, runIsCurrent = true) => {
  const data = makeData({ drivers: { drivers: nodes.map((n) => makeDriver({ factorKey: (n as { id: string }).id, factorLabel: (n as { id: string }).id, valueSource: runSource } as never)) } })
  return buildAnalysisNewViewModel({
    data, recommendations: [], isPreRun: false, isRunning: false, isStale: false,
    nodeValueSources: buildNodeValueSourceMap(nodes), acceptedFigures: bind(nodes, runIsCurrent),
  }).atAGlance.inputProvenance
}

describe('the drivers oracle', () => {
  it('accepted ids come from the whole observed state — never the bare literal', () => {
    expect([...buildAcceptedNodeIds([ADOPTED, BARE])]).toEqual(['warm'])
  })

  it('RED: the run consumed the adopted pair’s `user_assumption` → estimated', () => {
    expect(driverValueProvenance({ factorKey: 'warm', valueSource: 'user_assumption' } as never, undefined, CURRENT_WARM)).toBe('estimated')
  })

  it('NEGATIVE: the user’s own bare assumption stays not_estimated (theirs)', () => {
    expect(driverValueProvenance({ factorKey: 'brief', valueSource: 'user_assumption' } as never, undefined, CURRENT_WARM)).toBe('not_estimated')
  })

  it('NEGATIVE: a run that consumed the user’s later typed figure is never re-labelled an estimate', () => {
    expect(driverValueProvenance({ factorKey: 'warm', valueSource: 'user_override' } as never, undefined, CURRENT_WARM)).toBe('not_estimated')
  })

  it('⛔ CR CONTRAST 1: an OLDER human-assumption Run, accepted over later on the live node → undetermined, never estimated', () => {
    const older = { factorKey: 'warm', valueSource: 'user_assumption' } as never
    expect(driverValueProvenance(older, undefined, bind([ADOPTED], false))).toBe('undetermined')
    expect(driverValueProvenance(older, undefined, bind([WARM_BARE], true)), 'CONTROL: current + bare → the user’s').toBe('not_estimated')
  })

  it('⛔ CR CONTRAST 2: an OLDER accepted-figure Run, replaced by the user later → undetermined, never not_estimated', () => {
    expect(driverValueProvenance({ factorKey: 'warm', valueSource: 'user_assumption' } as never, undefined, bind([REPLACED], false))).toBe('undetermined')
  })

  it('CONTROL: without a binding (legacy callers) the stamp classifies as before', () => {
    expect(driverValueProvenance({ factorKey: 'warm', valueSource: 'user_assumption' } as never)).toBe('not_estimated')
  })
})

describe('the Reasoning glance, through the real view model', () => {
  it('RED: a run whose only input is Olumi’s accepted figure reads "estimated", not "user supplied"', () => {
    expect(glance([ADOPTED], 'user_assumption')).toBe('estimated')
  })

  it('CONTRAST: the same run over the user’s own assumption reads "user supplied"', () => {
    expect(glance([BARE], 'user_assumption')).toBe('user_supplied')
  })

  it('⛔ CR CONTRASTS through the real glance: an OLDER Run is undetermined both ways round', () => {
    expect(glance([ADOPTED], 'user_assumption', false), 'older human Run, newer acceptance').toBe('undetermined')
    expect(glance([REPLACED], 'user_assumption', false), 'older accepted Run, later human replacement').toBe('undetermined')
  })
})

// The hero's `est.` tag rows live in `analysis-hero/__tests__/acceptedOlumiFigureCarriesTheEstimateTag.spec.ts`: the
// hero's inertness guard admits importers from its own module only.
