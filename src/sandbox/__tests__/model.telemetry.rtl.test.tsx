// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderSandbox } from '@/test/renderSandbox'

// Mock board state to keep this test deterministic and no-network
vi.mock('@/sandbox/state/boardState', () => ({
  useBoardState: () => ({
    board: { id: 'b1', title: 'Test', nodes: [], edges: [], version: 1, createdAt: '', updatedAt: '', isDraft: true, createdBy: 'u1' } as any,
    getUpdate: () => new Uint8Array(),
    replaceWithUpdate: () => {},
    getCurrentDocument: () => null,
    getDecisionOptions: () => [] as string[],
  }),
  getOptionHandleId: (id: string) => `option:${id}`,
}))

describe('Model (probabilities) telemetry', () => {
  let calls: Array<{ event: string; props: Record<string, any> }>

  beforeEach(() => {
    calls = []
    vi.doMock('@/lib/analytics', () => ({
      track: (event: string, props: Record<string, any> = {}) => {
        calls.push({ event, props })
      },
      model_segment_changed: () => {},
    }))
  })

  it('emits even_split and normalize telemetry with correct counts', async () => {
    const user = userEvent.setup()
    const { ScenarioSandboxMock } = await import('@/sandbox/ui/ScenarioSandboxMock')

    renderSandbox(<ScenarioSandboxMock />, { sandbox: true, optionHandles: true, scenarioSnapshots: true })

    // Switch to Probabilities panel
    await user.click(screen.getByRole('radio', { name: /Probabilities/i }))

    // Distribute evenly
    await user.click(screen.getByRole('button', { name: /Distribute evenly/i }))
    // Normalize
    await user.click(screen.getByRole('button', { name: /Normalize/i }))

    const modelEvents = calls.filter(c => c.event === 'sandbox_model')
    const even = modelEvents.find(e => e.props.op === 'even_split')
    const norm = modelEvents.find(e => e.props.op === 'normalize')

    expect(even).toBeTruthy()
    expect(norm).toBeTruthy()

    // Default mock probabilities rows = 2
    expect(even!.props.count).toBe(2)
    expect(norm!.props.count).toBe(2)

    // Exactly once each
    expect(modelEvents.filter(e => e.props.op === 'even_split')).toHaveLength(1)
    expect(modelEvents.filter(e => e.props.op === 'normalize')).toHaveLength(1)
  })
})
