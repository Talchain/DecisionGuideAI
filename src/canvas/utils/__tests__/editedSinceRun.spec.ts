import { describe, expect, it } from 'vitest'
import type { Node } from '@xyflow/react'
import { diffEditedNodeIds } from '../editedSinceRun'

const node = (id: string, data: Record<string, unknown>, x = 0, y = 0): Node =>
  ({ id, position: { x, y }, data } as unknown as Node)

describe('diffEditedNodeIds — N3 edited-since-run', () => {
  const snapshot = [
    node('a', { label: 'Team capacity', observedState: { value: 40, unit: '%' } }),
    node('b', { label: 'Salary cost', value: 120000 }),
    node('c', { label: 'Risk of churn' }),
  ]

  it('a label change marks the node edited', () => {
    const current = [
      node('a', { label: 'Team capacity (revised)', observedState: { value: 40, unit: '%' } }),
      node('b', { label: 'Salary cost', value: 120000 }),
      node('c', { label: 'Risk of churn' }),
    ]
    expect(diffEditedNodeIds(current, snapshot)).toEqual(new Set(['a']))
  })

  it('an observed-state / value change marks the node edited', () => {
    const current = [
      node('a', { label: 'Team capacity', observedState: { value: 55, unit: '%' } }),
      node('b', { label: 'Salary cost', value: 130000 }),
      node('c', { label: 'Risk of churn' }),
    ]
    expect(diffEditedNodeIds(current, snapshot)).toEqual(new Set(['a', 'b']))
  })

  it('a node added since the run is edited; removed nodes are simply absent', () => {
    const current = [
      node('a', { label: 'Team capacity', observedState: { value: 40, unit: '%' } }),
      node('d', { label: 'New factor' }),
    ]
    expect(diffEditedNodeIds(current, snapshot)).toEqual(new Set(['d']))
  })

  it('position-only moves are layout, not edits', () => {
    const current = [
      node('a', { label: 'Team capacity', observedState: { value: 40, unit: '%' } }, 500, 900),
      node('b', { label: 'Salary cost', value: 120000 }, -50, 10),
      node('c', { label: 'Risk of churn' }, 3, 4),
    ]
    expect(diffEditedNodeIds(current, snapshot)).toEqual(new Set())
  })

  it('fail-closed: no snapshot yields an empty set (never everything-edited)', () => {
    expect(diffEditedNodeIds(snapshot, undefined)).toEqual(new Set())
  })

  it('identical graph yields an empty set (a fresh run self-clears the dots)', () => {
    expect(diffEditedNodeIds(snapshot, snapshot)).toEqual(new Set())
  })
})
