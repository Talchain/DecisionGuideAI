// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, act } from '@testing-library/react'
import { renderSandbox } from '@/test/renderSandbox'

const decisionId = 'kc-x'
const krId = 'kr1'

async function renderCard() {
  const { KRCard } = await import('@/sandbox/components/KRCard')
  return renderSandbox(<KRCard decisionId={decisionId} krId={krId} krTitle="Prob KR" />, { sandbox: true, strategyBridge: true })
}

describe('KR Cards — drop-late and once-per-version telemetry', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks() })

  it('keeps v=5 when an out-of-order v=3 arrives; and tracks once per version', async () => {
    const calls: Array<{ event: string; props: Record<string, any> }> = []
    vi.doMock('@/lib/analytics', () => ({ track: (e: string, p: Record<string, any> = {}) => { calls.push({ event: e, props: p }) }, model_segment_changed: () => {} }))
    const { __emitTest } = await import('@/sandbox/state/recompute')
    const now = Date.now()
    // Seed v=5 before render so subscriber picks up current state immediately
    await act(async () => { __emitTest(decisionId, { version: 5, lastTs: now, lastReason: 'prob_edit', bands: { p10: 0.6, p50: 0.7, p90: 0.8 } }) })
    await vi.advanceTimersByTimeAsync(1)
    await renderCard()
    const resolved = screen.getByTestId(`kr-resolved-${krId}`)
    expect(resolved).toBeTruthy()
    expect(resolved.textContent || '').toContain('70%')

    // Emit out-of-order v=3; UI should remain at v=5
    await act(async () => { __emitTest(decisionId, { version: 3, lastTs: now + 1, lastReason: 'prob_edit', bands: { p10: 0.1, p50: 0.2, p90: 0.3 } }) })
    await vi.advanceTimersByTimeAsync(1)
    expect(resolved.textContent || '').toContain('70%')

    // Telemetry: one sandbox_projection so far
    const first = calls.filter(c => c.event === 'sandbox_projection')
    expect(first.length).toBe(1)
    expect(first[0].props).toMatchObject({ decisionId, krId })

    // Rapid v=6 twice → still one more telemetry (total 2)
    await act(async () => { __emitTest(decisionId, { version: 6, lastTs: now + 2, lastReason: 'prob_edit', bands: { p10: 0.65, p50: 0.75, p90: 0.85 } }) })
    await vi.advanceTimersByTimeAsync(1)
    await act(async () => { __emitTest(decisionId, { version: 6, lastTs: now + 3, lastReason: 'prob_edit', bands: { p10: 0.65, p50: 0.75, p90: 0.85 } }) })
    await vi.advanceTimersByTimeAsync(1)
    const proj = calls.filter(c => c.event === 'sandbox_projection')
    expect(proj.length).toBe(2)
  })
})
