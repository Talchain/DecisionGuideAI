/**
 * ⭐ contract v3.1 CHR-5 — THE GROUND'S DOT GRID IS THE DS WARM BORDER TOKEN,
 * NOT REACT FLOW'S COOL-GREY DEFAULT.
 *
 * Served: `<Background>` carried no `color`, so the dots painted React Flow's
 * stylesheet default `#91919a` (2.75:1 on the canvas — twice the contract's
 * `#D8D3CB` whisper, and outside the DS palette). Target: `--border-emphasis`,
 * the existing DS token nearest the contract's grid.
 *
 * Two halves, because either alone is vacuous:
 *   1. SOURCE — every grid-toggled `<Background>` in `ReactFlowGraph.tsx` passes
 *      the token (with a positive control on the scan's own reach);
 *   2. WIRE — at the installed @xyflow/react, `color` really lands on the
 *      pattern's colour variable, so a CSS var (not a literal) is honoured.
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

describe('the canvas ground (contract v3.1 CHR-5)', () => {
  it('POSITIVE CONTROL: the scan reaches both grid-toggled grounds (main canvas + rf-only mode)', () => {
    expect(gridToggledBackgrounds(GRAPH)).toHaveLength(2)
  })

  it('⭐ every grid-toggled ground paints its dots in the DS token — none falls back to the library grey', () => {
    for (const el of gridToggledBackgrounds(GRAPH)) {
      expect(el).toContain('color={showGrid ? CANVAS_GRID_DOT_COLOUR : undefined}')
    }
    expect(GRAPH).toMatch(/const CANVAS_GRID_DOT_COLOUR = 'var\(--border-emphasis\)'/)
  })

  it('the token is a DS v5 token that exists — no colour is invented', () => {
    expect(BRAND).toMatch(/--border-emphasis:\s*rgb\(var\(--border-emphasis-rgb\)\)/)
    expect(BRAND).toMatch(/--border-emphasis-rgb:\s*221 212 196;/)
  })

  it('WIRE: React Flow carries a CSS-var `color` onto the pattern colour variable unchanged', () => {
    const { container } = render(
      <ReactFlowProvider>
        <Background variant={BackgroundVariant.Dots} gap={16} color="var(--border-emphasis)" />
      </ReactFlowProvider>,
    )
    const svg = container.querySelector('[data-testid="rf__background"]') as SVGElement | null
    expect(svg).not.toBeNull()
    expect(svg!.style.getPropertyValue('--xy-background-pattern-color-props')).toBe('var(--border-emphasis)')
  })
})
