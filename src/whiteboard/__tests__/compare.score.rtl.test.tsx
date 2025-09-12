// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { render, fireEvent, screen } from '@testing-library/react'
import CombinedSandboxRoute from '@/whiteboard/CombinedSandboxRoute'
import { FlagsProvider } from '@/lib/flags'

vi.mock('@/whiteboard/tldraw', () => ({ Tldraw: () => null }))

describe('compare.score', () => {
  beforeEach(() => { localStorage.clear() })
  afterEach(() => { localStorage.clear() })

  it('shows per-pane scores and delta with aria-live announce', async () => {
    // Seed current graph and two snapshots
    const cur = { schemaVersion: 1, nodes: { a: { id: 'a', type: 'Outcome', title: 'Out', krImpacts: [{ krId: 'kr', deltaP50: 0.2, confidence: 0.5 }], view: { x: 0, y: 0, w: 160, h: 80 } } }, edges: {} } // 10%
    const snap1 = { schemaVersion: 1, nodes: { b: { id: 'b', type: 'Outcome', title: 'Out2', krImpacts: [{ krId: 'kr', deltaP50: 0.5, confidence: 0.5 }], view: { x: 0, y: 0, w: 160, h: 80 } } }, edges: {} } // 25%
    const snap2 = { schemaVersion: 1, nodes: { c: { id: 'c', type: 'Outcome', title: 'Out3', krImpacts: [{ krId: 'kr', deltaP50: 0.1, confidence: 1 }], view: { x: 0, y: 0, w: 160, h: 80 } } }, edges: {} } // 10%
    localStorage.setItem('dgai:graph:decision:demo', JSON.stringify(cur))
    localStorage.setItem('dgai:graph:snap:list:demo', JSON.stringify([{ id: 'S1', name: 'S1', createdAt: Date.now() }, { id: 'S2', name: 'S2', createdAt: Date.now() }]))
    localStorage.setItem('dgai:graph:snap:demo:S1', JSON.stringify(snap1))
    localStorage.setItem('dgai:graph:snap:demo:S2', JSON.stringify(snap2))

    const r = render(
      <FlagsProvider value={{ sandbox: true, sandboxCompare: true, sandboxScore: true }}>
        <MemoryRouter initialEntries={[`/decisions/demo/sandbox/combined`]}>
          <Routes>
            <Route path="/decisions/:decisionId/sandbox/combined" element={<CombinedSandboxRoute />} />
          </Routes>
        </MemoryRouter>
      </FlagsProvider>
    )

    fireEvent.click(await r.findByText('Compare'))

    // Choose Left=S1, Right=S2
    const leftSel = await r.findByLabelText('Left')
    fireEvent.change(leftSel, { target: { value: 'S1' } })
    const rightSel = await r.findByLabelText('Right')
    fireEvent.change(rightSel, { target: { value: 'S2' } })

    fireEvent.click(await r.findByText('Open'))
    // Give a tick for score computation
    await new Promise(res => setTimeout(res, 0))

    // Scores and delta visible
    expect(await r.findByText('Left: 25%')).toBeTruthy()
    expect(screen.getByText('Right: 10%')).toBeTruthy()
    expect(screen.getByText('Δ -15%')).toBeTruthy()

    // aria-live announced
    expect(screen.getByText('Compare: Left 25 vs Right 10 (Δ -15).')).toBeTruthy()
  })
})
