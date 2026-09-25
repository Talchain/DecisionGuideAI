/**
 * ROW 38 (gap audit `DESIGN-GAP-AUDIT-20260924.md`) — the fragile cue must not
 * present a STALE fragility finding as current.
 *
 * ── THE DEFECT, TRACED ──────────────────────────────────────────────────────
 *
 * `paintFragileCue` (and therefore `isFragileEdge`) gates on `isResultsMode`
 * alone — `results.status === 'complete'` — and `store.ts` never resets
 * `results.status` when the user edits the model after a run (grep
 * `status:\s*'` in `store.ts`: the only writer of `'complete'` is
 * `resultsComplete`; no edit action touches it). So a completed run's report
 * stays on screen, and the fragile cue keeps painting FROM it, after the model
 * has changed — with no word distinguishing "this is what LAST run found" from
 * "this is true of the model in front of you now".
 *
 * ── THE DECISION, PER THE BRIEF ─────────────────────────────────────────────
 *
 * Paul's Ruling 3 (ROADMAP 2.651, `metricVocabulary.sensitivityRankBadgeLabel`'s
 * own docblock): "out-of-date results are labelled, not withheld". The factor
 * card's `Key driver N` badge already keeps a stale rank and PREFIXES
 * `LAST_RUN_PREFIX` rather than hiding it. This pins the SAME choice for the
 * edge's fragile cue: labelled, never hidden.
 *
 * `useModelChangedSinceRunLight` is mocked directly here — this file pins how
 * StyledEdge REACTS to that signal, not how the signal itself is derived
 * (that is `composeAnalysisState`'s own authority, proved equivalent to the
 * single-instance `useModelChangedSinceRun` for `'changed'` in that hook's own
 * docblock in `hooks/useModelChangedSinceRun.ts`).
 *
 * ReactFlow/store mock structure follows StyledEdge.fragilePresence.spec.tsx.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, act, screen } from '@testing-library/react'
import { StyledEdge } from '../StyledEdge'
import { Position } from '@xyflow/react'
import { LAST_RUN_PREFIX } from '../../nodes/shared/metricVocabulary'

// Mutable per-test report — the store mock factory reads it at selector time.
let mockReport: Record<string, unknown> | null = null
// Mutable per-test freshness signal — the ONE thing this file varies.
let mockModelChangedSinceRun = false

// ── ReactFlow mocks (as in StyledEdge.fragilePresence.spec.tsx) ─────────────
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
      results: { status: 'complete', report: mockReport },
      viewMode: 'detailed',
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

// The ONE signal this file varies. A DIRECT mock of the hook StyledEdge calls
// — this pins StyledEdge's reaction to the signal, not the signal's own
// derivation (that belongs to `analysisStateSelector`'s own suite).
vi.mock('../../hooks/useModelChangedSinceRun', () => ({
  useModelChangedSinceRunLight: () => mockModelChangedSinceRun,
  useModelChangedSinceRun: () => mockModelChangedSinceRun,
}))

vi.mock('../../store/edgeLabelMode', () => ({
  useEdgeLabelMode: vi.fn((selector: any) => selector({ mode: 'human' })),
}))

vi.mock('../../hooks/useTheme', () => ({
  useIsDark: () => false,
}))

vi.mock('../../hooks/useFirstTimeHints', () => ({
  useEdgeEditHint: () => ({ showHint: false, dismissHint: vi.fn() }),
}))

vi.mock('../../hooks/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: () => false,
}))

vi.mock('../../../flags', () => ({
  isGraphLensEnabled: () => false,
}))

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
  data: {
    weight: 0.6,
    direction: 'positive' as const,
    beliefExists: 0.8,
  },
}

function setFragileEdge(): void {
  mockReport = { robustness: { fragile_edges: [{ edge_id: 'e1', switch_probability: 0.42 }] } }
}

function openHoverPopover(container: HTMLElement): void {
  const hitPath = container.querySelector('path[stroke="transparent"]')
  expect(hitPath).not.toBeNull()
  act(() => {
    fireEvent.mouseEnter(hitPath!)
  })
  act(() => {
    vi.advanceTimersByTime(350)
  })
}

describe('StyledEdge — a stale fragile finding is labelled "Last run", never presented as current', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockReport = null
    mockModelChangedSinceRun = false
    setFragileEdge()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('CONTRAST: an unchanged model shows the cue with NO "Last run" label', () => {
    mockModelChangedSinceRun = false
    render(<StyledEdge {...(defaultEdgeProps as any)} />)
    const badge = screen.getByTestId('edge-fragile-tag')
    expect(badge.getAttribute('aria-label')).not.toContain(LAST_RUN_PREFIX)
    expect(badge.closest('[title]')?.getAttribute('title')).not.toContain(LAST_RUN_PREFIX)
  })

  it('PIN (badge): a model changed since the run labels the cue\'s name and title "Last run"', () => {
    mockModelChangedSinceRun = true
    render(<StyledEdge {...(defaultEdgeProps as any)} />)
    const badge = screen.getByTestId('edge-fragile-tag')
    expect(badge.getAttribute('aria-label')).toContain(LAST_RUN_PREFIX)
    expect(badge.getAttribute('aria-label')).toContain('42% flip risk')
    const titled = badge.closest('[title]')
    expect(titled?.getAttribute('title')).toContain(LAST_RUN_PREFIX)
  })

  it('PIN (popover): a model changed since the run labels the hover line too — the SAME sentence as the cue', () => {
    mockModelChangedSinceRun = true
    const { container } = render(<StyledEdge {...(defaultEdgeProps as any)} />)
    const badge = screen.getByTestId('edge-fragile-tag')
    openHoverPopover(container)
    const line = screen.getByTestId('edge-hover-fragility')
    expect(line.textContent).toContain(LAST_RUN_PREFIX)
    // ⭐ IDENTITY, NOT JUST PRESENCE — the popover and the cue must carry
    // byte-identical wording, never two spellings of the same staleness
    // (CLAUDE.md trap 12). This is the case that would have stayed green if
    // the popover's own `fragileEdgeSentence(...)` call had been left
    // un-refactored beside the cue's prefixed `fragileSentence`.
    expect(line.textContent).toBe(badge.getAttribute('aria-label'))
  })

  it('CONTRAST: the popover carries no label either when the model has not changed', () => {
    mockModelChangedSinceRun = false
    const { container } = render(<StyledEdge {...(defaultEdgeProps as any)} />)
    openHoverPopover(container)
    const line = screen.getByTestId('edge-hover-fragility')
    expect(line.textContent).not.toContain(LAST_RUN_PREFIX)
  })
})
