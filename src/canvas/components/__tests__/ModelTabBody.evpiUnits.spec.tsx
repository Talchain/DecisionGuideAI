/**
 * ModelTabBody EVPI map — UNIT-CONFLATION regression (P1-9).
 *
 * The selector used to fall back to `value_of_information * 100` when
 * `evpi_percentage_points` was absent. Those are different scales:
 * `value_of_information` is a 0–1 VoI score, `evpi_percentage_points` is a
 * shift in outcome probability. In the golden staging capture
 * `fac_acquisition` carries `value_of_information: 0.175` next to a true
 * `evpi_percentage_points: 2.1`, so the fallback rendered
 *
 *     "Worth 18pp if resolved … would improve confidence by 18 percentage points"
 *
 * — an 8.5x overstatement, stated as a precise claim, on a factor card.
 *
 * These specs pin the honest behaviour BOTH ways: the real field is still
 * read, and the fabricated fallback is gone. Re-introducing the fallback
 * turns the "does not manufacture" cases RED; deleting the read turns the
 * "still reads" case RED.
 *
 * Harness mirrors ModelTabBody.autoNoiseFallback.spec.tsx — spy on
 * FactorsSection and capture the `evpiMap` prop, isolating the selector from
 * accordion/rendering behaviour.
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import type { Node, Edge } from '@xyflow/react'
import { ModelTabBody } from '../ModelTabBody'

const mockUpdateNode = vi.fn()
const mockUpdateEdge = vi.fn()
const mockSetHighlightedNodes = vi.fn()
const mockSetHighlightedEdges = vi.fn()

let mockRawV2Response: unknown = null

function getMockState() {
  return {
    updateNode: mockUpdateNode,
    updateEdge: mockUpdateEdge,
    ceePipelineTrace: null,
    highlightedNodes: new Set<string>(),
    highlightedEdges: new Set<string>(),
    setHighlightedNodes: mockSetHighlightedNodes,
    setHighlightedEdges: mockSetHighlightedEdges,
    currentScenarioId: null,
    currentStage: null,
    graphEditedSinceLastRun: false,
    rawV2Response: mockRawV2Response,
  }
}

vi.mock('../../store', () => ({
  useCanvasStore: Object.assign(
    vi.fn((selector: (s: any) => any) => selector(getMockState())),
    { getState: getMockState },
  ),
}))

vi.mock('../GraphTextView', () => ({
  SectionErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

const factorsSpy = vi.fn()
vi.mock('../model-tab/FactorsSection', () => ({
  FactorsSection: (props: { evpiMap: Map<string, number> }) => {
    factorsSpy(props.evpiMap)
    return null
  },
}))

function makeGoalNode(): Node {
  return { id: 'g1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Pick the right vendor' } }
}

function makeFactorNode(): Node {
  return {
    id: 'fac_acquisition',
    type: 'factor',
    position: { x: 0, y: 0 },
    data: { label: 'Competitor Acquisition', category: 'observable', observedState: { value: 0.5 } },
  }
}

const DEFAULT_PROPS = {
  showDebug: false,
  hasDiagnostics: false,
  diagnostics: null,
  hasTrim: false,
  effectiveCorrelationId: null,
  correlationMismatch: false,
  correlationIdHeader: null,
  robustness: null,
}

function renderAndCaptureEvpiMap(): Map<string, number> {
  factorsSpy.mockClear()
  render(
    <ModelTabBody
      {...DEFAULT_PROPS}
      nodes={[makeGoalNode(), makeFactorNode()] as Node[]}
      edges={[] as Edge[]}
    />,
  )
  expect(factorsSpy).toHaveBeenCalled()
  return factorsSpy.mock.calls[0][0] as Map<string, number>
}

beforeEach(() => {
  vi.clearAllMocks()
  mockRawV2Response = null
})

describe('ModelTabBody evpiMap — percentage points only', () => {
  it('reads evpi_percentage_points when the producer sends it', () => {
    // Positive control: the map CAN be populated. Without this, the
    // "stays empty" assertions below would pass against a broken selector
    // that never populated anything.
    mockRawV2Response = {
      factor_sensitivity: [
        { factor_id: 'fac_acquisition', evpi_percentage_points: 2.1, value_of_information: 0.175 },
      ],
    }
    expect(renderAndCaptureEvpiMap().get('fac_acquisition')).toBe(2.1)
  })

  it('does NOT manufacture percentage points from value_of_information', () => {
    // ⛔ The regression. The exact real-capture pair: VoI 0.175 with no
    // evpi_percentage_points. The old fallback produced 18. There is no
    // honest pp figure here, so the map must carry none.
    mockRawV2Response = {
      factor_sensitivity: [{ factor_id: 'fac_acquisition', value_of_information: 0.175 }],
    }
    const map = renderAndCaptureEvpiMap()
    expect(map.has('fac_acquisition')).toBe(false)
    expect(map.get('fac_acquisition')).toBeUndefined()
    // Named explicitly so the failure message points at the defect, not just
    // at a count: 18 is what the conflation produced.
    expect([...map.values()]).not.toContain(18)
  })

  it('does not manufacture a pp figure from any other VoI magnitude either', () => {
    mockRawV2Response = {
      factor_sensitivity: [
        { factor_id: 'fac_acquisition', value_of_information: 0.9 },
        { factor_id: 'f_other', value_of_information: 0.02 },
      ],
    }
    expect(renderAndCaptureEvpiMap().size).toBe(0)
  })

  it('prefers the real field even when value_of_information would give a bigger number', () => {
    mockRawV2Response = {
      factor_sensitivity: [
        { factor_id: 'fac_acquisition', evpi_percentage_points: 0, value_of_information: 0.85 },
      ],
    }
    // Exact 0 is a real producer value and must survive — not be replaced by
    // the far larger fabricated 85.
    expect(renderAndCaptureEvpiMap().get('fac_acquisition')).toBe(0)
  })

  it('ignores a non-finite evpi_percentage_points rather than coercing it', () => {
    mockRawV2Response = {
      factor_sensitivity: [{ factor_id: 'fac_acquisition', evpi_percentage_points: NaN }],
    }
    expect(renderAndCaptureEvpiMap().has('fac_acquisition')).toBe(false)
  })
})
