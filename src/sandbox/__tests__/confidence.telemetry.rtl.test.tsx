// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { renderSandbox } from '@/test/renderSandbox'

describe('Confidence control telemetry', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { try { vi.runOnlyPendingTimers() } catch {}; vi.useRealTimers(); vi.resetAllMocks() })

  it('emits sandbox_model set_confidence with delta on adjustment', async () => {
    const calls: Array<{ event: string; props: Record<string, any> }> = []
    vi.doMock('@/lib/analytics', () => ({
      track: (event: string, props: Record<string, any> = {}) => { calls.push({ event, props }) },
      model_segment_changed: () => {},
    }))

    const { ScenarioSandboxMock } = await import('@/sandbox/ui/ScenarioSandboxMock')
    renderSandbox(<ScenarioSandboxMock />, { sandbox: true })

    // Switch to Probabilities panel
    const tab = screen.getByRole('radio', { name: /Probabilities/i })
    fireEvent.click(tab)

    // Get first confidence slider and change it to 0.75
    const sliders = screen.getAllByRole('slider')
    expect(sliders.length).toBeGreaterThan(0)
    fireEvent.change(sliders[0], { target: { value: '0.75' } })

    // Look for set_confidence telemetry
    const evt = calls.find(c => c.event === 'sandbox_model' && c.props.op === 'set_confidence')
    expect(evt).toBeTruthy()
    expect(typeof evt!.props.delta).toBe('number')
  })
})
