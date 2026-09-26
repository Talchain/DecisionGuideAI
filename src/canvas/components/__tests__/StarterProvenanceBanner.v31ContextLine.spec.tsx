/**
 * ⭐ CONTRACT v3.1 — THE SAVED-EXAMPLE DISCLOSURE IS A QUIET LINE AT THE CANVAS'S
 * TOP-RIGHT, NOT A BANNER OVER THE BOARD (DESIGN-GAP #3, 26 Sep 2026).
 *
 * MEASURED at base `6256a41f`, all five starters, 1280x800 with the dock open:
 * the bottom-centre banner was 644x76 with a filled primary "Re-draft this live"
 * pill and overlapped 3–6 outcome/risk cards on every board (19,154–38,304px²).
 * v3.1 `.context-banner`: one 10px muted line, right 17 / top of the canvas.
 *
 * What this pins, by identity:
 *   1. at rest there is ONE line, with the contract's words plus the fact the
 *      banner existed to state (a SAVED example, drafted by Olumi) — the date
 *      and the full sentence are in the detail;
 *   2. at rest there is no re-draft button, no dismiss, no banner chrome;
 *   3. the line is not a band occupant — it does not portal into the bottom
 *      cell even with the band mounted;
 *   4. it is anchored to the canvas's right edge (the dock inset + 17px);
 *   5. one click opens the banner's full sentences and its actions; Escape
 *      closes them.
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../../conversation/ConversationContext', () => ({
  useConversationContext: () => ({ sendMessage: vi.fn(), draft: '', setDraft: vi.fn() }),
}))

import { StarterProvenanceBanner } from '../StarterProvenanceBanner'
import { CanvasOverlayBand, CanvasOverlayBandProvider } from '../CanvasOverlayBand'
import { useCanvasStore } from '../../store'
import { STARTERS } from '../../starters/loadStarter'

const PRICING = STARTERS.find((s) => s.id === 'pricing-model')!

function seedStarter() {
  useCanvasStore.setState({
    nodes: [
      { id: 'dec', type: 'decision', position: { x: 0, y: 0 }, data: { label: PRICING.title, starterId: PRICING.id, starterTitle: PRICING.title } },
      { id: 'f1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'f1', starterId: PRICING.id, starterTitle: PRICING.title } },
    ] as never,
    edges: [] as never,
  })
}

beforeEach(() => {
  try { localStorage.setItem('feature.v5CanonicalAnalysis', '1') } catch { /* ignore */ }
  vi.stubEnv('VITE_ENABLE_V5_ORCHESTRATOR', 'true')
  seedStarter()
})

afterEach(() => {
  vi.unstubAllEnvs()
  try { localStorage.removeItem('feature.v5CanonicalAnalysis') } catch { /* ignore */ }
})

describe('v3.1 starter context line — at rest', () => {
  it('⭐ shows ONE quiet line: a saved example, drafted by Olumi, and the est. convention', () => {
    render(<StarterProvenanceBanner />)
    const line = screen.getByTestId('starter-provenance-line')
    expect(line.textContent).toBe('Saved example drafted by Olumi · Olumi values marked est.')
    // It is the disclosure's own root, so the band/overlap harnesses that count
    // `starter-provenance-banner` still find it.
    expect(screen.getByTestId('starter-provenance-banner')).toContainElement(line)
  })

  it('⛔ carries no re-draft pill, no dismiss and no banner chrome at rest', () => {
    render(<StarterProvenanceBanner />)
    expect(screen.queryByTestId('starter-redraft')).toBeNull()
    expect(screen.queryByTestId('starter-provenance-dismiss')).toBeNull()
    expect(screen.queryByTestId('starter-provenance-detail')).toBeNull()
    const root = screen.getByTestId('starter-provenance-banner')
    for (const c of ['shadow-2', 'border', 'bg-panel', 'rounded-lg', 'bg-primary']) {
      expect(root.className.split(/\s+/)).not.toContain(c)
    }
    expect(root.querySelector('.bg-primary')).toBeNull()
  })

  it('is NOT an occupant of the bottom overlay band — even with the band mounted', () => {
    render(
      <CanvasOverlayBandProvider>
        <CanvasOverlayBand />
        <StarterProvenanceBanner />
      </CanvasOverlayBandProvider>,
    )
    const banner = screen.getByTestId('starter-provenance-banner')
    const band = screen.getByTestId('canvas-overlay-band')
    expect(band.contains(banner)).toBe(false)
  })

  it('is anchored to the canvas’s top-right: the dock inset plus the contract’s 17px', () => {
    // jsdom has no dock, so the inset is 0 and the right edge is the contract's 17px.
    render(<StarterProvenanceBanner />)
    const root = screen.getByTestId('starter-provenance-banner')
    expect(root.style.right).toBe('17px')
    expect(root.style.top).toMatch(/^calc\(var\(--topbar-h, 0px\) \+ \d+px\)$/)
    expect(root.style.bottom).toBe('')
  })
})

describe('v3.1 starter context line — the detail, one click away', () => {
  it('opens the banner’s full sentences and its actions, and Escape closes them', () => {
    render(<StarterProvenanceBanner />)
    const line = screen.getByTestId('starter-provenance-line')
    expect(line).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(line)
    expect(line).toHaveAttribute('aria-expanded', 'true')
    const detail = screen.getByTestId('starter-provenance-detail')
    expect(line).toHaveAttribute('aria-controls', detail.id)
    expect(detail).toHaveTextContent(
      `Saved example — Olumi drafted this model on ${PRICING.provenance.capturedAt}. It wasn’t generated just now.`,
    )
    expect(detail).toHaveTextContent(/analysis is held/i)
    expect(screen.getByTestId('starter-redraft')).toHaveTextContent('Re-draft this live')
    // Secondary, not the filled primary pill the banner used.
    expect(screen.getByTestId('starter-redraft').className).not.toMatch(/bg-primary/)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByTestId('starter-provenance-detail')).toBeNull()
    expect(line).toHaveAttribute('aria-expanded', 'false')
  })

  it('a press outside closes the detail; the dismiss hides the note for the session', () => {
    render(<StarterProvenanceBanner />)
    fireEvent.click(screen.getByTestId('starter-provenance-line'))
    fireEvent.mouseDown(document.body)
    expect(screen.queryByTestId('starter-provenance-detail')).toBeNull()

    fireEvent.click(screen.getByTestId('starter-provenance-line'))
    fireEvent.click(screen.getByTestId('starter-provenance-dismiss'))
    expect(screen.queryByTestId('starter-provenance-banner')).toBeNull()
  })
})
