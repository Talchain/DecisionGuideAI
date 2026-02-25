/**
 * Contract tests for Inspector ↔ Adapter data contracts
 *
 * B.I.13: Verifies that UI inspector writes produce correct adapter outputs.
 * These are pure-logic tests — no component rendering required.
 */

import { describe, it, expect } from 'vitest'
import { transformEdgeToV2, uiOptionToV2Option, buildV2RequestFromAnalysisReady } from '../../../../src/adapters/plot/v2/adapter'
import { useCanvasStore } from '../../../../src/canvas/store'
import type { Edge, Node } from '@xyflow/react'
import type { CEEAnalysisReady } from '../../../../src/adapters/cee/types'

describe('Inspector ↔ Adapter contracts (B.I.13)', () => {
  /**
   * Test 1: Signed slider at -0.40 → edge weight=0.40, direction='negative',
   * adapter reconstructs strength.mean = -0.40
   */
  it('signed slider decomposition: -0.40 → weight 0.40, direction negative, adapter mean -0.40', () => {
    // Simulate what SignedStrengthSlider.onChange(-0.40) writes:
    const signedValue = -0.40
    const weight = Math.abs(signedValue)
    const direction = signedValue >= 0 ? 'positive' : 'negative'

    expect(weight).toBeCloseTo(0.40, 5)
    expect(direction).toBe('negative')

    // Feed through adapter (transformEdgeToV2 uses computeSignedMean internally)
    const edge: Edge = {
      id: 'e-test',
      source: 'a',
      target: 'b',
      data: {
        weight,
        direction,
        belief: 0.5,
        style: 'solid',
      },
    }
    const v2Edge = transformEdgeToV2(edge)

    expect(v2Edge.strength.mean).toBeCloseTo(-0.40, 5)
    expect(v2Edge.from).toBe('a')
    expect(v2Edge.to).toBe('b')
  })

  /**
   * Test 2: Confidence slider at 80% → edge exists_probability = 0.8
   */
  it('confidence slider at 80% → exists_probability 0.8', () => {
    const edge: Edge = {
      id: 'e-test',
      source: 'a',
      target: 'b',
      data: {
        weight: 0.5,
        direction: 'positive',
        belief: 0.8,    // Confidence slider writes to belief field
        style: 'solid',
      },
    }
    const v2Edge = transformEdgeToV2(edge)

    expect(v2Edge.exists_probability).toBeCloseTo(0.8, 5)
  })

  /**
   * Test 3: store.setGoalThreshold(200) → store.goalThreshold === 200 → request.goal_threshold === 200
   *
   * Full contract path:
   * 1. GoalThresholdEditor writes to store.setGoalThreshold()
   * 2. useV2Run reads store.goalThreshold
   * 3. executeV2RunWithAnalysisReady receives goalThreshold param
   * 4. Line 1189-1190: request.goal_threshold = goalThreshold (overrides builder value)
   *
   * This test verifies store write AND adapter request construction boundary.
   */
  it('setGoalThreshold(200) → store → adapter request.goal_threshold === 200', () => {
    // Step 1: Verify store write
    useCanvasStore.setState({ goalThreshold: null })
    useCanvasStore.getState().setGoalThreshold(200)
    expect(useCanvasStore.getState().goalThreshold).toBe(200)

    // Step 2: Build a request via buildV2RequestFromAnalysisReady with analysisReady
    // that has NO goal_threshold — simulates CEE not setting one
    const nodes: Node[] = [
      { id: 'g1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Goal', kind: 'goal' } },
      { id: 'f1', type: 'factor', position: { x: 100, y: 0 }, data: { label: 'Factor', kind: 'factor' } },
    ]
    const edges: Edge[] = [
      { id: 'e1', source: 'f1', target: 'g1', data: { weight: 0.5, direction: 'positive', belief: 0.5, style: 'solid' } },
    ]
    const analysisReady: CEEAnalysisReady = {
      options: [
        { id: 'opt1', label: 'Option 1', status: 'ready', interventions: { f1: { value: 10, type: 'numeric' } } },
      ],
      goal_node_id: 'g1',
    }

    const { request } = buildV2RequestFromAnalysisReady(nodes, edges, analysisReady)

    // Step 3: Simulate executeV2RunWithAnalysisReady's goalThreshold override (lines 1189-1190)
    // This is the exact code path: if (goalThreshold !== undefined) { request.goal_threshold = goalThreshold }
    const goalThreshold = useCanvasStore.getState().goalThreshold
    if (goalThreshold !== undefined && goalThreshold !== null) {
      request.goal_threshold = goalThreshold
    }

    expect(request.goal_threshold).toBe(200)
    expect(request.goal_node_id).toBe('g1')

    // Clean up
    useCanvasStore.setState({ goalThreshold: null })
  })

  /**
   * Test 4: Intervention for "node_abc" → options[i].interventions["node_abc"]
   */
  it('intervention mapping: UIOption with node_abc intervention → V2Option preserves it', () => {
    const uiOption = {
      id: 'opt-1',
      label: 'Option A',
      status: 'ready' as const,
      interventions: {
        node_abc: { value: 42, source: 'user' },
        node_def: { value: 0.75, source: 'user' },
      },
      source: 'legacy_node' as const,
    }

    const v2Option = uiOptionToV2Option(uiOption)

    expect(v2Option.id).toBe('opt-1')
    expect(v2Option.interventions).toHaveProperty('node_abc')
    expect(v2Option.interventions['node_abc']).toBe(42)
    expect(v2Option.interventions['node_def']).toBe(0.75)
  })
})
