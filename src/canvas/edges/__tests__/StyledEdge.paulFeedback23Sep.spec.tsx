/**
 * PAUL'S 23 SEP CONTRACT FEEDBACK — CONNECTORS (points 4, 9 and 12), AS THE
 * EDGE ACTUALLY RENDERS IT.
 *
 *   4. "Remove the warning-triangle + red/dashed + 'Sensitive' pile-up. One
 *      discreet fragility cue. Dash remains existence certainty only."
 *   9. "AI sign-disagreement = Warning/amber + `±`" — shape AND colour, never a
 *      new colour.
 *  12. "Links cannot rely on red/green alone. `+ / −` must remain interpretable
 *      at readable zoom. Icons need hover/focus labels."
 *
 * ⛔ BINDING. Elements are found by test id, role or `data-edge-id`, never by
 * matching the text under test (trap 19). `fragileEdgeMatch` is NOT mocked: its
 * real accessor decides which figure is measured.
 *
 * Harness copied from `StyledEdge.connectorGrammar.spec.tsx` (same mocks, same
 * fixtures) so the two files describe one rendering.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, act } from '@testing-library/react'
import { StyledEdge } from '../StyledEdge'
import { Position } from '@xyflow/react'
import { FRAGILE_CUE_SENTENCE, DIRECTION_DISPUTED_SENTENCE } from '../connectorCopy'
import { resolveEdgeDash, NOT_CONTESTED, type EdgePresentationState } from '../edgePresentation'
import { perceivableStrings } from './__helpers__/edgeCopyHonesty'

let capturedStyle: Record<string, unknown> | undefined
let mockReport: Record<string, unknown> | null = null
let mockEdges: Array<Record<string, unknown>> = []
let mockViewMode = 'standard'
let mockStatus = 'complete'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return {
    ...actual,
    BaseEdge: (props: any) => {
      capturedStyle = props.style
      return <path data-testid="base-edge" />
    },
    EdgeLabelRenderer: ({ children }: any) => <div>{children}</div>,
    getBezierPath: () => ['M0 0 L100 100', 50, 50],
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
      results: { status: mockStatus, report: mockReport },
      viewMode: mockViewMode,
      lodRung: 'full',
      hoveredOptionId: null,
      highlightedEdges: new Set<string>(),
      dimmedEdgeIds: new Set<string>(),
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

const CEE_EDGE = {
  strength_mean: 0.6,
  effect_direction: 'positive' as const,
  beliefExists: 0.8,
  beliefExistsSource: 'cee' as const,
}
const CEE_EDGE_NEGATIVE = {
  strength_mean: -0.6,
  effect_direction: 'negative' as const,
  beliefExists: 0.8,
  beliefExistsSource: 'cee' as const,
}

function validation(reason: string) {
  return {
    status: 'contested',
    contested_reasons: [reason],
    pass1: { strength_mean: 0.6, strength_std: 0.1, exists_probability: 0.8 },
    pass2: {
      strength_mean: -0.5, strength_std: 0.15, exists_probability: 0.9,
      reasoning: 'test', basis: 'domain_prior', needs_user_input: false,
    },
    max_divergence: 0.6,
    distance_to_goal: 1,
    evoi_rank: null,
    evoi_impact: null,
    was_shown: true,
    user_action: 'pending',
    resolved_value: null,
    resolved_by: 'default',
  }
}

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

const byTestId = (c: HTMLElement, id: string) =>
  c.querySelector(`[data-testid="${id}"]`) as HTMLElement | null
/** The polarity glyph, by the identity binding it carries — never by its text. */
const glyphOf = (c: HTMLElement) =>
  c.querySelector('[data-edge-id="e1"]') as HTMLElement | null

function setFragile(entries: Array<Record<string, unknown>>): void {
  mockReport = { robustness: { fragile_edges: entries } }
}
function renderEdge(data: Record<string, unknown>) {
  capturedStyle = undefined
  return render(<StyledEdge {...(baseProps as any)} data={data} />)
}
function openPopover(container: HTMLElement): HTMLElement {
  const hit = container.querySelector('path[stroke="transparent"]')
  expect(hit, 'no hit path — the hover cannot be driven').not.toBeNull()
  act(() => { fireEvent.mouseEnter(hit!) })
  act(() => { vi.advanceTimersByTime(350) })
  const popover = byTestId(container, 'edge-hover-popover')
  expect(popover, 'the hover popover did not open').not.toBeNull()
  return popover!
}

beforeEach(() => {
  mockReport = null
  mockEdges = []
  mockViewMode = 'standard'
  mockStatus = 'complete'
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

// ── Point 4 — one discreet fragility cue ────────────────────────────────────

describe('Paul 23 Sep point 4 — ONE discreet fragility cue, no pile-up', () => {
  it('the cue is not a warning triangle: it draws a neutral mark, named, with its own hover sentence', () => {
    setFragile([{ edge_id: 'e1', switch_probability: 0.42 }])
    const { container } = renderEdge({ ...CEE_EDGE })
    const cue = byTestId(container, 'edge-fragile-tag')
    expect(cue, 'the top fragile connection has no cue at all').not.toBeNull()
    const icon = cue!.querySelector('svg')
    expect(icon, 'the cue draws no mark').not.toBeNull()
    const cls = icon!.getAttribute('class') ?? ''
    // A triangle is the design system's WARNING icon and the RISK node's icon.
    expect(cls).not.toMatch(/lucide-(alert-triangle|triangle-alert|triangle)/)
    expect(cls).toMatch(/lucide-activity/)
    // Neutral weight: never a semantic hue on the mark itself. contract v3.1
    // (ICON-07/E10, 24 Sep 2026): MUTED ink, the contract's `.cue-icon`
    // #797871 — it was body ink (`text-text-body`) here.
    expect(cue!.className).toContain('text-text-light')
    expect(cue!.className).not.toMatch(/text-(warning|danger|info)/)
    // Named, and the same sentence on hover.
    const name = cue!.getAttribute('aria-label') ?? ''
    expect(name).toContain(FRAGILE_CUE_SENTENCE)
    expect(name).toContain('42% flip risk')
    expect(cue!.getAttribute('title')).toBe(name)
  })

  it('the chip that carries the cue gets no extra semantic border — the mark is the ONE cue', () => {
    setFragile([{ edge_id: 'e1', switch_probability: 0.42 }])
    const { container } = renderEdge({ ...CEE_EDGE })
    const chip = byTestId(container, 'edge-influence-label')
    expect(chip).not.toBeNull()
    expect(chip!.className).not.toMatch(/border-(info|warning|danger)/)
  })

  it('the fragile connection draws the SAME stroke and dash as the identical non-fragile one (no red, no dash)', () => {
    setFragile([{ edge_id: 'e1', switch_probability: 0.42 }])
    renderEdge({ ...CEE_EDGE })
    const fragileStroke = capturedStyle?.stroke
    const fragileDash = capturedStyle?.strokeDasharray
    mockReport = null
    renderEdge({ ...CEE_EDGE })
    expect(fragileStroke).toEqual(capturedStyle?.stroke)
    expect(fragileDash).toEqual(capturedStyle?.strokeDasharray)
    expect(String(fragileStroke)).not.toMatch(/danger|warning/)
  })

  it('nothing perceivable on a fragile connection — chip or hover — says "Sensitive"', () => {
    setFragile([{ edge_id: 'e1', switch_probability: 0.42 }])
    const { container } = renderEdge({ ...CEE_EDGE })
    const popover = openPopover(container)
    const strings = perceivableStrings(container)
    // Discrimination: the fragility sentence IS perceivable, so the absence
    // below is not an empty tree agreeing with itself.
    expect(strings.some((s) => s.includes(FRAGILE_CUE_SENTENCE))).toBe(true)
    expect(strings.filter((s) => /sensitive/i.test(s))).toEqual([])
    // The hover states the fragility in the SAME words, with no warning mark.
    expect(popover.textContent).toContain(FRAGILE_CUE_SENTENCE)
    expect(popover.textContent).toContain('42% flip risk')
    expect(popover.querySelector('.lucide-alert-triangle, .lucide-triangle-alert')).toBeNull()
  })
})

describe('Paul 23 Sep point 4 — dash means existence certainty ONLY', () => {
  const state = (over: Partial<EdgePresentationState>): EdgePresentationState => ({
    isStructural: false,
    lensMode: 'full',
    causalParams: null,
    evidenceClass: null,
    contested: NOT_CONTESTED,
    isHighlighted: false,
    polarityStroke: 'var(--edge-positive)',
    existence: { kind: 'stated', dash: undefined },
    ...over,
  })

  it('a presentational `style: dashed` cannot dash a connection whose stated likelihood is high', () => {
    const d = resolveEdgeDash(state({ existence: { kind: 'stated', dash: undefined }, visualPropsDash: '5,5' }))
    expect(d.value).toBeUndefined()
    expect(d.rule).toBe('existence_certainty')
  })

  it('CONTROL: a stated LOW likelihood still dashes, by the existence rule', () => {
    const d = resolveEdgeDash(state({ existence: { kind: 'stated', dash: '6,4' } }))
    expect(d.value).toBe('6,4')
    expect(d.rule).toBe('existence_certainty')
  })
})

// ── Point 9 — AI sign disagreement = amber + ± ──────────────────────────────

describe('Paul 23 Sep point 9 — an AI sign disagreement is amber AND "±"', () => {
  it('a pending sign_flip draws the "±" glyph, named as the disagreement, on the amber stroke', () => {
    const { container } = renderEdge({ ...CEE_EDGE, validation: validation('sign_flip') })
    const glyph = glyphOf(container)
    expect(glyph, 'a sign-disputed connection has no shape cue at all').not.toBeNull()
    expect(glyph!.textContent).toBe('±')
    expect(glyph!.getAttribute('aria-label') ?? '').toContain(DIRECTION_DISPUTED_SENTENCE)
    expect(String(capturedStyle?.stroke)).toContain('--semantic-warning')
  })

  it('the "±" survives even when the top-strength label would otherwise carry the direction', () => {
    // The label's direction word is the FIRST pass's sign — the disputed one —
    // so it cannot stand in for the dispute cue.
    const data = { ...CEE_EDGE, validation: validation('sign_flip') }
    mockEdges = [{ id: 'e1', source: 'n1', target: 'n2', data }]
    const { container } = renderEdge(data)
    const glyph = glyphOf(container)
    expect(glyph).not.toBeNull()
    expect(glyph!.textContent).toBe('±')
  })

  it.each(['strength_band_change', 'confidence_band_change', 'existence_boundary_crossing', 'raw_magnitude'])(
    'CONTROL: a %s contest (sign agreed) keeps its "+" glyph',
    (reason) => {
      const { container } = renderEdge({ ...CEE_EDGE, validation: validation(reason) })
      expect(glyphOf(container)?.textContent).toBe('+')
    },
  )
})

// ── Point 12 — +/− never colour alone, legible at readable zoom ─────────────

describe('Paul 23 Sep point 12 — the sign is a CHARACTER, legible, never hue alone', () => {
  it.each([
    ['positive', CEE_EDGE, '+'],
    ['negative', CEE_EDGE_NEGATIVE, '−'],
  ] as const)("a %s connection carries its sign as a character at the counter-scaled, semibold edge size", (_, data, ch) => {
    const { container } = renderEdge({ ...data })
    const glyph = glyphOf(container)
    expect(glyph).not.toBeNull()
    expect(glyph!.textContent).toBe(ch)
    // Counter-scaled with zoom (the canvas label token), and heavy enough that
    // a thin "−" does not vanish at the landing zoom.
    expect(glyph!.className).toContain('var(--canvas-label-scale')
    expect(glyph!.className).toContain('font-semibold')
    // Body ink, not the polarity hue: the SHAPE carries the sign.
    expect(glyph!.className).toContain('text-text-body')
  })
})
