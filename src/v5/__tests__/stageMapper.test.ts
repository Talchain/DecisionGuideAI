import { describe, it, expect } from 'vitest'
import { Stage } from '@talchain/schemas/boundary'
import { scenarioStageToV5Stage, deriveV5Stage, v5StageToScenarioStage } from '../stageMapper'

describe('scenarioStageToV5Stage', () => {
  it.each([
    ['frame', 'frame'],
    ['ideate', 'frame'],
    ['evaluate', 'analyse'],
    ['decide', 'decide'],
    ['optimise', 'review'],
  ] as const)('maps %s → %s', (input, expected) => {
    expect(scenarioStageToV5Stage(input)).toBe(expected)
  })

  it('defaults unknown / null / undefined to frame', () => {
    expect(scenarioStageToV5Stage(null)).toBe('frame')
    expect(scenarioStageToV5Stage(undefined)).toBe('frame')
    // @ts-expect-error — intentionally invalid
    expect(scenarioStageToV5Stage('mystery')).toBe('frame')
  })
})

describe('deriveV5Stage', () => {
  it('trusts stored currentStage when consistent with graph state', () => {
    expect(
      deriveV5Stage({ currentStage: 'decide', hasNodes: true, isAnalysisComplete: true }),
    ).toBe('decide')
  })

  it('falls back to analyse when analysis is complete and store not trusted', () => {
    expect(
      deriveV5Stage({ currentStage: 'frame', hasNodes: true, isAnalysisComplete: true }),
    ).toBe('analyse')
  })

  it('falls back to frame when no analysis and no nodes', () => {
    expect(
      deriveV5Stage({ currentStage: null, hasNodes: false, isAnalysisComplete: false }),
    ).toBe('frame')
  })

  it('falls back to frame when nodes present but analysis not complete', () => {
    expect(
      deriveV5Stage({ currentStage: null, hasNodes: true, isAnalysisComplete: false }),
    ).toBe('frame')
  })

  it('rejects inconsistent stored stage: frame with nodes', () => {
    // Store says frame but graph is populated → derive instead.
    expect(
      deriveV5Stage({ currentStage: 'frame', hasNodes: true, isAnalysisComplete: false }),
    ).toBe('frame') // derived value happens to match here
  })

  it('rejects inconsistent stored stage: ideate with analysis complete', () => {
    expect(
      deriveV5Stage({ currentStage: 'ideate', hasNodes: true, isAnalysisComplete: true }),
    ).toBe('analyse') // derived because stored stage is stale
  })

  it('stores mapped correctly to V5: evaluate → analyse', () => {
    expect(
      deriveV5Stage({ currentStage: 'evaluate', hasNodes: true, isAnalysisComplete: true }),
    ).toBe('analyse')
  })

  it('stores mapped correctly to V5: optimise → review', () => {
    expect(
      deriveV5Stage({ currentStage: 'optimise', hasNodes: true, isAnalysisComplete: true }),
    ).toBe('review')
  })
})

describe('v5StageToScenarioStage — inverse mapping', () => {
  it.each([
    ['frame', 'frame'],
    ['analyse', 'evaluate'],
    ['decide', 'decide'],
    ['review', 'optimise'],
  ] as const)('%s → %s', (input, expected) => {
    expect(v5StageToScenarioStage(input)).toBe(expected)
  })

  // The canonical wire vocabulary is exactly frame|analyse|decide|review
  // (schemas 0.19.0 `Stage`). Anything else — a future member, or a UI/DB
  // `ScenarioStage` value mistaken for a wire value — must fail CLOSED to
  // null ("no stage signal"), never leak undefined into the canvas store.
  it.each(['ideate', 'evaluate', 'optimise', 'analyze', ''] as const)(
    'fails closed to null for non-canonical %j',
    (input) => {
      expect(v5StageToScenarioStage(input as never)).toBeNull()
    },
  )

  // Derived from the vendored enum rather than a hand-listed mirror, so a
  // future member added in schemas surfaces here instead of drifting silently.
  it('covers exactly the canonical Stage vocabulary', () => {
    expect([...Stage.options].sort()).toEqual(
      ['analyse', 'decide', 'frame', 'review'],
    )
    for (const member of Stage.options) {
      expect(v5StageToScenarioStage(member)).not.toBeNull()
    }
  })
})
