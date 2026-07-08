// Relationship card + edge visual builders — unified ladder boundaries,
// sign precedence, real-signal why-line gate (UI-SEM-074), edge encoding
// bands (UI-SEM-075), structural handling.

import { describe, it, expect } from 'vitest'
import { buildRelationshipCard, buildEdgeVisual, detectStructural } from '../buildRelationshipCard'
import { strengthBandWidth, existenceDashArray, polarityColor, polarityFromSignedMean } from '../../edges/edgeEncoding'
import { WHY_FRAGILE, WHY_FEEDS_LEADER } from '../strings'
import type { AnalysisContextVM } from '../types'

const nodes = [
  { id: 'f1', type: 'factor', data: { label: 'Customer demand' } },
  { id: 'g1', type: 'goal', data: { label: 'Grow revenue' } },
  { id: 'o1', type: 'option', data: { label: 'Open a shop' } },
  { id: 'o2', type: 'option', data: { label: 'Go online' } },
  { id: 'd1', type: 'decision', data: { label: 'How to grow?' } },
]
const nodesById = new Map(nodes.map((n) => [n.id, n]))

const NO_RESULTS: AnalysisContextVM = {
  displayState: 'ready_to_analyse',
  hasResults: false,
  isStaleResult: false,
  leadingOptionId: null,
  leadingOptionLabel: null,
  goalThreshold: null,
}

function withResults(overrides: Partial<AnalysisContextVM> = {}): AnalysisContextVM {
  return {
    displayState: 'complete',
    hasResults: true,
    isStaleResult: false,
    leadingOptionId: null,
    leadingOptionLabel: null,
    goalThreshold: null,
    ...overrides,
  }
}

function makeEdge(data: Record<string, unknown>, id = 'e1', source = 'f1', target = 'g1') {
  return { id, source, target, data }
}

function card(edgeData: Record<string, unknown>, opts: { analysis?: AnalysisContextVM; fragile?: any[]; source?: string; target?: string; prefill?: boolean } = {}) {
  return buildRelationshipCard({
    edge: makeEdge(edgeData, 'e1', opts.source ?? 'f1', opts.target ?? 'g1'),
    nodesById,
    fragileEdges: opts.fragile ?? [],
    analysis: opts.analysis ?? NO_RESULTS,
    prefillChatAvailable: opts.prefill ?? false,
  })
}

describe('sentence + sign precedence', () => {
  it('positive signed mean → strengthens', () => {
    expect(card({ weight: 0.5, direction: 'positive' }).sentence).toBe('Customer demand strengthens Grow revenue')
  })

  it('negative signed mean → weakens', () => {
    expect(card({ weight: 0.5, direction: 'negative' }).sentence).toBe('Customer demand weakens Grow revenue')
  })

  it('pre-signed strength_mean wins over weight+direction (computeSignedMean precedence)', () => {
    const c = card({ strength_mean: -0.6, weight: 0.9, direction: 'positive' })
    expect(c.sentence).toContain('weakens')
    expect(c.strengthValue).toBe(-0.6)
  })
})

describe('unified strength ladder boundaries (0.19/0.20/0.40/0.70)', () => {
  it.each([
    [0.19, 'Slight'],
    [0.2, 'Moderate'],
    [0.39, 'Moderate'],
    [0.4, 'Strong'],
    [0.69, 'Strong'],
    [0.7, 'Very strong'],
  ])('|%f| → %s', (weight, label) => {
    expect(card({ weight, direction: 'positive' }).strengthLabel).toBe(label)
  })
})

describe('confidence words (UI-SEM-010/017 thresholds)', () => {
  it.each([
    [0.85, 'high'],
    [0.7, 'high'],
    [0.69, 'medium'],
    [0.4, 'medium'],
    [0.39, 'low'],
  ])('beliefExists %f → %s', (beliefExists, word) => {
    expect(card({ weight: 0.5, direction: 'positive', beliefExists }).confidenceLabel).toBe(word)
  })

  it('no belief data → null (no invented confidence)', () => {
    expect(card({ weight: 0.5, direction: 'positive' }).confidenceLabel).toBeNull()
  })
})

describe('why-it-matters real-signal gate (UI-SEM-074)', () => {
  const fragileList = [{ edge_id: 'e1', switch_probability: 0.45 }]

  it('omitted entirely with no real signal — no filler', () => {
    const c = card({ weight: 0.9, direction: 'positive' }, { analysis: withResults() })
    expect(c.whyItMatters).toBeNull()
  })

  it('fragile-edge match → could-flip line + Detailed pct', () => {
    const c = card({ weight: 0.5, direction: 'positive' }, { analysis: withResults(), fragile: fragileList })
    expect(c.whyItMatters).toBe(WHY_FRAGILE)
    expect(c.whyIsResultDerived).toBe(true)
    expect(c.whyDetailPct).toBe(45)
  })

  it('fragility requires results — same fragile list pre-analysis yields nothing', () => {
    const c = card({ weight: 0.5, direction: 'positive' }, { analysis: NO_RESULTS, fragile: fragileList })
    expect(c.whyItMatters).toBeNull()
  })

  it('endpoint on the RESOLVED leading option → feeds-leader line', () => {
    const analysis = withResults({ leadingOptionId: 'o1', leadingOptionLabel: 'Open a shop' })
    const c = card({ weight: 0.5, direction: 'positive' }, { analysis, source: 'o1', target: 'g1' })
    expect(c.whyItMatters).toBe(WHY_FEEDS_LEADER)
  })

  it('no feeds-leader line when the leader is unresolved (fail-closed)', () => {
    const c = card({ weight: 0.5, direction: 'positive' }, { analysis: withResults(), source: 'o1', target: 'g1' })
    expect(c.whyItMatters).toBeNull()
  })
})

describe('actions availability', () => {
  it('focus wired; evidence disabled without causal_claims; challenge follows prefill; edit disabled', () => {
    const c = card({ weight: 0.5, direction: 'positive' })
    const byKind = Object.fromEntries(c.actions.map((a) => [a.kind, a]))
    expect(byKind.focus.availability).toBe('wired')
    expect(byKind.evidence.availability).toBe('disabled')
    expect(byKind.challenge.availability).toBe('disabled')
    expect(byKind.edit.availability).toBe('disabled')
    expect(byKind.edit.disabledHint).toBe('Available in the standard canvas')
  })

  it('evidence wired with causal_claims; challenge wired with a registered prefill', () => {
    const c = card(
      { weight: 0.5, direction: 'positive', causal_claims: [{ claim_type: 'evidence', statement: 'Surveys say so.' }] },
      { prefill: true },
    )
    const byKind = Object.fromEntries(c.actions.map((a) => [a.kind, a]))
    expect(byKind.evidence.availability).toBe('wired')
    expect(byKind.challenge.availability).toBe('wired')
    expect(c.evidence).toEqual([{ statement: 'Surveys say so.', source: undefined }])
  })
})

describe('structural edges (StyledEdge detection mirrored)', () => {
  it('decision→option is structural by node kind', () => {
    const result = detectStructural(makeEdge({}, 'e-s', 'd1', 'o1'), nodesById)
    expect(result).toEqual({ isStructural: true, description: 'Option of this decision' })
  })

  it('explicit edge_type structural wins; other explicit types disable inference', () => {
    expect(detectStructural(makeEdge({ edge_type: 'structural' }, 'e-s', 'f1', 'g1'), nodesById).isStructural).toBe(true)
    expect(detectStructural(makeEdge({ edge_type: 'causal' }, 'e-s', 'd1', 'o1'), nodesById).isStructural).toBe(false)
  })

  it('structural card carries no strength/confidence/why claims and no challenge', () => {
    const c = card({}, { source: 'd1', target: 'o1' })
    expect(c.isStructural).toBe(true)
    expect(c.sentence).toBe('Option of this decision')
    expect(c.strengthLabel).toBeNull()
    expect(c.confidenceLabel).toBeNull()
    expect(c.whyItMatters).toBeNull()
    expect(c.challengePrompt).toBeNull()
    expect(c.actions.map((a) => a.kind)).toEqual(['focus', 'edit'])
  })
})

describe('edge visuals (UI-SEM-075)', () => {
  it('band widths align to the ladder', () => {
    expect(strengthBandWidth(0.1)).toBe(1.5)
    expect(strengthBandWidth(0.2)).toBe(2)
    expect(strengthBandWidth(0.4)).toBe(3)
    expect(strengthBandWidth(0.7)).toBe(4)
  })

  it('dash reuses the live binary rule: solid ≥0.7 (or unknown), dashed below', () => {
    expect(existenceDashArray(0.7)).toBeUndefined()
    expect(existenceDashArray(undefined)).toBeUndefined()
    expect(existenceDashArray(0.69)).toBe('6,4')
  })

  it('polarity colours are tokens, never Goal yellow', () => {
    expect(polarityColor('helps')).toBe('var(--success)')
    expect(polarityColor('hurts')).toBe('var(--danger)')
    expect(polarityColor('unknown')).toBe('var(--text-light)')
    expect(polarityFromSignedMean(0)).toBe('unknown')
  })

  it('fragility gates on results and matches by edge_id then endpoints', () => {
    const fragile = [{ from_id: 'f1', to_id: 'g1', switch_probability: 0.5 }]
    const edge = makeEdge({ weight: 0.5, direction: 'positive' })
    expect(buildEdgeVisual(edge, nodesById, fragile, NO_RESULTS).isFragile).toBe(false)
    const v = buildEdgeVisual(edge, nodesById, fragile, withResults())
    expect(v.isFragile).toBe(true)
    expect(v.fragileSwitchProbability).toBe(0.5)
  })

  it('structural visuals: thin neutral line, no fragility, no strength label', () => {
    const v = buildEdgeVisual(makeEdge({}, 'e-s', 'd1', 'o1'), nodesById, [], withResults())
    expect(v.isStructural).toBe(true)
    expect(v.strokeWidth).toBe(1)
    expect(v.strokeColor).toBe('var(--text-light)')
    expect(v.strengthLabel).toBeNull()
    expect(v.isFragile).toBe(false)
  })
})
