/**
 * buildPriorityProgress — direct unit tests for the pre-analysis priority
 * confirmation counter (pre-analysis-power-v1 Task 5 + addendum fixes).
 *
 * Contract locked by this spec:
 *   - In scope: any top-3 entry with `action.targetType === 'node'` and
 *     a defined `targetId`. The underlying node is looked up by id and
 *     its `observed_state.source` is checked against `REVIEWED_SOURCES`
 *     in `isReviewedByUser`.
 *   - Node entries whose `targetId` cannot be resolved to a present
 *     factor node (deleted, mid-render, fixture mismatch) still count
 *     toward `total` but never toward `confirmed`. Treating an
 *     unresolved reference as a soft "unconfirmed" signal is safer than
 *     silently dropping it.
 *   - Edge entries are excluded from BOTH numerator and denominator
 *     (addendum fix). Today the edge handler writes `weight` but no
 *     `source` field, so counting them would lock a top-3 with any edge
 *     entry below 100% forever. Excluding them keeps the visible bar
 *     honest until an edge-reviewed predicate exists.
 */

import { describe, it, expect } from 'vitest'
import type { Node } from '@xyflow/react'
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

describe('buildPriorityProgress — edge entries (addendum fix for Blocking 1)', () => {
  it('excludes edge entries from BOTH numerator and denominator', () => {
    // 1 node confirmed + 1 edge in top-3 → 1/1, NOT 1/2 (the legacy
    // behaviour locked a "Needs judgement" edge below 100% forever).
    const factorNodes = [node('n1', 'user_confirmed')]
    const topThree = [nodeEntry('a', 'n1'), edgeEntry('b', 'e1')]
    expect(buildPriorityProgress(topThree, factorNodes)).toEqual({ confirmed: 1, total: 1 })
  })

  it('returns { 0, 0 } when the top-3 consists entirely of edge entries', () => {
    const topThree = [edgeEntry('a', 'e1'), edgeEntry('b', 'e2'), edgeEntry('c', 'e3')]
    expect(buildPriorityProgress(topThree, [])).toEqual({ confirmed: 0, total: 0 })
  })

  it('a confirmed node alongside three unconfirmable edges still reads 1/1', () => {
    const factorNodes = [node('n1', 'user_confirmed')]
    const topThree = [nodeEntry('a', 'n1'), edgeEntry('b', 'e1'), edgeEntry('c', 'e2')]
    expect(buildPriorityProgress(topThree, factorNodes)).toEqual({ confirmed: 1, total: 1 })
  })
})
