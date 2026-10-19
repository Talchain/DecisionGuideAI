/**
 * LensInfoPanel "What would change" fragile list — switch_probability presence pins (the retired Robustness lens's
 * list, merged into "What would change" on 18 Oct 2026 with the same presence branch).
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
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LensInfoPanel } from '../LensInfoPanel'
import { useCanvasStore } from '../../store'

// The Run stage the action registry reads; real elsewhere, set per row in the "If it failed" block.
let mockStage: string | null = null
vi.mock('../../conversation/askAi', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../conversation/askAi')>()
  return { ...real, askAiStage: (state?: never) => (mockStage ?? real.askAiStage(state)) as never }
})

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
      active: 'what_changes',
    },
  } as never)
}

describe('LensInfoPanel "What would change" list — presence-branch on measured switch_probability', () => {
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

  // #2747 re-scope 2 (DL ruling): fragile links say their label only in C (no switch figure), so the em dash that stood in
  // the figure's slot is gone with the slot; the row's label and no-number negatives are kept.
  it('PIN: a marginal-only fragile edge is listed WITHOUT a percentage', () => {
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
    // The marginal 0.9 never becomes a number (#2747 re-scope 2: nor does the measured 40%, not shown in C).
    expect(text).not.toContain('40%')
    expect(text).not.toContain('90%')
    // Measured sorts first: the measured row's label precedes the marginal row's.
    expect(text.indexOf('Demand')).toBeGreaterThan(-1)
    expect(text.indexOf('Demand')).toBeLessThan(text.indexOf('Price'))
    // The "focus on" coaching names the measured edge, not the marginal one.
    expect(text).toContain('focus on: Demand → Margin')
  })

  // #2747 re-scope 2 (DL ruling, pre-accepted): row deleted — "CONTROL: a measured switch_probability renders its
  // percentage". Its only subject, the switch figure, is not shown in C (interim limit: restore via a CEE-served, licensed
  // robustness string, post-C). Census row: canvas robustness lens panel.

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

  it('CONTROL: a measured edge below the floor stays unlisted', () => {
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
    // POSITIVE CONTROL: the panel rendered its surviving sentence, so the
    // absence assertions below are not about a panel that failed to mount.
    expect(panel.textContent).toContain('These describe this model as it stands, not what to choose.')
    expect(panel.textContent).not.toContain('20%')
  })

  /**
   * ROADMAP 2.1273 — the `"Recommendation stability: {N}%."` sentence is GONE.
   *
   * ⚠ The seeded report in `seedRobustnessLens` still sets
   * `recommendation_stability: 0.8`, and that is DELIBERATE: it is exactly the
   * legacy hydrated payload the removal defends against, so this assertion
   * proves the sentence cannot render for a value that IS PRESENT — not merely
   * that it is suppressed when absent (which every fresh run already gives).
   * PLoT withholds the field because it is the leading option's
   * `win_probability` relabelled; see `../LensInfoPanel.tsx`.
   */
  it('never renders the withheld "Recommendation stability" claim, even with a legacy value seeded', () => {
    seedRobustnessLens([
      {
        from_id: 'price',
        to_id: 'revenue',
        switch_probability: 0.9,
        alternative_winner_label: 'Plan B',
      },
    ])
    render(<LensInfoPanel />)
    const panel = screen.getByTestId('lens-info-robustness')
    // POSITIVE CONTROLS: the panel is mounted and populated — the heading, the
    // surviving sentence, and the measured fragile edge (its label; #2747 re-scope 2: no switch figure in C) all render.
    expect(screen.getByTestId('lens-info-heading').textContent).toBe('What would change')
    expect(panel.textContent).toContain('These describe this model as it stands, not what to choose.')
    expect(panel.textContent).toContain('Price → Revenue')
    // The claim, and the figure it would have printed (0.8 → "80%"), are absent.
    expect(panel.textContent).not.toContain('Recommendation stability')
    expect(panel.textContent).not.toContain('80%')
  })
})

describe('"If it failed" offers its ask only where a worksheet can come back', () => {
  beforeEach(() => {
    localStorage.setItem('feature.graphLens', '1')
    useCanvasStore.setState({
      nodes: [{ id: 'o1', type: 'option', data: { label: 'Hire' }, position: { x: 0, y: 0 } }] as never,
      lens: { ...useCanvasStore.getState().lens, active: 'premortem' },
    } as never)
  })
  afterEach(() => {
    mockStage = null
    localStorage.removeItem('feature.graphLens')
    useCanvasStore.setState({ nodes: [] as never, lens: { ...useCanvasStore.getState().lens, active: 'full' } } as never)
  })

  it('before a Run there is no pre-mortem press, so it says why and offers no ask (staging fe4e4b9d: prose, no worksheet)', () => {
    mockStage = 'drafted'
    render(<LensInfoPanel />)
    expect(screen.getByTestId('premortem-needs-run').textContent).toContain('Run the analysis')
    expect(screen.queryByTestId('premortem-ask')).toBeNull()
  })

  it('CONTRAST: on a current Run the ask is offered', () => {
    mockStage = 'ran-current'
    render(<LensInfoPanel />)
    expect(screen.getByTestId('premortem-ask')).toBeTruthy()
    expect(screen.queryByTestId('premortem-needs-run')).toBeNull()
  })
})

describe('"What would change" says when fragile links were not checked', () => {
  beforeEach(() => localStorage.setItem('feature.graphLens', '1'))
  afterEach(() => {
    localStorage.removeItem('feature.graphLens')
    useCanvasStore.setState({ results: { status: 'idle', progress: 0 } as never, nodes: [] as never, lens: { ...useCanvasStore.getState().lens, active: 'full' } } as never)
  })

  it('robustness not_assessed: says not checked, never "measured nothing" (staging fe4e4b9d: the lens was silent)', () => {
    seedRobustnessLens([])
    const report = useCanvasStore.getState().results.report as unknown as Record<string, unknown>
    useCanvasStore.setState({ results: { ...useCanvasStore.getState().results, report: { ...report, robustness: { display_verdict: 'not_assessed', fragile_edges: [] } } } as never })
    render(<LensInfoPanel />)
    expect(screen.getByTestId('lens-key-fragile-not-checked').textContent).toBe("Fragile links weren't checked on this Run.")
    expect(screen.getByTestId('lens-info-robustness').textContent).not.toContain('measured nothing')
  })

  it('CONTRAST: an assessed Run with no fragile links does not say "not checked"', () => {
    seedRobustnessLens([])
    render(<LensInfoPanel />)
    expect(screen.queryByTestId('lens-key-fragile-not-checked')).toBeNull()
    expect(screen.getByTestId('lens-info-robustness').textContent).toContain('measured nothing')
  })
})
