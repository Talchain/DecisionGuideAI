/**
 * Wave 3a trigger engine — RED contracts (brief §8.6 grounding rules).
 * Every trigger fires on its exact producer/deterministic signal and
 * suppresses when the signal is absent; no local heuristics.
 */
import { describe, expect, it } from 'vitest'
import { resolveFactorConfidenceDisplay, DISPLAY_SAFE_DRIVER_CONFIDENCE } from '../../driverConfidenceDisplayPolicy'
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

// UI-SEM-085 (narrowed): every phase-3 fixture below sets an explicit
// `priorityRank` — the producer's 0.19.0 ascending ordinal VERBATIM — so
// they all model PRODUCER-RANKED blocks (rank PRESENCE is the ranked fact;
// no companion flag exists any more). Unranked behaviour (the demotion band
// + its source line) is pinned separately in guidanceRankHonesty.spec.ts;
// the coaching-band collapse pins live in producerGuidancePriority.spec.ts.


// ── F5b: the engine may no longer see a bare confidence number ──────────────
//
// `StrengthenFactor.confidence?: number` became
// `confidenceDisplay: FactorConfidenceDisplay`, because the LEHI trigger
// ("High influence, low evidence.") gated on `confidence < 0.4` and the
// producer's value IS the 0.25 placeholder — so the ceiling always passed.
//
// These helpers use the policy module's documented TEST SEAM (`displaySafe`)
// rather than hand-building the union, so a fixture cannot claim a shape the
// production resolver would never emit.
const cleared = (value: number) => resolveFactorConfidenceDisplay({ confidence: value }, true)
const absent = () => resolveFactorConfidenceDisplay({ confidence: null }, true)
/** What PRODUCTION emits today for ANY value: the ruled policy hides it. */
const ruledOut = (value: number) => resolveFactorConfidenceDisplay({ confidence: value })

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
        { factorId: 'f1', label: 'Engineering capacity', influence: 0.8, confidenceDisplay: cleared(0.25), canFocus: true },
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
      factors: [{ factorId: 'f1', label: 'Engineering capacity', influence: 0.8, confidenceDisplay: absent(), canFocus: true }],
    }
    expect(ids(noConfidence)).not.toContain('strengthen:lehi:f1')
  })

  // ── F5b ────────────────────────────────────────────────────────────────
  // The two tests above use the policy's `displaySafe` TEST SEAM, so they
  // prove the trigger still WORKS. This one proves what the product actually
  // does today, which is the finding: `factor_sensitivity[].confidence` is
  // `0.25` with `sampling_stability: 0` in both real staging captures, the
  // ruled policy says that has no display-safe source, and the panel was
  // nonetheless asserting "High influence, low evidence." about it.
  it('F5b: does NOT assert "low evidence" from a confidence the ruled policy hides', () => {
    // Positive control on the constant itself, so this test cannot pass for
    // the wrong reason if someone flips the doctrine without reading here.
    expect(DISPLAY_SAFE_DRIVER_CONFIDENCE).toBe(false)

    const productionShape: StrengthenInputs = {
      ...base,
      factors: [
        // The exact live value: high influence, the placeholder confidence.
        { factorId: 'f1', label: 'Engineering capacity', influence: 0.8, confidenceDisplay: ruledOut(0.25), canFocus: true },
      ],
    }
    const recs = buildRecommendations(productionShape)
    expect(ids(productionShape)).not.toContain('strengthen:lehi:f1')
    expect(recs.some(r => r.signal === 'High influence, low evidence.')).toBe(false)

    // POSITIVE CONTROL (trap 13): the SAME engine, the SAME factor, the SAME
    // 0.25 — only the display policy differs. It fires. So the absence above
    // is caused by the gate and by nothing else.
    const sameInputPolicyOpen: StrengthenInputs = {
      ...productionShape,
      factors: [{ ...productionShape.factors[0], confidenceDisplay: cleared(0.25) }],
    }
    const openRecs = buildRecommendations(sameInputPolicyOpen)
    expect(ids(sameInputPolicyOpen)).toContain('strengthen:lehi:f1')
    expect(openRecs.some(r => r.signal === 'High influence, low evidence.')).toBe(true)
  })

  // ── RELOCATED from StrengthenContainer.spec.tsx (Lane 2 / Codex R3-B1) ──
  // The LEHI floor must key on the DISPLAY influence the panel's own bars
  // show, not the raw producer `influence_score`; under partial producer
  // coverage the two diverge and a raw-score gate would flag a factor the
  // panel renders as weak. The container test that used to assert this became
  // non-discriminating once the confidence policy closed LEHI off entirely
  // (both divergence cases returned undefined for the same reason), so it
  // lives here, where the policy seam can hold confidence constant and leave
  // influence as the only variable.
  it('LEHI floor keys on the DISPLAY influence, not the raw producer score', () => {
    const withInfluence = (influence: number): StrengthenInputs => ({
      ...base,
      factors: [
        { factorId: 'f1', label: 'Divergent', influence, confidenceDisplay: cleared(0.2), canFocus: true },
      ],
    })

    // Display influence 0.9 (raw producer score would have been 0.1) → fires.
    expect(ids(withInfluence(0.9))).toContain('strengthen:lehi:f1')
    // Display influence 0.2 (raw producer score would have been 0.9) → does not.
    expect(ids(withInfluence(0.2))).not.toContain('strengthen:lehi:f1')
  })

  it('lehi: high confidence or low influence suppresses', () => {
    const confident: StrengthenInputs = {
      ...base,
      factors: [{ factorId: 'f1', label: 'X', influence: 0.8, confidenceDisplay: cleared(0.9), canFocus: true }],
    }
    expect(ids(confident)).not.toContain('strengthen:lehi:f1')
    const weak: StrengthenInputs = {
      ...base,
      factors: [{ factorId: 'f1', label: 'X', influence: 0.1, confidenceDisplay: cleared(0.25), canFocus: true }],
    }
    expect(ids(weak)).not.toContain('strengthen:lehi:f1')
  })

  it('voi: producer worth_investigating flag cites the producer; UI evpi fallback is HONESTLY labelled', () => {
    const producer: StrengthenInputs = {
      ...base,
      factors: [{ factorId: 'f1', label: 'Churn', worthInvestigating: true, evpiPercentagePoints: 8, canFocus: true, confidenceDisplay: absent() }],
    }
    const rec = buildRecommendations(producer).find((r) => r.id === 'strengthen:voi:f1')
    expect(rec).toBeDefined()
    expect(rec!.sourceLine.toLowerCase()).toContain('value of information')
    expect(rec!.sourceLine.toLowerCase()).not.toContain('ui threshold')

    const fallback: StrengthenInputs = {
      ...base,
      factors: [{ factorId: 'f1', label: 'Churn', evpiPercentagePoints: 8, canFocus: true, confidenceDisplay: absent() }],
    }
    const rec2 = buildRecommendations(fallback).find((r) => r.id === 'strengthen:voi:f1')
    expect(rec2).toBeDefined()
    // UI-SEM-014-class basis must be named, never claimed as producer provenance.
    expect(rec2!.sourceLine.toLowerCase()).toContain('ui threshold')
  })

  it('voi: sub-threshold evpi without the producer flag suppresses', () => {
    const tiny: StrengthenInputs = {
      ...base,
      factors: [{ factorId: 'f1', label: 'Churn', evpiPercentagePoints: 0.5, canFocus: true, confidenceDisplay: absent() }],
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
      factors: [{ factorId: 'f1', label: 'Churn', worthInvestigating: true, canFocus: true, confidenceDisplay: absent() }],
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

  // UPDATED PIN (was 'never two rows with identical titles'): the dedupe key
  // is now normalised title + body — title alone silently dropped DISTINCT
  // producer findings that share a generic headline. Bodiless same-title
  // items remain true duplicates and still collapse.
  it('UI-SEM-075(b): same title with NO bodies stays a true duplicate — collapses to one', () => {
    const input: StrengthenInputs = {
      ...base,
      phase3Items: [
        { id: 'b1', title: 'A load-bearing assumption', targetIds: [], priorityRank: 1 },
        { id: 'b2', title: 'A load-bearing assumption', targetIds: [], priorityRank: 2 },
        { id: 'b3', title: 'a load-bearing  assumption', targetIds: [], priorityRank: 3 }, // case/space variant
      ],
    }
    const recs = buildRecommendations(input)
    expect(recs.filter((r) => r.id.startsWith('strengthen:phase3:'))).toHaveLength(1)
    // The producer's best-ranked instance survives.
    expect(recs.some((r) => r.id === 'strengthen:phase3:b1')).toBe(true)
  })

  // ── T3 (b): dedupe must never drop DISTINCT findings ─────────────────────
  // The CEE producer emits four distinct "A load-bearing assumption" review
  // cards with different bodies (fixture cee-response-b82c89dd-trimmed.json).
  // Title-only dedupe silently discarded three real findings.
  const LOAD_BEARING_BODIES = [
    'The relationship between Technical Leadership Capacity and overall throughput remains stable.',
    'Team Maturity continues to support higher output as expected.',
    'Hiring costs are predictable and do not introduce significant new risks.',
    'Coordination overhead does not increase disproportionately with new hires.',
  ]

  it('T3(b): four distinct findings under one generic headline ALL promote (within the cap)', () => {
    const input: StrengthenInputs = {
      ...base,
      phase3Items: LOAD_BEARING_BODIES.map((body, i) => ({
        id: `blk_${i + 1}`,
        title: 'A load-bearing assumption',
        body,
        targetIds: [],
        priorityRank: 71 + i, // the fixture's real ranks
      })),
    }
    const phase3 = buildRecommendations(input).filter((r) => r.id.startsWith('strengthen:phase3:'))
    expect(phase3).toHaveLength(4)
    // Every distinct finding survives — none silently vanish.
    for (const body of LOAD_BEARING_BODIES) {
      expect(phase3.some((r) => r.signal === body)).toBe(true)
    }
  })

  it('T3(b): true duplicates (same title AND body) still collapse to the best-ranked instance', () => {
    const input: StrengthenInputs = {
      ...base,
      phase3Items: [
        { id: 'b1', title: 'A load-bearing assumption', body: 'Same body.', targetIds: [], priorityRank: 1 },
        { id: 'b2', title: 'A load-bearing assumption', body: 'Same body.', targetIds: [], priorityRank: 2 },
        { id: 'b3', title: 'a load-bearing  assumption', body: ' same  body. ', targetIds: [], priorityRank: 3 },
      ],
    }
    const phase3 = buildRecommendations(input).filter((r) => r.id.startsWith('strengthen:phase3:'))
    expect(phase3).toHaveLength(1)
    expect(phase3[0].id).toBe('strengthen:phase3:b1')
  })

  // ── T3 (c): collapsed-row information scent ───────────────────────────────
  it('T3(c): the collapsed subtitle carries the producer body VERBATIM when present', () => {
    const input: StrengthenInputs = {
      ...base,
      phase3Items: [
        { id: 'b1', title: 'A load-bearing assumption', body: 'Team Maturity continues to support higher output as expected.', targetIds: [], priorityRank: 1 },
      ],
    }
    const rec = buildRecommendations(input).find((r) => r.id === 'strengthen:phase3:b1')
    expect(rec).toBeDefined()
    expect(rec!.signal).toBe('Team Maturity continues to support higher output as expected.')
  })

  // Round 2: whyNow must ALSO carry the body — it is the expanded-row prose
  // AND the Ask-Olumi drawer context (StrengthenContainer passes rec.whyNow).
  // Moving the body out of whyNow degraded every phase-3 drawer ask to the
  // generic fallback line. The panel dedupes DISPLAY (an open row never
  // renders the same sentence twice); the engine keeps the data specific.
  it('round 2: whyNow carries the producer body VERBATIM (drawer context + expanded prose)', () => {
    const body = 'Team Maturity continues to support higher output as expected.'
    const input: StrengthenInputs = {
      ...base,
      phase3Items: [
        { id: 'b1', title: 'A load-bearing assumption', body, targetIds: [], priorityRank: 1 },
      ],
    }
    const rec = buildRecommendations(input).find((r) => r.id === 'strengthen:phase3:b1')
    expect(rec).toBeDefined()
    expect(rec!.whyNow).toBe(body)
  })

  it('T3(c): subtitle AND whyNow fall back to their boilerplate when the block has no body', () => {
    const input: StrengthenInputs = {
      ...base,
      phase3Items: [{ id: 'b1', title: 'Check your framing', targetIds: [], priorityRank: 1 }],
    }
    const rec = buildRecommendations(input).find((r) => r.id === 'strengthen:phase3:b1')
    expect(rec).toBeDefined()
    expect(rec!.signal).toBe('Olumi flagged this while reviewing your model.')
    expect(rec!.whyNow).toBe('Resolving it improves what the analysis can tell you.')
  })

  // ── Round 2: the FINAL identity pass (post-merge, widened key) ────────────
  // The RED commit deleted the only global title-uniqueness pin; the T3(b)
  // pins above exercise the PROMOTION-stage dedupe only. This pin exercises
  // the final visible-identity pass across the merge of UI-generated and
  // phase-3 recommendations, on the widened title+body key.
  it('round 2: the FINAL pass dedupes identical visible identity across UI-generated and phase-3 recs', () => {
    const sharedSignal = 'The current lead does not hold up strongly under stress-testing.'
    const input: StrengthenInputs = {
      ...base,
      // Emits the UI-generated robustness rec, whose visible identity is
      // ('Pressure-test the leading option', sharedSignal).
      robustness: { status: 'computed', level: 'low' },
      phase3Items: [
        // Identical visible identity from the producer side (case/space variant).
        { id: 'b1', title: 'Pressure-test the leading option', body: ' the current lead does not hold up strongly under  stress-testing. ', targetIds: [], priorityRank: 1 },
        // Same headline, DISTINCT body — the widened key must keep it.
        { id: 'b2', title: 'Pressure-test the leading option', body: 'A different, distinct producer finding under the same headline.', targetIds: [], priorityRank: 2 },
      ],
    }
    const recs = buildRecommendations(input)
    const sameTitle = recs.filter((r) => r.title === 'Pressure-test the leading option')
    // Widened key: the distinct-body row survives alongside — 2 rows, not 1.
    expect(sameTitle).toHaveLength(2)
    // The identical-identity pair collapsed to the higher-priority instance
    // (phase-3 band beats the robustness band).
    expect(recs.some((r) => r.id === 'strengthen:phase3:b1')).toBe(true)
    expect(recs.some((r) => r.id === 'strengthen:robustness')).toBe(false)
    expect(recs.some((r) => r.id === 'strengthen:phase3:b2')).toBe(true)
  })

  // ── Round 2: the display cap binds AFTER true-duplicate removal ───────────
  // A true duplicate must never consume a MAX_PHASE3_PROMOTED slot: with two
  // copies of one finding plus four distinct others, all four distinct-item
  // survivors promote. A cap-before-dedupe ordering would emit only three.
  it('round 2: MAX_PHASE3_PROMOTED binds after duplicate removal — a duplicate never consumes a slot', () => {
    const input: StrengthenInputs = {
      ...base,
      phase3Items: [
        { id: 'a1', title: 'A load-bearing assumption', body: 'Body one.', targetIds: [], priorityRank: 1 },
        { id: 'a2', title: 'A load-bearing assumption', body: 'Body one.', targetIds: [], priorityRank: 2 }, // true duplicate of a1
        { id: 'b', title: 'Second finding', body: 'Body two.', targetIds: [], priorityRank: 3 },
        { id: 'c', title: 'Third finding', body: 'Body three.', targetIds: [], priorityRank: 4 },
        { id: 'd', title: 'Fourth finding', body: 'Body four.', targetIds: [], priorityRank: 5 },
        { id: 'e', title: 'Fifth finding', body: 'Body five.', targetIds: [], priorityRank: 6 },
      ],
    }
    const phase3 = buildRecommendations(input).filter((r) => r.id.startsWith('strengthen:phase3:'))
    expect(phase3.map((r) => r.id)).toEqual([
      'strengthen:phase3:a1',
      'strengthen:phase3:b',
      'strengthen:phase3:c',
      'strengthen:phase3:d', // the row a cap-before-dedupe ordering silently drops
    ])
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
      factors: [{ factorId: 'f1', label: 'Churn', worthInvestigating: true, canFocus: true, confidenceDisplay: absent() }],
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
