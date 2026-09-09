/**
 * ⭐⭐ THE MOUNT HOST THREADS THE TWO FENCES THE PANEL CANNOT READ FOR ITSELF.
 *
 * `model-tab-v2`'s lane boundary (`modelTabV2Boundary.sourceScan`) bans a store
 * import and any foreign hook call inside that directory: the mount host owns
 * every live-app seam. So `currentScenarioId` and `lastServerGraphHash` — the
 * scenario fence on a pending effect edit, and the signal that the one
 * recoverable refusal has actually been recovered — reach the panel ONLY as
 * props, exactly as `nodes` and `edges` do.
 *
 * ⚠ WHICH MAKES THIS THE FILE THAT CATCHES THIS LANE'S RECURRING DEFECT: a
 * member added in SOME of its declaration sites and not all. Both props are
 * OPTIONAL, deliberately — nine existing specs render the panel without them and
 * their absence degrades safely, claiming nothing untrue. The cost of optional is
 * that dropping the wiring here is invisible: the panel keeps compiling, the
 * suite keeps passing, and the fences silently stop fencing. This asserts the
 * threading itself.
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import type { Node, Edge } from '@xyflow/react'
import { ModelTabBody } from '../ModelTabBody'

const SCENARIO = 'scn_threaded'
const HASH = '9f2c1b0ae4d37c5a'

function getMockState() {
  return {
    updateNode: vi.fn(),
    updateEdge: vi.fn(),
    ceePipelineTrace: null,
    highlightedNodes: new Set<string>(),
    highlightedEdges: new Set<string>(),
    setHighlightedNodes: vi.fn(),
    setHighlightedEdges: vi.fn(),
    currentScenarioId: SCENARIO,
    lastServerGraphHash: HASH,
    currentStage: null,
    graphEditedSinceLastRun: false,
    rawV2Response: null,
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

// The panel is replaced by a prop recorder: this spec is about what the HOST
// hands down, not about anything the panel renders.
const panelSpy = vi.fn()
vi.mock('../../model-tab-v2/ModelTabV2Panel', () => ({
  ModelTabV2Panel: (props: Record<string, unknown>) => {
    panelSpy(props)
    return null
  },
}))

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

function renderHost() {
  panelSpy.mockClear()
  render(
    <ModelTabBody
      {...DEFAULT_PROPS}
      nodes={[
        { id: 'g1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Pick a vendor' } },
      ] as Node[]}
      edges={[] as Edge[]}
    />,
  )
  expect(panelSpy).toHaveBeenCalled()
  return panelSpy.mock.calls[panelSpy.mock.calls.length - 1]?.[0] as Record<string, unknown>
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ModelTabBody → ModelTabV2Panel: the effect-edit fences', () => {
  it('threads the current scenario id', () => {
    expect(renderHost().currentScenarioId).toBe(SCENARIO)
  })

  it('threads the last server graph hash', () => {
    expect(renderHost().lastServerGraphHash).toBe(HASH)
  })

  it('⚠ passes them as DECLARED KEYS, not as undefined that happens to compare equal', () => {
    // `expect(props.x).toBe(undefined)` passes when the prop was never written
    // at all, which is exactly the wiring loss this file exists to catch. Assert
    // presence, then value.
    const props = renderHost()
    expect(Object.keys(props)).toEqual(
      expect.arrayContaining(['currentScenarioId', 'lastServerGraphHash']),
    )
  })

  it('POSITIVE CONTROL: the recorder sees the props that were already threaded', () => {
    // Without this, all three assertions above would pass against a recorder
    // that captured nothing and a panel that was never rendered.
    const props = renderHost()
    expect(props.nodes).toBeDefined()
    expect(Object.keys(props)).toEqual(expect.arrayContaining(['nodes', 'edges', 'goalThreshold']))
  })
})
