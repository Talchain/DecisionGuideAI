/**
 * ROW 29 (gap audit `DESIGN-GAP-AUDIT-20260924.md`) — the edge hover popover
 * is missing contract §03's lead sentence.
 *
 * ── THE GAP ──────────────────────────────────────────────────────────────
 *
 * §03: "<A> → <B>. Positive direction in this model." plus the existence-
 * doubt sentence when a doubt is recorded. `StyledEdge.tsx`'s popover held
 * confidence %, a strength bar and the two coaching chips — real editing
 * affordances the contract's plain tooltip has none of — but never the arrow
 * sentence and never the doubt wording.
 *
 * ── THE DECISION ─────────────────────────────────────────────────────────
 *
 * ADD the sentence as the popover's first line; keep everything else. The
 * direction word is `dirLabel` — the SAME value the existing bold Direction
 * row a few lines below reads (`statedDirection` / `resolveEdgeDirectionDisplay`),
 * never a second derivation. Unstated/defaulted direction says so honestly, in
 * the estate's own already-ratified words (`domain/edgeLabels.describeEdge`:
 * "…effect, direction not stated"). The doubt clause is bound to
 * `existenceDash` — the SAME field `resolveEdgeDash` reads to draw the dashed
 * stroke — never a second "doubt" concept invented for the sentence alone.
 *
 * ReactFlow/store mock structure follows StyledEdge.hover.spec.tsx.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, act } from '@testing-library/react'
import { StyledEdge } from '../StyledEdge'
import { Position } from '@xyflow/react'
import { EDGE_EXISTENCE_DOUBT_SENTENCE } from '../connectorCopy'

// ── ReactFlow mocks (as in StyledEdge.hover.spec.tsx) ────────────────────────
vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return {
    ...actual,
    BaseEdge: () => <path data-testid="base-edge" />,
    EdgeLabelRenderer: ({ children }: any) => <div>{children}</div>,
    getBezierPath: () => ['M0 0 L100 100', 50, 50],
    getSmoothStepPath: () => ['M0 0 L100 100', 50, 50],
    getStraightPath: () => ['M0 0 L100 100', 50, 50],
    useReactFlow: () => ({
      getNode: () => null,
      getEdges: () => [],
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
      results: { status: 'idle', report: null },
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
    })
  ),
}))

vi.mock('../../hooks/useModelChangedSinceRun', () => ({
  useModelChangedSinceRunLight: () => false,
  useModelChangedSinceRun: () => false,
}))

vi.mock('../../store/edgeLabelMode', () => ({
  useEdgeLabelMode: vi.fn((selector: any) => selector({ mode: 'human' })),
}))

vi.mock('../../hooks/useTheme', () => ({ useIsDark: () => false }))
vi.mock('../../hooks/useFirstTimeHints', () => ({
  useEdgeEditHint: () => ({ showHint: false, dismissHint: vi.fn() }),
}))
vi.mock('../../hooks/usePrefersReducedMotion', () => ({ usePrefersReducedMotion: () => false }))
vi.mock('../../../flags', () => ({ isGraphLensEnabled: () => false }))
vi.mock('../../utils/graphDisplayCalculations', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/graphDisplayCalculations')>()),
  calculateEdgeImportance: () => 0.5,
  importanceToStrokeWidth: () => 2,
  weightMagnitudeToStrokeWidth: () => 2,
}))
vi.mock('../../theme/edges', () => ({
  applyEdgeVisualProps: (_: any, props: any) => props,
}))
vi.mock('../../ui/inspector-v2/inspectorStrings', () => ({
  getStrengthDescription: () => 'moderate',
  getProvenanceLabel: () => '',
}))

const defaultEdgeProps = {
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

async function hoverAndGetSentence(data: Record<string, unknown>) {
  const { container } = render(<StyledEdge {...(defaultEdgeProps as any)} data={data} />)
  const hitPath = container.querySelector('path[stroke="transparent"]')!
  act(() => {
    fireEvent.mouseEnter(hitPath)
    vi.advanceTimersByTime(400)
  })
  const el = container.querySelector('[data-testid="edge-hover-arrow-sentence"]')
  return { container, el }
}

describe('StyledEdge hover popover — the arrow sentence (contract §03)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('PIN: a stated POSITIVE direction reads "<source> → <target>. Positive direction in this model."', async () => {
    const { el } = await hoverAndGetSentence({
      weight: 0.3, direction: 'positive', directionSource: 'user', beliefExists: 0.9, beliefExistsSource: 'user',
    })
    expect(el).not.toBeNull()
    expect(el!.textContent).toContain('n1 → n2. Positive direction in this model.')
  })

  it('PIN: a stated NEGATIVE direction reads "…Negative direction in this model."', async () => {
    const { el } = await hoverAndGetSentence({
      weight: 0.3, direction: 'negative', directionSource: 'user', beliefExists: 0.9, beliefExistsSource: 'user',
    })
    expect(el).not.toBeNull()
    expect(el!.textContent).toContain('n1 → n2. Negative direction in this model.')
  })

  /**
   * ⛔ THE HONESTY ARM. `direction: 'positive'` with no `directionSource` is
   * `USER_EDGE_DEFAULTS`'s UI default, never a stated fact — the same trap
   * `StyledEdge.directionProvenance.spec.tsx` pins one level down, on the
   * glyph. This sentence must not guess a sign for it.
   */
  it('CONTRAST: an UNSTATED/defaulted direction says so honestly — never guesses a sign', async () => {
    const { el } = await hoverAndGetSentence({
      weight: 0.3, direction: 'positive', beliefExists: 0.9, beliefExistsSource: 'user',
    })
    expect(el).not.toBeNull()
    expect(el!.textContent).toContain('n1 → n2. Direction not stated in this model.')
    expect(el!.textContent).not.toMatch(/Positive/)
    expect(el!.textContent).not.toMatch(/Negative/)
  })

  // ⛔ Review 5823365172 B1: the popover already rules that a DISPUTED sign is
  // named only inside the sentence that says it is disputed.
  const CONTESTED = { status: 'contested', user_action: 'pending', contested_reasons: ['sign_flip'], max_divergence: 0.6 }

  it('⭐ PIN: a sign DISPUTED by Olumi\'s review states the arrow alone — no settled direction, no "not stated"', async () => {
    const { el } = await hoverAndGetSentence({
      weight: 0.3, direction: 'positive', directionSource: 'user', beliefExists: 0.9, beliefExistsSource: 'user',
      validation: CONTESTED,
    })
    expect(el).not.toBeNull()
    expect(el!.textContent).toBe('n1 → n2.')
  })

  it('OPPOSITE CONTROL — the same link with no contest states its direction', async () => {
    const { el } = await hoverAndGetSentence({
      weight: 0.3, direction: 'positive', directionSource: 'user', beliefExists: 0.9, beliefExistsSource: 'user',
    })
    expect(el!.textContent).toContain('n1 → n2. Positive direction in this model.')
  })

  it('PIN: a recorded existence doubt (likelihood below the certainty band) appends the doubt sentence', async () => {
    const { el } = await hoverAndGetSentence({
      weight: 0.3, direction: 'positive', directionSource: 'user',
      beliefExists: 0.5, beliefExistsSource: 'user', // < EDGE_VALUE_BAND_CUTS.high (0.7) → dashed
    })
    expect(el).not.toBeNull()
    expect(el!.textContent).toContain(EDGE_EXISTENCE_DOUBT_SENTENCE)
  })

  it('CONTRAST: a HIGH stated likelihood (no doubt recorded) never appends the doubt sentence', async () => {
    const { el } = await hoverAndGetSentence({
      weight: 0.3, direction: 'positive', directionSource: 'user',
      beliefExists: 0.9, beliefExistsSource: 'user', // >= 0.7 → solid, no doubt
    })
    expect(el).not.toBeNull()
    expect(el!.textContent).not.toContain(EDGE_EXISTENCE_DOUBT_SENTENCE)
  })

  it('CONTRAST: an UNSET likelihood (never assessed) is not a "doubt" — never invents one', async () => {
    const { el } = await hoverAndGetSentence({
      weight: 0.3, direction: 'positive', directionSource: 'user',
      // no beliefExists at all
    })
    expect(el).not.toBeNull()
    expect(el!.textContent).not.toContain(EDGE_EXISTENCE_DOUBT_SENTENCE)
  })

  it('the sentence is ADDED, not a replacement — the rich popover content survives beside it', async () => {
    const { container, el } = await hoverAndGetSentence({
      weight: 0.3, direction: 'positive', directionSource: 'user',
      beliefExists: 0.9, beliefExistsSource: 'user', weightSource: 'user',
    })
    expect(el).not.toBeNull()
    const popover = container.querySelector('[data-testid="edge-hover-popover"]')!
    // The bold Direction row (the popover's pre-existing content) still renders.
    expect(popover.textContent).toMatch(/Positive/)
    // And it renders AFTER the arrow sentence in document order — "first line".
    const arrowIndex = popover.textContent!.indexOf('n1 → n2. Positive direction in this model.')
    const boldDirectionIndex = popover.textContent!.indexOf('Positive', arrowIndex + 1)
    expect(arrowIndex).toBeGreaterThanOrEqual(0)
    expect(boldDirectionIndex).toBeGreaterThan(arrowIndex)
  })
})
