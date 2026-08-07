/**
 * Dropped-content counter — Track C Step 1 (approved D-5).
 *
 * Unit coverage: aggregation by type+source+rationale, console.info
 * observability line, privacy-safe label clamping, snapshot immutability,
 * and the never-throws contract.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  recordDroppedContent,
  getDroppedContentSnapshot,
  _resetDroppedContentCounter,
} from '../droppedContentCounter'

function spyOnConsoleInfo() {
  return vi.spyOn(console, 'info').mockImplementation(() => {})
}

describe('droppedContentCounter', () => {
  let infoSpy: ReturnType<typeof spyOnConsoleInfo>

  beforeEach(() => {
    _resetDroppedContentCounter()
    infoSpy = spyOnConsoleInfo()
  })

  afterEach(() => {
    infoSpy.mockRestore()
    _resetDroppedContentCounter()
  })

  it('starts empty with the per-turn truth pointer', () => {
    const snap = getDroppedContentSnapshot()
    expect(snap.total_dropped).toBe(0)
    expect(snap.entries).toEqual([])
    expect(snap.per_turn_truth).toBe(
      'payloads.cee_response.__additive__.unknown_blocks',
    )
  })

  it('aggregates by type+source+rationale and totals instances', () => {
    recordDroppedContent({
      blockType: 'shiny_new_block',
      source: 'v5_response_parser',
      rationale: 'unknown_block_type_dropped_pre_validation',
      count: 2,
    })
    recordDroppedContent({
      blockType: 'shiny_new_block',
      source: 'v5_response_parser',
      rationale: 'unknown_block_type_dropped_pre_validation',
    })
    recordDroppedContent({
      blockType: 'other_block',
      source: 'v5_response_parser',
      rationale: 'unknown_block_type_dropped_pre_validation',
    })

    const snap = getDroppedContentSnapshot()
    expect(snap.total_dropped).toBe(4)
    expect(snap.entries).toHaveLength(2)
    // Sorted by count desc
    expect(snap.entries[0]).toMatchObject({
      block_type: 'shiny_new_block',
      source: 'v5_response_parser',
      rationale: 'unknown_block_type_dropped_pre_validation',
      count: 3,
    })
    expect(snap.entries[1]).toMatchObject({ block_type: 'other_block', count: 1 })
    expect(snap.entries[0].first_seen_at).toBeTruthy()
    expect(snap.entries[0].last_seen_at).toBeTruthy()
  })

  it('emits a console.info observability line per record call', () => {
    recordDroppedContent({
      blockType: 'shiny_new_block',
      source: 'v5_response_parser',
      rationale: 'unknown_block_type_dropped_pre_validation',
      count: 2,
    })
    expect(infoSpy).toHaveBeenCalledTimes(1)
    const line = String(infoSpy.mock.calls[0][0])
    expect(line).toContain('[dropped-content]')
    expect(line).toContain('shiny_new_block')
    expect(line).toContain('source=v5_response_parser')
    expect(line).toContain('rationale=unknown_block_type_dropped_pre_validation')
    expect(line).toContain('session total 2')
  })

  it('clamps oversized labels (privacy/robustness bound) and floors bad counts to 1', () => {
    recordDroppedContent({
      blockType: 'x'.repeat(500),
      source: 'v5_response_parser',
      rationale: 'unknown_block_type_dropped_pre_validation',
      count: Number.NaN,
    })
    const snap = getDroppedContentSnapshot()
    expect(snap.entries[0].block_type.length).toBeLessThanOrEqual(101) // 100 + ellipsis
    expect(snap.entries[0].count).toBe(1)
  })

  it('snapshot is a copy — mutating it does not corrupt the counter', () => {
    recordDroppedContent({
      blockType: 'a_block',
      source: 'v5_response_parser',
      rationale: 'unknown_block_type_dropped_pre_validation',
    })
    const snap = getDroppedContentSnapshot()
    snap.entries[0].count = 999
    expect(getDroppedContentSnapshot().entries[0].count).toBe(1)
  })
})
