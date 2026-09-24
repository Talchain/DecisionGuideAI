/**
 * GAP 2 (design-gap audit row 19). The locked contract is light-only
 * (`:root{color-scheme:light}`, no dark tokens) and cards/ground have no dark
 * path at all — `useIsDark` is imported ONLY by `StyledEdge.tsx` in this
 * codebase (verified by `git grep -rl useIsDark src`, excluding specs). So
 * canvas edges and their chips must render the LIGHT palette even when the
 * OS reports dark mode.
 *
 * ⚠ WHY THIS MOCKS `useTheme` RATHER THAN REAL `matchMedia`. `useTheme.ts`
 * captures `window.matchMedia('(prefers-color-scheme: dark)')` at MODULE
 * LOAD time (`tests/setup/rtl.ts` installs a fixed `matches: false` stub
 * before any spec's imports run), so a later per-test `matchMedia` override
 * in this file would arrive after that capture and never be read — every
 * sibling StyledEdge spec already works around this by mocking the hook
 * module directly. This file keeps that pattern but makes the flag
 * CONTROLLABLE (unlike siblings' hardcoded `() => false`), which is what
 * lets it actually simulate "OS reports dark" and prove the canvas ignores
 * it — a fixed `false` could never fail.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { StyledEdge } from '../StyledEdge'
import { Position } from '@xyflow/react'

let mockIsDark = false

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return {
    ...actual,
    BaseEdge: (props: any) => <path data-testid="base-edge" style={props.style} />,
    EdgeLabelRenderer: ({ children }: any) => <div>{children}</div>,
    getBezierPath: () => ['M0 0 L100 100', 50, 50],
    getSmoothStepPath: () => ['M0 0 L100 100', 50, 50],
    getStraightPath: () => ['M0 0 L100 100', 50, 50],
    useReactFlow: () => ({ getNode: () => null, getEdges: () => [], getNodes: () => [] }),
    useStore: (selector: any) => selector({ nodes: [] }),
  }
})

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector: any) =>
    selector({
      updateEdgeData: vi.fn(),
      runMeta: { ceeReview: null },
      // Detailed + complete: the simplest combination that makes
      // `shouldShowEdgeLabel` fire via `selected` alone, so the chip renders.
      results: { status: 'complete', report: null },
      viewMode: 'detailed',
      hoveredOptionId: null,
      highlightedEdges: new Set<string>(),
      dimmedEdgeIds: new Set<string>(),
      analysisHighlight: { source: null, edgeIds: new Set<string>(), nodeIds: new Set<string>() },
      lens: {
        active: 'full',
        _dimmedEdgeIds: new Set<string>(),
        _sensitivityWeights: new Map<string, number>(),
        _sensitivityQuartiles: null,
        _fragileEdgeIds: new Set<string>(),
        _hiddenNodeIds: new Set<string>(),
        _hiddenEdgeIds: new Set<string>(),
        _causalEdgeParams: new Map(),
        _evidenceEdgeClass: new Map(),
      },
    }),
  ),
}))

vi.mock('../../store/edgeLabelMode', () => ({ useEdgeLabelMode: (s: any) => s({ mode: 'human' }) }))
// ⚠ CONTROLLABLE — see file header. This is the one line every sibling spec
// hardcodes to `() => false`; here it reads a mutable flag instead.
vi.mock('../../hooks/useTheme', () => ({ useIsDark: () => mockIsDark }))
vi.mock('../../hooks/useFirstTimeHints', () => ({ useEdgeEditHint: () => ({ showHint: false, dismissHint: vi.fn() }) }))
vi.mock('../../hooks/usePrefersReducedMotion', () => ({ usePrefersReducedMotion: () => false }))
vi.mock('../../../flags', () => ({ isGraphLensEnabled: () => false }))
vi.mock('../../utils/fragileEdgeMatch', () => ({
  isEdgeFragile: () => false,
  getFragileEdgeSwitchProbability: () => null,
  isTopFragileEdge: () => false,
}))
vi.mock('../../utils/graphDisplayCalculations', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/graphDisplayCalculations')>()),
  calculateEdgeImportance: () => 0.5,
  importanceToStrokeWidth: () => 2,
  weightMagnitudeToStrokeWidth: () => 2,
}))
vi.mock('../../theme/edges', () => ({ applyEdgeVisualProps: (_: any, props: any) => props }))
vi.mock('../../ui/inspector-v2/inspectorStrings', () => ({ getStrengthDescription: () => 'moderate', getProvenanceLabel: () => '' }))

// `selected: true` makes `shouldShowEdgeLabel` fire regardless of the
// top-strength ranker, so the chip renders with no extra store wiring.
const POSITIVE_EDGE = {
  id: 'e1',
  source: 'n1',
  target: 'n2',
  sourceX: 0,
  sourceY: 0,
  targetX: 100,
  targetY: 100,
  sourcePosition: Position.Right,
  targetPosition: Position.Left,
  selected: true,
  data: { strength_mean: 0.6, effect_direction: 'positive' as const, exists_probability: 0.8 },
}

const strokeOf = (container: HTMLElement) =>
  (container.querySelector('[data-testid="base-edge"]') as unknown as HTMLElement).style.stroke
const chipOf = (container: HTMLElement) =>
  container.querySelector('[data-testid="edge-influence-label"]') as HTMLElement | null

afterEach(() => {
  cleanup()
  mockIsDark = false
})

describe('StyledEdge — GAP 2: canvas edges render the light palette regardless of OS colour scheme', () => {
  it('paints the LIGHT positive stroke even when the OS reports dark — never the dark tint', () => {
    mockIsDark = true
    const { container } = render(<StyledEdge {...(POSITIVE_EDGE as any)} />)
    expect(strokeOf(container)).toBe('var(--edge-positive)')
    expect(strokeOf(container)).not.toBe('var(--edge-positive-dark)')
  })

  it('CONTRAST: the same edge in light mode paints the identical stroke', () => {
    mockIsDark = false
    const { container: light } = render(<StyledEdge {...(POSITIVE_EDGE as any)} />)
    const lightStroke = strokeOf(light)
    cleanup()
    mockIsDark = true
    const { container: darkOS } = render(<StyledEdge {...(POSITIVE_EDGE as any)} />)
    expect(strokeOf(darkOS)).toBe(lightStroke)
  })

  it('the chip keeps its light classes when the OS reports dark — never bg-gray-900', () => {
    mockIsDark = true
    const { container } = render(<StyledEdge {...(POSITIVE_EDGE as any)} />)
    const chip = chipOf(container)
    expect(chip, 'chip did not render — the fixture stopped exercising this branch').toBeTruthy()
    expect(chip!.className).not.toContain('bg-gray-900')
    expect(chip!.className).not.toContain('text-gray-100')
    expect(chip!.className).not.toContain('border-gray-600')
  })

  it('CONTRAST: the chip class string is byte-identical between dark-OS and light-OS renders', () => {
    mockIsDark = false
    const { container: light } = render(<StyledEdge {...(POSITIVE_EDGE as any)} />)
    const lightClass = chipOf(light)!.className
    cleanup()
    mockIsDark = true
    const { container: darkOS } = render(<StyledEdge {...(POSITIVE_EDGE as any)} />)
    expect(chipOf(darkOS)!.className).toBe(lightClass)
  })
})
