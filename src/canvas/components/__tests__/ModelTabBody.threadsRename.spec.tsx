/**
 * ⭐⭐ THE MOUNT — without this the rename ships DARK.
 *
 * `onRenameRow` is optional at every hop (sixteen specs render the panel
 * standalone), and the row's `renameAvailable` reads `typeof onRenameRow ===
 * 'function'`. So dropping the wiring here does not break a build or RED a
 * suite: it silently removes the affordance, and the Model tab goes back to
 * having no rename at all while every behavioural spec in `model-tab-v2` stays
 * green — because they all pass the prop themselves.
 *
 * ⚠⚠ AND IT MUST BE `updateNodeLabel`, NOT ANY WRITER THAT SETS A LABEL. That
 * store action is the rename CHOKEPOINT (`store.ts:3035`): it calls
 * `recordStructuralRenameIntent` BEFORE the local mutation, so `expected_label`
 * asserts the label the user was looking at rather than the one just written;
 * it pushes history; and it supersedes a goal's `from_brief` provenance stamp.
 * A well-meaning substitution of `updateNode({ data: { label } })` would render
 * identically, pass any test that only checks the label changed, and silently
 * drop the concurrency assertion, the undo entry and the provenance retirement.
 * So this asserts the IDENTITY of the function threaded, not its shape.
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import type { Node, Edge } from '@xyflow/react'

const updateNodeLabel = vi.fn()
const updateNode = vi.fn()

function getMockState() {
  return {
    updateNode,
    updateNodeLabel,
    updateEdge: vi.fn(),
    ceePipelineTrace: null,
    highlightedNodes: new Set<string>(),
    highlightedEdges: new Set<string>(),
    setHighlightedNodes: vi.fn(),
    setHighlightedEdges: vi.fn(),
    currentScenarioId: null,
    lastServerGraphHash: null,
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

const panelSpy = vi.fn()
vi.mock('../../model-tab-v2/ModelTabV2Panel', () => ({
  ModelTabV2Panel: (props: Record<string, unknown>) => {
    panelSpy(props)
    return null
  },
}))

import { ModelTabBody } from '../ModelTabBody'

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

describe('ModelTabBody → ModelTabV2Panel: the rename write', () => {
  it('threads a rename handler at all', () => {
    expect(typeof renderHost().onRenameRow).toBe('function')
  })

  it('⭐ threads the CHOKEPOINT itself, not merely something that sets a label', () => {
    // Bound by IDENTITY (trap 19). `typeof === 'function'` would be satisfied by
    // `updateNode`, by a wrapper, or by a no-op — and each of those would look
    // right on screen while dropping the concurrency assertion, the history
    // entry and the goal provenance retirement that only `updateNodeLabel` does.
    expect(renderHost().onRenameRow).toBe(updateNodeLabel)
  })

  it('⚠ and NOT the generic node writer', () => {
    // The discriminating twin: proves the assertion above distinguishes the two
    // store actions rather than matching any function the mock happens to hold.
    const props = renderHost()
    expect(props.onRenameRow).not.toBe(updateNode)
  })

  it('POSITIVE CONTROL: the recorder sees the props already threaded', () => {
    const props = renderHost()
    expect(props.nodes).toBeDefined()
    expect(Object.keys(props)).toEqual(expect.arrayContaining(['nodes', 'edges', 'goalThreshold']))
  })
})
