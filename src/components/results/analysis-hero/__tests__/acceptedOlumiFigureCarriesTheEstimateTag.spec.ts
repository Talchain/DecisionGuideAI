/**
 * ⭐ THE HERO'S `est.` TAG: Olumi's figure the user accepted is still an estimate, on the Run that consumed it (52f8cd).
 * The glance and oracle rows are `analysisNew/__tests__/acceptedOlumiFigureIsAnEstimateAfterARun.spec.tsx`; these are
 * the hero's, through the real `buildHeroModel`, including the two contrasts of CODEX UI BUDDY CR 5923625039.
 */
import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useCanvasStore } from '@/canvas/store'
import { useAnalysisHero } from '../useAnalysisHero'
import { buildAcceptedNodeIds, buildNodeValueSourceMap, type AcceptedFigureBinding } from '../../driverValueProvenance'
import { buildHeroModel } from '../buildHeroModel'
import { makeHeroData } from '../__fixtures__/hero.fixtures'
import type { HeroChartModel } from '../heroTypes'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'

const AT = '2026-10-01T00:38:30.155Z'
const ADOPTED = { id: 'warm', data: { observedState: { value: 0.04, raw_value: 2, source: 'user_assumption', reviewed_by_user: { intent: 'confirm', at: AT } } } }
const BARE = { id: 'brief', data: { observedState: { value: 0.3, raw_value: 30, source: 'user_assumption' } } }
const REPLACED = { id: 'warm', data: { observedState: { value: 0.05, raw_value: 5, source: 'user_override' } } }
const bind = (nodes: unknown[], runIsCurrent: boolean): AcceptedFigureBinding => ({ ids: buildAcceptedNodeIds(nodes), runIsCurrent })

describe('the hero\u2019s est. tag, through the real builder', () => {
  const heroDriver = (key: string) => ({ factorKey: key, factorLabel: key, rawElasticity: 0.8, normalisedInfluence: 1, rank: 1,
    semanticLabel: 'strongest', canFocus: false, displayInfluence: 1, displayProvenance: 'influence_score', valueSource: 'user_assumption' }) as never
  const tag = (nodes: Array<{ id: string }>, runIsCurrent = true) => {
    const drivers = nodes.map((n) => heroDriver(n.id))
    const data = { ...makeHeroData({ drivers: { drivers, topDrivers: drivers } }) } as ResultsSectionDataReturn
    const m = buildHeroModel(data, undefined, undefined, buildNodeValueSourceMap(nodes), undefined, undefined, bind(nodes, runIsCurrent))
    expect(m.kind, 'fixture must produce a chart model').toBe('chart')
    return (m as HeroChartModel).evidence.drivers.map((d) => d.isEstimate)
  }

  it('RED: Olumi\u2019s accepted figure carries the estimate tag; the user\u2019s own assumption does not', () => {
    expect(tag([ADOPTED])).toEqual(['estimated'])
    expect(tag([BARE])).toEqual(['not_estimated'])
  })

  it('⛔ CR CONTRASTS through the real hero builder: an OLDER Run claims neither side', () => {
    expect(tag([ADOPTED], false)).toEqual(['undetermined'])
    expect(tag([REPLACED], false)).toEqual(['undetermined'])
  })
})

describe('the hook binds the live acceptance to the store’s own currency verdict (useAnalysisResultsAreCurrent)', () => {
  const heroDriver = { factorKey: 'warm', factorLabel: 'warm', rawElasticity: 0.8, normalisedInfluence: 1, rank: 1,
    semanticLabel: 'strongest', canFocus: false, displayInfluence: 1, displayProvenance: 'influence_score', valueSource: 'user_assumption' } as never
  const data = { ...makeHeroData({ drivers: { drivers: [heroDriver], topDrivers: [heroDriver] } }) } as ResultsSectionDataReturn
  const tagWith = (analysisFreshness: unknown) => {
    useCanvasStore.setState({ nodes: [ADOPTED] as never, analysisFreshness, analysisFreshnessDirty: false, importPendingServerRegistration: false, analysisStateV1: null } as never)
    const m = renderHook(() => useAnalysisHero(data)).result.current.model
    expect(m.kind, 'fixture must produce a chart model').toBe('chart')
    return (m as HeroChartModel).evidence.drivers.map((d) => d.isEstimate)
  }

  it('RED: an affirmatively current Run → Olumi’s accepted figure carries the estimate tag', () => {
    expect(tagWith({ freshness: 'fresh', freshnessReason: 'graph_hash_match' })).toEqual(['estimated'])
  })

  it('⛔ CR: a stale Run → the two-writer stamp claims neither side', () => {
    expect(tagWith({ freshness: 'stale', freshnessReason: 'graph_hash_mismatch' })).toEqual(['undetermined'])
  })
})
