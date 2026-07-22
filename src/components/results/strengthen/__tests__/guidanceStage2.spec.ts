/**
 * Stage 2 — the guidance surface consumes the producer signals that went live
 * on the 0.19.0+ wire: the four-value `category`, the producer `action_label`,
 * and the `signal` display line (carried only on the deterministic stale-rerun
 * nudge today, honestly absent elsewhere).
 *
 * RED-first, REAL-path: every fixture is a raw V5 response fed through the live
 * sidecar path (the ADDITIVE_EXTENSIONS_KEY the V5 writer uses) →
 * extractPhase3FromV5Response → toStrengthenPhase3Item → buildRecommendations,
 * so a pin can never pass by hand-shaping an intermediate the real derivation
 * would never produce (this repo's dominant defect class).
 *
 * Stage 1 already carried priority_rank/category/signal_code verbatim on the
 * DERIVED guidance item (see producerGuidancePriority.spec.ts). Stage 2 adds:
 *  - `action_label` + the producer `signal` line ride through the derived item
 *    AND the strengthen mapper — Stage 1 dropped action_label at
 *    toStrengthenPhase3Item (`actionLabel: undefined`) and never read `signal`;
 *  - the engine orders promoted phase-3 guidance SEVERITY-major: `category`
 *    dominates `priority_rank`, stable within a category by ascending rank.
 *
 * Location: OUTSIDE src/v5/** (the CI-tsc widening trap), matching the sibling
 * UI-SEM-085 specs, though it exercises the v5 extractor.
 */
import { describe, expect, it } from 'vitest'
import type { OlumiResponse } from '@talchain/schemas/boundary'
import {
  ADDITIVE_EXTENSIONS_KEY,
  type OlumiResponseWithExtensions,
} from '../../../../v5/responseParser'
import { extractPhase3FromV5Response } from '../../../../v5/extractPhase3FromV5Response'
import { buildRecommendations, toStrengthenPhase3Item } from '../buildRecommendations'
import type { StrengthenInputs } from '../strengthenTypes'

const extract = (blocks: Array<Record<string, unknown>>) => {
  const response = {
    response_version: 2,
    assistant_text: '',
    blocks: [],
    suggested_actions: [],
    insights: [],
    stage_indicator: 'analyse',
  } as unknown as OlumiResponse
  Object.defineProperty(response, ADDITIVE_EXTENSIONS_KEY, {
    value: Object.freeze({ phase3_blocks: blocks }),
    enumerable: false,
    writable: false,
    configurable: false,
  })
  return extractPhase3FromV5Response(response as OlumiResponseWithExtensions)
}

const coachingBlock = (over: Record<string, unknown>): Record<string, unknown> => ({
  type: 'coaching',
  ...over,
})

const baseInputs: StrengthenInputs = {
  goalThreshold: 62,
  analysisComplete: true,
  fragileEdges: [],
  factors: [],
  robustness: { status: null, level: null },
  biasFindingTypes: [],
  phase3Items: [],
}

const wireToInputs = (blocks: Array<Record<string, unknown>>): StrengthenInputs => ({
  ...baseInputs,
  phase3Items: extract(blocks).guidanceItems.map(toStrengthenPhase3Item),
})

const phase3Ids = (input: StrengthenInputs): string[] =>
  buildRecommendations(input)
    .filter((r) => r.id.startsWith('strengthen:phase3:'))
    .sort((a, b) => a.priority - b.priority)
    .map((r) => r.id)

// ─── action_label passthrough (was dropped at the strengthen seam) ──────────

describe('Stage 2 — producer action_label rides through, verbatim', () => {
  it('deriveGuidance surfaces action_label; an omitted one stays absent', () => {
    const items = extract([
      coachingBlock({ block_id: 'c-1', title: 'Confirm the assumption', action_label: 'Confirm this assumption' }),
      coachingBlock({ block_id: 'c-2', title: 'No label' }),
    ]).guidanceItems
    expect(items[0].actionLabel).toBe('Confirm this assumption')
    expect(items[1].actionLabel).toBeUndefined()
  })

  it('the strengthen mapper carries action_label (Stage 1 hardcoded it undefined)', () => {
    const item = extract([
      coachingBlock({ block_id: 'c-1', title: 'Confirm', action_label: 'Confirm this assumption' }),
    ]).guidanceItems.map(toStrengthenPhase3Item)[0]
    expect(item.actionLabel).toBe('Confirm this assumption')
  })

  it('the promoted rec renders the producer action_label as its CTA and its tip', () => {
    const rec = buildRecommendations(
      wireToInputs([
        coachingBlock({ block_id: 'c-1', title: 'Confirm', action_label: 'Confirm this assumption', priority_rank: 101 }),
      ]),
    ).find((r) => r.id === 'strengthen:phase3:c-1')!
    expect(rec.action.label).toBe('Confirm this assumption')
    expect(rec.tryThis).toBe('Confirm this assumption')
  })

  it('with no action_label the rec keeps its honest boilerplate CTA', () => {
    const rec = buildRecommendations(
      wireToInputs([coachingBlock({ block_id: 'c-1', title: 'Unlabelled', priority_rank: 101 })]),
    ).find((r) => r.id === 'strengthen:phase3:c-1')!
    expect(rec.action.label).toBe('Work through with Olumi')
  })
})

// ─── signal display line passthrough (deterministic stale-rerun nudge) ──────

describe('Stage 2 — producer `signal` display line renders verbatim where present', () => {
  it('deriveGuidance surfaces the producer signal line; an omitted one stays absent', () => {
    const items = extract([
      coachingBlock({ block_id: 'c-1', title: 'Refresh', signal: 'Re-run the analysis to refresh the insights.' }),
      coachingBlock({ block_id: 'c-2', title: 'No signal' }),
    ]).guidanceItems
    expect(items[0].signal).toBe('Re-run the analysis to refresh the insights.')
    expect(items[1].signal).toBeUndefined()
  })

  it('the promoted rec shows the producer signal verbatim, preferred over the body', () => {
    const rec = buildRecommendations(
      wireToInputs([
        coachingBlock({
          block_id: 'c-1',
          title: 'Stale',
          signal: 'Re-run the analysis to refresh the insights.',
          body: 'Some longer supporting body.',
          priority_rank: 101,
        }),
      ]),
    ).find((r) => r.id === 'strengthen:phase3:c-1')!
    expect(rec.signal).toBe('Re-run the analysis to refresh the insights.')
  })

  it('falls back to the body when the producer sent no signal line (Stage 1 behaviour intact)', () => {
    const rec = buildRecommendations(
      wireToInputs([
        coachingBlock({ block_id: 'c-1', title: 'Body only', body: 'Only a body here.', priority_rank: 101 }),
      ]),
    ).find((r) => r.id === 'strengthen:phase3:c-1')!
    expect(rec.signal).toBe('Only a body here.')
  })
})

// ─── severity-major ordering (category dominates priority_rank) ─────────────

describe('Stage 2 — guidance orders SEVERITY-major (category dominates rank)', () => {
  it('must_fix precedes should_fix even when must_fix carries a HIGHER (later) rank', () => {
    // Both wire order and ascending rank favour should_fix; only category-major
    // ordering puts must_fix first. Mutation: drop the category comparator →
    // reverts to ascending rank → should_fix first → RED.
    const ids = phase3Ids(
      wireToInputs([
        coachingBlock({ block_id: 'sf', title: 'Should fix', category: 'should_fix', priority_rank: 71 }),
        coachingBlock({ block_id: 'mf', title: 'Must fix', category: 'must_fix', priority_rank: 150 }),
      ]),
    )
    expect(ids).toEqual(['strengthen:phase3:mf', 'strengthen:phase3:sf'])
  })

  it('the full four-value ladder orders must_fix, should_fix, could_fix, technique', () => {
    // Ranks deliberately CONTRADICT the intended order — only category wins.
    const ids = phase3Ids(
      wireToInputs([
        coachingBlock({ block_id: 'tech', title: 'T', category: 'technique', priority_rank: 12 }),
        coachingBlock({ block_id: 'cf', title: 'C', category: 'could_fix', priority_rank: 13 }),
        coachingBlock({ block_id: 'mf', title: 'M', category: 'must_fix', priority_rank: 14 }),
        coachingBlock({ block_id: 'sf', title: 'S', category: 'should_fix', priority_rank: 15 }),
      ]),
    )
    expect(ids).toEqual([
      'strengthen:phase3:mf',
      'strengthen:phase3:sf',
      'strengthen:phase3:cf',
      'strengthen:phase3:tech',
    ])
  })

  it('within one category, ascending producer rank still decides (stable, verbatim)', () => {
    const ids = phase3Ids(
      wireToInputs([
        coachingBlock({ block_id: 'a', title: 'A', category: 'must_fix', priority_rank: 150 }),
        coachingBlock({ block_id: 'b', title: 'B', category: 'must_fix', priority_rank: 101 }),
      ]),
    )
    expect(ids).toEqual(['strengthen:phase3:b', 'strengthen:phase3:a'])
  })
})
