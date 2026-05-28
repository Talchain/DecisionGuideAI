/**
 * buildPriorityProgress — direct unit tests for the pre-analysis priority
 * confirmation counter (pre-analysis-power-v1 Task 5 + post-deploy
 * denominator alignment).
 *
 * Contract locked by this spec:
 *   - `total` equals `topThree.length` — every visible card is in the
 *     denominator so the rendered "N of M" matches the visible list
 *     exactly. Anything else produces a trust leak (denominator < cards).
 *   - `confirmed` counts node-type entries whose underlying node's
 *     `observed_state.source` is in `REVIEWED_SOURCES` (see
 *     `isReviewedByUser`). Edge entries today have no equivalent
 *     `source` write on `onUpdateEdgeStrength`, so they count toward
 *     `total` but cannot reach `confirmed`. Tier B follow-up: add an
 *     edge-reviewed predicate so the edge quick-select fills `confirmed`.
 *   - Node entries whose `targetId` cannot be resolved (deleted,
 *     mid-render, fixture mismatch) count toward `total` but never
 *     toward `confirmed` — same "denominator alignment" rule.
 */

import { describe, it, expect } from 'vitest'
import type { Edge, Node } from '@xyflow/react'
import { buildPriorityProgress } from '../buildPriorityProgress'

const node = (id: string, source: string): Node => ({
  id,
  type: 'factor',
  position: { x: 0, y: 0 },
  data: { label: id, observed_state: { source } },
})

const nodeEntry = (key: string, targetId: string) => ({
  card: { action: { targetId, targetType: 'node' as const } },
  _key: key,
})

const edgeEntry = (key: string, targetId: string) => ({
  card: { action: { targetId, targetType: 'edge' as const } },
  _key: key,
})

describe('buildPriorityProgress — node entries', () => {
  it('counts node entries whose source ∈ user_*', () => {
    const factorNodes = [node('n1', 'user_confirmed'), node('n2', 'user_assumption'), node('n3', 'cee_inference')]
    const topThree = [nodeEntry('a', 'n1'), nodeEntry('b', 'n2'), nodeEntry('c', 'n3')]
    expect(buildPriorityProgress(topThree, factorNodes)).toEqual({ confirmed: 2, total: 3 })
  })

  it('returns total = countOf(node entries) even when every entry is unconfirmed', () => {
    const factorNodes = [node('n1', 'cee_inference'), node('n2', 'brief_extraction')]
    const topThree = [nodeEntry('a', 'n1'), nodeEntry('b', 'n2')]
    expect(buildPriorityProgress(topThree, factorNodes)).toEqual({ confirmed: 0, total: 2 })
  })

  it('returns { 0, 0 } when the topThree is empty', () => {
    expect(buildPriorityProgress([], [node('n1', 'user_confirmed')])).toEqual({ confirmed: 0, total: 0 })
  })

  it('node entries whose underlying node cannot be resolved count toward total only', () => {
    const factorNodes = [node('n1', 'user_override')]
    const topThree = [nodeEntry('a', 'n1'), nodeEntry('b', 'missing-id')]
    expect(buildPriorityProgress(topThree, factorNodes)).toEqual({ confirmed: 1, total: 2 })
  })

  it('user_override counts as confirmed (parity with reviewedFactorsCount)', () => {
    const factorNodes = [node('n1', 'user_override')]
    expect(buildPriorityProgress([nodeEntry('a', 'n1')], factorNodes)).toEqual({ confirmed: 1, total: 1 })
  })

  it('non-user sources (cee_inference, brief_extraction, undefined) never count as confirmed', () => {
    const factorNodes = [
      node('n1', 'cee_inference'),
      node('n2', 'brief_extraction'),
      {
        id: 'n3',
        type: 'factor',
        position: { x: 0, y: 0 },
        data: { label: 'n3' },
      } as Node,
    ]
    const topThree = [nodeEntry('a', 'n1'), nodeEntry('b', 'n2'), nodeEntry('c', 'n3')]
    expect(buildPriorityProgress(topThree, factorNodes)).toEqual({ confirmed: 0, total: 3 })
  })

  // Addendum: REVIEWED_SOURCES was expanded to include the broader app's
  // canonical user-owned values. Locking each here so future tightening
  // of the set cannot silently regress genuinely user-edited factors.
  it.each(['user', 'user_edited'])(
    'broadened source value "%s" counts as confirmed (addendum fix for Blocking 3)',
    (sourceValue) => {
      const factorNodes = [node('n1', sourceValue)]
      expect(buildPriorityProgress([nodeEntry('a', 'n1')], factorNodes)).toEqual({ confirmed: 1, total: 1 })
    },
  )
})

describe('buildPriorityProgress — edge entries (pre-analysis-power-v2: edge predicate landed)', () => {
  const reviewedEdge = (id: string): Edge => ({
    id,
    source: 's',
    target: 't',
    data: { userReviewedStrength: true } as Record<string, unknown>,
  })
  const unreviewedEdge = (id: string): Edge => ({
    id,
    source: 's',
    target: 't',
    data: { weight: 0.5 } as Record<string, unknown>,
  })

  it('counts edge entries toward total so denominator matches visible cards', () => {
    // 1 node confirmed + 1 unreviewed edge → 1/2.
    const factorNodes = [node('n1', 'user_confirmed')]
    const topThree = [nodeEntry('a', 'n1'), edgeEntry('b', 'e1')]
    expect(buildPriorityProgress(topThree, factorNodes, [unreviewedEdge('e1')])).toEqual({ confirmed: 1, total: 2 })
  })

  it('counts a reviewed edge toward confirmed (userReviewedStrength === true)', () => {
    // 1 confirmed node + 1 user-reviewed edge → 2/2.
    const factorNodes = [node('n1', 'user_confirmed')]
    const topThree = [nodeEntry('a', 'n1'), edgeEntry('b', 'e1')]
    expect(
      buildPriorityProgress(topThree, factorNodes, [reviewedEdge('e1')]),
    ).toEqual({ confirmed: 2, total: 2 })
  })

  it('unreviewed edges still count toward total but not confirmed', () => {
    const topThree = [edgeEntry('a', 'e1'), edgeEntry('b', 'e2'), edgeEntry('c', 'e3')]
    expect(
      buildPriorityProgress(topThree, [], [unreviewedEdge('e1'), unreviewedEdge('e2'), unreviewedEdge('e3')]),
    ).toEqual({ confirmed: 0, total: 3 })
  })

  it('mixed: a confirmed node + 1 reviewed edge + 1 unreviewed edge reads 2/3', () => {
    const factorNodes = [node('n1', 'user_confirmed')]
    const topThree = [nodeEntry('a', 'n1'), edgeEntry('b', 'e1'), edgeEntry('c', 'e2')]
    expect(
      buildPriorityProgress(topThree, factorNodes, [reviewedEdge('e1'), unreviewedEdge('e2')]),
    ).toEqual({ confirmed: 2, total: 3 })
  })

  it('edge entries with no matching id in edges[] count toward total only (defensive)', () => {
    const topThree = [edgeEntry('a', 'missing-edge-id')]
    expect(buildPriorityProgress(topThree, [], [])).toEqual({ confirmed: 0, total: 1 })
  })
})
