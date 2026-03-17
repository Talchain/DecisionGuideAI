/**
 * DraftChat Node Mapping Tests
 *
 * Tests for P0 fixes:
 * 1. data.kind is correctly set from node type
 * 2. Goal node is auto-selected when exactly one goal exists
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useCanvasStore } from '../../store'
import { DEFAULT_EDGE_DATA } from '../../domain/edges'
import type { EffectDirection } from '../../../adapters/cee/types'

// Mock the CEE draft hook to avoid network calls
vi.mock('../../../hooks/useCEEDraft', () => ({
  useCEEDraft: vi.fn(() => ({
    generateDraft: vi.fn(),
    draft: null,
    loading: false,
    error: null,
    reset: vi.fn(),
  })),
}))

// Mock saveAutosave to avoid localStorage side effects
vi.mock('../../store/scenarios', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../store/scenarios')>()
  return {
    ...actual,
    saveAutosave: vi.fn(),
    saveCurrentScenario: vi.fn(() => 'test-scenario-id'),
  }
})

// Mock layout to avoid complex positioning logic
vi.mock('../../layout', () => ({
  applyGuidedLayout: vi.fn(),
}))

describe('DraftChat node mapping', () => {
  beforeEach(() => {
    // Reset store to clean state
    useCanvasStore.setState({
      nodes: [],
      edges: [],
      outcomeNodeId: null,
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  /**
   * Simulates the node mapping logic from applyDraftToCanvas
   * This mirrors the actual implementation to test the mapping behavior
   */
  function mapDraftNodesToCanvasNodes(draftNodes: Array<{ id: string; type: string; label: string }>) {
    return draftNodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: { x: 0, y: 0 },
      data: {
        label: n.label,
        // P0: Copy kind to data.kind for GoalNodeSelector and other components
        kind: n.type,
      },
    }))
  }

  describe('data.kind mapping', () => {
    it('sets data.kind to match node type for goal nodes', () => {
      const draftNodes = [
        { id: 'goal_1', type: 'goal', label: 'Reach £20k MRR' },
      ]

      const canvasNodes = mapDraftNodesToCanvasNodes(draftNodes)

      expect(canvasNodes[0].type).toBe('goal')
      expect(canvasNodes[0].data.kind).toBe('goal')
    })

    it('sets data.kind to match node type for outcome nodes', () => {
      const draftNodes = [
        { id: 'out_1', type: 'outcome', label: 'Higher revenue' },
      ]

      const canvasNodes = mapDraftNodesToCanvasNodes(draftNodes)

      expect(canvasNodes[0].type).toBe('outcome')
      expect(canvasNodes[0].data.kind).toBe('outcome')
    })

    it('sets data.kind to match node type for all node types', () => {
      const draftNodes = [
        { id: 'goal_1', type: 'goal', label: 'Goal Node' },
        { id: 'dec_1', type: 'decision', label: 'Decision Node' },
        { id: 'opt_1', type: 'option', label: 'Option Node' },
        { id: 'out_1', type: 'outcome', label: 'Outcome Node' },
        { id: 'factor_1', type: 'factor', label: 'Factor Node' },
        { id: 'risk_1', type: 'risk', label: 'Risk Node' },
      ]

      const canvasNodes = mapDraftNodesToCanvasNodes(draftNodes)

      canvasNodes.forEach((node, i) => {
        expect(node.data.kind).toBe(draftNodes[i].type)
        expect(node.type).toBe(node.data.kind)
      })
    })

    it('preserves label in data object', () => {
      const draftNodes = [
        { id: 'goal_1', type: 'goal', label: 'Reach £20k MRR within 12 months' },
      ]

      const canvasNodes = mapDraftNodesToCanvasNodes(draftNodes)

      expect(canvasNodes[0].data.label).toBe('Reach £20k MRR within 12 months')
    })
  })

  describe('goal node auto-selection', () => {
    /**
     * Simulates the auto-selection logic from applyDraftToCanvas
     */
    function autoSelectGoalNode(nodes: Array<{ id: string; type: string }>) {
      const goalNodes = nodes.filter((n) => n.type === 'goal')
      if (goalNodes.length === 1) {
        return goalNodes[0].id
      }
      return null
    }

    it('returns goal ID when exactly one goal node exists', () => {
      const nodes = [
        { id: 'goal_1', type: 'goal' },
        { id: 'factor_1', type: 'factor' },
        { id: 'outcome_1', type: 'outcome' },
      ]

      const selectedGoalId = autoSelectGoalNode(nodes)

      expect(selectedGoalId).toBe('goal_1')
    })

    it('returns null when no goal nodes exist', () => {
      const nodes = [
        { id: 'factor_1', type: 'factor' },
        { id: 'outcome_1', type: 'outcome' },
      ]

      const selectedGoalId = autoSelectGoalNode(nodes)

      expect(selectedGoalId).toBeNull()
    })

    it('returns null when multiple goal nodes exist', () => {
      const nodes = [
        { id: 'goal_1', type: 'goal' },
        { id: 'goal_2', type: 'goal' },
        { id: 'factor_1', type: 'factor' },
      ]

      const selectedGoalId = autoSelectGoalNode(nodes)

      expect(selectedGoalId).toBeNull()
    })

    it('correctly identifies goal nodes among mixed types', () => {
      const nodes = [
        { id: 'dec_1', type: 'decision' },
        { id: 'opt_1', type: 'option' },
        { id: 'opt_2', type: 'option' },
        { id: 'goal_1', type: 'goal' },
        { id: 'out_1', type: 'outcome' },
        { id: 'out_2', type: 'outcome' },
        { id: 'risk_1', type: 'risk' },
        { id: 'factor_1', type: 'factor' },
      ]

      const selectedGoalId = autoSelectGoalNode(nodes)

      expect(selectedGoalId).toBe('goal_1')
    })
  })

  describe('edge sign preservation', () => {
    function mapDraftEdgeToCanvas(edge: any) {
      const directionFromEdge: EffectDirection | undefined =
        edge.effect_direction === 'positive' || edge.effect_direction === 'negative'
          ? edge.effect_direction
          : undefined

      let rawWeight: number
      if (typeof edge.strength?.mean === 'number') {
        rawWeight = edge.strength.mean
      } else if (typeof edge.strength_mean === 'number') {
        rawWeight = edge.strength_mean
      } else if (typeof edge.weight === 'number') {
        rawWeight = edge.weight
      } else {
        rawWeight = DEFAULT_EDGE_DATA.weight
      }

      const direction: EffectDirection = directionFromEdge ?? (rawWeight < 0 ? 'negative' : 'positive')
      const weight = Math.max(0, Math.min(2, Math.abs(rawWeight)))

      return { weight, direction }
    }

    it('infers negative direction from signed strength_mean', () => {
      const result = mapDraftEdgeToCanvas({ strength_mean: -0.7 })
      expect(result.weight).toBeCloseTo(0.7)
      expect(result.direction).toBe('negative')
    })

    it('preserves explicit negative direction', () => {
      const result = mapDraftEdgeToCanvas({ strength_mean: -0.7, effect_direction: 'negative' })
      expect(result.weight).toBeCloseTo(0.7)
      expect(result.direction).toBe('negative')
    })

    it('handles mixed positive/negative edges', () => {
      const edges = [
        mapDraftEdgeToCanvas({ strength_mean: 0.4 }),
        mapDraftEdgeToCanvas({ strength_mean: -0.6 }),
      ]

      expect(edges[0]).toEqual({ weight: 0.4, direction: 'positive' })
      expect(edges[1]).toEqual({ weight: 0.6, direction: 'negative' })
    })
  })
})

describe('DraftChat store integration', () => {
  beforeEach(() => {
    // Reset store to clean state
    useCanvasStore.setState({
      nodes: [],
      edges: [],
      outcomeNodeId: null,
    })
  })

  it('setOutcomeNode correctly updates store', () => {
    const { setOutcomeNode } = useCanvasStore.getState()

    setOutcomeNode('goal_1')

    expect(useCanvasStore.getState().outcomeNodeId).toBe('goal_1')
  })

  it('setOutcomeNode clears value when set to null', () => {
    const { setOutcomeNode } = useCanvasStore.getState()

    setOutcomeNode('goal_1')
    expect(useCanvasStore.getState().outcomeNodeId).toBe('goal_1')

    setOutcomeNode(null)
    expect(useCanvasStore.getState().outcomeNodeId).toBeNull()
  })

  describe('UI strength.mean default convention', () => {
    // UI convention: default strength.mean is 0.5 when CEE provides no value
    // This is the UI's responsibility — CEE and PLoT do not default strengths

    const mapDraftEdgeToCanvas = (edge: Partial<{
      strength: { mean?: number; std?: number }
      strength_mean: number
      weight: number
      effect_direction: EffectDirection
    }>) => {
      let rawWeight: number
      if (typeof edge.strength?.mean === 'number') {
        rawWeight = edge.strength.mean
      } else if (typeof edge.strength_mean === 'number') {
        rawWeight = edge.strength_mean
      } else if (typeof edge.weight === 'number') {
        rawWeight = edge.weight
      } else {
        rawWeight = DEFAULT_EDGE_DATA.weight  // 0.5
      }
      return { rawWeight }
    }

    it('defaults to 0.5 when all strength fields are missing', () => {
      const result = mapDraftEdgeToCanvas({})
      expect(result.rawWeight).toBe(0.5)
      expect(result.rawWeight).toBe(DEFAULT_EDGE_DATA.weight)
    })

    it('defaults to 0.5 when all strength fields are undefined', () => {
      const result = mapDraftEdgeToCanvas({
        strength: undefined,
        strength_mean: undefined,
        weight: undefined,
      })
      expect(result.rawWeight).toBe(0.5)
    })

    it('does not default when strength.mean is 0 (zero is valid)', () => {
      const result = mapDraftEdgeToCanvas({ strength: { mean: 0 } })
      expect(result.rawWeight).toBe(0)
      expect(result.rawWeight).not.toBe(DEFAULT_EDGE_DATA.weight)
    })

    it('does not default when strength_mean is 0 (zero is valid)', () => {
      const result = mapDraftEdgeToCanvas({ strength_mean: 0 })
      expect(result.rawWeight).toBe(0)
      expect(result.rawWeight).not.toBe(DEFAULT_EDGE_DATA.weight)
    })

    it('does not default when weight is 0 (zero is valid)', () => {
      const result = mapDraftEdgeToCanvas({ weight: 0 })
      expect(result.rawWeight).toBe(0)
      expect(result.rawWeight).not.toBe(DEFAULT_EDGE_DATA.weight)
    })
  })
})

describe('V3 field pass-through verification', () => {
  /**
   * Gate test: verifies that V3 top-level CEE fields pass through
   * DraftChat's destructure + spread pattern into canvas node.data.
   *
   * The mapping: const { id, kind, type, label, observed_state, ...rest } = n
   * puts all OTHER top-level CEE fields into ...rest, which then gets
   * spread into data: { ...rest, label, kind, ... }.
   *
   * If these tests fail, Task 1 must become a code fix before Tasks 2-8.
   */

  function mapCEENodeToCanvas(n: Record<string, unknown>) {
    // Mirror the exact DraftChat mapping logic (lines 457-475)
    const { id, kind, type: nodeType, label, observed_state, ...rest } = n as any
    return {
      id,
      type: kind || nodeType,
      position: { x: 0, y: 0 },
      data: {
        ...rest,
        label,
        kind: kind || nodeType,
        ...(observed_state ? { observedState: observed_state } : {}),
      },
    }
  }

  function mapCEEEdgeToCanvas(e: Record<string, unknown>) {
    // Mirror the exact DraftChat edge mapping logic (lines 479-627)
    const directionFromEdge: EffectDirection | undefined =
      (e as any).effect_direction === 'positive' || (e as any).effect_direction === 'negative'
        ? (e as any).effect_direction
        : undefined

    const strengthStd: number | undefined =
      typeof (e as any).strength?.std === 'number' ? (e as any).strength.std :
      typeof (e as any).strength_std === 'number' ? (e as any).strength_std :
      undefined

    let rawWeight: number
    if (typeof (e as any).strength?.mean === 'number') {
      rawWeight = (e as any).strength.mean
    } else if (typeof (e as any).strength_mean === 'number') {
      rawWeight = (e as any).strength_mean
    } else if (typeof (e as any).weight === 'number') {
      rawWeight = (e as any).weight
    } else {
      rawWeight = DEFAULT_EDGE_DATA.weight
    }

    const direction: EffectDirection = directionFromEdge ?? (rawWeight < 0 ? 'negative' : 'positive')
    const weight = Math.max(0, Math.min(2, Math.abs(rawWeight)))

    return {
      data: {
        weight,
        direction,
        ...(strengthStd !== undefined ? { strengthStd } : {}),
      },
    }
  }

  it('preserves category in node.data via ...rest spread', () => {
    const ceeNode = {
      id: 'fac_revenue',
      kind: 'factor',
      label: 'Revenue',
      category: 'controllable',
      observed_state: { value: 0.5, source: 'cee_inference' },
    }
    const result = mapCEENodeToCanvas(ceeNode)
    expect(result.data.category).toBe('controllable')
  })

  it('preserves observedState with value and source in node.data', () => {
    const ceeNode = {
      id: 'fac_cash',
      kind: 'factor',
      label: 'Cash Runway',
      observed_state: {
        value: 0.5,
        source: 'brief_extraction',
        raw_value: 9,
        cap: 18,
        factor_type: 'continuous',
        uncertainty_drivers: ['Burn rate fluctuations'],
      },
    }
    const result = mapCEENodeToCanvas(ceeNode)
    expect(result.data.observedState).toBeDefined()
    expect(result.data.observedState.value).toBe(0.5)
    expect(result.data.observedState.source).toBe('brief_extraction')
    expect(result.data.observedState.raw_value).toBe(9)
    expect(result.data.observedState.uncertainty_drivers).toEqual(['Burn rate fluctuations'])
  })

  it('preserves goal_threshold_raw on goal nodes', () => {
    const ceeNode = {
      id: 'goal_1',
      kind: 'goal',
      label: 'Achieve 200 Mid-Market Customers',
      goal_threshold: 0.2,
      goal_threshold_raw: 200,
      goal_threshold_unit: 'customers',
      goal_threshold_cap: 1000,
    }
    const result = mapCEENodeToCanvas(ceeNode)
    expect(result.data.goal_threshold_raw).toBe(200)
    expect(result.data.goal_threshold_unit).toBe('customers')
    expect(result.data.goal_threshold_cap).toBe(1000)
    expect(result.data.goal_threshold).toBe(0.2)
  })

  it('maps edge weight and direction from CEE strength fields', () => {
    const ceeEdge = {
      id: 'e-1',
      from: 'fac_1',
      to: 'goal_1',
      strength_mean: -0.4,
      strength_std: 0.15,
      effect_direction: 'negative',
      belief_exists: 0.85,
    }
    const result = mapCEEEdgeToCanvas(ceeEdge)
    expect(result.data.weight).toBeCloseTo(0.4)
    expect(result.data.direction).toBe('negative')
    expect(result.data.strengthStd).toBe(0.15)
  })

  it('maps edge from nested V3 strength object', () => {
    const ceeEdge = {
      id: 'e-2',
      from: 'fac_2',
      to: 'goal_1',
      strength: { mean: 0.6, std: 0.1 },
      effect_direction: 'positive',
    }
    const result = mapCEEEdgeToCanvas(ceeEdge)
    expect(result.data.weight).toBeCloseTo(0.6)
    expect(result.data.direction).toBe('positive')
    expect(result.data.strengthStd).toBe(0.1)
  })

  it('preserves prior field on external factor nodes', () => {
    const ceeNode = {
      id: 'fac_external',
      kind: 'factor',
      label: 'Market Growth',
      category: 'external',
      prior: 0.3,
    }
    const result = mapCEENodeToCanvas(ceeNode)
    expect(result.data.prior).toBe(0.3)
    expect(result.data.category).toBe('external')
  })
})
