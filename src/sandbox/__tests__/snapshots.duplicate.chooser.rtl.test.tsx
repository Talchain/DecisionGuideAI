// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { render, fireEvent } from '@testing-library/react'
import { FlagsProvider } from '@/lib/flags'
import CombinedSandboxRoute from '@/whiteboard/CombinedSandboxRoute'

vi.mock('@/whiteboard/tldraw', () => ({
  Tldraw: ({ onMount }: any) => {
    const editor = { updateInstanceState: () => {}, setCurrentTool: () => {}, store: { getSnapshot: () => ({}), listen: () => () => {} } }
    React.useEffect(() => { onMount?.(editor) }, [])
    return null
  },
}))

describe('snapshots.duplicate.chooser', () => {
  beforeEach(() => { localStorage.clear() })
  afterEach(() => { localStorage.clear() })

  it('duplicates via chooser item action', async () => {
    // Seed one snapshot
    localStorage.setItem('dgai:graph:snap:list:demo', JSON.stringify([{ id: 'S1', name: 'Snap1', createdAt: Date.now() }]))
    localStorage.setItem('dgai:graph:snap:demo:S1', JSON.stringify({ schemaVersion: 1, nodes: {}, edges: {} }))
    // Seed current
    localStorage.setItem('dgai:graph:decision:demo', JSON.stringify({ schemaVersion: 1, nodes: {}, edges: {} }))

    const r = render(
      <FlagsProvider value={{ sandbox: true, sandboxCompare: true, sandboxMapping: true }}>
        <MemoryRouter initialEntries={[`/decisions/demo/sandbox/combined`]}>
          <Routes>
            <Route path="/decisions/:decisionId/sandbox/combined" element={<CombinedSandboxRoute />} />
          </Routes>
        </MemoryRouter>
      </FlagsProvider>
    )

    fireEvent.click(await r.findByText('Snapshots ▾'))
    const btnDup = r.getByLabelText('Duplicate snapshot Snap1')
    fireEvent.click(btnDup)

    const listRaw = localStorage.getItem('dgai:graph:snap:list:demo')!
    const list = JSON.parse(listRaw)
    expect(list.length).toBe(2)
  })
})
