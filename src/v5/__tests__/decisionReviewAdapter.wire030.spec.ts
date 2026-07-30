/**
 * decisionReviewAdapter — the 0.30 wire shape (ROADMAP 2.154).
 *
 * WHY THIS FILE EXISTS. `extractDecisionReview` validated the retired M1 REST
 * shape (`intent`/`analysis_state`/`readiness`/`blocks`) and its own docstring
 * asserted CEE sent that shape. CEE has not sent it for months: the live
 * `enrichment.decision_review` is the 0.30 / F.6 payload
 * (`{...verbatim LLM output, produced_at}`). The adapter therefore returned
 * `null` on EVERY live analysis turn, and five prose fields that cost a real
 * ~8-9s gpt-4.1 call were dropped at the UI boundary. The sibling suite
 * (`decisionReviewAdapter.test.ts`) stayed green throughout because its
 * `validDR` fixture was a hand-written mirror of the dead shape — a green
 * suite certifying a 100%-dead path.
 *
 * So the fixtures here are NOT hand-written. They are the verbatim captured
 * `blocks[0]` of two live `POST /proxy/v5/turn` analysis responses, taken from
 * the deployed pair (UI 1e320e5c / CEE 76d2e1c) by the adjudication lane and
 * committed unmodified. See each fixture's `__source__` / `__notes__` for the
 * source file and its sha256. They are pinned to those historical artefacts on
 * purpose and must never be "refreshed" to track a current payload: a control
 * whose reference is whatever is deployed now is a control with an expiry date
 * nobody wrote down.
 *
 * r1 and r3 are two INDEPENDENT gpt-4.1 invocations, not a replay: distinct
 * token counts, latencies, `produced_at` and prose. Asserting the same
 * structure across both is what makes this evidence of a stable wire shape
 * rather than of one lucky payload.
 */
import { describe, it, expect } from 'vitest'
import {
  readDecisionReviewWireState,
  type DecisionReview030,
} from '../decisionReviewAdapter'
import r1Block from './fixtures/live-decision-review-0_30.r1-cee-76d2e1c.json'
import r3Block from './fixtures/live-decision-review-0_30.r3-cee-76d2e1c.json'

const LIVE_BLOCKS: Array<[string, Record<string, unknown>]> = [
  ['r1', r1Block as unknown as Record<string, unknown>],
  ['r3', r3Block as unknown as Record<string, unknown>],
]

function enrichmentOf(block: Record<string, unknown>): Record<string, unknown> {
  return block.enrichment as Record<string, unknown>
}

function v030Of(block: Record<string, unknown>): DecisionReview030 {
  const state = readDecisionReviewWireState(enrichmentOf(block))
  if (state.kind !== 'v0_30') {
    throw new Error(`expected v0_30, got ${state.kind}`)
  }
  return state.review
}

describe('the fixtures are the live wire, not a hand-written mirror', () => {
  it.each(LIVE_BLOCKS)(
    '%s carries the adjudicated 0.30 key set, in wire order, produced_at LAST',
    (_tag, block) => {
      const dr = enrichmentOf(block).decision_review as Record<string, unknown>
      expect(Object.keys(dr)).toEqual([
        'narrative_summary',
        'story_headlines',
        'robustness_explanation',
        'readiness_rationale',
        'evidence_enhancements',
        'scenario_contexts',
        'flip_thresholds',
        'bias_findings',
        'key_assumptions',
        'decision_quality_prompts',
        'produced_at',
      ])
    },
  )

  it.each(LIVE_BLOCKS)(
    '%s carries NONE of the M1 REST discriminators the old adapter required',
    (_tag, block) => {
      const dr = enrichmentOf(block).decision_review as Record<string, unknown>
      expect(dr.intent).toBeUndefined()
      expect(dr.analysis_state).toBeUndefined()
      expect(dr.readiness).toBeUndefined()
      expect(dr.blocks).toBeUndefined()
    },
  )

  it.each(LIVE_BLOCKS)('%s carries the 13 enrichment siblings', (_tag, block) => {
    expect(Object.keys(enrichmentOf(block))).toHaveLength(13)
  })
})

describe('readDecisionReviewWireState — the live 0.30 payload', () => {
  it.each(LIVE_BLOCKS)('%s is classified v0_30', (_tag, block) => {
    expect(readDecisionReviewWireState(enrichmentOf(block)).kind).toBe('v0_30')
  })

  it.each(LIVE_BLOCKS)('%s reports prose present', (_tag, block) => {
    expect(v030Of(block).hasProse).toBe(true)
  })

  it.each(LIVE_BLOCKS)('%s passes produced_at through verbatim', (_tag, block) => {
    const dr = enrichmentOf(block).decision_review as Record<string, unknown>
    expect(v030Of(block).produced_at).toBe(dr.produced_at)
  })

  // ── The five orphans, field by field, verbatim ────────────────────────────

  it('r1 narrative_summary is the live prose, byte-for-byte', () => {
    expect(v030Of(r1Block as unknown as Record<string, unknown>).narrative_summary).toBe(
      'Keep Current Setup (Status Quo) leads with a margin of about 79 percentage points over ' +
        'HubSpot. This is mostly anchored by the stable cost and adoption risks associated with ' +
        'making a switch.',
    )
  })

  it.each(LIVE_BLOCKS)(
    '%s narrative_summary equals the wire value with no rewriting',
    (_tag, block) => {
      const dr = enrichmentOf(block).decision_review as Record<string, unknown>
      expect(v030Of(block).narrative_summary).toBe(dr.narrative_summary)
    },
  )

  it.each(LIVE_BLOCKS)(
    '%s readiness_rationale equals the wire value with no rewriting',
    (_tag, block) => {
      const dr = enrichmentOf(block).decision_review as Record<string, unknown>
      expect(v030Of(block).readiness_rationale).toBe(dr.readiness_rationale)
    },
  )

  it.each(LIVE_BLOCKS)('%s robustness_explanation is fully carried', (_tag, block) => {
    const wire = (enrichmentOf(block).decision_review as Record<string, unknown>)
      .robustness_explanation as Record<string, unknown>
    const vm = v030Of(block).robustness_explanation
    expect(vm).not.toBeNull()
    expect(vm!.summary).toBe(wire.summary)
    expect(vm!.primary_risk).toBe(wire.primary_risk)
    expect(vm!.stability_factors).toEqual(wire.stability_factors)
    expect(vm!.fragility_factors).toEqual(wire.fragility_factors)
    expect(vm!.stability_factors).toHaveLength(2)
    expect(vm!.fragility_factors).toHaveLength(2)
  })

  it.each(LIVE_BLOCKS)(
    '%s story_headlines becomes one entry per option, in wire order, text verbatim',
    (_tag, block) => {
      const wire = (enrichmentOf(block).decision_review as Record<string, unknown>)
        .story_headlines as Record<string, string>
      const vm = v030Of(block).story_headlines
      expect(vm.map((h) => h.optionId)).toEqual(Object.keys(wire))
      for (const h of vm) expect(h.headline).toBe(wire[h.optionId])
      expect(vm).toHaveLength(4)
    },
  )

  it.each(LIVE_BLOCKS)(
    '%s scenario_contexts becomes one entry per trigger, key kept opaque, prose verbatim',
    (_tag, block) => {
      const wire = (enrichmentOf(block).decision_review as Record<string, unknown>)
        .scenario_contexts as Record<string, Record<string, string>>
      const vm = v030Of(block).scenario_contexts
      expect(vm.map((s) => s.id)).toEqual(Object.keys(wire))
      for (const s of vm) {
        expect(s.trigger_description).toBe(wire[s.id].trigger_description)
        expect(s.consequence).toBe(wire[s.id].consequence)
      }
      expect(vm).toHaveLength(2)
    },
  )

  // The two runs must NOT be interchangeable — if they were, one of them is a
  // replay and the "two independent invocations" claim is empty.
  it('r1 and r3 carry DIFFERENT prose (they are separate LLM calls)', () => {
    const a = v030Of(r1Block as unknown as Record<string, unknown>)
    const b = v030Of(r3Block as unknown as Record<string, unknown>)
    expect(a.narrative_summary).not.toBe(b.narrative_summary)
    expect(a.readiness_rationale).not.toBe(b.readiness_rationale)
    expect(a.produced_at).not.toBe(b.produced_at)
  })

  it('the six fields that already reach the UI via enricher blocks are NOT duplicated here', () => {
    const vm = v030Of(r1Block as unknown as Record<string, unknown>) as unknown as Record<
      string,
      unknown
    >
    for (const dup of [
      'evidence_enhancements',
      'flip_thresholds',
      'bias_findings',
      'key_assumptions',
      'decision_quality_prompts',
    ]) {
      expect(vm[dup]).toBeUndefined()
    }
  })
})

describe('readDecisionReviewWireState — the three non-populated wire states', () => {
  it('enrichment undefined → absent', () => {
    expect(readDecisionReviewWireState(undefined)).toEqual({ kind: 'absent' })
  })

  it('key not set (the enricher’s 7 soft-fail skips) → absent, NOT malformed', () => {
    expect(readDecisionReviewWireState({ option_comparison: [], robustness: {} })).toEqual({
      kind: 'absent',
    })
  })

  it('decision_review === null (patchRunAnalysisDecisionReviewNull) → degraded, NOT malformed', () => {
    // CEE distinguishes these two absences deliberately: `null` means "review
    // attempted, degraded at the call site"; field-not-set means "the
    // enricher's own soft-fail path". The UI must not conflate them, and
    // neither is an alarm.
    expect(readDecisionReviewWireState({ decision_review: null })).toEqual({ kind: 'degraded' })
  })

  it('genuinely malformed content → malformed (the marker MUST still be able to fire)', () => {
    // Positive control for the invalid marker. An absence assertion that
    // cannot see a presence is vacuous; the same is true of a marker that can
    // no longer fire at all. Each of these is a record on the key that matches
    // neither the 0.30 nor the M1 shape.
    expect(readDecisionReviewWireState({ decision_review: {} }).kind).toBe('malformed')
    expect(readDecisionReviewWireState({ decision_review: { produced_at: 123 } }).kind).toBe(
      'malformed',
    )
    expect(
      readDecisionReviewWireState({ decision_review: { narrative_summary: 'no timestamp' } }).kind,
    ).toBe('malformed')
    expect(readDecisionReviewWireState({ decision_review: { intent: 'bogus' } }).kind).toBe(
      'malformed',
    )
  })

  it('a non-record on the key → malformed (a string/array/number is not a review)', () => {
    expect(readDecisionReviewWireState({ decision_review: 'a string' }).kind).toBe('malformed')
    expect(readDecisionReviewWireState({ decision_review: [] }).kind).toBe('malformed')
    expect(readDecisionReviewWireState({ decision_review: 7 }).kind).toBe('malformed')
  })

  it('produced_at ALONE is not a review — the discriminator needs a content key too', () => {
    expect(readDecisionReviewWireState({ decision_review: { produced_at: 'x' } }).kind).toBe(
      'malformed',
    )
  })
})

describe('readDecisionReviewWireState — partial 0.30 payloads are honest, not alarms', () => {
  const AT = '2026-07-30T00:00:00.000Z'

  it('a 0.30 payload carrying only non-prose content keys is v0_30 with hasProse=false', () => {
    // Legitimate: the LLM can return empty flip_thresholds/bias_findings. That
    // is a valid review with nothing to render, NOT malformed input.
    const state = readDecisionReviewWireState({
      decision_review: { produced_at: AT, bias_findings: [], flip_thresholds: [] },
    })
    expect(state.kind).toBe('v0_30')
    if (state.kind !== 'v0_30') return
    expect(state.review.hasProse).toBe(false)
    expect(state.review.narrative_summary).toBeNull()
    expect(state.review.robustness_explanation).toBeNull()
    expect(state.review.story_headlines).toEqual([])
    expect(state.review.scenario_contexts).toEqual([])
  })

  it('wrong-typed prose fields are dropped to null, never coerced or defaulted', () => {
    const state = readDecisionReviewWireState({
      decision_review: {
        narrative_summary: 42,
        readiness_rationale: { not: 'a string' },
        robustness_explanation: 'not an object',
        story_headlines: ['not a record'],
        scenario_contexts: 3,
        produced_at: AT,
      },
    })
    expect(state.kind).toBe('v0_30')
    if (state.kind !== 'v0_30') return
    expect(state.review.narrative_summary).toBeNull()
    expect(state.review.readiness_rationale).toBeNull()
    expect(state.review.robustness_explanation).toBeNull()
    expect(state.review.story_headlines).toEqual([])
    expect(state.review.scenario_contexts).toEqual([])
    expect(state.review.hasProse).toBe(false)
  })

  it('a robustness_explanation with only a summary keeps the summary and empties the arrays', () => {
    const state = readDecisionReviewWireState({
      decision_review: { produced_at: AT, robustness_explanation: { summary: 'Stable.' } },
    })
    if (state.kind !== 'v0_30') throw new Error(state.kind)
    expect(state.review.robustness_explanation).toEqual({
      summary: 'Stable.',
      primary_risk: null,
      stability_factors: [],
      fragility_factors: [],
    })
    expect(state.review.hasProse).toBe(true)
  })

  it('non-string members inside the factor arrays are dropped, not stringified', () => {
    const state = readDecisionReviewWireState({
      decision_review: {
        produced_at: AT,
        robustness_explanation: {
          summary: 'S',
          stability_factors: ['keep', 5, null, { a: 1 }, 'also keep'],
          fragility_factors: 'not an array',
        },
      },
    })
    if (state.kind !== 'v0_30') throw new Error(state.kind)
    expect(state.review.robustness_explanation!.stability_factors).toEqual(['keep', 'also keep'])
    expect(state.review.robustness_explanation!.fragility_factors).toEqual([])
  })

  it('non-string story headlines and malformed scenario entries are skipped', () => {
    const state = readDecisionReviewWireState({
      decision_review: {
        produced_at: AT,
        story_headlines: { opt_a: 'kept', opt_b: 99, opt_c: null, opt_d: 'also kept' },
        scenario_contexts: {
          s1: { trigger_description: 'T', consequence: 'C' },
          s2: 'not an object',
          s3: { trigger_description: 'only trigger' },
          s4: {},
        },
      },
    })
    if (state.kind !== 'v0_30') throw new Error(state.kind)
    expect(state.review.story_headlines).toEqual([
      { optionId: 'opt_a', headline: 'kept' },
      { optionId: 'opt_d', headline: 'also kept' },
    ])
    // s4 carries neither field — nothing to render, so it is not an entry.
    expect(state.review.scenario_contexts).toEqual([
      { id: 's1', trigger_description: 'T', consequence: 'C' },
      { id: 's3', trigger_description: 'only trigger', consequence: null },
    ])
  })

  it('empty-string prose does not count as prose (an empty <p> is not a value)', () => {
    const state = readDecisionReviewWireState({
      decision_review: { produced_at: AT, narrative_summary: '', readiness_rationale: '   ' },
    })
    if (state.kind !== 'v0_30') throw new Error(state.kind)
    expect(state.review.narrative_summary).toBeNull()
    expect(state.review.readiness_rationale).toBeNull()
    expect(state.review.hasProse).toBe(false)
  })
})
