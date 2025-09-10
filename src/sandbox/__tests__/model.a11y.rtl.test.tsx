// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Enable sandbox features for this test
vi.mock('@/lib/config', () => ({
  isScenarioSnapshotsEnabled: () => true,
  isOptionHandlesEnabled: () => true,
}))

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

describe('Model segmented control and panel a11y', () => {
  let user: ReturnType<typeof userEvent.setup>

  beforeEach(() => {
    vi.useFakeTimers()
    user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  })

  afterEach(() => {
    try { vi.runOnlyPendingTimers() } catch {}
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('supports Arrow keys and Space/Enter to select segments; aria-labelledby ties panel to active tab', async () => {
    const { ScenarioSandboxMock } = await import('@/sandbox/ui/ScenarioSandboxMock')
    render(<ScenarioSandboxMock />)

    const optionsBtn = screen.getByRole('radio', { name: /Options/i })
    const probsBtn = screen.getByRole('radio', { name: /Probabilities/i })

    // Focus the selected segment and move to next with ArrowRight
    optionsBtn.focus()
    expect(document.activeElement).toBe(optionsBtn)

    fireEvent.keyDown(optionsBtn, { key: 'ArrowRight' })
    await vi.advanceTimersByTimeAsync(0)
    // The component focuses the selected segment with a timeout
    expect(document.activeElement).toBe(probsBtn)

    // Select with Space
    fireEvent.keyDown(optionsBtn, { key: ' ' })
    await vi.advanceTimersByTimeAsync(0)
    expect(probsBtn).toHaveAttribute('aria-checked', 'true')

    // Panel should be labelled by the probabilities segment id
    const panel = screen.getByRole('region', { name: /Probabilities/i })
    expect(panel).toHaveAttribute('aria-labelledby', 'segment-probabilities')

    // Move back with ArrowLeft and Enter to select
    fireEvent.keyDown(probsBtn, { key: 'ArrowLeft' })
    await vi.advanceTimersByTimeAsync(0)
    expect(document.activeElement).toBe(optionsBtn)
    fireEvent.keyDown(optionsBtn, { key: 'Enter' })
    await vi.advanceTimersByTimeAsync(0)
    expect(optionsBtn).toHaveAttribute('aria-checked', 'true')
    const optionsPanel = screen.getByRole('region', { name: /Options/i })
    expect(optionsPanel).toHaveAttribute('aria-labelledby', 'segment-options')

    // Radiogroup is present
    expect(screen.getByRole('radiogroup', { name: /Model view/i })).toBeInTheDocument()
  })

  it('Escape closes the panel and returns focus to the tile', async () => {
    const { ScenarioSandboxMock } = await import('@/sandbox/ui/ScenarioSandboxMock')
    render(<ScenarioSandboxMock />)

    // Focus a control inside the Options panel deterministically
    const optionsPanel = screen.getByRole('region', { name: /Options/i })
    const inputs = optionsPanel.querySelectorAll('input')
    expect(inputs.length).toBeGreaterThan(0)
    ;(inputs[0] as HTMLInputElement).focus()
    expect(document.activeElement).toBe(inputs[0] as HTMLInputElement)

    // Press Esc to close panel
    fireEvent.keyDown(window, { key: 'Escape' })
    await vi.advanceTimersByTimeAsync(0)

    // Focus should return to the tile (invoker container)
    const tile = screen.getByRole('group', { name: /Scenario Tile/i })
    expect(document.activeElement).toBe(tile)
  })
})
