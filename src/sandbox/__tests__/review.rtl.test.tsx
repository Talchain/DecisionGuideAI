// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { renderSandbox } from '@/test/renderSandbox'

const enableFlags = async () => {
  vi.doMock('@/lib/config', async () => {
    const actual = await vi.importActual<typeof import('@/lib/config')>('@/lib/config')
    return {
      ...actual,
      isSandboxEnabled: () => true,
      isStrategyBridgeEnabled: () => true,
    }
  })
}

describe('Review Mode skeleton', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { try { vi.runOnlyPendingTimers() } catch {}; vi.useRealTimers(); vi.resetAllMocks() })

  it('flows through steps and publishes with telemetry', async () => {
    await enableFlags()
    const calls: Array<{ event: string; props: Record<string, any> }> = []
    vi.doMock('@/lib/analytics', () => ({ track: (event: string, props: Record<string, any> = {}) => { calls.push({ event, props }) }, model_segment_changed: () => {} }))

    const { StrategyBridgeShell } = await import('@/sandbox/layout/StrategyBridgeShell')
    renderSandbox(<StrategyBridgeShell decisionId="rev-1" />, { sandbox: true, strategyBridge: true })

    // Open Review tab
    const reviewTab = await screen.findByRole('tab', { name: /review/i })
    fireEvent.click(reviewTab)

    // Start
    fireEvent.click(await screen.findByTestId('review-start'))
    // Next through steps until final
    fireEvent.click(await screen.findByRole('button', { name: /next/i }))
    fireEvent.click(await screen.findByRole('button', { name: /next/i }))
    fireEvent.click(await screen.findByRole('button', { name: /next/i }))

    // Publish
    const area = await screen.findByPlaceholderText(/review note/i)
    fireEvent.change(area, { target: { value: 'Looks good' } })
    const publish = (await screen.findByTestId('review-publish')).querySelector('button') as HTMLButtonElement
    publish.click()

    const evts = calls.filter(c => c.event === 'sandbox_review')
    const ops = evts.map(e => e.props.op)
    expect(ops).toContain('start')
    expect(ops).toContain('publish')
  })
})
