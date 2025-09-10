// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act } from 'react'
import { screen } from '@testing-library/react'
import { renderSandbox } from '@/test/renderSandbox'
import { __clearTestBuffer, __getTestBuffer } from '@/lib/analytics'

const decisionId = 'align-x'

describe('Alignment badge and telemetry', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    __clearTestBuffer()
  })

  it('shows Low, Medium, High buckets with a11y label and emits telemetry with bucket', async () => {
    const { GoalsOkrsPanel } = await import('@/sandbox/panels/GoalsOkrsPanel')
    const { submitVotes } = await import('@/sandbox/state/voting')
    const { notifyRecompute } = await import('@/sandbox/state/recompute')
    renderSandbox(<GoalsOkrsPanel decisionId={decisionId} />, { sandbox: true, projections: true, voting: true })

    // Ensure version 1 for Low scenario
    await act(async () => { notifyRecompute(decisionId, 'seed', [
      { id: 'a', p: 0.5, c: 1 }, { id: 'b', p: 0.5, c: 1 }, { id: 'c', p: 0.5, c: 1 }, { id: 'd', p: 0.5, c: 1 }
    ]) })
    // Low: conf high variance, prob constant
    await act(async () => { submitVotes(decisionId, 'u1', [
      { id: 'a', p: 0.5, c: 0 },
      { id: 'b', p: 0.5, c: 1 },
      { id: 'c', p: 0.5, c: 0 },
      { id: 'd', p: 0.5, c: 1 },
    ]) })
    await vi.advanceTimersByTimeAsync(1)
    // badge
    const badgeLow = screen.getByTestId('alignment-badge')
    expect(badgeLow).toHaveAttribute('aria-label', 'Alignment: Low')
    // telemetry (accept sandbox or PRD name)
    const callsLow = __getTestBuffer()
    const lowEvt = [...callsLow].reverse().find((c: { event: string }) => c.event === 'sandbox_alignment' || c.event === 'alignment_updated')
    expect(lowEvt).toBeTruthy()
    if (lowEvt) expect((lowEvt as any).props).toHaveProperty('bucket', 'Low')

    // Increment version 2 for Medium scenario
    await act(async () => { notifyRecompute(decisionId, 'seed', [
      { id: 'a', p: 0.5, c: 1 }, { id: 'b', p: 0.5, c: 1 }, { id: 'c', p: 0.5, c: 1 }, { id: 'd', p: 0.5, c: 1 }
    ]) })
    // Medium: conf moderate variance
    await act(async () => { submitVotes(decisionId, 'u2', [
      { id: 'a', p: 0.5, c: 0.25 },
      { id: 'b', p: 0.5, c: 0.5 },
      { id: 'c', p: 0.5, c: 0.5 },
      { id: 'd', p: 0.5, c: 0.75 },
    ]) })
    await vi.advanceTimersByTimeAsync(1)
    const badgeMed = screen.getByTestId('alignment-badge')
    expect(badgeMed).toHaveAttribute('aria-label', 'Alignment: Medium')
    const callsMed = __getTestBuffer()
    const medEvt = [...callsMed].reverse().find((c: { event: string }) => c.event === 'sandbox_alignment' || c.event === 'alignment_updated')
    expect(medEvt).toBeTruthy()
    if (medEvt) expect((medEvt as any).props).toHaveProperty('bucket', 'Medium')

    // Increment version 3 for High scenario
    await act(async () => { notifyRecompute(decisionId, 'seed', [
      { id: 'a', p: 0.5, c: 1 }, { id: 'b', p: 0.5, c: 1 }, { id: 'c', p: 0.5, c: 1 }, { id: 'd', p: 0.5, c: 1 }
    ]) })
    // High: all equal
    await act(async () => { submitVotes(decisionId, 'u3', [
      { id: 'a', p: 0.5, c: 0.5 },
      { id: 'b', p: 0.5, c: 0.5 },
      { id: 'c', p: 0.5, c: 0.5 },
      { id: 'd', p: 0.5, c: 0.5 },
    ]) })
    await vi.advanceTimersByTimeAsync(1)
    const badgeHigh = screen.getByTestId('alignment-badge')
    expect(badgeHigh).toHaveAttribute('aria-label', 'Alignment: High')
    const callsHigh = __getTestBuffer()
    const highEvt = [...callsHigh].reverse().find((c: { event: string }) => c.event === 'sandbox_alignment' || c.event === 'alignment_updated')
    expect(highEvt).toBeTruthy()
    if (highEvt) expect((highEvt as any).props).toHaveProperty('bucket', 'High')
  })
})
