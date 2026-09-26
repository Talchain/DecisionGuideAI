/**
 * N3 — THE STALE CUE'S COLUMN CAN NEVER BE STARVED BY A CENTRE OCCUPANT.
 *
 * ⭐ WITNESSED ON THE SERVED BUILD, 24 Sep (`MANUAL-EDIT-REWITNESS-0753Z.md`
 * §N3): at 1440x900 with the chat dock open and the "Saved example" banner
 * showing, `AnalysisStateCue` ("Model changed · previous findings shown as Last
 * run") was MOUNTED BUT INVISIBLE. The band's columns read `0px 816px 0px`, and
 * `181.7/828.6/181.7px` after a reload; the cue's own container query
 * (`max-width: 199px` → `display: none`) hid it in that column. Dismissing the
 * banner gave `596/0/596` and the cue appeared at 345x28.
 *
 * ⛔ THE MECHANISM, which is CSS grid's track-sizing order and not a bug in
 * either occupant: with `1fr auto 1fr`, the `auto` centre track is grown to its
 * occupant's max-content in "maximize tracks" BEFORE the `fr` tracks receive
 * anything, and the side cells have `min-width: 0` — so any centre occupant as
 * wide as the band leaves the side cells exactly zero. A dismissible provenance
 * banner was silently deleting a TRUTH signal (Experience Design: the
 * whole-graph stale cue must remain present; never hide staleness).
 *
 * ⚠ SCOPE, STATED: jsdom computes NO layout. Everything here is a STRUCTURAL
 * PIN — the band's declared `grid-template-columns` and `align-content`, read
 * off the element by identity — never a pixel measurement. The pixel reading
 * (columns, cue and banner rects at 672/832/1048/1208px of band content) was
 * taken in headless Chromium against the real band and CSS and is recorded in
 * the PR, not here. What this file guarantees is that the declaration which
 * produced those pixels cannot silently regress to one that starves the cue.
 */
import { describe, it, expect, vi } from 'vitest'
import { useState } from 'react'
import { render, screen, act } from '@testing-library/react'
import { createPortal } from 'react-dom'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

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
import { AnalysisStateCue, ANALYSIS_STATE_CUE_TESTID } from '../AnalysisStateCue'

/**
 * The width below which the cue WITHDRAWS, read from the cue's own stylesheet
 * rather than restated — so the band's reservation and the cue's guard are
 * bound to one number, and moving either one alone REDs this file.
 */
const CUE_CSS = readFileSync(resolve(__dirname, '../AnalysisStateCue.module.css'), 'utf8')
function cueVisibleFromPx(): number {
  const m = CUE_CSS.match(
    /@container\s*\(\s*max-width:\s*(\d+(?:\.\d+)?)px\s*\)\s*\{\s*\.cue\s*\{\s*display:\s*none/,
  )
  if (!m) return Number.NaN
  // `max-width: 199px` hides at <=199px, so the cue is visible from 200px.
  return Math.floor(Number(m[1])) + 1
}

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
  const m = track.replace(/\s+/g, '').match(/^minmax\(min\((\d+(?:\.\d+)?)px,100%\),1fr\)$/)
  return m ? Number(m[1]) : 0
}

/**
 * The wide bottom-centre occupant the N3 defect needs. It was the saved-example
 * banner's id; contract v3.1 DESIGN-GAP #3 (26 Sep 2026) moved that disclosure
 * out of the band to the top-right context line, so the stand-in now uses the
 * next REAL centre claimant. The mechanism under test — an `auto` centre track
 * starving the cue's column — belongs to the band, not to either occupant.
 */
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

describe('N3 — the stale cue keeps a column beside the saved-example banner', () => {
  it('POSITIVE CONTROL: the cue withdrawal width is readable from its stylesheet', () => {
    // Every assertion below compares against this number; NaN would make a
    // `>=` comparison false for the wrong reason, and 0 would make it vacuous.
    expect(cueVisibleFromPx()).toBe(200)
  })

  it('⭐ banner + cue: the cue column declares a minimum no smaller than the width at which the cue withdraws', () => {
    const { container } = render(
      <CanvasOverlayBandProvider>
        <CanvasOverlayBand />
        <Claimant cell="bottom-centre" id={CENTRE_STAND_IN} />
        <AnalysisStateCue />
      </CanvasOverlayBandProvider>,
    )
    // Both occupants really are in their cells — the precondition of the defect.
    const cue = screen.getByTestId(ANALYSIS_STATE_CUE_TESTID)
    expect(cue.closest('[data-overlay-cell]')?.getAttribute('data-overlay-cell')).toBe('bottom-right')
    expect(
      screen.getByTestId(CENTRE_STAND_IN).closest('[data-overlay-cell]')?.getAttribute('data-overlay-cell'),
    ).toBe('bottom-centre')

    const template = bandOf(container).style.gridTemplateColumns
    const cols = tracks(template)
    expect(cols, `expected three tracks, got ${JSON.stringify(template)}`).toHaveLength(3)
    // The `auto` centre is what starves the sides; it must stay `auto` (the
    // banner keeps its width when there is room), and the RIGHT track must
    // carry the floor.
    expect(cols[1]).toBe('auto')
    expect(
      declaredMinPx(cols[2]),
      `the cue's column declares no minimum (${JSON.stringify(cols[2])}), so a centre occupant as wide ` +
        'as the band sizes it to 0px and the cue\'s container query hides it — the served N3 defect',
    ).toBeGreaterThanOrEqual(cueVisibleFromPx())
  })

  it('⭐ banner + cue: the floor is capped at the band width (`min(…, 100%)`), so it can never force horizontal overflow', () => {
    const { container } = render(
      <CanvasOverlayBandProvider>
        <CanvasOverlayBand />
        <Claimant cell="bottom-centre" id={CENTRE_STAND_IN} />
        <AnalysisStateCue />
      </CanvasOverlayBandProvider>,
    )
    const right = tracks(bandOf(container).style.gridTemplateColumns)[2] ?? ''
    expect(right.replace(/\s+/g, '')).toMatch(/^minmax\(min\(\d+(?:\.\d+)?px,100%\),1fr\)$/)
  })

  it('⭐ banner + cue: rows align to the END, so a centre occupant that wraps grows UP onto the canvas, not off its bottom edge', () => {
    // Giving the cue its column narrows the centre; at 1280 with the dock open
    // the banner wraps to 82px against the 64px band. `align-content: normal`
    // (stretch) starts the row at the band's TOP, so the surplus would run
    // below the band and past the canvas's bottom edge — clipped. `end` puts
    // the surplus above the band, where it stays readable.
    const { container } = render(
      <CanvasOverlayBandProvider>
        <CanvasOverlayBand />
        <Claimant cell="bottom-centre" id={CENTRE_STAND_IN} />
        <AnalysisStateCue />
      </CanvasOverlayBandProvider>,
    )
    expect(bandOf(container).style.alignContent).toBe('end')
  })

  it('CONTRAST: with no bottom-right occupant the band is byte-identical to before (`1fr auto 1fr`, no align-content)', () => {
    // This is what keeps every Canvas Browser Gate reading valid: none of its
    // corpus mounts the cue, so none of it may see a different grid.
    const { container } = render(
      <CanvasOverlayBandProvider>
        <CanvasOverlayBand />
        <Claimant cell="bottom-centre" id={CENTRE_STAND_IN} />
      </CanvasOverlayBandProvider>,
    )
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
          <Claimant cell="bottom-right" id={ANALYSIS_STATE_CUE_TESTID} wants={cueWants} />
          <button type="button" data-testid="withdraw-cue" onClick={() => setCueWants(false)}>
            withdraw
          </button>
        </CanvasOverlayBandProvider>
      )
    }
    const { container } = render(<Harness />)
    const band = bandOf(container)

    expect(declaredMinPx(tracks(band.style.gridTemplateColumns)[2] ?? '')).toBeGreaterThanOrEqual(
      cueVisibleFromPx(),
    )

    act(() => {
      screen.getByTestId('withdraw-cue').click()
    })

    expect(screen.queryByTestId(ANALYSIS_STATE_CUE_TESTID)).toBeNull()
    expect(band.style.gridTemplateColumns).toBe('1fr auto 1fr')
    expect(band.style.alignContent).toBe('')
  })
})
