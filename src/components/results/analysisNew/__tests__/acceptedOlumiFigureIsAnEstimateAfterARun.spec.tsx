/**
 * ⭐ AFTER A RUN, OLUMI'S ACCEPTED FIGURE IS STILL AN ESTIMATE — never "not estimated" (the user's own) (52f8cd; the
 * named morning row of DGAI #2377/#2380, AIQ census 5922532335).
 *
 * The drivers oracle (`driverValueProvenance`) classified the run's own `value_source` string. For the approved
 * adoption that string is the bare `user_assumption`, which alone means the user's own declared guess, so an
 * adopted Olumi figure read `not_estimated` on the Reasoning glance and the hero's `est.` tag. The hooks now build the
 * accepted ids (`buildAcceptedNodeIds`, the same `isAcceptedOlumiFigure` rule as the card) beside the source map.
 */
import { describe, expect, it } from 'vitest'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { buildAcceptedNodeIds, buildNodeValueSourceMap, driverValueProvenance } from '../../driverValueProvenance'
import { makeData, makeDriver } from './analysisNewFixtures'
import { buildHeroModel } from '../../analysis-hero/buildHeroModel'
import { makeHeroData } from '../../analysis-hero/__fixtures__/hero.fixtures'
import type { HeroChartModel } from '../../analysis-hero/heroTypes'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'

const AT = '2026-10-01T00:38:30.155Z'
/** Canvas nodes as the store holds them: the served adopted pair (guest `9cec5206`) and the user's own bare literal. */
const ADOPTED = { id: 'warm', data: { observedState: { value: 0.04, raw_value: 2, source: 'user_assumption', reviewed_by_user: { intent: 'confirm', at: AT } } } }
const BARE = { id: 'brief', data: { observedState: { value: 0.3, raw_value: 30, source: 'user_assumption' } } }

const glance = (nodes: unknown[], runSource: string) => {
  const data = makeData({ drivers: { drivers: nodes.map((n) => makeDriver({ factorKey: (n as { id: string }).id, factorLabel: (n as { id: string }).id, valueSource: runSource } as never)) } })
  return buildAnalysisNewViewModel({
    data, recommendations: [], isPreRun: false, isRunning: false, isStale: false,
    nodeValueSources: buildNodeValueSourceMap(nodes), acceptedValueIds: buildAcceptedNodeIds(nodes),
  }).atAGlance.inputProvenance
}

describe('the drivers oracle', () => {
  it('accepted ids come from the whole observed state — never the bare literal', () => {
    expect([...buildAcceptedNodeIds([ADOPTED, BARE])]).toEqual(['warm'])
  })

  it('RED: the run consumed the adopted pair’s `user_assumption` → estimated', () => {
    expect(driverValueProvenance({ factorKey: 'warm', valueSource: 'user_assumption' } as never, undefined, new Set(['warm']))).toBe('estimated')
  })

  it('NEGATIVE: the user’s own bare assumption stays not_estimated (theirs)', () => {
    expect(driverValueProvenance({ factorKey: 'brief', valueSource: 'user_assumption' } as never, undefined, new Set(['warm']))).toBe('not_estimated')
  })

  it('NEGATIVE: a run that consumed the user’s later typed figure is never re-labelled an estimate', () => {
    expect(driverValueProvenance({ factorKey: 'warm', valueSource: 'user_override' } as never, undefined, new Set(['warm']))).toBe('not_estimated')
  })
})

describe('the Reasoning glance, through the real view model', () => {
  it('RED: a run whose only input is Olumi’s accepted figure reads "estimated", not "user supplied"', () => {
    expect(glance([ADOPTED], 'user_assumption')).toBe('estimated')
  })

  it('CONTRAST: the same run over the user’s own assumption reads "user supplied"', () => {
    expect(glance([BARE], 'user_assumption')).toBe('user_supplied')
  })
})

describe('the hero\u2019s est. tag, through the real builder', () => {
  const heroDriver = (key: string) => ({ factorKey: key, factorLabel: key, rawElasticity: 0.8, normalisedInfluence: 1, rank: 1,
    semanticLabel: 'strongest', canFocus: false, displayInfluence: 1, displayProvenance: 'influence_score', valueSource: 'user_assumption' }) as never
  const tag = (nodes: Array<{ id: string }>) => {
    const drivers = nodes.map((n) => heroDriver(n.id))
    const data = { ...makeHeroData({ drivers: { drivers, topDrivers: drivers } }) } as ResultsSectionDataReturn
    const m = buildHeroModel(data, undefined, undefined, buildNodeValueSourceMap(nodes), undefined, undefined, buildAcceptedNodeIds(nodes))
    expect(m.kind, 'fixture must produce a chart model').toBe('chart')
    return (m as HeroChartModel).evidence.drivers.map((d) => d.isEstimate)
  }

  it('RED: Olumi\u2019s accepted figure carries the estimate tag; the user\u2019s own assumption does not', () => {
    expect(tag([ADOPTED])).toEqual(['estimated'])
    expect(tag([BARE])).toEqual(['not_estimated'])
  })
})
