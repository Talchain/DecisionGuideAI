// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderSandbox } from '@/test/renderSandbox'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { ExplainDeltaPanel } from '@/whiteboard/ExplainDeltaPanel'

// Telemetry stub (use hook directly)
const trackSpy = vi.fn()
vi.mock('@/lib/useTelemetry', () => ({ useTelemetry: () => ({ track: (...args: any[]) => trackSpy(...args) }) }))

// Deterministic graph for the test (9 contributors)
const testGraph = {
  schemaVersion: 1,
  nodes: Object.fromEntries([
    ['o1', { id: 'o1', type: 'Outcome', title: 'Outcome' }],
    ...Array.from({ length: 8 }).map((_, i) => {
      const id = `a${i + 1}`
      return [id, { id, type: 'Action', title: `A${i + 1}` }]
    })
  ]),
  edges: {},
}

// Mock graph/overrides stores to avoid provider complexity
vi.mock('@/sandbox/state/graphStore', () => ({
  useGraph: () => ({ graph: testGraph, getGraph: () => testGraph })
}))
vi.mock('@/sandbox/state/overridesStore', () => {
  const React = require('react')
  return {
    OverridesProvider: ({ children }: any) => React.createElement(React.Fragment, null, children),
    useOverrides: () => ({ focusOnNodeId: null, setFocusOn: () => {}, toggleNodeDisabled: () => {}, hasOverrides: false, version: 0, effectiveGraph: (g: any) => g }),
  }
})

describe('Explain Δ v1.5 — copy (deterministic direct panel)', () => {
  let warnSpy: any, errSpy: any
  beforeEach(() => {
    trackSpy.mockReset()
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    Object.assign(navigator as any, { clipboard: { writeText: vi.fn().mockResolvedValue(void 0) } })
  })
  afterEach(() => {
    trackSpy.mockReset()
    warnSpy?.mockRestore?.(); errSpy?.mockRestore?.()
  })

  it('copies explanation and emits telemetry', async () => {
    renderSandbox(
      <ExplainDeltaPanel decisionId="demo" onClose={() => {}} onHighlight={() => {}} />,
      { sandbox: true, sandboxExplain: true, sandboxExplainV15: true }
    )

    const btn = await screen.findByRole('button', { name: /copy explanation/i })
    fireEvent.click(btn)

    await waitFor(() => {
      expect(trackSpy).toHaveBeenCalled()
    })
    const call = trackSpy.mock.calls.find(c => c[0] === 'sandbox_score_explain_copy')
    expect(call?.[1]).toEqual(expect.objectContaining({ contributorCount: 5, limitedTo: 5 }))

    const writeText = (navigator as any).clipboard.writeText as any
    expect(writeText).toHaveBeenCalled()
    const text = writeText.mock.calls[0][0] as string
    expect(text).toMatch(/Explain Δ — Before .* → After .* \(Δ [+-]?\d+\)/)
    expect(text).toMatch(/Top 5 contributors \(of 9\)/)
  })
})
