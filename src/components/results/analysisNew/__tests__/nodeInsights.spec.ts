/**
 * `nodeInsights` — the join between a node and what this run said about it.
 *
 * ⭐ EVERY CASE BINDS BY IDENTITY. A finding reaches a node because the ENGINE
 * named that node in `targetId`, and the assertions are written against
 * recommendation ids and node ids, never against a title string or a value
 * another record could satisfy (CLAUDE.md trap 19). The load-bearing case is
 * `the join DISCRIMINATES`: a build that attached every finding to every node
 * would satisfy a single-node test perfectly.
 *
 * ⚠ WHAT THIS FILE DELIBERATELY DOES NOT ASSERT: that a node absent from the
 * index "has no findings in the run". The index is built from the panel's own
 * two lists — a capped driver list and an already-filtered intervention list —
 * so absence here is absence FROM THOSE LISTS and nothing wider. The renderer's
 * sentence is scoped to the panel for exactly this reason.
 */

import { describe, expect, it } from 'vitest'

import { buildNodeInsights, NODE_INSIGHT_FINDING_CAP } from '../nodeInsights'
import type { Recommendation } from '../../strengthen/strengthenTypes'
import type { GlanceDriver } from '../analysisNewTypes'

const rec = (over: Partial<Recommendation> & { id: string }): Recommendation =>
  ({
    helpType: 'challenge',
    title: 'Pressure-test the leading option',
    signal: 'The ranking was fragile under perturbation.',
    whyNow: 'Small changes flip which option leads.',
    tryThis: 'Imagine it failed. Write down why.',
    sourceLine: 'From the robustness check.',
    action: { kind: 'ai-dialogue', label: 'Work through this', prompt: 'Pressure-test it' },
    priority: 1,
    targetId: null,
    ...over,
  }) as Recommendation

const driver = (over: Partial<GlanceDriver> & { id: string }): GlanceDriver => ({
  label: 'Vendor licensing cost',
  fraction: 1,
  targetId: null,
  ...over,
})

describe('the join is on the engine’s own target, and it discriminates', () => {
  it('attaches a finding to the node the ENGINE named, by id', () => {
    const index = buildNodeInsights({
      interventions: [rec({ id: 'strengthen:robustness:o1', targetId: 'o1' })],
      drivers: [],
    })
    expect(index.get('o1')?.findings.map((f) => f.recommendationId)).toEqual([
      'strengthen:robustness:o1',
    ])
  })

  /**
   * ⭐ THE DISCRIMINATING CASE. A build that ignored `targetId` and attached
   * every finding to every node passes the case above and fails this one.
   */
  it('does NOT attach it to any other node', () => {
    const index = buildNodeInsights({
      interventions: [
        rec({ id: 'strengthen:robustness:o1', targetId: 'o1' }),
        rec({ id: 'strengthen:lehi:f7', targetId: 'f7', title: 'Give this factor a range' }),
      ],
      drivers: [],
    })
    expect(index.get('o1')?.findings.map((f) => f.recommendationId)).toEqual([
      'strengthen:robustness:o1',
    ])
    expect(index.get('f7')?.findings.map((f) => f.recommendationId)).toEqual(['strengthen:lehi:f7'])
    expect(index.get('r3')).toBeUndefined()
  })

  /**
   * `targetId` is legitimately an EDGE id on the relationship recommendations.
   * An edge matches no node, so the finding attaches to nothing — which is the
   * correct outcome, not a gap: the strip draws no mark for a relationship.
   */
  it('a recommendation with no target, and one targeting an edge, reach no node', () => {
    const index = buildNodeInsights({
      interventions: [
        rec({ id: 'strengthen:phase3:b1', targetId: null }),
        rec({ id: 'strengthen:flip:edge_9', targetId: 'edge_9' }),
      ],
      drivers: [],
    })
    expect(index.get('edge_9')?.findings.map((f) => f.recommendationId)).toEqual([
      'strengthen:flip:edge_9',
    ])
    // Nothing was invented for the untargeted one: the whole index is the edge.
    expect([...index.keys()]).toEqual(['edge_9'])
  })
})

describe('the engine’s words are carried verbatim, and nothing else is', () => {
  it('carries title and tryThis exactly as the engine wrote them', () => {
    const index = buildNodeInsights({
      interventions: [
        rec({
          id: 'strengthen:lehi:f7',
          targetId: 'f7',
          title: 'Give Vendor licensing cost a range',
          tryThis: 'Replace the single number with a low and a high you would defend.',
        }),
      ],
      drivers: [],
    })
    const finding = index.get('f7')!.findings[0]
    expect(finding.title).toBe('Give Vendor licensing cost a range')
    expect(finding.tryThis).toBe('Replace the single number with a low and a high you would defend.')
  })

  /**
   * `whyNow` then `signal` — the same precedence the Strengthen section uses to
   * seed the drawer. Both are engine fields; this is a choice between two
   * producer sentences, never a composition.
   */
  it('prefers whyNow for context and falls back to signal, never to a composed line', () => {
    const withWhyNow = buildNodeInsights({
      interventions: [rec({ id: 'a', targetId: 'n1', whyNow: 'It flips the leader.' })],
      drivers: [],
    })
    expect(withWhyNow.get('n1')!.findings[0].context).toBe('It flips the leader.')

    const withoutWhyNow = buildNodeInsights({
      interventions: [
        rec({ id: 'a', targetId: 'n1', whyNow: '', signal: 'The ranking was fragile.' }),
      ],
      drivers: [],
    })
    expect(withoutWhyNow.get('n1')!.findings[0].context).toBe('The ranking was fragile.')
  })
})

describe('the technique is attached only where the mapping says so', () => {
  /**
   * ⚠ Bound to the mapped PREFIX by name. `strengthen:robustness` is a
   * pre-mortem per `recommendationMethod.ts`; the assertion reads the method id
   * rather than its title, so a copy edit in the catalogue cannot fail it and a
   * remapping does.
   */
  it('a mapped recommendation carries its method; an unmapped one carries null', () => {
    const index = buildNodeInsights({
      interventions: [
        rec({ id: 'strengthen:robustness:o1', targetId: 'o1' }),
        rec({ id: 'strengthen:lehi:f7', targetId: 'f7' }),
      ],
      drivers: [],
    })
    expect(index.get('o1')!.findings[0].method?.id).toBe('pre_mortem')
    // Absence is not zero: an unmapped finding names no technique at all.
    expect(index.get('f7')!.findings[0].method).toBeNull()
  })

  it('a producer signal code reaches a method when the id maps to none', () => {
    const index = buildNodeInsights({
      interventions: [
        rec({ id: 'strengthen:phase3:b4', targetId: 'f2', signalCode: 'COGNITIVE_BIAS' }),
      ],
      drivers: [],
    })
    expect(index.get('f2')!.findings[0].method?.id).toBe('review_bias')
  })
})

describe('drivers: presence licenses a claim, absence licenses nothing', () => {
  it('flags a node the glance named, by target id, with the glance’s own label', () => {
    const index = buildNodeInsights({
      interventions: [],
      drivers: [driver({ id: 'd1', label: 'Vendor licensing cost', targetId: 'f7' })],
    })
    expect(index.get('f7')!.driverLabel).toBe('Vendor licensing cost')
  })

  it('a node the glance did not name has NO driver flag, and no negative field to read', () => {
    const index = buildNodeInsights({
      interventions: [rec({ id: 'a', targetId: 'f9' })],
      drivers: [driver({ id: 'd1', targetId: 'f7' })],
    })
    expect(index.get('f9')!.driverLabel).toBeNull()
    // The shape offers no way to assert "not a driver" — the cap forbids it.
    expect(Object.keys(index.get('f9')!).sort()).toEqual([
      'driverLabel',
      'findings',
      'withheldFindings',
    ])
  })

  it('a driver the producer gave no target joins nothing rather than guessing', () => {
    const index = buildNodeInsights({
      interventions: [],
      drivers: [driver({ id: 'd1', targetId: null })],
    })
    expect(index.size).toBe(0)
  })
})

describe('the cap discloses itself', () => {
  it('keeps engine order to the cap and counts the remainder', () => {
    const many = Array.from({ length: NODE_INSIGHT_FINDING_CAP + 2 }, (_, i) =>
      rec({ id: `strengthen:phase3:b${i}`, targetId: 'o1' }),
    )
    const index = buildNodeInsights({ interventions: many, drivers: [] })
    const insight = index.get('o1')!
    expect(insight.findings).toHaveLength(NODE_INSIGHT_FINDING_CAP)
    // Engine order, not sorted or reversed — bound by id.
    expect(insight.findings.map((f) => f.recommendationId)).toEqual(
      many.slice(0, NODE_INSIGHT_FINDING_CAP).map((r) => r.id),
    )
    expect(insight.withheldFindings).toBe(2)
  })
})
