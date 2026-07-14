/**
 * Regression tests for contested edge visual styling in StyledEdge.
 *
 * Covers:
 *  - Pending contested → dashed info stroke with divergence-scaled gap
 *  - needs_user_input → tighter dash gap + full info colour
 *  - Resolved contested → reverts to standard non-contested style
 *  - Missing max_divergence → non-contested style (no silent default)
 *  - Absent validation → standard style
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import { StyledEdge } from '../StyledEdge'
import { Position } from '@xyflow/react'

// ── Capture BaseEdge style prop ─────────────────────────────────────────────

let capturedStyle: React.CSSProperties | undefined

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
      getEdges: () => [],
      getNodes: () => [],
    }),
    // E3 part 2: StyledEdge subscribes to node geometry via the store
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

vi.mock('../../flags', () => ({
  isGraphLensEnabled: () => false,
}))

vi.mock('../../utils/fragileEdgeMatch', () => ({
  isEdgeFragile: () => false,
  getFragileEdgeSwitchProbability: () => null,
}))

vi.mock('../../utils/graphDisplayCalculations', () => ({
  existenceCertaintyToLineStyle: () => null,
  calculateEdgeImportance: () => 0.5,
  importanceToStrokeWidth: () => 2,
  weightMagnitudeToStrokeWidth: () => 2,
}))

vi.mock('../../theme/edges', () => ({
  applyEdgeVisualProps: () => ({
    strokeWidth: 2,
    strokeDasharray: undefined,
    stroke: '#888',
    curvature: 0.15,
  }),
}))

vi.mock('../../ui/inspector-v2/inspectorStrings', () => ({
  getStrengthDescription: () => 'moderate',
  getProvenanceLabel: () => '',
}))

// ── Helpers ─────────────────────────────────────────────────────────────────

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

function makeValidation(overrides: Record<string, unknown> = {}) {
  return {
    status: 'contested',
    contested_reasons: ['strength_band_change'],
    pass1: { strength_mean: 0.3, strength_std: 0.1, exists_probability: 0.8 },
    pass2: {
      strength_mean: 0.7, strength_std: 0.15, exists_probability: 0.9,
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
    ...overrides,
  }
}

function renderEdge(data: Record<string, unknown>) {
  capturedStyle = undefined
  render(<StyledEdge {...baseProps as any} data={data} />)
  return capturedStyle!
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('StyledEdge — contested visual styling', () => {
  afterEach(() => {
    capturedStyle = undefined
  })

  it('pending contested edge with max_divergence renders dashed warning stroke', () => {
    const style = renderEdge({
      weight: 0.5,
      direction: 'positive',
      validation: makeValidation({ max_divergence: 0.6 }),
    })

    // Stroke should be the 70% mixed warning colour (contested = needs attention)
    expect(style.stroke).toContain('color-mix')
    expect(style.stroke).toContain('--semantic-warning')

    // Dash array should be divergence-scaled: width = 1.5 + 0.6*1.5 = 2.4, gap = 4 + 0.6*4 = 6
    expect(style.strokeDasharray).toBe('2.4 6')
  })

  it('needs_user_input gets tighter dash and full info colour', () => {
    const style = renderEdge({
      weight: 0.5,
      direction: 'positive',
      validation: makeValidation({
        max_divergence: 0.8,
        pass2: {
          strength_mean: 0.7, strength_std: 0.15, exists_probability: 0.9,
          reasoning: 'test', basis: 'domain_prior', needs_user_input: true,
        },
      }),
    })

    // Full warning colour for needs_user_input (contested = needs attention)
    expect(style.stroke).toBe('var(--semantic-warning)')

    // Tight dash: gap = 3 regardless of divergence; width = 1.5 + 0.8*1.5 = 2.7
    expect(style.strokeDasharray).toBe('2.7 3')
  })

  it('resolved contested edge reverts to standard non-contested style', () => {
    const style = renderEdge({
      weight: 0.5,
      direction: 'positive',
      beliefExists: 0.8,
      validation: makeValidation({ user_action: 'accepted_pass2' }),
    })

    // Should NOT have info colour — falls back to direction-based stroke
    expect(style.stroke).not.toContain('--semantic-info')
    // Should NOT have contested dash; with beliefExists set, existenceCertainty returns null (mocked)
    // so it falls back to visualProps.strokeDasharray (undefined)
    expect(style.strokeDasharray).toBeUndefined()
  })

  it('missing max_divergence on contested edge falls back to non-contested style', () => {
    const validation = makeValidation()
    delete (validation as any).max_divergence
    const style = renderEdge({
      weight: 0.5,
      direction: 'positive',
      validation,
    })

    // Should NOT render contested styling when max_divergence is absent
    expect(style.stroke).not.toContain('--semantic-info')
  })

  it('null max_divergence on contested edge falls back to non-contested style', () => {
    const style = renderEdge({
      weight: 0.5,
      direction: 'positive',
      validation: makeValidation({ max_divergence: null }),
    })

    expect(style.stroke).not.toContain('--semantic-info')
  })

  it('absent validation renders standard style', () => {
    const style = renderEdge({
      weight: 0.5,
      direction: 'positive',
    })

    expect(style.stroke).not.toContain('--semantic-info')
  })

  it('agreed validation status renders standard style', () => {
    const style = renderEdge({
      weight: 0.5,
      direction: 'positive',
      validation: makeValidation({ status: 'agreed' }),
    })

    expect(style.stroke).not.toContain('--semantic-info')
  })

  it('max_divergence 0 produces minimal dash width (1.5) and gap (4)', () => {
    const style = renderEdge({
      weight: 0.5,
      direction: 'positive',
      validation: makeValidation({ max_divergence: 0 }),
    })

    expect(style.strokeDasharray).toBe('1.5 4')
    expect(style.stroke).toContain('color-mix')
  })

  it('max_divergence 1 produces maximum dash width (3.0) and gap (8)', () => {
    const style = renderEdge({
      weight: 0.5,
      direction: 'positive',
      validation: makeValidation({ max_divergence: 1 }),
    })

    expect(style.strokeDasharray).toBe('3 8')
  })
})
