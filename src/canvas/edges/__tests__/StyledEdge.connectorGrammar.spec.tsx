/**
 * THE LOCKED CONNECTOR GRAMMAR, AS THE EDGE ACTUALLY RENDERS IT.
 *
 * Experience Design, 23 Sep 2026 (§6 "Connectors"), which wins over the spec
 * where it refines it:
 *   · dash = existence certainty ONLY;
 *   · orange = AI-review SIGN disagreement only;
 *   · fragility = a discreet exception cue, NOT a repurposed line style, shown at
 *     readable zoom only and within the existing budget (the single most
 *     sensitive connection in Standard view);
 *   · labels must not be verbose — "Sensitive · 70%" printed a flip probability
 *     with no noun beside a strength label, so it was read as a strength;
 *   · the edge and the card must agree that an unconfirmed strength is an
 *     ESTIMATE ("Link strength · Olumi's estimate"), not a fact;
 *   · a disputed sign is never stated as fact on hover.
 *
 * ⛔ BINDING. Every element is found by test id or role, never by matching the
 * text under test (trap 19): "Sensitive" appears in the chip and the popover
 * both, and three elements in this tree carry `role="note"`.
 *
 * `fragileEdgeMatch` is deliberately NOT mocked: its real accessor decides which
 * figure is measured, and a stub would let this file pass on a number the
 * product never shows.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, act } from '@testing-library/react'
import { StyledEdge } from '../StyledEdge'
import { Position } from '@xyflow/react'
import { LINK_STRENGTH_COPY } from '../../nodes/shared/metricVocabulary'

let capturedStyle: Record<string, unknown> | undefined
let mockReport: Record<string, unknown> | null = null
let mockEdges: Array<Record<string, unknown>> = []
let mockViewMode = 'standard'
let mockStatus = 'complete'
/** `undefined` = a store double with NO rung slice, which must read as ordinary. */
let mockLodRung: 'full' | 'quiet' | 'line' | undefined = 'full'

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
      ...(mockLodRung === undefined ? {} : { lodRung: mockLodRung }),
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

/** A producer-drafted edge nobody has confirmed: strength 0.6, stated positive, likelihood 0.8. */
const CEE_EDGE = {
  strength_mean: 0.6,
  effect_direction: 'positive' as const,
  // The likelihood channel reads `beliefExists` + its stamp (the draft path's
  // shape, `applyDraftResult`), NOT the raw `exists_probability`.
  beliefExists: 0.8,
  beliefExistsSource: 'cee' as const,
}
/** The same numbers, typed by the person — a SETTLED strength. */
const USER_EDGE = {
  weight: 0.6,
  weightSource: 'user' as const,
  direction: 'positive' as const,
  directionSource: 'user' as const,
  beliefExists: 0.8,
  beliefExistsSource: 'user' as const,
}
/** The same numbers, authored by a template author — unconfirmed, and NOT Olumi's. */
const TEMPLATE_EDGE = {
  weight: 0.6,
  weightSource: 'template' as const,
  direction: 'positive' as const,
  directionSource: 'template' as const,
  beliefExists: 0.8,
  beliefExistsSource: 'template' as const,
}

function validation(reason: string, needsUserInput = false) {
  return {
    status: 'contested',
    contested_reasons: [reason],
    pass1: { strength_mean: 0.6, strength_std: 0.1, exists_probability: 0.8 },
    pass2: {
      strength_mean: -0.5, strength_std: 0.15, exists_probability: 0.9,
      reasoning: 'test', basis: 'domain_prior', needs_user_input: needsUserInput,
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

function setFragile(entries: Array<Record<string, unknown>>): void {
  mockReport = { robustness: { fragile_edges: entries } }
}
function pinAsTopStrength(data: Record<string, unknown>): void {
  mockEdges = [{ id: 'e1', source: 'n1', target: 'n2', data }]
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
  mockLodRung = 'full'
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

// ── R1 + R2, rendered ───────────────────────────────────────────────────────

const REASONS = [
  'sign_flip',
  'strength_band_change',
  'confidence_band_change',
  'existence_boundary_crossing',
  'raw_magnitude',
] as const

describe('R1 — the rendered dash is existence certainty only', () => {
  it.each(REASONS.flatMap((r) => [false, true].map((n) => [r, n] as const)))(
    'a pending %s contest (needs_user_input=%s) draws the SAME dash as the edge without it',
    (reason, needs) => {
      renderEdge({ ...CEE_EDGE, validation: validation(reason, needs) })
      const contested = capturedStyle?.strokeDasharray
      renderEdge({ ...CEE_EDGE })
      const control = capturedStyle?.strokeDasharray
      expect(contested).toEqual(control)
      // This edge's likelihood (0.8) clears the existence cut: solid.
      expect(contested).toBeUndefined()
    },
  )

  it('a contested edge with a stated likelihood below the cut dashes 6,4 — from existence, not from the contest', () => {
    // (At the base this read the contest's divergence-scaled dash instead: the
    // contest rule OUTRANKED existence, so the one honest existence mark was
    // replaced by a disagreement mark on exactly the edges most in doubt.)
    renderEdge({ ...CEE_EDGE, beliefExists: 0.3, validation: validation('raw_magnitude', true) })
    expect(capturedStyle?.strokeDasharray).toBe('6,4')
  })
})

describe('R2 — orange on the line is a SIGN disagreement and nothing else', () => {
  it.each(
    REASONS.filter((r) => r !== 'sign_flip').flatMap((r) => [false, true].map((n) => [r, n] as const)),
  )('a pending %s contest (needs_user_input=%s) keeps its polarity stroke', (reason, needs) => {
    renderEdge({ ...CEE_EDGE, validation: validation(reason, needs) })
    const contested = capturedStyle?.stroke
    renderEdge({ ...CEE_EDGE })
    expect(contested).toEqual(capturedStyle?.stroke)
    expect(String(contested)).not.toContain('--semantic-warning')
  })

  it.each([false, true])('a pending sign_flip (needs_user_input=%s) is orange', (needs) => {
    renderEdge({ ...CEE_EDGE, validation: validation('sign_flip', needs) })
    expect(String(capturedStyle?.stroke)).toContain('--semantic-warning')
  })
})

// ── R4 + R5 + R6: the fragility cue ─────────────────────────────────────────

describe('R4 — fragility is a DISCREET cue: no bare figure on the canvas', () => {
  it('the cue paints no figure and no word — the measured flip risk lives in its name, WITH its noun', () => {
    setFragile([{ edge_id: 'e1', switch_probability: 0.42 }])
    const { container } = renderEdge({ ...CEE_EDGE })
    const cue = byTestId(container, 'edge-fragile-tag')
    expect(cue, 'the top fragile connection has no cue at all').not.toBeNull()
    // Nothing painted beside a strength label that could be read as a strength.
    expect(cue!.textContent ?? '').not.toMatch(/\d/)
    expect((cue!.textContent ?? '').trim()).toBe('')
    // The figure is still reachable, named for what it is.
    const name = cue!.getAttribute('aria-label') ?? ''
    expect(name).toContain('42% flip risk')
    expect(cue!.getAttribute('role')).toBe('img')
    expect(cue!.getAttribute('title')).toBe(name)
  })

  it('a MARGINAL-only fragile connection keeps the cue and states no figure anywhere on it', () => {
    setFragile([{ edge_id: 'e1', marginal_switch_probability: 0.9 }])
    const { container } = renderEdge({ ...CEE_EDGE })
    const cue = byTestId(container, 'edge-fragile-tag')
    expect(cue).not.toBeNull()
    expect(cue!.getAttribute('aria-label') ?? '').not.toMatch(/\d+%/)
    // Paul 23 Sep contract feedback point 4: the cue's own sentence, no figure.
    expect(cue!.getAttribute('aria-label') ?? '').toBe("If this connection's strength changes, the current model comparison could change")
  })

  it('a chip carrying BOTH a strength row and the cue names the cue on the assistive channel too', () => {
    // `aria-label` REPLACES descendant text: before this, a screen-reader user
    // on a top-strength fragile connection was never told it was fragile.
    // contract v3.1 (U10): the two-row chip exists in Detailed view only.
    mockViewMode = 'expert'
    pinAsTopStrength(CEE_EDGE)
    setFragile([{ edge_id: 'e1', switch_probability: 0.42 }])
    const { container } = renderEdge({ ...CEE_EDGE })
    const chip = byTestId(container, 'edge-influence-label')
    expect(chip).not.toBeNull()
    expect(byTestId(container, 'edge-influence-label-text'), 'the strength row is missing — this is not the two-row chip').not.toBeNull()
    expect(chip!.getAttribute('aria-label') ?? '').toContain('42% flip risk')
  })
})

describe('R5 — the cue appears at readable zoom only', () => {
  it.each(['standard', 'expert'])(
    'at the far "line" rung the cue is not painted, nor a chip that held only it (%s view)',
    (view) => {
      mockViewMode = view
      mockLodRung = 'line'
      setFragile([{ edge_id: 'e1', switch_probability: 0.42 }])
      const { container } = renderEdge({ ...CEE_EDGE })
      expect(byTestId(container, 'edge-fragile-tag')).toBeNull()
      expect(byTestId(container, 'edge-influence-label')).toBeNull()
    },
  )

  it.each([
    ['quiet', 'standard'], ['full', 'standard'], ['quiet', 'expert'], ['full', 'expert'],
  ] as const)('CONTROL: at rung "%s" the cue is painted (%s view)', (rung, view) => {
    mockViewMode = view
    mockLodRung = rung
    setFragile([{ edge_id: 'e1', switch_probability: 0.42 }])
    const { container } = renderEdge({ ...CEE_EDGE })
    expect(byTestId(container, 'edge-fragile-tag')).not.toBeNull()
  })

  it('CONTROL: a store double with NO rung slice paints the cue (absent means ordinary, never far)', () => {
    mockLodRung = undefined
    setFragile([{ edge_id: 'e1', switch_probability: 0.42 }])
    const { container } = renderEdge({ ...CEE_EDGE })
    expect(byTestId(container, 'edge-fragile-tag')).not.toBeNull()
  })

  it('at the "line" rung the STRENGTH row of a two-row chip survives — only the exception cue goes', () => {
    // contract v3.1 (U10): the two-row chip exists in Detailed view only.
    mockViewMode = 'expert'
    mockLodRung = 'line'
    pinAsTopStrength(CEE_EDGE)
    setFragile([{ edge_id: 'e1', switch_probability: 0.42 }])
    const { container } = renderEdge({ ...CEE_EDGE })
    expect(byTestId(container, 'edge-influence-label-text')).not.toBeNull()
    expect(byTestId(container, 'edge-fragile-tag')).toBeNull()
    // …and the hover still names it, so the fact is not lost with the cue.
    const popover = openPopover(container)
    expect(popover.textContent).toContain('42% flip risk')
  })
})

describe('R6 — within the existing budget (CONTROL: unchanged by this change)', () => {
  it('Standard view marks only the single most sensitive connection', () => {
    setFragile([
      { edge_id: 'other', switch_probability: 0.8 },
      { edge_id: 'e1', switch_probability: 0.42 },
    ])
    const { container } = renderEdge({ ...CEE_EDGE })
    expect(byTestId(container, 'edge-fragile-tag')).toBeNull()
  })

  it('Detailed view marks every sensitive connection', () => {
    mockViewMode = 'expert'
    setFragile([
      { edge_id: 'other', switch_probability: 0.8 },
      { edge_id: 'e1', switch_probability: 0.42 },
    ])
    const { container } = renderEdge({ ...CEE_EDGE })
    expect(byTestId(container, 'edge-fragile-tag')).not.toBeNull()
  })

  it('no cue before an analysis has completed', () => {
    mockStatus = 'idle'
    setFragile([{ edge_id: 'e1', switch_probability: 0.42 }])
    const { container } = renderEdge({ ...CEE_EDGE })
    expect(byTestId(container, 'edge-fragile-tag')).toBeNull()
  })
})

// ── R7: the hover never states a disputed sign as fact ──────────────────────

describe('R7 — a disputed sign is not stated as fact on hover', () => {
  it('a sign_flip connection says the review passes disagree, and prints no bare direction or direction-coloured bar', () => {
    const { container } = renderEdge({ ...CEE_EDGE, validation: validation('sign_flip') })
    const popover = openPopover(container)
    expect(popover.textContent).toContain("Olumi's two review passes disagree on direction")
    const bare = Array.from(popover.querySelectorAll('*')).filter(
      (el) => el.children.length === 0 && /^(Positive|Negative)$/.test((el.textContent ?? '').trim()),
    )
    expect(bare, 'a bare "Positive"/"Negative" line states the disputed sign as settled').toHaveLength(0)
    expect(popover.querySelector('.bg-success, .bg-danger')).toBeNull()
  })

  // ⭐ v3.1 (DESIGN-GAP-v31 row 12): the hover is a one-line tooltip, so the
  // agreed direction is said in the arrow sentence — once — rather than as a
  // bold "Positive" row over a green bar (both left with the popover).
  it('CONTROL: a contest over an AGREED sign still states its direction plainly', () => {
    const { container } = renderEdge({ ...CEE_EDGE, validation: validation('strength_band_change') })
    const popover = openPopover(container)
    expect(byTestId(container, 'edge-hover-arrow-sentence')!.textContent)
      .toBe('n1 → n2. Positive direction in this model.')
    expect(popover.textContent).not.toContain('disagree on direction')
    expect(popover.querySelector('.bg-success, .bg-danger')).toBeNull()
  })
})

// ── R8: an unconfirmed strength is never stated as settled on hover ─────────

describe('R8 — the hover states no strength, so it cannot state an estimate as settled', () => {
  // ⭐ REWRITTEN for v3.1 (DESIGN-GAP-v31 row 12). R8 pinned the popover's
  // "Link strength · Olumi’s estimate" caption. The one-line tooltip carries no
  // strength at all — the contract's hover is the arrow sentence — so the
  // estimate-versus-settled distinction is held where a strength IS shown: the
  // card rows (`LINK_STRENGTH_COPY`, pinned by `EdgePills.spec.tsx` and
  // `linkStrengthOneSource.spec.ts`) and the edge inspector's strength control.
  // What this pins now is the stronger claim: no strength caption, figure or
  // provenance word reaches the hover for ANY author.
  for (const [who, data] of [
    ['a producer (unconfirmed)', CEE_EDGE],
    ['a template (unconfirmed)', TEMPLATE_EDGE],
    ['the person (settled)', USER_EDGE],
  ] as const) {
    it(`${who}: no "Link strength", no estimate wording, no figure`, () => {
      const { container } = renderEdge({ ...data })
      const popover = openPopover(container)
      expect(popover.getAttribute('role')).toBe('tooltip')
      expect(popover.textContent).not.toContain(LINK_STRENGTH_COPY.noun)
      expect(popover.textContent).not.toMatch(/estimate/i)
      // No figure: the endpoint ids ("n1", "n2") are the only digits allowed.
      expect((popover.textContent ?? '').replace(/\bn[12]\b/g, '')).not.toMatch(/\d/)
      // POSITIVE: it does say the connection itself.
      expect(popover.textContent).toMatch(/^n1 → n2\./)
    })
  }

  it('an edge with no strength at all hovers to the same one sentence — no "not set" block to disagree with', () => {
    const { container } = renderEdge({ weight: 0.5 })
    const popover = openPopover(container)
    expect(byTestId(container, 'edge-hover-popover-unset')).toBeNull()
    expect(popover.textContent).toBe('n1 → n2. Direction not stated in this model.')
  })
})
