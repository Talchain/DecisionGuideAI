/**
 * Wave 3a trigger engine — RED contracts (brief §8.6 grounding rules).
 * Every trigger fires on its exact producer/deterministic signal and
 * suppresses when the signal is absent; no local heuristics.
 */
import { describe, expect, it } from 'vitest'
import { buildRecommendations } from '../buildRecommendations'
import type { StrengthenInputs } from '../strengthenTypes'

const base: StrengthenInputs = {
  goalThreshold: 62,
  analysisComplete: true,
  fragileEdges: [],
  factors: [],
  robustness: { status: null, level: null },
  biasFindingTypes: [],
  phase3Items: [],
}

const ids = (input: StrengthenInputs) => buildRecommendations(input).map((r) => r.id)

describe('buildRecommendations — trigger grounding (§8.6)', () => {
  it('success-measure: fires iff the effective goal threshold is null (deterministic)', () => {
    expect(ids({ ...base, goalThreshold: null })).toContain('strengthen:success-measure')
    expect(ids(base)).not.toContain('strengthen:success-measure')
  })

  it('success-measure fires even before any analysis (it is a framing gap, not a result)', () => {
    expect(ids({ ...base, goalThreshold: null, analysisComplete: false })).toContain(
      'strengthen:success-measure',
    )
  })

  it('flip: fires for the HIGHEST switch-probability fragile edge only, entity-scoped id', () => {
    const input: StrengthenInputs = {
      ...base,
      fragileEdges: [
        { edgeId: 'e1', factorLabel: 'Team capacity', switchProbability: 0.35 },
        { edgeId: 'e2', factorLabel: 'Salary cost', switchProbability: 0.62, alternativeWinnerLabel: 'Two developers' },
      ],
    }
    const recs = buildRecommendations(input)
    const flips = recs.filter((r) => r.id.startsWith('strengthen:flip:'))
    expect(flips).toHaveLength(1)
    expect(flips[0].id).toBe('strengthen:flip:e2')
    expect(flips[0].targetId).toBe('e2')
    // Signal names the consequence honestly (producer values only).
    expect(flips[0].signal).toContain('62%')
  })

  it('flip: suppressed with no fragile edges or before analysis', () => {
    expect(ids(base).some((i) => i.startsWith('strengthen:flip:'))).toBe(false)
    const withEdge: StrengthenInputs = {
      ...base,
      analysisComplete: false,
      fragileEdges: [{ edgeId: 'e1', factorLabel: 'X', switchProbability: 0.5 }],
    }
    expect(ids(withEdge).some((i) => i.startsWith('strengthen:flip:'))).toBe(false)
  })

  it('low-evidence-high-influence: PATH-CONDITIONAL — fires only when producer per-factor confidence is present', () => {
    const withConfidence: StrengthenInputs = {
      ...base,
      factors: [
        { factorId: 'f1', label: 'Engineering capacity', influence: 0.8, confidence: 0.25, canFocus: true },
      ],
    }
    const recs = buildRecommendations(withConfidence)
    const lehi = recs.find((r) => r.id === 'strengthen:lehi:f1')
    expect(lehi).toBeDefined()
    expect(lehi!.title).toContain('Engineering capacity')
    expect(lehi!.targetId).toBe('f1')

    // Same factor WITHOUT producer confidence → never fires (no beliefExists fallback).
    const noConfidence: StrengthenInputs = {
      ...base,
      factors: [{ factorId: 'f1', label: 'Engineering capacity', influence: 0.8, confidence: null, canFocus: true }],
    }
    expect(ids(noConfidence)).not.toContain('strengthen:lehi:f1')
  })

  it('lehi: high confidence or low influence suppresses', () => {
    const confident: StrengthenInputs = {
      ...base,
      factors: [{ factorId: 'f1', label: 'X', influence: 0.8, confidence: 0.9, canFocus: true }],
    }
    expect(ids(confident)).not.toContain('strengthen:lehi:f1')
    const weak: StrengthenInputs = {
      ...base,
      factors: [{ factorId: 'f1', label: 'X', influence: 0.1, confidence: 0.25, canFocus: true }],
    }
    expect(ids(weak)).not.toContain('strengthen:lehi:f1')
  })

  it('voi: producer worth_investigating flag cites the producer; UI evpi fallback is HONESTLY labelled', () => {
    const producer: StrengthenInputs = {
      ...base,
      factors: [{ factorId: 'f1', label: 'Churn', worthInvestigating: true, evpiPercentagePoints: 8, canFocus: true }],
    }
    const rec = buildRecommendations(producer).find((r) => r.id === 'strengthen:voi:f1')
    expect(rec).toBeDefined()
    expect(rec!.sourceLine.toLowerCase()).toContain('value of information')
    expect(rec!.sourceLine.toLowerCase()).not.toContain('ui threshold')

    const fallback: StrengthenInputs = {
      ...base,
      factors: [{ factorId: 'f1', label: 'Churn', evpiPercentagePoints: 8, canFocus: true }],
    }
    const rec2 = buildRecommendations(fallback).find((r) => r.id === 'strengthen:voi:f1')
    expect(rec2).toBeDefined()
    // UI-SEM-014-class basis must be named, never claimed as producer provenance.
    expect(rec2!.sourceLine.toLowerCase()).toContain('ui threshold')
  })

  it('voi: sub-threshold evpi without the producer flag suppresses', () => {
    const tiny: StrengthenInputs = {
      ...base,
      factors: [{ factorId: 'f1', label: 'Churn', evpiPercentagePoints: 0.5, canFocus: true }],
    }
    expect(ids(tiny)).not.toContain('strengthen:voi:f1')
  })

  it('robustness challenge: fires on low/very_low robustness only', () => {
    expect(
      ids({ ...base, robustness: { status: 'computed', level: 'low' } }),
    ).toContain('strengthen:robustness')
    expect(
      ids({ ...base, robustness: { status: 'computed', level: 'high' } }),
    ).not.toContain('strengthen:robustness')
    expect(ids(base)).not.toContain('strengthen:robustness')
  })

  it('broaden: PRODUCER-GATED — fires only from a producer bias finding, never option counting (§19)', () => {
    expect(ids({ ...base, biasFindingTypes: ['narrow_framing'] })).toContain('strengthen:broaden')
    expect(ids(base)).not.toContain('strengthen:broaden')
  })

  it('commit: fires only on computed robustness at high level', () => {
    expect(
      ids({ ...base, robustness: { status: 'computed', level: 'high' } }),
    ).toContain('strengthen:commit')
    expect(
      ids({ ...base, robustness: { status: 'computed', level: 'low' } }),
    ).not.toContain('strengthen:commit')
  })

  it('phase-3 promotion: verbatim wire title, stable block-scoped id, target-gated focus', () => {
    const input: StrengthenInputs = {
      ...base,
      phase3Items: [
        { id: 'blk_1', title: 'Confirm this assumption', actionIntent: 'confirm_factor', actionLabel: 'Confirm it', targetIds: ['node_x'], priorityRank: 1 },
        { id: 'blk_2', title: 'Check your framing', targetIds: [], priorityRank: 2 },
      ],
    }
    const recs = buildRecommendations(input)
    const p1 = recs.find((r) => r.id === 'strengthen:phase3:blk_1')
    const p2 = recs.find((r) => r.id === 'strengthen:phase3:blk_2')
    expect(p1).toBeDefined()
    expect(p1!.title).toBe('Confirm this assumption') // verbatim, never UI-authored
    expect(p1!.targetId).toBe('node_x')
    expect(p1!.action.actionType).toBe('confirm_factor')
    expect(p2!.targetId).toBeNull() // empty target_refs → no focus affordance
  })

  it('priority: success-measure outranks everything; phase-3 follows priority_rank; flip precedes voi', () => {
    const input: StrengthenInputs = {
      ...base,
      goalThreshold: null,
      fragileEdges: [{ edgeId: 'e1', factorLabel: 'X', switchProbability: 0.5 }],
      factors: [{ factorId: 'f1', label: 'Churn', worthInvestigating: true, canFocus: true }],
      phase3Items: [{ id: 'b1', title: 'T', targetIds: [], priorityRank: 1 }],
    }
    const recs = buildRecommendations(input).sort((a, b) => a.priority - b.priority)
    const order = recs.map((r) => r.id)
    expect(order[0]).toBe('strengthen:success-measure')
    expect(order.indexOf('strengthen:phase3:b1')).toBeLessThan(order.indexOf('strengthen:flip:e1'))
    expect(order.indexOf('strengthen:flip:e1')).toBeLessThan(order.indexOf('strengthen:voi:f1'))
  })

  it('UI-SEM-075(a): phase-3 promotion is capped at the producer top-4 by priority_rank', () => {
    const input: StrengthenInputs = {
      ...base,
      phase3Items: [
        { id: 'b1', title: 'One', targetIds: [], priorityRank: 5 },
        { id: 'b2', title: 'Two', targetIds: [], priorityRank: 1 },
        { id: 'b3', title: 'Three', targetIds: [], priorityRank: 2 },
        { id: 'b4', title: 'Four', targetIds: [], priorityRank: 3 },
        { id: 'b5', title: 'Five', targetIds: [], priorityRank: 4 },
        { id: 'b6', title: 'Six', targetIds: [], priorityRank: 6 },
      ],
    }
    const phase3 = buildRecommendations(input).filter((r) => r.id.startsWith('strengthen:phase3:'))
    expect(phase3).toHaveLength(4)
    // The producer's own ranking picks the survivors — b6 (rank 6) and b1 (rank 5) drop.
    expect(phase3.map((r) => r.id)).toEqual(
      expect.arrayContaining(['strengthen:phase3:b2', 'strengthen:phase3:b3', 'strengthen:phase3:b4', 'strengthen:phase3:b5']),
    )
  })

  it('UI-SEM-075(b): never two rows with identical titles — duplicate guidance items collapse to one', () => {
    const input: StrengthenInputs = {
      ...base,
      phase3Items: [
        { id: 'b1', title: 'A load-bearing assumption', targetIds: [], priorityRank: 1 },
        { id: 'b2', title: 'A load-bearing assumption', targetIds: [], priorityRank: 2 },
        { id: 'b3', title: 'a load-bearing  assumption', targetIds: [], priorityRank: 3 }, // case/space variant
      ],
    }
    const recs = buildRecommendations(input)
    const titles = recs.map((r) => r.title.trim().toLowerCase().replace(/\s+/g, ' '))
    expect(new Set(titles).size).toBe(titles.length)
    expect(recs.filter((r) => r.id.startsWith('strengthen:phase3:'))).toHaveLength(1)
    // The producer's best-ranked instance survives.
    expect(recs.some((r) => r.id === 'strengthen:phase3:b1')).toBe(true)
  })

  it('adaptive priority: a producer stage signal floats matching-helpType recs to the top; null leaves the ladder', () => {
    const input: StrengthenInputs = {
      ...base,
      goalThreshold: null, // clarify rec (priority 0)
      fragileEdges: [{ edgeId: 'e1', factorLabel: 'X', switchProbability: 0.5 }], // evaluate rec
    }
    const ladder = buildRecommendations(input).sort((a, b) => a.priority - b.priority)
    expect(ladder[0].id).toBe('strengthen:success-measure')

    const boosted = buildRecommendations({ ...input, adaptivePriority: 'evaluate' }).sort(
      (a, b) => a.priority - b.priority,
    )
    expect(boosted[0].id).toBe('strengthen:flip:e1') // evaluate floats above clarify
    // Fail-closed: explicit null behaves like absent.
    const nulled = buildRecommendations({ ...input, adaptivePriority: null }).sort(
      (a, b) => a.priority - b.priority,
    )
    expect(nulled[0].id).toBe('strengthen:success-measure')
  })

  it('adaptive priority preserves relative order WITHIN the matching group', () => {
    const input: StrengthenInputs = {
      ...base,
      adaptivePriority: 'evaluate',
      fragileEdges: [{ edgeId: 'e1', factorLabel: 'X', switchProbability: 0.5 }],
      factors: [{ factorId: 'f1', label: 'Churn', worthInvestigating: true, canFocus: true }],
    }
    const order = buildRecommendations(input)
      .sort((a, b) => a.priority - b.priority)
      .map((r) => r.id)
    // flip (band 100) still precedes voi (band 120) inside the boosted group.
    expect(order.indexOf('strengthen:flip:e1')).toBeLessThan(order.indexOf('strengthen:voi:f1'))
  })

  it('every emitted recommendation is fully formed (§8.4) with an explicit ai-dialogue action_type where applicable', () => {
    const input: StrengthenInputs = {
      ...base,
      goalThreshold: null,
      fragileEdges: [{ edgeId: 'e1', factorLabel: 'X', switchProbability: 0.5 }],
      robustness: { status: 'computed', level: 'low' },
      biasFindingTypes: ['narrow_framing'],
    }
    for (const rec of buildRecommendations(input)) {
      expect(rec.title.length).toBeGreaterThan(0)
      expect(rec.signal.length).toBeGreaterThan(0)
      expect(rec.whyNow.length).toBeGreaterThan(0)
      expect(rec.tryThis.length).toBeGreaterThan(0)
      expect(rec.sourceLine.length).toBeGreaterThan(0)
      expect(rec.action.label.length).toBeGreaterThan(0)
      if (rec.action.kind === 'ai-dialogue') {
        expect(rec.action.actionType).toBeTruthy() // never the keyword heuristic
        expect(rec.action.prompt).toBeTruthy() // _sendMessage degrade path
      }
      // en-GB copy hygiene: no em dashes in rendered prose.
      for (const text of [rec.title, rec.signal, rec.whyNow, rec.tryThis, rec.sourceLine]) {
        expect(text).not.toContain('—')
      }
    }
  })
})
