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
import type { Edge, Node } from '@xyflow/react'
import { isReviewedByUser, isReviewedEdge, isReviewedSource } from '../isReviewedByUser'

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

describe('isReviewedByUser — wire-carried provenance rung (L66, final-walk defect 0)', () => {
  // The server graph structurally CANNOT carry a user claim in
  // observed_state.source (CEE's ObservedStateV3 enum has no user member —
  // rowed 2.396(b)); what it DOES carry is node-level provenance:'user_set',
  // written by CEE when it applies the user's edit. On a reload that claim is
  // the only durable evidence the user checked the value, so the predicate
  // reads it as the final rung. Witnessed shape: runE post-reload
  // fac_pricing_level — provenance user_set + observed_state.source
  // cee_inference — must read as reviewed.
  it('the exact runE post-reload shape reads as reviewed (provenance user_set beats a producer source)', () => {
    const node = makeNode({
      label: 'Paid Tier Price Point',
      provenance: 'user_set',
      display_value: '0.7',
      observedState: {
        value: 0.7,
        source: 'cee_inference',
        raw_value: 0.7,
        std: 0.006999999999999999,
        baseline: 0.7,
      },
    })
    expect(isReviewedByUser(node)).toBe(true)
  })

  it('provenance user_set alone (no observed-state bags at all) reads as reviewed', () => {
    expect(isReviewedByUser(makeNode({ provenance: 'user_set' }))).toBe(true)
  })

  it.each(['ai_inferred', 'from_brief'])(
    'non-user provenance "%s" does NOT paint — the over-claim direction is the serious one',
    (provenance) => {
      expect(
        isReviewedByUser(makeNode({ provenance, observedState: { source: 'cee_inference' } })),
      ).toBe(false)
    },
  )

  it('a user-owned SOURCE still wins regardless of provenance (the in-session receipt stamp path)', () => {
    const node = makeNode({
      provenance: 'ai_inferred',
      observed_state: { source: 'user_override' },
    })
    expect(isReviewedByUser(node)).toBe(true)
  })
})

describe('isReviewedEdge — edge-level predicate (pre-analysis-power-v2)', () => {
  const makeEdge = (data?: Record<string, unknown>): Edge => ({
    id: 'e1',
    source: 's',
    target: 't',
    data,
  })

  it('returns true when data.userReviewedStrength === true', () => {
    expect(isReviewedEdge(makeEdge({ userReviewedStrength: true }))).toBe(true)
  })

  it('returns false when data.userReviewedStrength is false', () => {
    expect(isReviewedEdge(makeEdge({ userReviewedStrength: false }))).toBe(false)
  })

  it('returns false when the marker is absent (legacy edges, fresh-from-CEE)', () => {
    expect(isReviewedEdge(makeEdge({}))).toBe(false)
    expect(isReviewedEdge(makeEdge({ weight: 0.7 }))).toBe(false)
  })

  it('returns false when data itself is undefined', () => {
    expect(isReviewedEdge(makeEdge())).toBe(false)
  })

  it('only the literal `true` counts (strict equality, not truthy)', () => {
    expect(isReviewedEdge(makeEdge({ userReviewedStrength: 1 as unknown as boolean }))).toBe(false)
    expect(isReviewedEdge(makeEdge({ userReviewedStrength: 'true' as unknown as boolean }))).toBe(false)
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
