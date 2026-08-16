/**
 * Tests for useScenarioComparison hook — POST-RETIREMENT.
 *
 * WHAT CHANGED, AND WHY THIS FILE WAS REWRITTEN RATHER THAN PATCHED
 * -----------------------------------------------------------------
 * This spec used to assert the opposite of what the hook now does: its first
 * test was literally `calls runV2 instead of ISL compare`, and the response
 * parsing / status handling suites all drove a mocked PLoT `/v2/run`
 * response. That direct browser→PLoT compare call is retired, so those tests
 * were not "failing" — they were pinning a behaviour we deliberately removed.
 * Keeping them mocked-green would have been a guard agreeing with itself.
 *
 * WHAT IS ASSERTED NOW
 * --------------------
 * The honest-unavailable contract, in both directions:
 *   · the compute genuinely does not happen (no network call at all), and
 *   · the surface says so truthfully — `'unavailable'`, NOT `'failed'`, with
 *     no fabricated numbers — while the locally-computed structural diff,
 *     which is still true, survives.
 *
 * MUTATION CHECK (the point of the file): delete the `analysisStatus:
 * 'unavailable'` state in the hook and `reports the honest unavailable
 * status` REDs. Change it to `'failed'` and `does not claim the comparison
 * failed` REDs. The two point in OPPOSITE directions on purpose — a gap
 * (silently showing nothing) and a lie (claiming a failure) are different
 * harms and cannot share one assertion (trap 22b).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { useScenarioComparison, COMPARISON_UNAVAILABLE_REASON } from '../useScenarioComparison'
import { useCanvasStore } from '../../store'
import { useComparisonStore } from '../../stores/comparisonStore'
import type { Node, Edge } from '@xyflow/react'

// Mock generateScenarios - uses new multi-option format (GeneratedScenariosV2)
vi.mock('../../utils/generateScenarios', () => ({
  generateScenarios: vi.fn(() => ({
    scenarios: [
      {
        nodes: [
          { id: 'decision-1', type: 'decision', data: { label: 'Decision' }, position: { x: 0, y: 0 } },
          { id: 'option-a', type: 'option', data: { label: 'Option A' }, position: { x: 0, y: 100 } },
        ],
        edges: [{ id: 'e1', source: 'decision-1', target: 'option-a', data: {} }],
      },
      {
        nodes: [
          { id: 'decision-1', type: 'decision', data: { label: 'Decision' }, position: { x: 0, y: 0 } },
          { id: 'option-b', type: 'option', data: { label: 'Option B' }, position: { x: 0, y: 100 } },
        ],
        edges: [{ id: 'e2', source: 'decision-1', target: 'option-b', data: {} }],
      },
    ],
    labels: ['Option A', 'Option B'],
    optionIds: ['option-a', 'option-b'],
    allOptions: [
      { id: 'option-a', label: 'Option A' },
      { id: 'option-b', label: 'Option B' },
    ],
    hasMoreOptions: false,
  })),
  canGenerateScenarios: vi.fn(() => true),
}))

describe('useScenarioComparison', () => {
  const mockNodes: Node[] = [
    { id: 'decision-1', type: 'decision', data: { label: 'Decision', kind: 'decision' }, position: { x: 0, y: 0 } },
    { id: 'option-a', type: 'option', data: { label: 'Option A', kind: 'option', interventions: {} }, position: { x: 0, y: 100 } },
    { id: 'option-b', type: 'option', data: { label: 'Option B', kind: 'option', interventions: {} }, position: { x: 100, y: 100 } },
    { id: 'goal-1', type: 'goal', data: { label: 'Revenue', kind: 'goal', unit: '%' }, position: { x: 50, y: 200 } },
  ]

  // Use type assertion for test mocks - actual EdgeData shape not needed for these tests
  const mockEdges = [
    { id: 'e1', source: 'decision-1', target: 'option-a', data: { weight: 0.8 } },
    { id: 'e2', source: 'decision-1', target: 'option-b', data: { weight: 0.8 } },
    { id: 'e3', source: 'option-a', target: 'goal-1', data: { weight: 0.5 } },
    { id: 'e4', source: 'option-b', target: 'goal-1', data: { weight: 0.6 } },
  ] as Edge[]

  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()

    // A real spy, not a mocked adapter: the claim is that NOTHING reaches the
    // network, so the probe has to sit at the network boundary itself. A spy
    // on the retired adapter function could only prove that one door is shut.
    fetchSpy = vi.fn(() =>
      Promise.reject(new Error('no network call expected')),
    ) as unknown as ReturnType<typeof vi.fn>
    vi.stubGlobal('fetch', fetchSpy)

    // Set up store with mock data
    // Type assertion needed because store expects Edge<EdgeData>[] but test mocks use simplified shape
    useCanvasStore.setState({
      nodes: mockNodes,
      edges: mockEdges as any,
      outcomeNodeId: 'goal-1',
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    useCanvasStore.setState({
      nodes: [],
      edges: [],
      outcomeNodeId: null,
    })
    // Comparison state lives in useComparisonStore as of C3-3
    useComparisonStore.getState().resetComparison()
  })

  describe('retired compute leg', () => {
    it('reports the honest unavailable status', async () => {
      const { result } = renderHook(() => useScenarioComparison())

      // POSITIVE CONTROL (trap 13): the hook must actually have run. Without
      // this, an early `throw` inside startComparison would leave the state
      // untouched and every assertion below would pass by never executing.
      expect(result.current.analysisStatus).toBe('idle')

      await act(async () => {
        await result.current.startComparison()
      })

      expect(result.current.analysisStatus).toBe('unavailable')
      expect(result.current.loading).toBe(false)
    })

    it('does not claim the comparison failed', async () => {
      const { result } = renderHook(() => useScenarioComparison())

      await act(async () => {
        await result.current.startComparison()
      })

      // The OPPOSITE-DIRECTION twin of the test above. Reusing 'failed' would
      // render "Comparison failed" over a comparison that never ran — a lie,
      // and a different harm from showing nothing at all.
      expect(result.current.analysisStatus).not.toBe('failed')
      expect(result.current.error).toBeNull()
    })

    it('fabricates no numbers', async () => {
      const { result } = renderHook(() => useScenarioComparison())

      await act(async () => {
        await result.current.startComparison()
      })

      // No zero-filled placeholder outcomes standing in for a real analysis.
      expect(result.current.apiResponse).toBeNull()
    })

    it('makes no network call', async () => {
      const { result } = renderHook(() => useScenarioComparison())

      await act(async () => {
        await result.current.startComparison()
      })

      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('still produces the locally-computed structural diff', async () => {
      const { result } = renderHook(() => useScenarioComparison())

      await act(async () => {
        await result.current.startComparison()
      })

      // The honest half: the diff is real, computed locally, and still shown.
      // If this ever goes null the copy becomes untrue, because it tells the
      // user the structural differences below ARE real.
      expect(result.current.comparison).not.toBeNull()
      expect(result.current.snapshotA).not.toBeNull()
      expect(result.current.snapshotB).not.toBeNull()
      expect(useComparisonStore.getState().comparisonMode.active).toBe(true)
    })
  })

  describe('the unavailable state is rendered, not just held', () => {
    // ⚠ SCOPE OF THIS GUARD, STATED HONESTLY: it reads OutputsDock's SOURCE.
    // It proves the notice is wired to the status and to the exported reason
    // by identity — it does NOT prove visibility, which jsdom cannot show
    // anyway (trap 3). A DOM/browser witness is the technical lead's step.
    const dockSource = readFileSync(
      resolve(__dirname, '../../components/OutputsDock.tsx'),
      'utf8',
    )

    it('binds the notice to the unavailable status', () => {
      expect(dockSource).toContain("scenarioComparison.analysisStatus === 'unavailable'")
      expect(dockSource).toContain('data-testid="scenario-comparison-unavailable"')
    })

    it('renders the exported reason rather than a drifting copy', () => {
      // Identity binding (trap 19): the surface must render THIS constant, so
      // the copy cannot silently diverge from the one the hook documents.
      expect(dockSource).toContain('{COMPARISON_UNAVAILABLE_REASON}')
      expect(COMPARISON_UNAVAILABLE_REASON).toMatch(/unavailable/i)
      // It must not promise a return date it cannot keep.
      expect(COMPARISON_UNAVAILABLE_REASON).not.toMatch(/soon|shortly|coming/i)
    })
  })

  describe('edge diff identity', () => {
    it('uses edge.id for identity, not source->target', () => {
      // This is tested via the computeComparison function
      // Two edges with same endpoints but different IDs should be identified as different
      const { result } = renderHook(() => useScenarioComparison())

      // The hook should be able to compare scenarios
      expect(result.current.canCompare).toBe(true)
    })
  })

  describe('clearComparison', () => {
    it('resets state and exits comparison mode', async () => {
      const { result } = renderHook(() => useScenarioComparison())

      await act(async () => {
        await result.current.startComparison()
      })

      expect(result.current.analysisStatus).toBe('unavailable')

      act(() => {
        result.current.clearComparison()
      })

      expect(result.current.analysisStatus).toBe('idle')
      expect(result.current.apiResponse).toBeNull()
      expect(result.current.snapshotA).toBeNull()
      expect(result.current.snapshotB).toBeNull()
    })
  })
})
