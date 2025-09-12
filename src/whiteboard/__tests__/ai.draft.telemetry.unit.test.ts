// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { FlagsProvider } from '@/lib/flags'
import { render } from '@testing-library/react'
import { GraphProvider, useGraph } from '@/sandbox/state/graphStore'

// Mock analytics to capture telemetry
const trackSpy = vi.fn()
vi.mock('@/lib/analytics', () => ({ track: (...args: any[]) => trackSpy(...args) }))

function ApplyDraftOnce() {
  const api = useGraph()
  React.useEffect(() => {
    api.applyDraft({ nodes: [ { id: 'n0', type: 'Problem', title: 'P0', meta: { generated: true }, view: { x: 100, y: 100, w: 160, h: 80 } } as any ], edges: [] })
  }, [])
  return null
}

describe('ai.draft.telemetry', () => {
  beforeEach(() => { trackSpy.mockReset(); localStorage.clear() })
  afterEach(() => { trackSpy.mockReset(); localStorage.clear() })

  it('emits sandbox_graph_ai_draft', async () => {
    render(
      React.createElement(FlagsProvider, {
        value: { sandbox: true, sandboxMapping: true, sandboxAIDraft: true },
        children: React.createElement(GraphProvider, {
          decisionId: 'demo',
          children: React.createElement(ApplyDraftOnce, {})
        })
      })
    )
    const events = trackSpy.mock.calls.map(c => c[0])
    expect(events.includes('sandbox_graph_ai_draft')).toBe(true)
  })
})
