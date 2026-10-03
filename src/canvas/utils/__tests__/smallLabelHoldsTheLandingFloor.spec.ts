/**
 * ⭐ TEXT DECLARED BELOW `nodeLabel` HOLDS THE 9px LANDING FLOOR (2 Oct 2026, CANVAS 39e656; DL 380e54 GO (b),
 * programme-docs#85 5944575143).
 *
 * Served `5cc9a3db` at 1280×800: the source marks (`est.`, `brief`, `no source`), the Goal's limit pill and the option
 * metas rode the `nodeLabel` cap (1.64) and drew 10 × 1.64 × 0.5 = 8.2px at the landing, 10–17 per board, under
 * `LANDING_BODY_FLOOR_PX`. jsdom has no layout, so the size claims are the module's own arithmetic (as
 * `renderedLabelPx` documents); the class claims are a source scan over the WHOLE class, with a contrast.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import {
  CANVAS_SMALL_LABEL_SCALE_VAR,
  LABEL_LEGIBLE_ZOOM,
  LANDING_BODY_FLOOR_PX,
  MAX_SMALL_LABEL_COUNTER_SCALE,
  SMALL_LABEL_COUNTER_SCALE_CAP,
  SMALL_LABEL_DECLARED_PX,
  glyphCounterScale,
  labelCounterScale,
  renderedSmallLabelPx,
  smallLabelCounterScale,
} from '../zoomLegibility'

const SRC = join(__dirname, '..', '..', '..')
function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) { if (name !== '__tests__' && name !== 'node_modules') sources(p, out) } else if (/\.(ts|tsx)$/.test(name) && !/\.(spec|test)\./.test(name)) out.push(p)
  }
  return out
}
const FILES = sources(SRC).map((p) => ({ p, text: readFileSync(p, 'utf8') }))
const textClasses = (re: RegExp) => FILES.flatMap(({ p, text }) => [...text.matchAll(re)].map((m) => ({ p, px: Number(m[1]) })))

describe('the small-text scale reaches the landing floor and changes nothing at 100%', () => {
  it('the cap is the floor\'s own derivation for the smallest declared size (10px)', () => {
    expect(SMALL_LABEL_DECLARED_PX).toBe(10)
    expect(SMALL_LABEL_COUNTER_SCALE_CAP).toBe(1.8)
    expect(MAX_SMALL_LABEL_COUNTER_SCALE).toBe(SMALL_LABEL_COUNTER_SCALE_CAP)
  })

  it('every small text declaration draws at least the floor at the landing zoom', () => {
    for (const px of [10, 10.5]) expect(renderedSmallLabelPx(px, LABEL_LEGIBLE_ZOOM)).toBeGreaterThanOrEqual(LANDING_BODY_FLOOR_PX)
    // CONTRAST: the label cap these declarations rode before draws 10px text BELOW the floor.
    expect(10 * labelCounterScale(LABEL_LEGIBLE_ZOOM) * LABEL_LEGIBLE_ZOOM).toBeLessThan(LANDING_BODY_FLOOR_PX)
  })

  it('at and above 100% the declared size holds (contract v3.1 pixel-perfect), and it is never smaller than the label scale nor larger than the glyph scale', () => {
    expect(smallLabelCounterScale(1)).toBe(1)
    expect(smallLabelCounterScale(1.5)).toBe(1)
    for (let z = 0.2; z <= 1.6; z += 0.01) {
      expect(smallLabelCounterScale(z)).toBeGreaterThanOrEqual(labelCounterScale(z))
      expect(smallLabelCounterScale(z)).toBeLessThanOrEqual(glyphCounterScale(z))
    }
  })
})

describe('the WHOLE class reads the small-text scale (source scan)', () => {
  const LABEL_SCALED = /text-\[length:calc\((\d+(?:\.\d+)?)px\*var\(--canvas-label-scale,1\)\)\]/g
  const SMALL_SCALED = /text-\[length:calc\((\d+(?:\.\d+)?)px\*var\(--canvas-small-label-scale,1\)\)\]/g

  it('no text below `nodeLabel` (11px) rides the label scale; CONTRAST: 11px+ text still does', () => {
    const labelScaled = textClasses(LABEL_SCALED)
    expect(labelScaled.filter((c) => c.px < 11).map((c) => `${c.p}:${c.px}`)).toEqual([])
    expect(labelScaled.filter((c) => c.px >= 11).length).toBeGreaterThan(0)
  })

  it('the small-text scale carries ONLY sub-11px text, and every one reaches the floor at the landing', () => {
    const small = textClasses(SMALL_SCALED)
    expect(small.length).toBeGreaterThanOrEqual(7)
    for (const c of small) {
      expect(c.px).toBeLessThan(11)
      expect(c.px * MAX_SMALL_LABEL_COUNTER_SCALE * LABEL_LEGIBLE_ZOOM).toBeGreaterThanOrEqual(LANDING_BODY_FLOOR_PX)
    }
  })

  it('the property name is one string: the constant, the CSS declaration and the classes agree', () => {
    expect(CANVAS_SMALL_LABEL_SCALE_VAR).toBe('--canvas-small-label-scale')
    expect(readFileSync(join(SRC, 'styles', 'brand.css'), 'utf8')).toMatch(/--canvas-small-label-scale:\s*1;/)
  })

  it('the turning-point track row grows with its label (a fixed 10px-label-scale row would clip the larger text)', () => {
    const track = readFileSync(join(SRC, 'canvas', 'nodes', 'shared', 'FactorTurningPointTrack.tsx'), 'utf8')
    expect(track).toContain('h-[calc(10px*var(--canvas-small-label-scale,1))]')
    expect(track).not.toContain('h-[calc(10px*var(--canvas-label-scale,1))]')
  })
})

describe('the writer and the height reservation carry it', () => {
  it('CanvasLabelScaleSync writes it and measureNodeHeightsAtLabelBound pins + restores it', () => {
    const sync = readFileSync(join(SRC, 'canvas', 'components', 'CanvasLabelScaleSync.tsx'), 'utf8')
    expect(sync).toMatch(/setProperty\(CANVAS_SMALL_LABEL_SCALE_VAR, String\(smallScale\)\)/)
    expect(sync).toMatch(/smallLabelCounterScale\(s\.transform\[2\]\)/)
    const measure = readFileSync(join(SRC, 'canvas', 'utils', 'measureNodeHeightsAtLabelBound.ts'), 'utf8')
    expect(measure).toMatch(/setProperty\(CANVAS_SMALL_LABEL_SCALE_VAR, String\(MAX_SMALL_LABEL_COUNTER_SCALE\)\)/)
    expect(measure).toMatch(/removeProperty\(CANVAS_SMALL_LABEL_SCALE_VAR\)/)
  })
})
