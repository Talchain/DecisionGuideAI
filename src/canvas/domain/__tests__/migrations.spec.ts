import { describe, it, expect } from 'vitest'
import { importSnapshot } from '../migrations'

describe('Edge Label Migration', () => {
  it('top-level edge.label wins over edge.data.label', () => {
    const v1 = {
      version: 1,
      timestamp: Date.now(),
      nodes: [
        { id: '1', position: { x: 0, y: 0 }, data: { label: 'N1' } },
        { id: '2', position: { x: 100, y: 100 }, data: { label: 'N2' } }
      ],
      edges: [
        { id: 'e1', source: '1', target: '2', label: 'TopLabel', data: { label: 'DataLabel' } }
      ]
    }

    const migrated = importSnapshot(v1)
    expect(migrated?.edges[0].data.label).toBe('TopLabel')
  })
})
