/**
 * ⭐ THE CANVAS GROUND'S DOTS ARE VISIBLE: React Flow's own grey, never a
 * near-invisible token.
 *
 * Paul, 30 Sep 2026 ~12:25Z: "Where is the original canvas background with the
 * dots? Revert to that immediately." #1932 (24 Sep) had painted the dots in
 * `--border-emphasis` (rgb 221 212 196). That is ~1.1:1 on the #F4F0EA canvas,
 * so on served builds the dots read as gone. The ground is back to React Flow's
 * stylesheet default `#91919a`, the canvas's look before #1932.
 *
 * Two halves, because either alone is vacuous:
 *   1. SOURCE: every grid-toggled `<Background>` in `ReactFlowGraph.tsx` takes
 *      its colour from the one constant, and that constant is `undefined`
 *      (with a positive control on the scan's own reach);
 *   2. WIRE: at the installed @xyflow/react, an `undefined` colour sets no
 *      pattern colour variable, so the stylesheet default paints the dots;
 *      a colour that IS set lands there (a discriminating control).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render } from '@testing-library/react'
import { ReactFlowProvider, Background, BackgroundVariant } from '@xyflow/react'

const ROOT = join(__dirname, '..', '..', '..')
const GRAPH = readFileSync(join(ROOT, 'src', 'canvas', 'ReactFlowGraph.tsx'), 'utf8')

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

describe('the canvas ground keeps its visible dots', () => {
  it('POSITIVE CONTROL: the scan reaches both grid-toggled grounds (main canvas + rf-only mode)', () => {
    expect(gridToggledBackgrounds(GRAPH)).toHaveLength(2)
  })

  it('⭐ every grid-toggled ground takes the one dot colour, and that colour is React Flow\'s own (undefined)', () => {
    for (const el of gridToggledBackgrounds(GRAPH)) {
      expect(el).toContain('color={showGrid ? CANVAS_GRID_DOT_COLOUR : undefined}')
    }
    expect(GRAPH).toMatch(/const CANVAS_GRID_DOT_COLOUR: string \| undefined = undefined\n/)
    expect(GRAPH).not.toMatch(/const CANVAS_GRID_DOT_COLOUR[^\n]*border-emphasis/)
  })

  it('WIRE: an undefined colour sets no pattern colour, so the library default grey paints the dots', () => {
    expect(patternColourVar(undefined)).toBe('')
  })

  it('WIRE CONTROL: a colour that is set does land on the pattern variable (so the row above can fail)', () => {
    expect(patternColourVar('var(--border-emphasis)')).toBe('var(--border-emphasis)')
  })
})
