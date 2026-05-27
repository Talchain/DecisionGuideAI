/**
 * isReviewedByUser — predicate spec, including the addendum fixes for
 * Blocking 2 (field-level fallback) and Blocking 3 (broadened source set).
 *
 * Tests cover:
 *   - Every value in the canonical REVIEWED_SOURCES union returns true.
 *   - Non-user sources return false.
 *   - Field-level fallback: an `observed_state: {}` shell does NOT shadow
 *     a valid `observedState.source` or top-level `data.source`.
 *   - Mixed/empty data shapes return false.
 */

import { describe, it, expect } from 'vitest'
import type { Node } from '@xyflow/react'
import { isReviewedByUser, isReviewedSource } from '../isReviewedByUser'

const makeNode = (data: Record<string, unknown>): Node => ({
  id: 'n1',
  type: 'factor',
  position: { x: 0, y: 0 },
  data,
})

describe('isReviewedByUser — REVIEWED_SOURCES membership (addendum Blocking 3)', () => {
  it.each([
    'user_confirmed',
    'user_assumption',
    'user_override',
    'user',
    'user_edited',
  ])('returns true for canonical user-owned source value "%s"', (source) => {
    expect(isReviewedByUser(makeNode({ observed_state: { source } }))).toBe(true)
  })

  it.each(['cee_inference', 'brief_extraction', 'ai', 'inferred', 'engine', 'ai_estimate', 'default'])(
    'returns false for non-user source value "%s"',
    (source) => {
      expect(isReviewedByUser(makeNode({ observed_state: { source } }))).toBe(false)
    },
  )

  it('returns false when source is undefined / missing', () => {
    expect(isReviewedByUser(makeNode({ observed_state: {} }))).toBe(false)
    expect(isReviewedByUser(makeNode({}))).toBe(false)
  })
})

describe('isReviewedByUser — field-level fallback (addendum Blocking 2)', () => {
  // Critical case: snake-case wrapper present but missing `source`. The
  // OLD object-level `??` resolved at the wrapper level and ignored
  // the camelCase + top-level fallbacks, producing silent false negatives.
  it('falls back from empty observed_state to observedState.source', () => {
    const node = makeNode({
      observed_state: {}, // shell with no source — must NOT short-circuit
      observedState: { source: 'user_confirmed' },
    })
    expect(isReviewedByUser(node)).toBe(true)
  })

  it('falls back from empty observed_state to top-level data.source', () => {
    const node = makeNode({
      observed_state: {},
      source: 'user_override',
    })
    expect(isReviewedByUser(node)).toBe(true)
  })

  it('snake-case source wins over camelCase when both have source (canonical order preserved)', () => {
    // snake_case is the canonical wire format — when both have a source
    // value, snake_case must be the one read. Camel is a fallback only.
    const node = makeNode({
      observed_state: { source: 'cee_inference' }, // canonical: not a user value
      observedState: { source: 'user_confirmed' }, // fallback: would resolve true
    })
    expect(isReviewedByUser(node)).toBe(false)
  })

  it('top-level data.source is the last fallback when neither wrapper has source', () => {
    const node = makeNode({
      observed_state: {},
      observedState: {},
      source: 'user_assumption',
    })
    expect(isReviewedByUser(node)).toBe(true)
  })

  it('returns false when every fallback path yields undefined', () => {
    const node = makeNode({
      observed_state: {},
      observedState: {},
    })
    expect(isReviewedByUser(node)).toBe(false)
  })
})

describe('isReviewedSource — string-level helper', () => {
  it.each(['user_confirmed', 'user_assumption', 'user_override', 'user', 'user_edited'])(
    'returns true for canonical user-owned value "%s"',
    (source) => {
      expect(isReviewedSource(source)).toBe(true)
    },
  )

  it.each(['cee_inference', 'brief_extraction', 'ai', 'engine', 'default'])(
    'returns false for non-user value "%s"',
    (source) => {
      expect(isReviewedSource(source)).toBe(false)
    },
  )

  it('returns false for null / undefined / empty input', () => {
    expect(isReviewedSource(null)).toBe(false)
    expect(isReviewedSource(undefined)).toBe(false)
    expect(isReviewedSource('')).toBe(false)
  })
})
