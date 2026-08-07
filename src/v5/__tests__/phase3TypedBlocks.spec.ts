/**
 * Lane UI-R3 (truth rendering) — Track C slice 1: 0.13.x typed Phase 3
 * block adapters (coaching / review_card).
 *
 * Contract under test (provisional_doctrine_v0):
 *   - EXACTLY the typed fields are read; unknown subfields at any depth are
 *     ignored (additive producer evolution never breaks rendering).
 *   - Fail-closed: missing/mistyped required render-relevant fields → null
 *     (caller counts + suppresses; nothing is invented or repaired).
 *   - Copy is producer-verbatim.
 *
 * Shapes mirror the REAL live staging fixture
 * (cee-response-b82c89dd-trimmed.json) — including its omission of the
 * schema-declared `created_at`, which must NOT cause suppression.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { EvidenceBlockSchema, ExerciseBlockSchema } from '@talchain/schemas/boundary'

import {
  adaptTypedCoachingBlock,
  adaptTypedEvidenceBlock,
  adaptTypedExerciseBlock,
  adaptTypedReviewCardBlock,
} from '../phase3TypedBlocks'

const FIXTURE_PATH = resolve(__dirname, 'fixtures/cee-response-b82c89dd-trimmed.json')

// Slice 2 (Lane UI-W4 C): bundle-shaped evidence/exercise fixture. No live
// staging capture carries these types yet, so the fixture is pinned to the
// vendored 0.13.1 contract by parsing it against the REAL Zod schemas below.
const SLICE2_FIXTURE_PATH = resolve(
  __dirname,
  'fixtures/phase3-evidence-exercise.bundle-shaped.json',
)

function liveBlocks(): Array<Record<string, unknown>> {
  const fixture = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as {
    blocks: Array<Record<string, unknown>>
  }
  return fixture.blocks
}

function liveReviewCard(): Record<string, unknown> {
  const block = liveBlocks().find((b) => b.type === 'review_card')
  if (!block) throw new Error('fixture review_card missing')
  return block
}

function liveCoaching(): Record<string, unknown> {
  const block = liveBlocks().find((b) => b.type === 'coaching')
  if (!block) throw new Error('fixture coaching missing')
  return block
}

function slice2Blocks(): Array<Record<string, unknown>> {
  const fixture = JSON.parse(readFileSync(SLICE2_FIXTURE_PATH, 'utf8')) as {
    blocks: Array<Record<string, unknown>>
  }
  return fixture.blocks
}

function fixtureEvidence(): Record<string, unknown> {
  const block = slice2Blocks().find((b) => b.type === 'evidence')
  if (!block) throw new Error('fixture evidence missing')
  return block
}

function fixtureExercises(): Array<Record<string, unknown>> {
  const blocks = slice2Blocks().filter((b) => b.type === 'exercise')
  if (blocks.length === 0) throw new Error('fixture exercise missing')
  return blocks
}

describe('adaptTypedReviewCardBlock', () => {
  it('adapts a REAL live 0.13.x review_card verbatim (created_at absent on the live wire)', () => {
    const raw = liveReviewCard()
    const adapted = adaptTypedReviewCardBlock(raw)
    expect(adapted).not.toBeNull()
    expect(adapted).toMatchObject({
      type: 'v5_review_card',
      block_id: raw.block_id,
      title: raw.title,
      body: raw.body,
      severity: raw.severity,
      card_kind: raw.card_kind,
      priority_rank: raw.priority_rank,
      freshness: raw.freshness,
    })
  })

  it('ignores unknown subfields (top level AND inside target_refs)', () => {
    const adapted = adaptTypedReviewCardBlock({
      ...liveReviewCard(),
      some_future_field: { nested: true },
      target_refs: [
        { id: 'fac_x', label: 'Factor X', kind: 'factor', future_ref_field: 42 },
      ],
    })
    expect(adapted).not.toBeNull()
    expect(adapted?.target_refs).toEqual([{ id: 'fac_x', label: 'Factor X', kind: 'factor' }])
    expect('some_future_field' in (adapted as object)).toBe(false)
  })

  it.each([
    ['missing body', { body: undefined }],
    ['empty title', { title: '   ' }],
    ['invalid severity', { severity: 'catastrophic' }],
    ['missing severity', { severity: undefined }],
    ['non-numeric priority_rank', { priority_rank: 'first' }],
    ['invalid freshness', { freshness: 'ancient' }],
    ['target_refs not an array', { target_refs: 'none' }],
    ['wrong type discriminator', { type: 'coaching' }],
  ])('fail-closed: %s → null (counted+suppressed by caller, never crash)', (_name, overrides) => {
    const adapted = adaptTypedReviewCardBlock({ ...liveReviewCard(), ...overrides })
    expect(adapted).toBeNull()
  })

  it('legacy-shaped card (summary instead of body, no severity) → null so the legacy bridge handles it', () => {
    const adapted = adaptTypedReviewCardBlock({
      type: 'review_card',
      block_id: 'rc-legacy',
      title: 'Legacy card',
      summary: 'Legacy body text lives under summary.',
      freshness: 'fresh',
      card_kind: 'narrative',
      target_refs: [],
    })
    expect(adapted).toBeNull()
  })

  it('skips malformed individual target_refs entries but keeps valid ones', () => {
    const adapted = adaptTypedReviewCardBlock({
      ...liveReviewCard(),
      target_refs: [
        { id: 'fac_ok', label: 'OK', kind: 'factor' },
        { id: 'fac_missing_label', kind: 'factor' },
        'not-an-object',
      ],
    })
    expect(adapted?.target_refs).toEqual([{ id: 'fac_ok', label: 'OK', kind: 'factor' }])
  })
})

describe('adaptTypedCoachingBlock', () => {
  it('adapts a REAL live 0.13.x coaching block verbatim, including action refs', () => {
    const raw = liveCoaching()
    const adapted = adaptTypedCoachingBlock(raw)
    expect(adapted).not.toBeNull()
    expect(adapted).toMatchObject({
      type: 'v5_coaching',
      block_id: raw.block_id,
      title: raw.title,
      body: raw.body,
      coaching_kind: raw.coaching_kind,
      source: raw.source,
      priority_rank: raw.priority_rank,
      freshness: raw.freshness,
      action_intent: raw.action_intent,
      action_label: raw.action_label,
    })
  })

  it('omits optional action fields when absent (no defaults)', () => {
    const raw = { ...liveCoaching() }
    delete raw.action_intent
    delete raw.action_label
    const adapted = adaptTypedCoachingBlock(raw)
    expect(adapted).not.toBeNull()
    expect('action_intent' in (adapted as object)).toBe(false)
    expect('action_label' in (adapted as object)).toBe(false)
  })

  it.each([
    ['missing body', { body: undefined }],
    ['missing coaching_kind', { coaching_kind: undefined }],
    ['missing source', { source: undefined }],
    ['missing block_id', { block_id: '' }],
    ['invalid freshness', { freshness: 'brand-new' }],
    ['wrong type discriminator', { type: 'review_card' }],
    ['non-object payload', null],
  ])('fail-closed: %s → null', (_name, overrides) => {
    const raw = overrides === null ? null : { ...liveCoaching(), ...overrides }
    expect(adaptTypedCoachingBlock(raw)).toBeNull()
  })
})

// ─── Track C slice 2 (Lane UI-W4 C): evidence / exercise adapters ────────

describe('slice 2 fixture — contract pin', () => {
  it('every fixture block parses against the REAL vendored 0.13.1 Zod schema (drift fails here first)', () => {
    for (const block of slice2Blocks()) {
      const schema = block.type === 'evidence' ? EvidenceBlockSchema : ExerciseBlockSchema
      const result = schema.safeParse(block)
      expect(
        result.success,
        `${String(block.type)} ${String(block.block_id)}: ${JSON.stringify(!result.success ? result.error.issues : [])}`,
      ).toBe(true)
    }
  })
})

describe('adaptTypedEvidenceBlock', () => {
  it('adapts a schema-valid 0.13.1 evidence block verbatim', () => {
    const raw = fixtureEvidence()
    const adapted = adaptTypedEvidenceBlock(raw)
    expect(adapted).not.toBeNull()
    expect(adapted).toMatchObject({
      type: 'v5_evidence',
      block_id: raw.block_id,
      factor_label: raw.factor_label,
      current_confidence: raw.current_confidence,
      evidence_gap: raw.evidence_gap,
      suggested_technique: raw.suggested_technique,
      impact_if_gathered: raw.impact_if_gathered,
      priority_rank: raw.priority_rank,
      severity: raw.severity,
      freshness: raw.freshness,
      action_intent: raw.action_intent,
      action_label: raw.action_label,
    })
    expect(adapted?.factor_ref).toEqual(raw.factor_ref)
    expect(adapted?.target_refs).toEqual(raw.target_refs)
  })

  it('does not require schema-declared metadata the UI never shows (live staging omits it on other Phase 3 types)', () => {
    const raw: Record<string, unknown> = { ...fixtureEvidence() }
    delete raw.created_at
    delete raw.signal_id
    delete raw.source_handler
    delete raw.graph_hash_at_generation
    expect(adaptTypedEvidenceBlock(raw)).not.toBeNull()
  })

  it('ignores unknown subfields (top level AND inside target_refs)', () => {
    const adapted = adaptTypedEvidenceBlock({
      ...fixtureEvidence(),
      some_future_field: { nested: true },
      target_refs: [
        { id: 'fac_x', label: 'Factor X', kind: 'factor', future_ref_field: 42 },
      ],
    })
    expect(adapted).not.toBeNull()
    expect(adapted?.target_refs).toEqual([{ id: 'fac_x', label: 'Factor X', kind: 'factor' }])
    expect('some_future_field' in (adapted as object)).toBe(false)
  })

  it('a malformed factor_ref is omitted without suppressing the block (factor_label still carries the name)', () => {
    const adapted = adaptTypedEvidenceBlock({
      ...fixtureEvidence(),
      factor_ref: { id: 'fac_conversion_rate' },
    })
    expect(adapted).not.toBeNull()
    expect('factor_ref' in (adapted as object)).toBe(false)
  })

  it.each([
    ['missing evidence_gap', { evidence_gap: undefined }],
    ['empty factor_label', { factor_label: '  ' }],
    ['missing suggested_technique', { suggested_technique: undefined }],
    ['missing impact_if_gathered', { impact_if_gathered: undefined }],
    ['invalid severity', { severity: 'catastrophic' }],
    ['missing severity', { severity: undefined }],
    ['missing current_confidence', { current_confidence: undefined }],
    ['non-numeric priority_rank', { priority_rank: 'first' }],
    ['invalid freshness', { freshness: 'ancient' }],
    ['target_refs not an array', { target_refs: 'none' }],
    ['wrong type discriminator', { type: 'coaching' }],
    ['missing block_id', { block_id: '' }],
  ])('fail-closed: %s → null (counted+suppressed by caller, never crash)', (_name, overrides) => {
    expect(adaptTypedEvidenceBlock({ ...fixtureEvidence(), ...overrides })).toBeNull()
  })

  it('non-object payload → null', () => {
    expect(adaptTypedEvidenceBlock(null)).toBeNull()
    expect(adaptTypedEvidenceBlock('evidence')).toBeNull()
  })
})

describe('adaptTypedExerciseBlock', () => {
  it('adapts a schema-valid pre_mortem exercise verbatim (prose + warning signs + refs)', () => {
    const raw = fixtureExercises()[0]
    const adapted = adaptTypedExerciseBlock(raw)
    expect(adapted).not.toBeNull()
    expect(adapted).toMatchObject({
      type: 'v5_exercise',
      block_id: raw.block_id,
      exercise_kind: raw.exercise_kind,
      failure_scenario: raw.failure_scenario,
      warning_signs: raw.warning_signs,
      mitigation: raw.mitigation,
      freshness: raw.freshness,
    })
    expect(adapted?.target_refs).toEqual(raw.target_refs)
  })

  it('adapts a graph-agnostic consider_opposite exercise (optional graph_hash absent, counter_case + review_trigger + target_element_ref)', () => {
    const raw = fixtureExercises()[1]
    expect('graph_hash_at_generation' in raw).toBe(false)
    const adapted = adaptTypedExerciseBlock(raw)
    expect(adapted).not.toBeNull()
    expect(adapted).toMatchObject({
      type: 'v5_exercise',
      counter_case: raw.counter_case,
      review_trigger: raw.review_trigger,
    })
    expect(adapted?.target_element_ref).toEqual(raw.target_element_ref)
    expect('failure_scenario' in (adapted as object)).toBe(false)
  })

  it('skips malformed individual warning_signs entries but keeps valid ones', () => {
    const adapted = adaptTypedExerciseBlock({
      ...fixtureExercises()[0],
      warning_signs: ['A real sign', 42, '', { nested: true }],
    })
    expect(adapted?.warning_signs).toEqual(['A real sign'])
  })

  it('fail-closed: an exercise with NO renderable prose adapts to null (an empty card would be dishonest)', () => {
    const raw: Record<string, unknown> = { ...fixtureExercises()[0] }
    delete raw.failure_scenario
    delete raw.warning_signs
    delete raw.mitigation
    expect(adaptTypedExerciseBlock(raw)).toBeNull()
  })

  it.each([
    ['missing exercise_kind', { exercise_kind: undefined }],
    ['empty exercise_kind', { exercise_kind: ' ' }],
    ['invalid freshness', { freshness: 'ancient' }],
    ['target_refs not an array', { target_refs: 'none' }],
    ['wrong type discriminator', { type: 'evidence' }],
    ['missing block_id', { block_id: '' }],
  ])('fail-closed: %s → null', (_name, overrides) => {
    expect(adaptTypedExerciseBlock({ ...fixtureExercises()[0], ...overrides })).toBeNull()
  })

  it('non-object payload → null', () => {
    expect(adaptTypedExerciseBlock(null)).toBeNull()
  })
})
