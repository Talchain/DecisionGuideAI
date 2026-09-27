/**
 * N3 — THE STALE CUE'S COLUMN CAN NEVER BE STARVED BY A CENTRE OCCUPANT.
 *
 * ⭐ WITNESSED ON THE SERVED BUILD, 24 Sep (`MANUAL-EDIT-REWITNESS-0753Z.md`
 * §N3): at 1440x900 with the chat dock open and the "Saved example" banner
 * showing, `AnalysisStateCue` ("Model changed · previous findings shown as Last
 * run") was MOUNTED BUT INVISIBLE. The band's columns read `0px 816px 0px`, and
 * `181.7/828.6/181.7px` after a reload; the cue's own width guard hid it in
 * that column. Dismissing the banner gave `596/0/596` and the cue appeared.
 *
 * ⛔ THE MECHANISM, which is CSS grid's track-sizing order and not a bug in
 * either occupant: with `1fr auto 1fr`, the `auto` centre track is grown to its
 * occupant's max-content in "maximize tracks" BEFORE the `fr` tracks receive
 * anything, and the side cells have `min-width: 0` — so any centre occupant as
 * wide as the band leaves the side cells exactly zero. A dismissible
 * disclosure was silently deleting a TRUTH signal (Experience Design: the
 * whole-graph stale cue must remain present; never hide staleness).
 *
 * ⭐ 27 Sep 2026 (canvas-8ffc sbs-post DIFF item 8): the cue moved from the
 * bottom-RIGHT slot to the bottom-LEFT one — the contract's canvas foot — and
 * is painted beneath the graph rather than inside the band. It still holds the
 * band's bottom-left CELL (its width is that cell's width), so the floor that
 * protects it moved with it to the LEFT column. The right column keeps the
 * floor it gave `degraded-banner` while that banner shared the cell with the
 * cue, byte-identical, so its layout does not move under this change.
 *
 * ⚠ SCOPE, STATED: jsdom computes NO layout. Everything here is a STRUCTURAL
 * PIN — the band's declared `grid-template-columns` and `align-content`, read
 * off the element by identity — never a pixel measurement.
 */
import { describe, it, expect, vi } from 'vitest'
import { useState, type ReactNode } from 'react'
import { render, screen, act } from '@testing-library/react'
import { createPortal } from 'react-dom'

vi.mock('../../hooks/useAnalysisTrust', () => ({
  useAnalysisTrust: () => ({ semantic: 'changed' }),
}))

import {
  CanvasOverlayBand,
  CanvasOverlayBandProvider,
  OVERLAY_BAND_SELECTOR,
  useOverlayCell,
  type OverlayCell,
} from '../CanvasOverlayBand'
import {
  AnalysisStateCue,
  ANALYSIS_STATE_CUE_COPY,
  ANALYSIS_STATE_CUE_MIN_WIDTH_PX,
  ANALYSIS_STATE_CUE_TESTID,
} from '../AnalysisStateCue'
import { LensInfoPanel, LENS_INFO_STALE_TESTID } from '../LensInfoPanel'
import { useCanvasStore } from '../../store'

/** Top-level tracks of a `grid-template-columns` value (splits only at paren depth 0). */
function tracks(template: string): string[] {
  const out: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of template.trim()) {
    if (ch === '(') depth += 1
    if (ch === ')') depth -= 1
    if (/\s/.test(ch) && depth === 0) {
      if (cur) out.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  if (cur) out.push(cur)
  return out
}

/**
 * The minimum a track declares, in px, or 0 when it declares none a starving
 * centre track has to respect (`1fr` = `minmax(auto, 1fr)`, and `auto` on a
 * `min-width: 0` cell is zero — which is the defect).
 */
function declaredMinPx(track: string): number {
  const m = track.replace(/\s+/g, '').match(/^minmax\(min\((\d+(?:\.\d+)?)px,\d+%\),1fr\)$/)
  return m ? Number(m[1]) : 0
}
function declaredCapPct(track: string): number {
  const m = track.replace(/\s+/g, '').match(/^minmax\(min\(\d+(?:\.\d+)?px,(\d+)%\),1fr\)$/)
  return m ? Number(m[1]) : Number.NaN
}

/** A real, wide bottom-centre claimant (the saved-example banner left the band in v3.1). */
const CENTRE_STAND_IN = 'first-model-notice'

/** A stand-in claimant under a REAL id (the band arbitrates by id, not by component). */
function Claimant({ cell, id, wants = true }: { cell: OverlayCell; id: string; wants?: boolean }) {
  const { granted, target } = useOverlayCell(cell, id, wants)
  if (!wants || !granted) return null
  const body = <div data-testid={id}>{id}</div>
  return target ? createPortal(body, target) : body
}

function bandOf(container: HTMLElement): HTMLElement {
  const band = container.querySelector(OVERLAY_BAND_SELECTOR) as HTMLElement | null
  expect(band, 'the band must be findable by the selector computeFitPadding uses').not.toBeNull()
  return band!
}

function renderBand(children: ReactNode) {
  return render(
    <CanvasOverlayBandProvider>
      <CanvasOverlayBand />
      {children}
    </CanvasOverlayBandProvider>,
  )
}

describe('N3 — the stale cue keeps its column beside a wide centre occupant', () => {
  it('POSITIVE CONTROL: the width below which the cue withdraws is a real number', () => {
    // Every assertion below compares against this number; NaN would make a
    // `>=` comparison false for the wrong reason, and 0 would make it vacuous.
    expect(ANALYSIS_STATE_CUE_MIN_WIDTH_PX).toBe(200)
  })

  it('⭐ centre + cue: the LEFT column — the cue’s — declares a minimum no smaller than the cue’s withdrawal width', () => {
    const { container } = renderBand(
      <>
        <Claimant cell="bottom-centre" id={CENTRE_STAND_IN} />
        <AnalysisStateCue />
      </>,
    )
    const template = bandOf(container).style.gridTemplateColumns
    const cols = tracks(template)
    expect(cols, `expected three tracks, got ${JSON.stringify(template)}`).toHaveLength(3)
    expect(cols[1]).toBe('auto')
    expect(
      declaredMinPx(cols[0]),
      `the cue's column declares no minimum (${JSON.stringify(cols[0])}), so a centre occupant as wide ` +
        "as the band sizes it to 0px and the cue withdraws — the served N3 defect, now on the left",
    ).toBeGreaterThanOrEqual(ANALYSIS_STATE_CUE_MIN_WIDTH_PX)
    // The right column is not the cue's any more and earns nothing from it.
    expect(cols[2]).toBe('1fr')
  })

  it('⭐ centre + cue: the floor is capped at the band width (`min(…, 100%)`), so it can never force horizontal overflow', () => {
    const { container } = renderBand(
      <>
        <Claimant cell="bottom-centre" id={CENTRE_STAND_IN} />
        <AnalysisStateCue />
      </>,
    )
    expect(declaredCapPct(tracks(bandOf(container).style.gridTemplateColumns)[0] ?? '')).toBe(100)
  })

  it('⭐ centre + cue: rows align to the END, so a centre occupant that wraps grows UP onto the canvas, not off its bottom edge', () => {
    const { container } = renderBand(
      <>
        <Claimant cell="bottom-centre" id={CENTRE_STAND_IN} />
        <AnalysisStateCue />
      </>,
    )
    expect(bandOf(container).style.alignContent).toBe('end')
  })

  it('CONTRAST: the lens panel holding the left cell earns NO floor (lens layouts unchanged) — and carries the stale sentence, never hides it', () => {
    // The REAL panel, not a stand-in under its id: a stand-in cannot say the
    // sentence, which is how the old version of this pin encoded "the stale
    // fact disappears while a lens is open" as if it were the design.
    localStorage.setItem('feature.graphLens', '1')
    useCanvasStore.setState({ lens: { ...useCanvasStore.getState().lens, active: 'robustness' } } as never)
    try {
      const { container } = renderBand(
        <>
          <Claimant cell="bottom-centre" id={CENTRE_STAND_IN} />
          <LensInfoPanel />
          <AnalysisStateCue />
        </>,
      )
      const panel = screen.getByTestId('lens-info-panel')
      expect(panel.closest('[data-overlay-cell]')?.getAttribute('data-overlay-cell')).toBe('bottom-left')
      // The lens panel outranks the foot line, and says its sentence instead.
      expect(screen.queryByTestId(ANALYSIS_STATE_CUE_TESTID)).toBeNull()
      expect(screen.getByTestId(LENS_INFO_STALE_TESTID).textContent).toBe(ANALYSIS_STATE_CUE_COPY)
      expect(panel.contains(screen.getByTestId(LENS_INFO_STALE_TESTID))).toBe(true)
      // …and the grid is the one the band has always had.
      expect(bandOf(container).style.gridTemplateColumns).toBe('1fr auto 1fr')
    } finally {
      localStorage.removeItem('feature.graphLens')
      useCanvasStore.setState({ lens: { ...useCanvasStore.getState().lens, active: 'full' } } as never)
    }
  })

  it('CONTRAST: a bottom-right occupant keeps the floor it had, byte-identical', () => {
    const { container } = renderBand(
      <>
        <Claimant cell="bottom-centre" id={CENTRE_STAND_IN} />
        <Claimant cell="bottom-right" id="degraded-banner" />
      </>,
    )
    expect(bandOf(container).style.gridTemplateColumns).toBe('1fr auto minmax(min(200px, 100%), 1fr)')
    expect(bandOf(container).style.alignContent).toBe('end')
  })

  it('both side floors at once split the band, each capped at half — two floors can never sum past it', () => {
    const { container } = renderBand(
      <>
        <Claimant cell="bottom-right" id="degraded-banner" />
        <AnalysisStateCue />
      </>,
    )
    const cols = tracks(bandOf(container).style.gridTemplateColumns)
    expect(declaredMinPx(cols[0] ?? '')).toBeGreaterThanOrEqual(ANALYSIS_STATE_CUE_MIN_WIDTH_PX)
    expect(declaredMinPx(cols[2] ?? '')).toBeGreaterThanOrEqual(ANALYSIS_STATE_CUE_MIN_WIDTH_PX)
    expect(declaredCapPct(cols[0] ?? '')).toBe(50)
    expect(declaredCapPct(cols[2] ?? '')).toBe(50)
  })

  it('CONTRAST: with no side occupant the band is byte-identical to before (`1fr auto 1fr`, no align-content)', () => {
    const { container } = renderBand(<Claimant cell="bottom-centre" id={CENTRE_STAND_IN} />)
    const band = bandOf(container)
    expect(band.style.gridTemplateColumns).toBe('1fr auto 1fr')
    expect(band.style.alignContent).toBe('')
  })

  it('CONTRAST: the reservation follows the occupant — it is released the moment the cue withdraws', () => {
    function Harness() {
      const [cueWants, setCueWants] = useState(true)
      return (
        <CanvasOverlayBandProvider>
          <CanvasOverlayBand />
          <Claimant cell="bottom-centre" id={CENTRE_STAND_IN} />
          <Claimant cell="bottom-left" id={ANALYSIS_STATE_CUE_TESTID} wants={cueWants} />
          <button type="button" data-testid="withdraw-cue" onClick={() => setCueWants(false)}>
            withdraw
          </button>
        </CanvasOverlayBandProvider>
      )
    }
    const { container } = render(<Harness />)
    const band = bandOf(container)

    expect(declaredMinPx(tracks(band.style.gridTemplateColumns)[0] ?? '')).toBeGreaterThanOrEqual(
      ANALYSIS_STATE_CUE_MIN_WIDTH_PX,
    )

    act(() => {
      screen.getByTestId('withdraw-cue').click()
    })

    expect(band.style.gridTemplateColumns).toBe('1fr auto 1fr')
    expect(band.style.alignContent).toBe('')
  })
})
