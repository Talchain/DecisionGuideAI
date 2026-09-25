/**
 * `LodSync` writes the anchor-rail floor from the LIVE viewport, beside the
 * rung it already writes (review 5822709101; see `anchorRailFloor.ts`).
 */
import { describe, it, expect } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { useLayoutEffect } from 'react'
import { ReactFlowProvider, useStoreApi } from '@xyflow/react'
import { LodSync } from '../LodSync'
import { useAnchorRailFloorStore, setAnchorRailFitsBeside } from '../../nodes/shared/anchorRailFloor'

function Zoom({ z }: { z: number }) {
  const api = useStoreApi()
  useLayoutEffect(() => { api.setState({ transform: [0, 0, z] }) }, [api, z])
  return null
}

const fitsAfterMountingAt = (z: number, start: boolean): boolean => {
  setAnchorRailFitsBeside(start)
  render(<ReactFlowProvider><Zoom z={z} /><LodSync /></ReactFlowProvider>)
  const fits = useAnchorRailFloorStore.getState().fitsBeside
  cleanup()
  return fits
}

describe('LodSync writes the anchor-rail floor from the viewport', () => {
  it('landing zoom 0.5 → the anchor rail does NOT fit beside', () => {
    expect(fitsAfterMountingAt(0.5, true)).toBe(false)
  })

  it('CONTRAST — zoom 1 → it fits beside', () => {
    expect(fitsAfterMountingAt(1, false)).toBe(true)
  })
})
