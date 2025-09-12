// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { FlagsProvider } from '@/lib/flags'
import { GraphProvider } from '@/sandbox/state/graphStore'
import { Canvas } from '@/whiteboard/Canvas'

vi.mock('@/whiteboard/tldraw', () => ({ Tldraw: () => null }))
vi.mock('@/whiteboard/persistence', () => ({
  ensureCanvasForDecision: async (id: string) => ({ canvasId: `local:${id}` }),
  loadCanvasDoc: async (_id: string) => ({ shapes: [], bindings: [], meta: { decision_id: 'demo', kind: 'sandbox' } }),
  saveCanvasDoc: async () => {},
}))

describe('score.node.badge', () => {
  beforeEach(() => { vi.useFakeTimers(); localStorage.clear() })
  afterEach(() => { try { vi.runOnlyPendingTimers() } catch {}; vi.useRealTimers(); localStorage.clear() })

  it('renders per-node score badges as non-blocking overlay', async () => {
    // Seed graph with positioned node
    const graph = {
      schemaVersion: 1,
      nodes: {
        n1: { id: 'n1', type: 'Outcome', title: 'Out', krImpacts: [{ krId: 'kr', deltaP50: 0.3, confidence: 0.5 }], view: { x: 100, y: 80, w: 160, h: 80 } }
      },
      edges: {}
    }
    localStorage.setItem('dgai:graph:decision:demo', JSON.stringify(graph))

    render(
      React.createElement(FlagsProvider, {
        value: { sandbox: true, sandboxScore: true },
        children: React.createElement(GraphProvider, {
          decisionId: 'demo',
          children: React.createElement(Canvas, { decisionId: 'demo', hideBanner: true, hideFeedback: true, embedded: true } as any)
        })
      })
    )

    await act(async () => { await vi.advanceTimersByTimeAsync(350) })
    const badgeEl = document.querySelector('[data-dg-score-node="n1"]') as HTMLElement
    expect(badgeEl).toBeTruthy()
    const overlay = document.querySelector('[data-dg-score-overlay]') as HTMLElement
    expect(overlay).toBeTruthy()
  })
})
