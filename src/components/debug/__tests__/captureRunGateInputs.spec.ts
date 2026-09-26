/**
 * The bundle records which carrier closed the Run gate (Panel's hand-off, #69
 * 5840542820; manual test 1a298d6d). Over a SERVED refusal: the OpenAI turn
 * after an agent-added option (CEE 85ce874), where the legacy side-car and the
 * bound admission disagree.
 */
import { describe, it, expect, beforeEach } from 'vitest'

import SERVED from '../../../canvas/utils/__tests__/fixtures/openai-85ce874-added-option-refusal.turn.json'
import { useCanvasStore } from '../../../canvas/store'
import { useReadinessStore } from '../../../canvas/stores/readinessStore'
import { captureRunGateInputs } from '../utils/captureRunGateInputs'

/** The legacy side-car saying the model CAN run: the contradiction the bundle could not show. */
const SIDE_CAR_SAYS_RUN = {
  readiness_score: 80,
  readiness_level: 'ready',
  can_run_analysis: true,
  confidence_explanation: 'Ready.',
  improvements: [],
} as never

beforeEach(() => {
  useCanvasStore.setState({
    ceeAnalysisReady: SERVED.analysis_ready,
    lastServerGraphHash: SERVED.graph_hash,
    analysisFreshnessDirty: false,
    analysisStateV1: null,
  } as never)
  useReadinessStore.setState({ readiness: SIDE_CAR_SAYS_RUN, stale: false } as never)
})

describe('captureRunGateInputs — the bundle names the carrier that closed the gate', () => {
  it('⭐ SERVED: the bound admission refused while the side-car said "can run", and the bundle says which decided', () => {
    const g = captureRunGateInputs()!
    expect(g.decided_by).toBe('bound_admission')
    expect(g.readiness_objects_to_run).toBe(true)
    expect(g.bound_admission?.may_run).toBe(false)
    expect(g.bound_admission?.wording.requiredInputs).toEqual([
      'An option is not connected from the decision. Link the decision to it.',
    ])
    expect(g.legacy_graph_readiness).toEqual({ can_run_analysis: true, readiness_level: 'ready', blocker_reason: null, stale: false })
    expect(g.cee_analysis_ready).toEqual({ status: 'blocked', may_run: false, current_graph_hash: SERVED.graph_hash })
    expect(g.last_server_graph_hash).toBe(SERVED.graph_hash)
  })

  it('CONTRAST: the same verdict for ANOTHER revision is unbound, so the side-car decides and the gate opens', () => {
    useCanvasStore.setState({ lastServerGraphHash: '0000000000000000' } as never)
    const g = captureRunGateInputs()!
    expect(g.bound_admission).toBeNull()
    expect(g.decided_by).toBe('legacy_side_car')
    expect(g.readiness_objects_to_run).toBe(false)
    // the raw carrier is still recorded, so a reader sees the unbound refusal too
    expect(g.cee_analysis_ready?.may_run).toBe(false)
  })

  it('CONTRAST: a local edit since the verdict unbinds it as well', () => {
    useCanvasStore.setState({ analysisFreshnessDirty: true } as never)
    const g = captureRunGateInputs()!
    expect(g.bound_admission).toBeNull()
    expect(g.analysis_freshness_dirty).toBe(true)
  })

  it('no carrier at all: decided by none, and nothing objects', () => {
    useCanvasStore.setState({ ceeAnalysisReady: null } as never)
    useReadinessStore.setState({ readiness: null } as never)
    const g = captureRunGateInputs()!
    expect(g.decided_by).toBe('none')
    expect(g.readiness_objects_to_run).toBe(false)
  })
})
