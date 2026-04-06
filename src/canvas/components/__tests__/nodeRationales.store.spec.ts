/**
 * nodeRationales store slice — test suite
 *
 * The slice has no dedicated action: nodeRationales is written directly via
 * useCanvasStore.setState in DraftChat.tsx (batched alongside other CEE
 * metadata). These tests cover the slice's basic shape and reset behaviour.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useCanvasStore } from '../../store'

describe('nodeRationales store slice', () => {
  beforeEach(() => {
    useCanvasStore.setState({ nodeRationales: {} })
  })

  it('starts empty by default', () => {
    expect(useCanvasStore.getState().nodeRationales).toEqual({})
  })

  it('accepts a direct setState write', () => {
    useCanvasStore.setState({
      nodeRationales: {
        factor_price: 'Price is key',
        risk_churn: 'Churn risk increases with price',
      },
    })

    expect(useCanvasStore.getState().nodeRationales).toEqual({
      factor_price: 'Price is key',
      risk_churn: 'Churn risk increases with price',
    })
  })

  it('overwrites the entire map on subsequent setState', () => {
    useCanvasStore.setState({ nodeRationales: { factor_a: 'First' } })
    useCanvasStore.setState({ nodeRationales: { factor_b: 'Second' } })

    const { nodeRationales } = useCanvasStore.getState()
    expect(nodeRationales).toEqual({ factor_b: 'Second' })
    expect(nodeRationales).not.toHaveProperty('factor_a')
  })

  it('clears to {} when written with an empty object (stale-rationale guard path)', () => {
    useCanvasStore.setState({ nodeRationales: { factor_a: 'old' } })
    useCanvasStore.setState({ nodeRationales: {} })
    expect(useCanvasStore.getState().nodeRationales).toEqual({})
  })
})
