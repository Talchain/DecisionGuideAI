/**
 * decisionQualityPrompts mapper — DSK science-provenance golden tests.
 *
 * Lane 1 (P1): the wire entries under
 * `enrichment.decision_review.decision_quality_prompts[]` carry optional DSK
 * provenance (`dsk_claim_id`, `dsk_protocol_id`, `evidence_strength`). The
 * mapper must carry that provenance through to the UI shape — but ONLY when
 * attested by a real `dsk_claim_id`. An entry with no claim id gets NO
 * provenance fields at all: never a default, never an inferred strength.
 *
 * Golden inputs are the COMMITTED LIVE-CAPTURE fixtures (staging, CEE
 * 76d2e1c) — assertions bind by IDENTITY to the literal ids and titles in
 * those fixtures, never by a value predicate another object could satisfy.
 * r3's prompt[0] is the real no-id entry from live staging: it is this
 * suite's negative, and the id-bearing entries in the same suite are its
 * in-suite positive controls (they prove the suite CAN see provenance, so
 * the absence assertions are not vacuous).
 */

import { describe, it, expect } from 'vitest'
import r1Turn from '../../../../v5/__tests__/fixtures/live-decision-review-0_30.r1-cee-76d2e1c.json'
import r3Turn from '../../../../v5/__tests__/fixtures/live-decision-review-0_30.r3-cee-76d2e1c.json'
import { mapDecisionQualityPrompts } from '../decisionQualityPrompts'

const r1Prompts = (r1Turn as any).enrichment.decision_review.decision_quality_prompts as unknown[]
const r3Prompts = (r3Turn as any).enrichment.decision_review.decision_quality_prompts as unknown[]

describe('mapDecisionQualityPrompts — DSK provenance carry (golden, from live fixtures)', () => {
  it('r1[0] (DSK-T-003): carries claim id, protocol id, and strength VERBATIM alongside sanitized copy', () => {
    const mapped = mapDecisionQualityPrompts(r1Prompts)
    expect(mapped).toHaveLength(1)
    const entry = mapped[0]
    // Identity binding: the literal fixture strings.
    expect(entry.principle).toBe('Consider-the-opposite as a debiasing strategy')
    expect(entry.question).toBe('What would make you switch to HubSpot instead of keeping the current setup?')
    expect(entry.dskClaimId).toBe('DSK-T-003')
    expect(entry.dskProtocolId).toBe('DSK-P-003')
    expect(entry.evidenceStrength).toBe('medium')
  })

  it('r3[1] (DSK-T-002): second id-bearing golden — "strong" strength carried verbatim', () => {
    const mapped = mapDecisionQualityPrompts(r3Prompts)
    expect(mapped).toHaveLength(2)
    const entry = mapped[1]
    expect(entry.principle).toBe('Outside view and reference class forecasting')
    expect(entry.dskClaimId).toBe('DSK-T-002')
    expect(entry.dskProtocolId).toBe('DSK-P-002')
    expect(entry.evidenceStrength).toBe('strong')
  })

  it('r3[0] (the REAL live no-id entry): NO provenance fields at all — honest absence', () => {
    // NEGATIVE with in-suite positive control: r3[1] in the SAME mapped
    // array carries DSK-T-002/strong (asserted above and re-asserted here),
    // proving this suite can see provenance when it is attested. Without
    // that control this absence assertion would be vacuous (trap 13).
    const mapped = mapDecisionQualityPrompts(r3Prompts)
    const negative = mapped[0]
    expect(negative.principle).toBe('Consider-the-opposite') // identity: THE no-id fixture entry
    expect(negative.dskClaimId).toBeUndefined()
    expect(negative.dskProtocolId).toBeUndefined()
    expect(negative.evidenceStrength).toBeUndefined()
    // Positive control in the same array/run:
    expect(mapped[1].dskClaimId).toBe('DSK-T-002')
    expect(mapped[1].evidenceStrength).toBe('strong')
  })

  it('strength WITHOUT a claim id is dropped — provenance is id-gated as a unit', () => {
    const mapped = mapDecisionQualityPrompts([
      {
        principle: 'Premortem analysis',
        applies_because: 'x',
        question: 'What could make this fail?',
        evidence_strength: 'strong', // present on the wire, but unattested (no dsk_claim_id)
      },
    ])
    expect(mapped[0].principle).toBe('Premortem analysis')
    expect(mapped[0].evidenceStrength).toBeUndefined()
    expect(mapped[0].dskClaimId).toBeUndefined()
  })

  it('non-canonical strength vocabulary fails closed to absent (id kept)', () => {
    const mapped = mapDecisionQualityPrompts([
      {
        principle: 'Premortem analysis',
        applies_because: 'x',
        question: 'q',
        dsk_claim_id: 'DSK-T-001',
        evidence_strength: 'overwhelming', // not in the attested weak|medium|strong vocabulary
      },
    ])
    expect(mapped[0].dskClaimId).toBe('DSK-T-001')
    expect(mapped[0].evidenceStrength).toBeUndefined()
  })

  it('id present but strength absent: claim id carried, strength stays absent (never defaulted)', () => {
    const mapped = mapDecisionQualityPrompts([
      {
        principle: 'Premortem analysis',
        applies_because: 'x',
        question: 'q',
        dsk_claim_id: 'DSK-T-001',
        dsk_protocol_id: 'DSK-P-001',
      },
    ])
    expect(mapped[0].dskClaimId).toBe('DSK-T-001')
    expect(mapped[0].dskProtocolId).toBe('DSK-P-001')
    expect(mapped[0].evidenceStrength).toBeUndefined()
  })

  it('non-string / empty dsk_claim_id is not provenance — gate stays closed', () => {
    const mapped = mapDecisionQualityPrompts([
      { principle: 'A', applies_because: 'x', question: 'q', dsk_claim_id: '' },
      { principle: 'B', applies_because: 'x', question: 'q', dsk_claim_id: 42 },
    ])
    expect(mapped[0].dskClaimId).toBeUndefined()
    expect(mapped[1].dskClaimId).toBeUndefined()
  })

  it('badge-feeding copy goes through sanitizeCoachingText (arrows stripped), preserving current principle/question behaviour', () => {
    const mapped = mapDecisionQualityPrompts([
      {
        principle: 'Cause → effect thinking',
        applies_because: 'a -> b',
        question: 'q',
        dsk_claim_id: 'DSK-T-009',
        evidence_strength: 'weak',
      },
    ])
    expect(mapped[0].principle).toBe('Cause to effect thinking')
    expect(mapped[0].appliesBecause).toBe('a to b')
    expect(mapped[0].evidenceStrength).toBe('weak')
  })
})
