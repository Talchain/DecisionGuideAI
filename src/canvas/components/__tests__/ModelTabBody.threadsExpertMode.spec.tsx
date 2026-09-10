/**
 * ⭐⭐ THE MOUNT HOST THREADS THE ONE EXPERT PREFERENCE INTO THE OUTLINE.
 *
 * `ModelTabV2Panel`'s new `expertMode` / `onToggleExpert` props are OPTIONAL —
 * sixteen existing specs render that panel without them, and making them
 * required would churn every one. The cost of optional is the exact wiring loss
 * `ModelTabBody.threadsInterventionFences.spec.tsx` was written to catch, one
 * prop over: drop the threading and the panel keeps compiling, the suite keeps
 * passing, and the tab silently goes back to having TWO detail switches — the
 * outline holding a private, unpersisted opinion while `olumi.expertMode` (and
 * so Compare, Results, and the scientific transparency block directly beneath
 * the outline) holds another.
 *
 * A convergence nobody can reach is not a convergence. This asserts the wire.
 *
 * ⚠ `onToggleExpert` is asserted as a FUNCTION, not merely as a declared key.
 * `ModelTabBody` receives no setter of its own — the preference is owned by
 * `OutputsDock.tsx:1150` — so a plausible-looking wiring that threads the VALUE
 * and forgets the SETTER would leave the in-tab control inert: it would read
 * correctly and write nowhere, which is worse than the defect it replaced,
 * because the control would look live.
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import type { Node, Edge } from '@xyflow/react'
import { ModelTabBody } from '../ModelTabBody'

function getMockState() {
  return {
    updateNode: vi.fn(),
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

function renderHost(extra: Record<string, unknown>) {
  panelSpy.mockClear()
  render(
    <ModelTabBody
      {...DEFAULT_PROPS}
      {...extra}
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

describe('ModelTabBody → ModelTabV2Panel: the one expert preference', () => {
  it('threads expertMode ON', () => {
    expect(renderHost({ expertMode: true }).expertMode).toBe(true)
  })

  it('threads expertMode OFF — as a declared key, not an absent prop', () => {
    // `expect(props.expertMode).toBe(false)` would NOT pass on a missing prop
    // (undefined !== false), but assert the key too: this is the direction the
    // wiring loss actually takes.
    const props = renderHost({ expertMode: false })
    expect(Object.keys(props)).toEqual(expect.arrayContaining(['expertMode']))
    expect(props.expertMode).toBe(false)
  })

  it('⭐ threads THE OWNER\'S setter, so the in-tab control writes the real preference', () => {
    // Bound by IDENTITY, not by `typeof === 'function'` (trap 19): any function
    // satisfies the predicate, including a locally-created no-op that would
    // leave the control inert while looking wired. Only the owner's own setter
    // reaches `olumi.expertMode`.
    const onToggleExpert = vi.fn()
    const props = renderHost({ expertMode: false, onToggleExpert })
    expect(props.onToggleExpert).toBe(onToggleExpert)
  })

  it('POSITIVE CONTROL: the recorder sees the props that were already threaded', () => {
    // Without this, every assertion above could pass against a recorder that
    // captured nothing and a panel that was never rendered.
    const props = renderHost({ expertMode: true })
    expect(props.nodes).toBeDefined()
    expect(Object.keys(props)).toEqual(expect.arrayContaining(['nodes', 'edges', 'goalThreshold']))
  })
})
