/**
 * `PanelFigure` — the three rules the panel had been re-deriving per call site.
 *
 * ## Why a component and not a review note
 *
 * Measured in `sections/` on deployed `99b46212`: FIVE figure treatments, two
 * radii, three heights, for quantities that are all "a proportion of a track".
 * #1346 had already ruled *geometry is grammar and is fixed, tone is meaning and
 * varies* — the panel drifted from its own ruling anyway.
 *
 * ⚠ AND THE FIFTH GRAMMAR WAS MINE, added the same night this was written. A new
 * figure authored at its own call site, sized against the row in front of me.
 * That is the argument: a rule a call site must remember is a rule that drifts.
 *
 * ## What is pinned here, and why each one bit in production
 *
 * 1. **A measured non-zero never draws as zero.** `OptionsComparison` shipped
 *    "< 1%" beside a 0px fill on deployed `ce32426c` — one row, one quantity,
 *    two contradictory claims. **And its twin: a genuine zero MUST draw empty**,
 *    because "came out ahead in 0% of scenarios" is true. A floor that fires on
 *    zero would invent a quantity.
 * 2. **A marker never leaves its track.** On a range whose domain is DEFINED BY
 *    the extremes, one marker lands on an edge every run by construction —
 *    measured on a real run: two of four options. Browser-measured 3px overhang,
 *    0px clamped.
 * 3. **Geometry does not vary by variant.** Four bars on a shared baseline are
 *    read comparatively whatever each one means; a caller able to make its own
 *    figure taller can make its question look more important than its neighbour's.
 *
 * ⚠ THE CLAMP IS TESTED AS A PURE FUNCTION, NOT AS RENDERED CSS. jsdom may drop
 * a value it cannot parse, so `style.left` could pass or fail for reasons
 * unrelated to the code. `markerLeft` is exported for exactly this reason.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import fs from 'node:fs'
import path from 'node:path'

import {
  PanelFigure,
  markerLeft,
  FIGURE_TRACK_HEIGHT,
  FIGURE_RADIUS,
  type FigureVariant,
} from '../PanelFigure'

const PANEL_DIR = path.resolve(__dirname, '..')

afterEach(() => cleanup())

const VARIANTS: FigureVariant[] = ['share', 'goal', 'range', 'influence']

describe('rule 1 — a measured non-zero never draws as zero, and a real zero draws empty', () => {
  it('floors a strictly positive fraction', () => {
    render(<PanelFigure variant="share" fraction={0.0004} testId="fig" />)
    const fill = screen.getByTestId('fig-fill')
    expect(fill.style.width, 'the true width is kept, not rounded away').toBe('0.04%')
    expect(fill.style.minWidth, 'a measured non-zero must be visible').toBe('2px')
  })

  it('⛔ does NOT floor a genuine zero — that would invent a quantity', () => {
    render(<PanelFigure variant="share" fraction={0} testId="fig" />)
    const fill = screen.getByTestId('fig-fill')
    expect(fill.style.width).toBe('0%')
    expect(fill.style.minWidth, '"ahead in 0% of scenarios" is TRUE and must look it').toBe('')
  })

  it('renders an empty track for an ABSENT quantity — never a guessed zero', () => {
    render(<PanelFigure variant="share" fraction={null} testId="fig" />)
    expect(screen.getByTestId('fig')).toBeInTheDocument()
    expect(screen.queryByTestId('fig-fill'), 'absence draws nothing at all').toBeNull()
  })
})

describe('rule 2 — a marker never leaves its track', () => {
  /**
   * ⚠ BOTH EXTREMES, because a range figure's domain is defined by them, so
   * these are the positions that occur on EVERY run rather than rare ones.
   */
  // ⭐ V2 FIDELITY (24 Sep 2026, re-pointed for gap 13/20): the marker grew
  // from a 6px dark tick to an 11px option-coloured dot (a dot the range band
  // it sits on actually reads as, rather than a tick in a different ink), so
  // `FIGURE_MARKER_W` moved from 6 to 11 and the clamp's own offsets moved
  // with it: half of 11 is 5.5, and the far bound is `100% - 11px`.
  it.each([
    ['the low extreme', 0],
    ['the high extreme', 1],
    ['the middle', 0.5],
  ])('%s is clamped inside the track', (_name, fraction) => {
    const css = markerLeft(fraction)
    expect(css.startsWith('clamp(0px,'), `must not go below 0: ${css}`).toBe(true)
    expect(css.endsWith('calc(100% - 11px))'), `must not exceed the track: ${css}`).toBe(true)
  })

  it('PRECONDITION: the unclamped expression really would overhang', () => {
    // Without the clamp the low extreme is `calc(0% - 5.5px)` — half an 11px
    // marker outside its own track. This asserts the offset the clamp protects.
    expect(markerLeft(0)).toContain('calc(0% - 5.5px)')
  })

  it('places the marker only when there is one', () => {
    render(<PanelFigure variant="range" band={{ start: 0.2, end: 0.8, marker: null }} testId="f" />)
    expect(screen.getByTestId('f-band')).toBeInTheDocument()
    expect(screen.queryByTestId('f-marker'), 'a missing p50 places no dot').toBeNull()
  })

  it('draws an empty track rather than NaN when a bound is missing', () => {
    // `!= null` loose: the view model declares these required and fixtures omit
    // them, which once threw six times in CI and would otherwise draw calc(NaN%).
    render(
      <PanelFigure
        variant="range"
        band={{ start: undefined as unknown as number, end: 0.8 }}
        testId="f"
      />,
    )
    expect(screen.getByTestId('f')).toBeInTheDocument()
    expect(screen.queryByTestId('f-band')).toBeNull()
  })
})

describe('rule 3 — geometry is grammar and does not vary', () => {
  it('every variant carries the SAME height and radius', () => {
    for (const v of VARIANTS) {
      const { unmount } = render(
        <PanelFigure variant={v} fraction={0.5} band={{ start: 0, end: 1 }} testId={`f-${v}`} />,
      )
      const track = screen.getByTestId(`f-${v}`)
      expect(track.classList.contains(FIGURE_TRACK_HEIGHT), `${v} height`).toBe(true)
      expect(track.classList.contains(FIGURE_RADIUS), `${v} radius`).toBe(true)
      // ⛔ the treatments this component replaced, by token — h-1 is a PREFIX of
      // h-1.5, so classList membership is the only honest check.
      expect(track.classList.contains('h-1'), `${v} must not be the old hairline`).toBe(false)
      expect(track.classList.contains('h-1.5'), `${v} must not be the old pill`).toBe(false)
      expect(track.classList.contains('rounded-pill'), `${v} must not be the old radius`).toBe(false)
      unmount()
    }
  })

  it('the figure prints no text — every number comes from the readout beside it', () => {
    render(<PanelFigure variant="goal" fraction={0.64} testId="fig" />)
    expect(screen.getByTestId('fig').textContent, 'a figure that printed a number would claim a unit').toBe('')
  })

  it('is hidden from assistive tech unless it is given its own name', () => {
    const { unmount } = render(<PanelFigure variant="share" fraction={0.5} testId="a" />)
    expect(screen.getByTestId('a')).toHaveAttribute('aria-hidden', 'true')
    unmount()
    render(<PanelFigure variant="share" fraction={0.5} testId="b" label="Highest in this model, 50%" />)
    expect(screen.getByTestId('b')).toHaveAttribute('role', 'img')
    expect(screen.getByTestId('b')).toHaveAttribute('aria-label', 'Highest in this model, 50%')
  })
})

/**
 * ⭐ THE CENSUS ARM — the one that stops a SIXTH grammar arriving.
 *
 * Every rule above tests the component. None of them notices a call site that
 * simply does not use it, which is exactly how five treatments accumulated
 * under a ruling that already forbade them.
 *
 * ⚠ AND THE SCOPE IS THE WHOLE PANEL, NOT `sections/`. My first census swept
 * `sections/` and reported five figures. Re-run across all of `analysisNew`
 * after the first adoptions, it found a SIXTH in `DisclosureRow.tsx` — one
 * directory up. **A census scoped to a directory answers "which figures are in
 * sections?" and not "which figures does the panel draw", silently.**
 */
describe('the census — no seventh grammar', () => {
  it('⛔ no file hand-rolls a figure track outside the component', () => {
    const TRACK = /className="[^"]*\bh-(?:1|1\.5|2|2\.5|3)\b[^"]*(?:rounded-full|bg-panel-hover)[^"]*"/g
    const offenders: string[] = []
    let seen = 0
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir)) {
        if (entry === '__tests__' || entry === 'prototype') continue
        const full = path.join(dir, entry)
        if (fs.statSync(full).isDirectory()) walk(full)
        else if (/\.tsx$/.test(full) && !/\.(spec|test)\./.test(full)) {
          const raw = fs.readFileSync(full, 'utf8')
          const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
          seen += 1
          const tracks = (code.match(TRACK) ?? []).filter((c) => c.includes('w-full') || c.includes('gap-'))
          if (tracks.length === 0) continue
          if (code.includes('PanelFigure') || raw.includes('@panel-figure-opt-out')) continue
          offenders.push(path.relative(PANEL_DIR, full))
        }
      }
    }
    walk(PANEL_DIR)

    // PRECONDITION: a walker that found nothing would satisfy this vacuously.
    expect(seen, 'the census reached no panel sources').toBeGreaterThan(20)
    expect(
      offenders,
      'a figure must use PanelFigure or declare `@panel-figure-opt-out <reason>`. ' +
        'Five treatments accumulated under a ruling that already forbade them.',
    ).toEqual([])
  })
})
