import { describe, it, expect, beforeEach, vi } from 'vitest'

// We will mock analytics before importing the module under test to capture events

describe('storage-level snapshots telemetry', () => {
  let calls: Array<{ event: string; props: Record<string, any> }>

  beforeEach(() => {
    calls = []
    vi.doMock('@/lib/analytics', () => ({
      track: (event: string, props: Record<string, any> = {}) => {
        calls.push({ event, props })
      },
      model_segment_changed: () => {},
    }))
  })

  it('emits one trim event with droppedIds when saving over cap', async () => {
    const { saveSnapshot, listSnapshots } = await import('@/sandbox/state/snapshots')
    const decisionId = 'dec-cap'

    // Seed to exactly 10
    for (let i = 0; i < 10; i++) {
      saveSnapshot(decisionId, new Uint8Array(), { note: `S${i}` })
    }
    expect(listSnapshots(decisionId)).toHaveLength(10)

    // Pushing one more triggers exactly one trim with droppedIds length 1
    saveSnapshot(decisionId, new Uint8Array(), { note: 'Overflow' })

    const trimEvents = calls.filter(c => c.event === 'sandbox_snapshot' && c.props.op === 'trim')
    expect(trimEvents).toHaveLength(1)
    expect(trimEvents[0].props.droppedCount).toBe(1)
    expect(Array.isArray(trimEvents[0].props.droppedIds)).toBe(true)
    expect(trimEvents[0].props.droppedIds.length).toBe(1)
    expect(trimEvents[0].props.decisionId).toBe(decisionId)
  })

  it('emits one delete on explicit delete', async () => {
    const { saveSnapshot, deleteSnapshot, listSnapshots } = await import('@/sandbox/state/snapshots')
    const decisionId = 'dec-del'

    const m1 = saveSnapshot(decisionId, new Uint8Array(), { note: 'A' })
    const m2 = saveSnapshot(decisionId, new Uint8Array(), { note: 'B' })
    expect(listSnapshots(decisionId)).toHaveLength(2)

    deleteSnapshot(decisionId, m1.id)

    const delEvents = calls.filter(c => c.event === 'sandbox_snapshot' && c.props.op === 'delete')
    expect(delEvents).toHaveLength(1)
    expect(delEvents[0].props.snapshotId).toBe(m1.id)
    expect(delEvents[0].props.decisionId).toBe(decisionId)
  })

  it('clearSnapshots emits delete per snapshot and a final clear summary', async () => {
    const { saveSnapshot, clearSnapshots, listSnapshots } = await import('@/sandbox/state/snapshots')
    const decisionId = 'dec-clear'

    const m1 = saveSnapshot(decisionId, new Uint8Array(), { note: 'A' })
    const m2 = saveSnapshot(decisionId, new Uint8Array(), { note: 'B' })
    const m3 = saveSnapshot(decisionId, new Uint8Array(), { note: 'C' })
    expect(listSnapshots(decisionId)).toHaveLength(3)

    clearSnapshots(decisionId)

    const delEvents = calls.filter(c => c.event === 'sandbox_snapshot' && c.props.op === 'delete')
    const clearEvents = calls.filter(c => c.event === 'sandbox_snapshot' && c.props.op === 'clear')

    expect(delEvents).toHaveLength(3)
    const deletedIds = delEvents.map(e => e.props.snapshotId).sort()
    expect(deletedIds.sort()).toEqual([m1.id, m2.id, m3.id].sort())

    expect(clearEvents).toHaveLength(1)
    expect(clearEvents[0].props.count).toBe(3)
    expect(clearEvents[0].props.decisionId).toBe(decisionId)
  })
})
