/**
 * DegradedBanner inside the REAL overlay band — placement, not presence.
 *
 * A16 AUDIT: the banner used to position itself (`fixed top-16 left-1/2
 * -translate-x-1/2 z-[1050]`), drawing directly over the Question card. This
 * spec is RED until `DegradedBanner` claims a cell in `OVERLAY_PRIORITY` and
 * portals into it — matching the pattern `AnalysisStateCue.band.spec.tsx`
 * pins for its own cell.
 *
 * ⚠ `getByTestId` finds a portalled node and an inline node identically, so
 * every assertion here checks WHICH CELL the banner is in, never merely
 * whether it exists.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createPortal } from 'react-dom'

vi.mock('../../../lib/health', () => ({
  fetchHealth: vi.fn(),
}))

import {
  CanvasOverlayBand,
  CanvasOverlayBandProvider,
  OVERLAY_PRIORITY,
  useOverlayCell,
} from '../CanvasOverlayBand'
import { DegradedBanner } from '../DegradedBanner'
import { fetchHealth } from '../../../lib/health'

const mockFetchHealth = vi.mocked(fetchHealth)

function CentreClaimant({ id }: { id: string }) {
  const { granted, target } = useOverlayCell('bottom-centre', id)
  if (!granted) return null
  const body = <div data-testid={id}>{id}</div>
  return target ? createPortal(body, target) : body
}

describe('DegradedBanner — a band occupant', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'fetch', { writable: true, value: window.fetch || vi.fn() })
    mockFetchHealth.mockReset()
  })

  it('is declared in the bottom-right cell of OVERLAY_PRIORITY', () => {
    expect(OVERLAY_PRIORITY['bottom-right']).toContain('degraded-banner')
  })

  it('lands INSIDE the bottom-right cell — never floating over the canvas', async () => {
    mockFetchHealth.mockResolvedValueOnce({ status: 'down', p95_ms: 0 })

    render(
      <CanvasOverlayBandProvider>
        <CanvasOverlayBand />
        <DegradedBanner />
      </CanvasOverlayBandProvider>,
    )

    const banner = await screen.findByTestId('degraded-banner')
    expect(banner.closest('[data-overlay-cell]')?.getAttribute('data-overlay-cell')).toBe('bottom-right')
  })

  it('does not evict a bottom-centre occupant', async () => {
    const CENTRE = OVERLAY_PRIORITY['bottom-centre'][0]
    expect(CENTRE).toBeTypeOf('string')
    mockFetchHealth.mockResolvedValueOnce({ status: 'degraded', p95_ms: 0 })

    render(
      <CanvasOverlayBandProvider>
        <CanvasOverlayBand />
        <CentreClaimant id={CENTRE} />
        <DegradedBanner />
      </CanvasOverlayBandProvider>,
    )

    await screen.findByTestId('degraded-banner')
    const centre = screen.getByTestId(CENTRE)
    expect(centre.closest('[data-overlay-cell]')?.getAttribute('data-overlay-cell')).toBe('bottom-centre')
  })

  it('outranks analysis-state-cue for the SAME cell — an unreachable engine is the more urgent fact', () => {
    expect(OVERLAY_PRIORITY['bottom-right'].indexOf('degraded-banner')).toBeLessThan(
      OVERLAY_PRIORITY['bottom-right'].indexOf('analysis-state-cue'),
    )
  })

  it('never renders the position classes the band exists to abolish', async () => {
    mockFetchHealth.mockResolvedValueOnce({ status: 'down', p95_ms: 0 })
    render(
      <CanvasOverlayBandProvider>
        <CanvasOverlayBand />
        <DegradedBanner />
      </CanvasOverlayBandProvider>,
    )
    const banner = await screen.findByTestId('degraded-banner')
    // Bound to the ATTRIBUTE, not a snapshot: the banner must not carry its
    // own fixed/top/left/translate/z-index classes any more — the band owns
    // position now.
    for (const cls of ['fixed', 'top-16', 'left-1/2', '-translate-x-1/2', 'z-[1050]']) {
      expect(banner.className.split(/\s+/)).not.toContain(cls)
    }
  })
})
