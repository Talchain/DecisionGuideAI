// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { renderSandbox } from '@/test/renderSandbox'
import React from 'react'

// Hoisted dynamic flag for per-test control
const flags = vi.hoisted(() => ({ optionHandles: true }))

// Flags will be provided via renderSandbox

// Mock analytics to observe tracking calls
vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
  model_segment_changed: vi.fn(),
}))

async function renderScenario(decisionId = 'dec-test-1') {
  const { ScenarioSandboxMock } = await import('@/sandbox/ui/ScenarioSandboxMock')
  return renderSandbox(<ScenarioSandboxMock decisionId={decisionId} />, { sandbox: true, optionHandles: flags.optionHandles })
}

beforeEach(() => {
  // Clear any persisted snapshots used by ScenarioSandboxMock.saveSnapshot
  try { localStorage.clear() } catch {}
})

describe('ScenarioSandboxMock option handles feature flag', () => {
  it('does not render option handles when flag is disabled', async () => {
    flags.optionHandles = false
    await renderScenario('dec-ff-0')

    expect(screen.queryByLabelText('Option handles')).toBeNull()
  })

  it('renders option handles when flag is enabled (default 3 buttons)', async () => {
    flags.optionHandles = true
    await renderScenario('dec-ff-1')

    const region = await screen.findByLabelText('Option handles')
    // Default component options list has 3 rows
    const buttons = region.querySelectorAll('button')
    expect(buttons.length).toBe(3)
  })
})

describe('ScenarioSandboxMock option handle analytics', () => {
  it('fires sandbox_handle_click with handleId, optionId, index on click', async () => {
    flags.optionHandles = true
    const decisionId = 'dec-analytics-1'
    await renderScenario(decisionId)

    const region = await screen.findByLabelText('Option handles')
    const btn = region.querySelector('button') as HTMLButtonElement
    expect(btn).toBeTruthy()

    fireEvent.click(btn)

    const { track } = (await import('@/lib/analytics')) as any
    // Ensure at least one call occurred
    expect(track).toHaveBeenCalled()

    // Validate last call payload
    const calls = (track as any).mock.calls as any[][]
    const lastCall = calls[calls.length - 1]
    expect(lastCall[0]).toBe('sandbox_handle_click')

    const payload = lastCall[1] as Record<string, any>
    expect(payload.decisionId).toBe(decisionId)
    // Compare against button dataset to avoid coupling to random option ids
    expect(payload.handleId).toBe(btn.dataset.handleId)
    expect(payload.optionId).toBe(btn.dataset.optionId)
    expect(payload.index).toBe(0)
  })
})
