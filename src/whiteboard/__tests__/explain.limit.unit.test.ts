import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { renderSandbox } from '@/test/renderSandbox'
import { screen } from '@testing-library/react'
import { ExplainDeltaPanel } from '@/whiteboard/ExplainDeltaPanel'

vi.mock('@/lib/useTelemetry', () => ({ useTelemetry: () => ({ track: () => {} }) }))
vi.mock('@/sandbox/state/graphStore', () => ({ useGraph: () => ({ graph: { schemaVersion: 1, nodes: Object.fromEntries([
    ['o1', { id: 'o1', type: 'Outcome', title: 'Outcome' }],
    ...Array.from({ length: 12 }).map((_, i) => { const id = `a${i+1}`; return [id, { id, type: 'Action', title: `A${i+1}` }] })
  ]), edges: {} } }) }))
vi.mock('@/sandbox/state/overridesStore', () => ({ useOverrides: () => ({ hasOverrides: false, version: 0, effectiveGraph: (g: any) => g }) }))

describe('Explain Δ v1.5 — contributor cap', () => {
  beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}); vi.spyOn(console, 'warn').mockImplementation(() => {}) })
  afterEach(() => { (console.error as any).mockRestore?.(); (console.warn as any).mockRestore?.() })

  it('shows limited banner and caps at 5', async () => {
    renderSandbox(
      React.createElement(ExplainDeltaPanel, { decisionId: 'demo', onClose: () => {}, onHighlight: () => {} } as any),
      { sandbox: true, sandboxExplain: true, sandboxExplainV15: true }
    )
    const banner = await screen.findByText(/Showing top 5 of /i)
    expect(banner).toBeTruthy()
  })
})
