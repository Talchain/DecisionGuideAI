/**
 * ⭐ THE CANVAS GROUND'S DOTS ARE THE BRAND'S WARM GREY AND STAY VISIBLE.
 *
 * - **30 Sep, #2347.** Paul, ~12:25Z: "Where is the original canvas background with the
 *   dots? Revert to that immediately." #1932's `--border-emphasis` (rgb 221 212 196) was
 *   ~1.3:1 on the #F4F0EA canvas and read as gone. #2347 handed the colour back to React
 *   Flow's cool default `#91919a` (2.75:1).
 * - **1 Oct.** Paul: "Why is it not the brand colour?" The dots now take the brand token
 *   `--canvas-grid-dot`, a warm grey that is never quieter than #2347's grey.
 *
 * Three halves, because any one alone is vacuous:
 *   1. SOURCE: every grid-toggled `<Background>` in `ReactFlowGraph.tsx` takes its colour
 *      from the one constant, and that constant is the brand token. The scan's own reach
 *      has a positive control.
 *   2. TOKEN: `brand.css` defines the token as a warm grey whose contrast on
 *      `--bg-canvas` is at least the #91919a it replaced. The quiet #1932 token is the
 *      discriminating control: it fails the same bar.
 *   3. WIRE: at the installed @xyflow/react, the constant lands on the pattern colour
 *      variable. An undefined colour sets none, the control that shows the row can fail.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render } from '@testing-library/react'
import { ReactFlowProvider, Background, BackgroundVariant } from '@xyflow/react'

const ROOT = join(__dirname, '..', '..', '..')
const GRAPH = readFileSync(join(ROOT, 'src', 'canvas', 'ReactFlowGraph.tsx'), 'utf8')
const BRAND = readFileSync(join(ROOT, 'src', 'styles', 'brand.css'), 'utf8')

const gridToggledBackgrounds = (src: string): string[] =>
  src.match(/<Background\s+variant=\{showGrid[^\n]*\/>/g) ?? []

const patternColourVar = (color: string | undefined): string => {
  const { container, unmount } = render(
    <ReactFlowProvider>
      <Background variant={BackgroundVariant.Dots} gap={16} color={color} />
    </ReactFlowProvider>,
  )
  const svg = container.querySelector('[data-testid="rf__background"]') as SVGElement | null
  expect(svg).not.toBeNull()
  const value = svg!.style.getPropertyValue('--xy-background-pattern-color-props')
  unmount()
  return value
}

type Rgb = [number, number, number]
const hex = (h: string): Rgb => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb
const tokenRgb = (name: string): Rgb => {
  const m = BRAND.match(new RegExp(`^\\s*--${name}-rgb:\\s*(\\d+)\\s+(\\d+)\\s+(\\d+);`, 'm'))
  expect(m, `brand.css defines --${name}-rgb`).not.toBeNull()
  return [Number(m![1]), Number(m![2]), Number(m![3])]
}
const luminance = (c: Rgb): number => {
  const [r, g, b] = c.map((v) => {
    const x = v / 255
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a: Rgb, b: Rgb): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
const canvasGround = (): Rgb => {
  const m = BRAND.match(/^\s*--bg-canvas:\s*(#[0-9A-Fa-f]{6});/m)
  expect(m, 'brand.css defines --bg-canvas').not.toBeNull()
  return hex(m![1])
}
/** React Flow's default dots, the visibility Paul asked back for on 30 Sep (#2347). */
const REACT_FLOW_DEFAULT_DOTS = hex('#91919a')

describe('the canvas ground keeps visible dots in the brand colour', () => {
  it('POSITIVE CONTROL: the scan reaches both grid-toggled grounds (main canvas + rf-only mode)', () => {
    expect(gridToggledBackgrounds(GRAPH)).toHaveLength(2)
  })

  it('⭐ SOURCE: every grid-toggled ground takes the one dot colour, and that colour is the brand token', () => {
    for (const el of gridToggledBackgrounds(GRAPH)) {
      expect(el).toContain('color={showGrid ? CANVAS_GRID_DOT_COLOUR : undefined}')
    }
    expect(GRAPH).toMatch(/const CANVAS_GRID_DOT_COLOUR = 'var\(--canvas-grid-dot\)'\n/)
    expect(BRAND).toMatch(/^\s*--canvas-grid-dot:\s*rgb\(var\(--canvas-grid-dot-rgb\)\);/m)
  })

  it('⭐ TOKEN: the brand dot is a warm grey, never quieter on the canvas than the grey it replaced', () => {
    const dot = tokenRgb('canvas-grid-dot')
    const [r, g, b] = dot
    // Warm: the brand neutrals run red ≥ green ≥ blue. React Flow's #91919a is blue-leaning.
    expect(r).toBeGreaterThanOrEqual(g)
    expect(g).toBeGreaterThanOrEqual(b)
    expect(r).toBeGreaterThan(b)
    expect(contrast(dot, canvasGround())).toBeGreaterThanOrEqual(contrast(REACT_FLOW_DEFAULT_DOTS, canvasGround()))
  })

  it('TOKEN CONTROL: the quiet #1932 token fails the same visibility bar, and React Flow\'s grey fails "warm"', () => {
    expect(contrast(tokenRgb('border-emphasis'), canvasGround()))
      .toBeLessThan(contrast(REACT_FLOW_DEFAULT_DOTS, canvasGround()))
    const [r, , b] = REACT_FLOW_DEFAULT_DOTS
    expect(r > b).toBe(false)
  })

  it('WIRE: the brand token lands on the pattern colour variable', () => {
    expect(patternColourVar('var(--canvas-grid-dot)')).toBe('var(--canvas-grid-dot)')
  })

  it('WIRE CONTROL: an undefined colour sets no pattern colour (the library default would paint the dots)', () => {
    expect(patternColourVar(undefined)).toBe('')
  })
})
