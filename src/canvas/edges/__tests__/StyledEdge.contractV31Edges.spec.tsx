/**
 * CONTRACT v3.1 — THE CONNECTION GRAMMAR, AS THE EDGE ACTUALLY RENDERS IT
 * (wave 3, group "edges", 24 Sep 2026).
 *
 * One file for the audited edge deltas that change what a connection PAINTS:
 *
 *   E2/T09   the +/−/± glyph carries a canvas-coloured halo (Paul pt 12)
 *   E4       interaction widens RELATIVE to strength, never to a floor
 *   E5/T09   one partial-alpha info glow recipe, no neon, no fallback hex
 *   E6       the selection dim is the whole connection's — line, glyph, chip
 *   E9       a layered (bottom → top, downward) edge is near-straight
 *   E10      a cue-only chip is the contract's focusable 16px disc
 *   E11/E12  structural warm grey; the dispute hue is the solid Warning token
 *   E13      round caps on solid lines, butt caps on dashed ones
 *   E8/T07   the unset/undirected stroke token is the contract's warm neutral
 *   ICON-07  edge glyphs are counter-scaled; the fragility cue is muted ink
 *   T16      DS tokens instead of legacy / default-palette utilities
 *
 * ⛔ BINDING. Elements are found by test id, role or `data-edge-id`, and values
 * are compared to the EXPORTED constants that own them — never to a value
 * another rule could also produce (trap 19). The ribbon (E1/T08) is pinned in
 * `StyledEdge.uncertaintyBand.spec.tsx`; the widths ladder (E3) in
 * `strokeBandsAreLegibleAtFitZoom.spec.ts`; the arrowhead (E7) in
 * `edgePresentation.directionMarker.spec.ts`; the glyph's lateral offset (E14)
 * in `edgeGlyphPlacement.spec.ts`.
 *
 * Harness shape copied from `StyledEdge.paulFeedback23Sep.spec.tsx`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Position } from '@xyflow/react'
import {
  StyledEdge,
  EDGE_GLOW,
  EDGE_SELECTION_DIM_OPACITY,
  POLARITY_GLYPH_HALO,
} from '../StyledEdge'
import { STRUCTURAL_EDGE_COLOUR, DIRECTION_DISPUTED_STROKE } from '../edgePresentation'
import { fragileEdgeSentence } from '../connectorCopy'
import { weightMagnitudeToStrokeWidth } from '../../utils/graphDisplayCalculations'
import { CANVAS_GLYPH_SIZE_CLASSES } from '../../nodes/shared/canvasGlyphScale'

let capturedStyle: Record<string, unknown> | undefined
let mockReport: Record<string, unknown> | null = null
let mockEdges: Array<Record<string, unknown>> = []
let mockViewMode = 'standard'
let mockDimmed = new Set<string>()
let mockAnalysisHighlight: Record<string, unknown> | null = null

const openEditor = vi.fn()
vi.mock('../../utils/openEdgeStrengthEditor', () => ({
  openEdgeStrengthEditor: (id: string) => openEditor(id),
}))

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return {
    ...actual,
    BaseEdge: (props: any) => {
      capturedStyle = props.style
      return <path data-testid="base-edge" />
    },
    EdgeLabelRenderer: ({ children }: any) => <div>{children}</div>,
    getBezierPath: () => ['M0 0 L100 100', 50, 50, 50, 50],
    getSmoothStepPath: () => ['M0 0 L100 100', 50, 50],
    getStraightPath: () => ['M0 0 L100 100', 50, 50],
    useReactFlow: () => ({
      getNode: () => null,
      getEdges: () => mockEdges,
      getNodes: () => [],
    }),
    useStore: (selector: any) => selector({ nodes: [] }),
  }
})

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector: any) =>
    selector({
      updateEdgeData: vi.fn(),
      runMeta: { ceeReview: null },
      results: { status: 'complete', report: mockReport },
      viewMode: mockViewMode,
      lodRung: 'full',
      hoveredOptionId: null,
      highlightedEdges: new Set<string>(),
      dimmedEdgeIds: mockDimmed,
      analysisHighlight: mockAnalysisHighlight,
      lens: {
        active: 'full',
        _dimmedEdgeIds: new Set<string>(),
        _sensitivityWeights: new Map<string, number>(),
        _sensitivityQuartiles: null,
        _fragileEdgeIds: new Set<string>(),
        _lensFragileLabels: new Map<string, string>(),
      },
    }),
  ),
}))

vi.mock('../../store/edgeLabelMode', () => ({
  useEdgeLabelMode: vi.fn((selector: any) => selector({ mode: 'human' })),
}))
vi.mock('../../hooks/useTheme', () => ({ useIsDark: () => false }))
vi.mock('../../hooks/useFirstTimeHints', () => ({
  useEdgeEditHint: () => ({ showHint: false, dismissHint: vi.fn() }),
}))
vi.mock('../../hooks/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: () => false,
}))
vi.mock('../../../flags', () => ({ isGraphLensEnabled: () => false }))
vi.mock('../../utils/graphDisplayCalculations', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/graphDisplayCalculations')>()),
  calculateEdgeImportance: () => 0.5,
}))
vi.mock('../../theme/edges', () => ({
  applyEdgeVisualProps: (_: any, props: any) => props,
}))
vi.mock('../../ui/inspector-v2/inspectorStrings', () => ({
  getStrengthDescription: () => 'moderate',
  getProvenanceLabel: () => '',
}))

// ── Fixtures ────────────────────────────────────────────────────────────────

/** A producer-stated positive edge: strength and likelihood both sourced. */
const edge = (mean: number) => ({
  strength_mean: mean,
  effect_direction: mean < 0 ? ('negative' as const) : ('positive' as const),
  beliefExists: 0.8,
  beliefExistsSource: 'cee' as const,
})
// One magnitude per band (`CANVAS_STRENGTH_BANDS`): slight < 0.20 ≤ moderate < 0.40.
const SLIGHT = 0.15
const MODERATE = 0.3

const baseProps = {
  id: 'e1',
  source: 'n1',
  target: 'n2',
  sourceX: 0,
  sourceY: 0,
  targetX: 100,
  targetY: 100,
  sourcePosition: Position.Right,
  targetPosition: Position.Left,
  selected: false,
}

function renderEdge(data: Record<string, unknown>, props: Record<string, unknown> = {}) {
  capturedStyle = undefined
  return render(<StyledEdge {...(baseProps as any)} {...props} data={data} />)
}
const byTestId = (c: HTMLElement, id: string) =>
  c.querySelector(`[data-testid="${id}"]`) as HTMLElement | null
const glyphOf = (c: HTMLElement) => c.querySelector('[data-edge-id="e1"]') as HTMLElement | null
const groupOf = (c: HTMLElement) =>
  c.querySelector('[data-testid="base-edge"]')!.closest('g') as unknown as HTMLElement
const hitPathOf = (c: HTMLElement) => c.querySelector('path[stroke="transparent"]') as SVGPathElement
const setTopFragile = () => {
  mockReport = { robustness: { fragile_edges: [{ edge_id: 'e1', switch_probability: 0.42 }] } }
}

beforeEach(() => {
  mockReport = null
  mockEdges = []
  mockViewMode = 'standard'
  mockDimmed = new Set<string>()
  mockAnalysisHighlight = null
  openEditor.mockReset()
})
afterEach(() => {
  vi.useRealTimers()
})

// ── E2/T09 ──────────────────────────────────────────────────────────────────

describe('E2/T09 — the polarity glyph carries a canvas-coloured halo', () => {
  it('paints the shared halo, in the canvas ground token, counter-scaled like its font', () => {
    const { container } = renderEdge(edge(0.5))
    const glyph = glyphOf(container)
    expect(glyph, 'no polarity glyph rendered').not.toBeNull()
    expect(glyph!.style.textShadow).toBe(POLARITY_GLYPH_HALO)
    expect(POLARITY_GLYPH_HALO).toContain('var(--bg-canvas)')
    expect(POLARITY_GLYPH_HALO).toContain('var(--canvas-label-scale, 1)')
  })

  it('keeps body ink and the 600 weight — the halo adds a knockout, not a colour', () => {
    const { container } = renderEdge(edge(0.5))
    const cls = glyphOf(container)!.className
    expect(cls).toContain('text-text-body')
    expect(cls).toContain('font-semibold')
  })
})

// ── E6 ──────────────────────────────────────────────────────────────────────

describe('E6 — the selection dim is the whole connection, as one unit', () => {
  it('dims the wrapping group, the glyph and the chip together — and adds nothing on the line', () => {
    setTopFragile()
    mockDimmed = new Set(['e1'])
    const { container } = renderEdge(edge(0.5))
    const g = groupOf(container)
    expect(g.getAttribute('data-selection-dimmed')).toBe('true')
    expect(g.style.opacity).toBe(String(EDGE_SELECTION_DIM_OPACITY))
    expect(glyphOf(container)!.style.opacity).toBe(String(EDGE_SELECTION_DIM_OPACITY))
    expect(byTestId(container, 'edge-influence-label')!.style.opacity).toBe(String(EDGE_SELECTION_DIM_OPACITY))
    // The line itself must not compound a second factor (0.2 × 0.25 = 0.05).
    expect(capturedStyle?.opacity).toBeUndefined()
  })

  it('CONTRAST: an undimmed connection carries no group or glyph opacity, and the chip is opaque', () => {
    setTopFragile()
    const { container } = renderEdge(edge(0.5))
    const g = groupOf(container)
    expect(g.getAttribute('data-selection-dimmed')).toBeNull()
    expect(g.style.opacity).toBe('')
    expect(glyphOf(container)!.style.opacity).toBe('')
    expect(byTestId(container, 'edge-influence-label')!.style.opacity).toBe('1')
  })

  it('is the visual contract §03 `.edge-group.dimmed{opacity:.18}`', () => {
    expect(EDGE_SELECTION_DIM_OPACITY).toBe(0.18)
  })
})

// ── E4 ──────────────────────────────────────────────────────────────────────

describe('E4 — interaction widens relative to strength, so the ordering survives', () => {
  const widthOf = () => Number(capturedStyle?.strokeWidth)

  it('resting = the band width; hover = +1; selected = +2', () => {
    const w = weightMagnitudeToStrokeWidth(MODERATE)
    const { container, unmount } = renderEdge(edge(MODERATE))
    expect(widthOf()).toBe(w)
    fireEvent.mouseEnter(groupOf(container))
    expect(widthOf()).toBe(w + 1)
    unmount()
    renderEdge(edge(MODERATE), { selected: true })
    expect(widthOf()).toBe(w + 2)
  })

  it('a HOVERED slight edge stays thinner than a HOVERED moderate one (hover used to flatten both to 3)', () => {
    const a = renderEdge(edge(SLIGHT))
    fireEvent.mouseEnter(groupOf(a.container))
    const slight = widthOf()
    a.unmount()
    const b = renderEdge(edge(MODERATE))
    fireEvent.mouseEnter(groupOf(b.container))
    const moderate = widthOf()
    expect(weightMagnitudeToStrokeWidth(SLIGHT)).toBeLessThan(weightMagnitudeToStrokeWidth(MODERATE))
    expect(slight).toBeLessThan(moderate)
  })

  it('a SELECTED slight edge stays thinner than a SELECTED moderate one (it used to floor both at 4)', () => {
    const a = renderEdge(edge(SLIGHT), { selected: true })
    const slight = widthOf()
    a.unmount()
    renderEdge(edge(MODERATE), { selected: true })
    const moderate = widthOf()
    expect(slight).toBeLessThan(moderate)
  })

  it('a viewed flip-risk edge keeps its strength width — the glow, not a floor, marks it', () => {
    mockAnalysisHighlight = { source: 'flip_risks', edgeIds: new Set(['e1']), nodeIds: new Set() }
    renderEdge(edge(SLIGHT))
    expect(widthOf()).toBe(weightMagnitudeToStrokeWidth(SLIGHT))
    expect(String(capturedStyle?.filter)).toContain(EDGE_GLOW.flipRisk)
  })
})

// ── E5/T09 ──────────────────────────────────────────────────────────────────

describe('E5/T09 — one glow recipe', () => {
  it('selected paints the contract glow: 2px info at about a third alpha', () => {
    renderEdge(edge(0.5), { selected: true })
    expect(capturedStyle?.filter).toBe(EDGE_GLOW.selected)
    expect(EDGE_GLOW.selected).toBe(
      'drop-shadow(0 0 2px color-mix(in srgb, var(--semantic-info) 35%, transparent))',
    )
  })

  it('hover paints the quieter hover glow', () => {
    const { container } = renderEdge(edge(0.5))
    fireEvent.mouseEnter(groupOf(container))
    expect(capturedStyle?.filter).toBe(EDGE_GLOW.hover)
  })

  it('no glow names the off-palette #3b82f6 or paints full-strength info', () => {
    for (const glow of Object.values(EDGE_GLOW)) {
      expect(glow).not.toContain('#3b82f6')
      // Full-strength = the bare token as the shadow colour, unmixed.
      expect(glow).not.toMatch(/drop-shadow\(0 0 [\d.]+px var\(--semantic-info/)
      expect(glow).toMatch(/color-mix\(in srgb, var\(--semantic-info\) \d+%, transparent\)/)
    }
  })
})

// ── E13 ─────────────────────────────────────────────────────────────────────

describe('E13 — line caps', () => {
  it('a solid line has round caps', () => {
    renderEdge(edge(0.5))
    expect(capturedStyle?.strokeDasharray).toBeUndefined()
    expect(capturedStyle?.strokeLinecap).toBe('round')
  })

  it('a dashed (existence-doubt) line keeps butt caps so the dash stays a dash', () => {
    renderEdge({ ...edge(0.5), beliefExists: 0.4 })
    expect(capturedStyle?.strokeDasharray, 'precondition: the doubt dash fired').toBeTruthy()
    expect(capturedStyle?.strokeLinecap).toBe('butt')
  })
})

// ── E9 ──────────────────────────────────────────────────────────────────────

describe('E9 — a layered edge is near-straight with short vertical leads', () => {
  const layered = { sourcePosition: Position.Bottom, targetPosition: Position.Top }

  it('draws the contract curve: bend = max(6, min(30, Δy/2))', () => {
    const { container } = renderEdge(edge(0.5), { ...layered, sourceX: 10, sourceY: 0, targetX: 210, targetY: 300 })
    expect(hitPathOf(container).getAttribute('d')).toBe('M10,0 C10,30 210,270 210,300')
  })

  it('a short hop takes half its height as the bend, with a floor of 6', () => {
    const { container, unmount } = renderEdge(edge(0.5), { ...layered, sourceX: 0, sourceY: 0, targetX: 40, targetY: 20 })
    expect(hitPathOf(container).getAttribute('d')).toBe('M0,0 C0,10 40,10 40,20')
    unmount()
    const { container: c2 } = renderEdge(edge(0.5), { ...layered, sourceX: 0, sourceY: 0, targetX: 40, targetY: 8 })
    expect(hitPathOf(c2).getAttribute('d')).toBe('M0,0 C0,6 40,2 40,8')
  })

  it('keeps the label anchor at the handle midpoint, exactly where xyflow put it', () => {
    setTopFragile()
    const { container } = renderEdge(edge(0.5), { ...layered, sourceX: 10, sourceY: 0, targetX: 210, targetY: 300 })
    const chip = byTestId(container, 'edge-influence-label')!
    expect(chip.style.transform).toMatch(/translate\(110px,\s*150px\)/)
  })

  it('CONTRAST: an upward or side-to-side edge keeps xyflow\'s own bezier', () => {
    const { container, unmount } = renderEdge(edge(0.5), { ...layered, sourceY: 300, targetY: 0 })
    expect(hitPathOf(container).getAttribute('d')).toBe('M0 0 L100 100')
    unmount()
    const { container: c2 } = renderEdge(edge(0.5))
    expect(hitPathOf(c2).getAttribute('d')).toBe('M0 0 L100 100')
  })
})

// ── E10 + ICON-07 ───────────────────────────────────────────────────────────

describe('E10 — a cue-only chip is the contract\'s focusable 16px disc', () => {
  it('renders the disc: round, counter-scaled 16px, no panel shadow, muted ring', () => {
    setTopFragile()
    const { container } = renderEdge(edge(0.5))
    const chip = byTestId(container, 'edge-influence-label')!
    expect(chip.getAttribute('data-fragile-cue')).toBe('disc')
    expect(chip.style.width).toBe('calc(16px * var(--canvas-label-scale, 1))')
    expect(chip.style.height).toBe('calc(16px * var(--canvas-label-scale, 1))')
    expect(chip.style.borderRadius).toBe('9999px')
    const cls = chip.className.split(/\s+/)
    expect(cls).toContain('border-text-light/40')
    expect(cls).not.toContain('shadow-panel')
  })

  it('is a named control: role button, a tab stop, a focus-visible ring', () => {
    setTopFragile()
    const { container } = renderEdge(edge(0.5))
    const chip = byTestId(container, 'edge-influence-label')!
    expect(chip.getAttribute('role')).toBe('button')
    expect(chip.getAttribute('tabindex')).toBe('0')
    expect(chip.getAttribute('aria-label')).toBe(fragileEdgeSentence(0.42))
    expect(chip.className).toContain('focus-visible:ring-info')
  })

  it('Enter, Space and click open THIS connection\'s inspector', () => {
    setTopFragile()
    const { container } = renderEdge(edge(0.5))
    const chip = byTestId(container, 'edge-influence-label')!
    fireEvent.keyDown(chip, { key: 'Enter' })
    fireEvent.keyDown(chip, { key: ' ' })
    fireEvent.click(chip)
    expect(openEditor.mock.calls).toEqual([['e1'], ['e1'], ['e1']])
    // A key that is not an activation key does nothing.
    fireEvent.keyDown(chip, { key: 'a' })
    expect(openEditor).toHaveBeenCalledTimes(3)
  })

  it('CONTRAST: with a strength row the chip keeps its row form — a note, no tab stop', () => {
    setTopFragile()
    mockViewMode = 'detailed'
    const { container } = renderEdge(edge(0.5), { selected: true })
    const chip = byTestId(container, 'edge-influence-label')!
    expect(byTestId(container, 'edge-influence-label-text'), 'precondition: strength row shown').not.toBeNull()
    expect(byTestId(container, 'edge-fragile-tag'), 'precondition: cue row shown').not.toBeNull()
    expect(chip.getAttribute('role')).toBe('note')
    expect(chip.getAttribute('tabindex')).toBeNull()
    expect(chip.getAttribute('data-fragile-cue')).toBeNull()
  })
})

describe('ICON-07 — edge glyphs are counter-scaled; the cue is muted', () => {
  it('the disc\'s pulse mark is 10px, counter-scaled, in muted ink', () => {
    setTopFragile()
    const { container } = renderEdge(edge(0.5))
    const tag = byTestId(container, 'edge-fragile-tag')!
    expect(tag.className).toContain('text-text-light')
    expect(tag.className).not.toContain('text-text-body')
    expect(tag.querySelector('svg')!.getAttribute('class')).toContain(CANVAS_GLYPH_SIZE_CLASSES[10])
  })

  it('in row form it is 12px, counter-scaled', () => {
    setTopFragile()
    mockViewMode = 'detailed'
    const { container } = renderEdge(edge(0.5), { selected: true })
    const tag = byTestId(container, 'edge-fragile-tag')!
    expect(tag.querySelector('svg')!.getAttribute('class')).toContain(CANVAS_GLYPH_SIZE_CLASSES[12])
  })

  it('the assumption flag is counter-scaled', () => {
    const { container } = renderEdge({ ...edge(0.5), flagged_as_assumption: true })
    const flag = byTestId(container, 'edge-assumption-badge')!.querySelector('svg')!
    expect(flag.getAttribute('class')).toContain(CANVAS_GLYPH_SIZE_CLASSES[12])
  })
})

// ── T16 ─────────────────────────────────────────────────────────────────────

describe('T16 — DS tokens, not legacy or default-palette utilities', () => {
  it('the template provenance dot is `bg-info`, not the legacy `bg-info-500`', () => {
    mockViewMode = 'detailed'
    const { container } = renderEdge({ ...edge(0.5), provenance: 'template' }, { selected: true })
    const dot = container.querySelector('[aria-label="Provenance: template"]')!
    expect(dot.className.split(/\s+/)).toContain('bg-info')
    expect(dot.className).not.toContain('bg-info-500')
  })

  it('an unrecognised provenance dot is `bg-text-light`, not Tailwind grey', () => {
    mockViewMode = 'detailed'
    const { container } = renderEdge({ ...edge(0.5), provenance: 'inferred' }, { selected: true })
    const dot = container.querySelector('[aria-label="Provenance: inferred"]')!
    expect(dot.className.split(/\s+/)).toContain('bg-text-light')
    expect(dot.className).not.toContain('bg-gray-400')
  })
})

// ── E11/E12 + E8/T07 ────────────────────────────────────────────────────────

describe('E11/E12/E8 — the three non-polarity stroke colours', () => {
  it('structural links are the contract\'s warm grey', () => {
    // Built from the muted-ink token (no new production hex — DS v5, Paul pt 9).
    expect(STRUCTURAL_EDGE_COLOUR).toBe('rgb(var(--text-light-rgb) / 0.5)')
  })

  it('the sign dispute is the SOLID Warning token, not a translucent mix', () => {
    expect(DIRECTION_DISPUTED_STROKE).toBe('var(--semantic-warning)')
  })

  it('the unset/undirected stroke token is the contract\'s warm neutral', () => {
    const css = readFileSync(resolve(__dirname, '../../../styles/brand.css'), 'utf8')
    expect(css).toMatch(/--edge-neutral:\s*#A9AAA5;/)
    expect(css).not.toMatch(/--edge-neutral:\s*#D4D4D8;/)
  })
})
