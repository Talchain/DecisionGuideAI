/**
 * isAiSource — predicate spec.
 *
 * Locks the AI_SOURCES set, the field-level fallback chain, and the
 * disjoint-from-user-sources guarantee.
 */

import { describe, it, expect } from 'vitest'
import type { Node } from '@xyflow/react'
import { isAiSource, isAiSourceFromNode } from '../isAiSource'
import { isReviewedSource } from '../isReviewedByUser'

const makeNode = (data: Record<string, unknown>): Node => ({
  id: 'n1',
  type: 'factor',
  position: { x: 0, y: 0 },
  data,
})

describe('isAiSource — string-level helper', () => {
  it.each(['ai', 'cee_inference', 'inferred', 'engine', 'ai_estimate'])(
    'returns true for canonical AI source "%s"',
    (source) => {
      expect(isAiSource(source)).toBe(true)
    },
  )

  it.each(['user_confirmed', 'user_assumption', 'user_override', 'user', 'user_edited', 'brief_extraction', 'default'])(
    'returns false for non-AI source "%s"',
    (source) => {
      expect(isAiSource(source)).toBe(false)
    },
  )

  it('returns false for null / undefined / empty input', () => {
    expect(isAiSource(null)).toBe(false)
    expect(isAiSource(undefined)).toBe(false)
    expect(isAiSource('')).toBe(false)
  })

  it('AI_SOURCES and REVIEWED_SOURCES are disjoint (no value is both)', () => {
    const aiValues = ['ai', 'cee_inference', 'inferred', 'engine', 'ai_estimate']
    for (const v of aiValues) {
      expect(isAiSource(v)).toBe(true)
      expect(isReviewedSource(v)).toBe(false)
    }
  })
})

describe('isAiSourceFromNode — field-level fallback', () => {
  it.each(['ai', 'cee_inference', 'inferred', 'engine', 'ai_estimate'])(
    'returns true when observed_state.source is "%s"',
    (source) => {
      expect(isAiSourceFromNode(makeNode({ observed_state: { source } }))).toBe(true)
    },
  )

  it('returns true via camelCase fallback when snake-case shell is empty', () => {
    const node = makeNode({
      observed_state: {},
      observedState: { source: 'cee_inference' },
    })
    expect(isAiSourceFromNode(node)).toBe(true)
  })

  it('returns true via top-level data.source when neither wrapper has source', () => {
    const node = makeNode({
      observed_state: {},
      observedState: {},
      source: 'ai',
    })
    expect(isAiSourceFromNode(node)).toBe(true)
  })

  it('snake-case wins when both wrappers have a source', () => {
    const node = makeNode({
      observed_state: { source: 'user_confirmed' }, // canonical: not AI
      observedState: { source: 'cee_inference' }, // fallback: would resolve true
    })
    expect(isAiSourceFromNode(node)).toBe(false)
  })

  it('returns false when every fallback path yields undefined', () => {
    expect(isAiSourceFromNode(makeNode({}))).toBe(false)
    expect(isAiSourceFromNode(makeNode({ observed_state: {}, observedState: {} }))).toBe(false)
  })

  it('returns false for user-owned sources (predicate is AI-only)', () => {
    expect(isAiSourceFromNode(makeNode({ observed_state: { source: 'user_confirmed' } }))).toBe(false)
    expect(isAiSourceFromNode(makeNode({ observed_state: { source: 'user_override' } }))).toBe(false)
  })
})
