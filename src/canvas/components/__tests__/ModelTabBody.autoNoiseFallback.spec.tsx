/**
 * Regression: the `_meta.auto_noise_applied` legacy fallback in
 * ModelTabBody's auditTrail selector. Older PLoT builds emitted the
 * flag only under `_meta`; cached or Supabase-hydrated bundles
 * captured pre-promotion still rely on this read path. The B3
 * disclosure work (PR for `claude-plot-ui/b3-auto-noise-disclosure`)
 * tightened the selector to `V2RunResponse` types and accidentally
 * dropped the fallback in an earlier draft. This spec locks the
 * fallback in so future additive work cannot hide existing audit
 * metadata.
 *
 * Strategy: mock ModelHealthSection with a spy and capture the
 * `auditTrail` prop ModelTabBody passes. That isolates the selector
 * logic from the Accordion's expansion behaviour and from any
 * rendering changes in the audit section itself.
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import type { Node, Edge } from '@xyflow/react'
import { ModelTabBody } from '../ModelTabBody'

// ── Mock state matching ModelTabBody.spec.tsx pattern, plus rawV2Response ────

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

// Spy on ModelHealthSection — capture the `auditTrail` prop ModelTabBody
// hands down. The selector under test is the inline `useMemo(auditTrail …)`
// in ModelTabBody; this mock isolates it from rendering concerns.
const modelHealthSpy = vi.fn()
vi.mock('../model-tab/ModelHealthSection', () => ({
  ModelHealthSection: (props: { auditTrail: unknown }) => {
    modelHealthSpy(props.auditTrail)
    return null
  },
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeGoalNode(): Node {
  return { id: 'g1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Pick the right vendor' } }
}

function makeFactorNode(): Node {
  return {
    id: 'f1',
    type: 'factor',
    position: { x: 0, y: 0 },
    data: {
      label: 'Budget',
      category: 'observable',
      observedState: { value: 0.5 },
    },
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

function renderTabAndCaptureAuditTrail() {
  modelHealthSpy.mockClear()
  render(
    <ModelTabBody
      {...DEFAULT_PROPS}
      nodes={[makeGoalNode(), makeFactorNode()] as Node[]}
      edges={[] as Edge[]}
    />,
  )
  // ModelHealthSection is rendered unconditionally on line 664 of
  // ModelTabBody — exactly one call expected.
  expect(modelHealthSpy).toHaveBeenCalled()
  return modelHealthSpy.mock.calls[0][0] as { autoNoiseApplied: boolean | null }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockRawV2Response = null
})

describe('ModelTabBody auditTrail selector — _meta.auto_noise_applied legacy fallback', () => {
  it('falls back to _meta.auto_noise_applied when the top-level field is absent', () => {
    // Legacy shape: cached/hydrated bundles captured before the flag was
    // promoted to a top-level field. Only `_meta.auto_noise_applied`
    // carries the signal.
    mockRawV2Response = { _meta: { auto_noise_applied: true } }
    const auditTrail = renderTabAndCaptureAuditTrail()
    expect(auditTrail.autoNoiseApplied).toBe(true)
  })

  it('top-level field wins over _meta when both are present', () => {
    // Top-level `false` + `_meta` `true` → selector resolves to `false`.
    mockRawV2Response = {
      auto_noise_applied: false,
      _meta: { auto_noise_applied: true },
    }
    const auditTrail = renderTabAndCaptureAuditTrail()
    expect(auditTrail.autoNoiseApplied).toBe(false)
  })

  it('top-level true is preserved even when _meta is undefined', () => {
    mockRawV2Response = { auto_noise_applied: true }
    const auditTrail = renderTabAndCaptureAuditTrail()
    expect(auditTrail.autoNoiseApplied).toBe(true)
  })

  it('returns null when neither top-level nor _meta carries the flag', () => {
    mockRawV2Response = {} // no signal at all
    const auditTrail = renderTabAndCaptureAuditTrail()
    expect(auditTrail.autoNoiseApplied).toBeNull()
  })

  it('returns null when rawV2Response itself is null', () => {
    mockRawV2Response = null
    const auditTrail = renderTabAndCaptureAuditTrail()
    expect(auditTrail.autoNoiseApplied).toBeNull()
  })
})
