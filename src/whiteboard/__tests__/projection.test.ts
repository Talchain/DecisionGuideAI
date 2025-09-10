import { describe, it, expect } from 'vitest'
import { extractProjection } from '../projection'

describe('projection extraction', () => {
  it('extracts scenarios and edges from doc shapes', () => {
    const doc = {
      meta: { decision_id: 'dec_1' },
      shapes: [
        { id: 's1', type: 'scenario-tile', props: { title: 'S1' } },
        { id: 'e1', type: 'probability-connector', props: { from: 's1', to: 's2', p: 0.7 } },
        { id: 'note', type: 'text', props: { text: 'ignore' } },
      ],
    }

    const proj = extractProjection(doc)
    expect(proj.board_id).toBe('dec_1')
    expect(proj.scenarios).toEqual([{ id: 's1', title: 'S1' }])
    expect(proj.edges).toEqual([
      { id: 'e1', from: 's1', to: 's2', p: 0.7, fromSide: 'right', toSide: 'left' },
    ])
    expect(typeof proj.last_updated_at).toBe('string')
  })
})
