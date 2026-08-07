/**
 * LensInfoPanel robustness list — switch_probability presence pins.
 *
 * Contract (vendored @talchain/schemas 0.30.0, EnrichmentRobustnessEdgeSchema):
 * `switch_probability` is OPTIONAL — ABSENT means NOT COMPUTED, and consumers
 * "must omit any value derived from it (severity, visible, ranking position)
 * rather than derive one from a substitute". `marginal_switch_probability` is
 * a DIFFERENT Monte Carlo — P(flip | only this edge varies) — never a
 * fallback. Same class as #543's chains A/B, different surface: the lens
 * fragile list rendered `NN%` from the coalesced marginal.
 *
 * Honest absence here matches the file's own absent-quantity handling — the
 * causal table renders an em dash for absent Std / P(exists) cells.
 *
 * Controls prove a measured value — including 0 — still travels the measured
 * path, so the absence assertions are not vacuous (trap 13).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LensInfoPanel } from '../LensInfoPanel'
import { useCanvasStore } from '../../store'

const EM_DASH = '—'

function seedRobustnessLens(fragileEdges: Array<Record<string, unknown>>): void {
  useCanvasStore.setState({
    nodes: [
      { id: 'price', data: { label: 'Price' }, position: { x: 0, y: 0 } },
      { id: 'revenue', data: { label: 'Revenue' }, position: { x: 0, y: 0 } },
      { id: 'demand', data: { label: 'Demand' }, position: { x: 0, y: 0 } },
      { id: 'margin', data: { label: 'Margin' }, position: { x: 0, y: 0 } },
    ] as never,
    results: {
      status: 'complete',
      progress: 100,
      report: {
        robustness: {
          recommendation_stability: 0.8,
          fragile_edges: fragileEdges,
        },
      },
    } as never,
    lens: {
      ...useCanvasStore.getState().lens,
      active: 'robustness',
    },
  } as never)
}

describe('LensInfoPanel robustness list — presence-branch on measured switch_probability', () => {
  beforeEach(() => {
    localStorage.setItem('feature.graphLens', '1')
  })

  afterEach(() => {
    localStorage.removeItem('feature.graphLens')
    useCanvasStore.setState({
      results: { status: 'idle', progress: 0 } as never,
      nodes: [] as never,
      lens: { ...useCanvasStore.getState().lens, active: 'full' },
    } as never)
  })

  it('PIN: a marginal-only fragile edge is listed WITHOUT a percentage (em dash, the file’s absent-quantity mark)', () => {
    seedRobustnessLens([
      {
        from_id: 'price',
        to_id: 'revenue',
        marginal_switch_probability: 0.9,
        alternative_winner_label: 'Plan B',
      },
    ])
    render(<LensInfoPanel />)
    const panel = screen.getByTestId('lens-info-robustness')
    // The row itself surfaces (labels are real data) — only the number is absent.
    expect(panel.textContent).toContain('Price')
    expect(panel.textContent).toContain('Revenue')
    expect(panel.textContent).not.toContain('90%')
    expect(panel.textContent).toContain(EM_DASH)
  })

  it('PIN: a measured edge outranks a marginal-only edge (ranking position is never derived from a substitute)', () => {
    seedRobustnessLens([
      {
        from_id: 'price',
        to_id: 'revenue',
        marginal_switch_probability: 0.9,
        alternative_winner_label: 'Plan B',
      },
      {
        from_id: 'demand',
        to_id: 'margin',
        switch_probability: 0.4,
        alternative_winner_label: 'Plan C',
      },
    ])
    render(<LensInfoPanel />)
    const panel = screen.getByTestId('lens-info-robustness')
    const text = panel.textContent ?? ''
    // Measured 40% renders; the marginal 0.9 never becomes a number.
    expect(text).toContain('40%')
    expect(text).not.toContain('90%')
    // Measured sorts first: the measured row's label precedes the marginal row's.
    expect(text.indexOf('Demand')).toBeGreaterThan(-1)
    expect(text.indexOf('Demand')).toBeLessThan(text.indexOf('Price'))
    // The "focus on" coaching names the measured edge, not the marginal one.
    expect(text).toContain('focus on: Demand → Margin')
  })

  it('CONTROL: a measured switch_probability renders its percentage', () => {
    seedRobustnessLens([
      {
        from_id: 'price',
        to_id: 'revenue',
        switch_probability: 0.85,
        alternative_winner_label: 'Plan B',
      },
    ])
    render(<LensInfoPanel />)
    expect(screen.getByTestId('lens-info-robustness').textContent).toContain('85%')
  })

  it('CONTROL: a measured 0 is a measurement — below the display floor, and never overridden by marginal', () => {
    seedRobustnessLens([
      {
        from_id: 'price',
        to_id: 'revenue',
        switch_probability: 0,
        marginal_switch_probability: 0.9,
        alternative_winner_label: 'Plan B',
      },
    ])
    render(<LensInfoPanel />)
    const panel = screen.getByTestId('lens-info-robustness')
    // Measured 0 <= 0.3 floor: not listed. The marginal 0.9 must not resurrect
    // it (that would prefer a substitute over a present measurement).
    expect(panel.textContent).not.toContain('90%')
    expect(panel.textContent).not.toContain('Price')
  })

  it('CONTROL: a measured edge below the floor stays unlisted; stability line unaffected', () => {
    seedRobustnessLens([
      {
        from_id: 'price',
        to_id: 'revenue',
        switch_probability: 0.2,
        alternative_winner_label: 'Plan B',
      },
    ])
    render(<LensInfoPanel />)
    const panel = screen.getByTestId('lens-info-robustness')
    expect(panel.textContent).toContain('Recommendation stability: 80%')
    expect(panel.textContent).not.toContain('20%')
  })
})
