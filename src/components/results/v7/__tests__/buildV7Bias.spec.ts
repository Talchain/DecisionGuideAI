/**
 * buildV7Bias — V7 Lane L6 pins for the bias-finding passthrough builder
 * (spec row 11).
 *
 * Pins: producer type/description/steps/estimated_minutes/affected are read
 * verbatim; steps accept both `string[]` and `{ text }[]` wire shapes;
 * estimated_minutes is read from the intervention OR the finding root; a finding
 * with neither description nor step is dropped (honest, no empty shell); the
 * kind token is humanised (and "_RISK" trimmed); pickBiasFindingsSource prefers
 * ceeReviewV1 over the legacy ceeReview.
 */
import { describe, it, expect } from 'vitest'
import { buildV7BiasFindings, buildV7BiasFinding, pickBiasFindingsSource } from '../buildV7Bias'

describe('buildV7BiasFindings (V7 L6)', () => {
  it('maps type, description, string steps, minutes and affected nodes verbatim', () => {
    const raw = [
      {
        type: 'ANCHORING_RISK',
        description: 'Your estimate may be anchored to the first number.',
        affected_node_ids: ['n1', 'n2'],
        micro_intervention: { estimated_minutes: 4, steps: ['Re-estimate independently', 'Compare'] },
      },
    ]
    const out = buildV7BiasFindings(raw)
    expect(out).toHaveLength(1)
    expect(out[0].kindLabel).toBe('Anchoring')
    expect(out[0].description).toContain('anchored')
    expect(out[0].steps).toEqual(['Re-estimate independently', 'Compare'])
    expect(out[0].estimatedMinutes).toBe(4)
    expect(out[0].affectedNodeIds).toEqual(['n1', 'n2'])
  })

  it('accepts { text } step objects and root-level estimated_minutes', () => {
    const raw = [
      {
        code: 'sunk_cost',
        message: 'You may be over-weighting past investment.',
        estimated_minutes: 6,
        micro_intervention: { steps: [{ text: 'List only future costs' }, { notText: 'x' }] },
      },
    ]
    const out = buildV7BiasFindings(raw)
    expect(out[0].kindLabel).toBe('Sunk cost')
    expect(out[0].steps).toEqual(['List only future costs'])
    expect(out[0].estimatedMinutes).toBe(6)
  })

  it('drops a finding with neither a description nor a step (no empty shell)', () => {
    expect(buildV7BiasFinding({ type: 'ANCHORING', micro_intervention: { steps: [] } }, 0)).toBeNull()
    expect(buildV7BiasFindings([{ type: 'X' }, { junk: true }, null])).toEqual([])
  })

  it('returns [] for non-array input', () => {
    expect(buildV7BiasFindings(undefined)).toEqual([])
    expect(buildV7BiasFindings({})).toEqual([])
  })
})

describe('pickBiasFindingsSource (V7 L6)', () => {
  it('prefers ceeReviewV1 over the legacy ceeReview', () => {
    const runMeta = {
      ceeReviewV1: { bias_findings: [{ id: 'v1' }] },
      ceeReview: { bias_findings: [{ id: 'legacy' }] },
    }
    expect(pickBiasFindingsSource(runMeta)).toEqual([{ id: 'v1' }])
  })

  it('falls back to legacy ceeReview when V1 has none', () => {
    const runMeta = { ceeReview: { bias_findings: [{ id: 'legacy' }] } }
    expect(pickBiasFindingsSource(runMeta)).toEqual([{ id: 'legacy' }])
  })

  it('returns undefined when neither carries findings', () => {
    expect(pickBiasFindingsSource({})).toBeUndefined()
    expect(pickBiasFindingsSource(null)).toBeUndefined()
  })
})
