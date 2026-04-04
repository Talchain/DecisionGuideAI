/**
 * nodeRationales store slice — test suite
 *
 * Tests:
 * - setNodeRationales populates map from array
 * - Filters out entries with missing target or why
 * - Clears on resetCanvas
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useCanvasStore } from '../../store'

describe('nodeRationales store', () => {
  beforeEach(() => {
    useCanvasStore.setState({ nodeRationales: {} })
  })

  it('setNodeRationales populates map from array', () => {
    useCanvasStore.getState().setNodeRationales([
      { target: 'factor_price', why: 'Price is key' },
      { target: 'risk_churn', why: 'Churn risk increases with price' },
    ])

    const { nodeRationales } = useCanvasStore.getState()
    expect(nodeRationales).toEqual({
      factor_price: 'Price is key',
      risk_churn: 'Churn risk increases with price',
    })
  })

  it('filters out entries with missing target or why', () => {
    useCanvasStore.getState().setNodeRationales([
      { target: 'factor_valid', why: 'Valid entry' },
      { target: '', why: 'Missing target' },
      { target: 'factor_empty_why', why: '' },
    ])

    const { nodeRationales } = useCanvasStore.getState()
    expect(nodeRationales).toEqual({ factor_valid: 'Valid entry' })
  })

  it('overwrites previous rationales on second call', () => {
    useCanvasStore.getState().setNodeRationales([
      { target: 'factor_a', why: 'First' },
    ])
    useCanvasStore.getState().setNodeRationales([
      { target: 'factor_b', why: 'Second' },
    ])

    const { nodeRationales } = useCanvasStore.getState()
    expect(nodeRationales).toEqual({ factor_b: 'Second' })
    expect(nodeRationales).not.toHaveProperty('factor_a')
  })
})
