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

import {
  adaptTypedCoachingBlock,
  adaptTypedReviewCardBlock,
} from '../phase3TypedBlocks'

const FIXTURE_PATH = resolve(__dirname, 'fixtures/cee-response-b82c89dd-trimmed.json')

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
