/**
 * Phase 2.3 — renderTimeline null-probability guard for analysis_run.
 *
 * When a journey event carries an explicit `probability` key of null or 0
 * (or any non-truthy number), the template must NOT fall back to the
 * success-implying `"Analysis run"` sentence-case string. Instead it
 * renders an explicit "no probability available" headline.
 *
 * This is the BoundaryError contract for timeline rendering: a run that
 * "happened" but produced no probability must not read as a clean success.
 */
import { describe, it, expect } from 'vitest'
import type { ScenarioEvent } from '../../../types/scenario'
import { renderTimeline } from '../renderTimeline'

let seq = 0
function makeAnalysisRun(details: Record<string, unknown>): ScenarioEvent {
  seq += 1
  return {
    event_id: `evt-${seq}`,
    seq,
    event_type: 'analysis_run',
    stage: 'analyse',
    occurred_at: '2026-04-24T12:00:00Z',
    details,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

describe('renderTimeline analysis_run null-probability guard', () => {
  it('renders "Analysis complete" with numeric probability present', () => {
    const events = [makeAnalysisRun({ winner: 'Option A', probability: 74 })]
    const [entry] = renderTimeline(events)
    expect(entry.headline).toContain('Analysis complete')
    expect(entry.headline).toContain('74%')
  })

  it('does NOT render "Analysis complete" when probability is null', () => {
    const events = [makeAnalysisRun({ winner: 'Option A', probability: null })]
    const [entry] = renderTimeline(events)
    expect(entry.headline).not.toContain('Analysis complete')
    expect(entry.headline).toBe('Analysis finished (no probability available)')
  })

  it('renders "Analysis complete" with 0% when probability is finite zero (P1-2)', () => {
    // Finite zero is a valid renderable probability. 0% means "winner
    // performs at 0%" which is a real — if pessimistic — result.
    // Only null/undefined/NaN/Infinity route to the no-probability state.
    const events = [makeAnalysisRun({ winner: 'Option A', probability: 0 })]
    const [entry] = renderTimeline(events)
    expect(entry.headline).toContain('Analysis complete')
    expect(entry.headline).toContain('0%')
  })

  it('renders "Analysis finished (no probability available)" when probability is NaN', () => {
    const events = [makeAnalysisRun({ winner: 'Option A', probability: NaN })]
    const [entry] = renderTimeline(events)
    expect(entry.headline).toBe('Analysis finished (no probability available)')
  })

  it('falls back to sentence case when the event carries no probability field at all', () => {
    const events = [makeAnalysisRun({ winner: 'Option A' })]
    const [entry] = renderTimeline(events)
    // The field is absent entirely — legacy pre-v5 events. Keep the
    // pre-existing sentence-case fallback so this branch is untouched.
    expect(entry.headline).toBe('Analysis run')
  })
})
