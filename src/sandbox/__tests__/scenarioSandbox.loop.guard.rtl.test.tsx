// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderSandbox } from '@/test/renderSandbox'
import * as Y from 'yjs'

// Stable Y.Doc for this test file
const ydoc = new Y.Doc()

// Mock realtime provider (unused here)
vi.doMock('@/realtime/provider', () => ({ useRealtimeDoc: () => null }))

// Mock boardState to return our stable ydoc and minimal handlers
vi.doMock('@/sandbox/state/boardState', () => {
  return {
    useBoardState: (_did: string) => ({
      board: { id: 'b1', nodes: [], edges: [] },
      getUpdate: () => new Uint8Array(),
      replaceWithUpdate: () => {},
      getCurrentDocument: () => ydoc,
      getDecisionOptions: () => [],
    }),
    getOptionHandleId: (id: string) => `option:${id}`,
  }
})

// Import after mocks
const { ScenarioSandboxMock } = await import('@/sandbox/ui/ScenarioSandboxMock')

describe('ScenarioSandboxMock render loop guard', () => {
  let errSpy: ReturnType<typeof vi.spyOn>
  beforeEach(() => {
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    errSpy.mockRestore()
  })

  it('does not trigger maximum update depth when Yjs emits updates', async () => {
    // Initialize Y state minimally so ensureYState is a no-op
    const mock = ydoc.getMap('sandboxMock') as Y.Map<any>
    mock.set('initialized', true)
    mock.set('title', 'Scenario A')

    // Render
    const { findByLabelText } = renderSandbox(
      <ScenarioSandboxMock decisionId="t1" />, { sandbox: true, scenarioSnapshots: true, projections: true }
    )

    // Emit a Y update after mount
    ydoc.transact(() => {
      mock.set('title', 'Scenario A (edited)')
    })

    // It should render the tile and not log maximum depth errors
    expect(await findByLabelText('Scenario Tile')).toBeInTheDocument()
    const calls = (errSpy.mock.calls || []).flat().join(' ')
    expect(calls).not.toMatch(/Maximum update depth exceeded/i)
  })
})
