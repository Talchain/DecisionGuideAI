/**
 * AnalysisStateCue inside the REAL overlay band — placement, not presence.
 *
 * ⚠ `getByTestId` finds a portalled node and an inline node identically, so
 * every assertion here checks WHICH CELL the cue is in (`CanvasOverlayBand
 * .spec.tsx` records why: a mutant that disabled the portal survived a suite
 * that only asked "is it there?").
 *
 * ⚠ DEPENDENCY, STATED: the cue claims `'bottom-right'` under the id
 * `'analysis-state-cue'`, and `useOverlayCell` grants a cell only to ids listed
 * in `OVERLAY_PRIORITY`. This spec is RED until that table lists the id — which
 * is the point: without the entry the cue never renders in the product.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createPortal } from 'react-dom'

vi.mock('../../hooks/useAnalysisTrust', () => ({
  useAnalysisTrust: () => ({ semantic: 'changed' }),
}))

import {
  CanvasOverlayBand,
  CanvasOverlayBandProvider,
  OVERLAY_PRIORITY,
  useOverlayCell,
} from '../CanvasOverlayBand'
import { AnalysisStateCue, ANALYSIS_STATE_CUE_TESTID } from '../AnalysisStateCue'

function CentreClaimant({ id }: { id: string }) {
  const { granted, target } = useOverlayCell('bottom-centre', id)
  if (!granted) return null
  const body = <div data-testid={id}>{id}</div>
  return target ? createPortal(body, target) : body
}

describe('AnalysisStateCue — a band occupant', () => {
  it('is declared in the bottom-right cell of OVERLAY_PRIORITY', () => {
    expect(OVERLAY_PRIORITY['bottom-right']).toContain(ANALYSIS_STATE_CUE_TESTID)
  })

  it('lands INSIDE the bottom-right cell, and does not evict a bottom-centre occupant', () => {
    const CENTRE = OVERLAY_PRIORITY['bottom-centre'][0]
    expect(CENTRE).toBeTypeOf('string')
    render(
      <CanvasOverlayBandProvider>
        <CanvasOverlayBand />
        <CentreClaimant id={CENTRE} />
        <AnalysisStateCue />
      </CanvasOverlayBandProvider>,
    )
    const cue = screen.getByTestId(ANALYSIS_STATE_CUE_TESTID)
    expect(cue.closest('[data-overlay-cell]')?.getAttribute('data-overlay-cell')).toBe('bottom-right')
    const centre = screen.getByTestId(CENTRE)
    expect(centre.closest('[data-overlay-cell]')?.getAttribute('data-overlay-cell')).toBe('bottom-centre')
  })
})
