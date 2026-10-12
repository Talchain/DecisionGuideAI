/**
 * DL ruling (12 Oct, after run 5; AIE #94 6132247742): the canvas card shows a factor's STORED bounds
 * (`observed_state.range`) neutrally — "Range: 20%–30% of monthly team capacity" — whatever the range's source. No
 * "your range" (CEE cannot yet prove the user wrote it: a confirmed consultant range is stamped `user_override`,
 * independent check round 2 on #2748) and no Olumi label (a range with no human evidence is not thereby Olumi's).
 * The line is drawn only where the card's prior-range line is not, so one card never states two ranges.
 *
 * Node data: run-4 hiring reopen, `fac_capacity_used_for_non_development_tasks` (live/runs/2026-10-12T172858Z/hiring/
 * reopen.json, after.state.node_data; UI 616bbf21, CEE a770ce49), verbatim except the long source quote is shortened.
 * Only `range.source` varies across the human / confirmed / AI rows. The prior rows add a `prior` in the shape the
 * card's prior-range line reads (FactorNode.boundedAnatomy.spec's RANGE_* fixtures).
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { FactorNode } from '../FactorNode'
import { useCanvasStore } from '../../store'

vi.mock('@xyflow/react', async () => ({ ...await vi.importActual<Record<string, unknown>>('@xyflow/react'), Handle: () => null }))
afterEach(() => { cleanup(); useCanvasStore.setState({ nodes: [], edges: [] } as never) })

const ID = 'fac_capacity_used_for_non_development_tasks'
const SERVED = {
  ref: 'F7', category: 'external', label: 'Capacity used for non-development tasks', kind: 'factor',
  observedState: {
    cap: 100, unit: '% of monthly team capacity',
    range: { low: 20, high: 30, source: 'user_override', meaning: 'min_max',
      source_quote: 'currently they spend between 20% and 30% of their time on non-development tasks' },
    value: 0.25, source: 'user_override', raw_value: 25, declared_scale: 'unit_interval', extractionType: 'explicit',
  },
}
const NEUTRAL = 'Range: 20%–30% of monthly team capacity'
const withRangeSource = (source: string) =>
  ({ ...SERVED, observedState: { ...SERVED.observedState, range: { ...SERVED.observedState.range, source } } })
const withRange = (range: unknown) => ({ ...SERVED, observedState: { ...SERVED.observedState, range } })
const withPrior = (rangeMin: number, rangeMax: number) =>
  ({ ...SERVED, prior: { distribution: 'uniform', range_min: rangeMin, range_max: rangeMax } })

function card(data: Record<string, unknown>, viewMode: 'standard' | 'detailed' = 'standard') {
  useCanvasStore.setState({ nodes: [{ id: ID, type: 'factor', position: { x: 0, y: 0 }, data }], edges: [], viewMode } as never)
  const { container } = render(<ReactFlowProvider><FactorNode id={ID} type="factor" data={data as never} selected={false}
    isConnectable positionAbsoluteX={0} positionAbsoluteY={0} dragging={false} zIndex={0} deletable selectable draggable />
  </ReactFlowProvider>)
  return container
}

describe('the stored range is said neutrally on the canvas card', () => {
  it.each([
    ['human (user_override)', 'user_override'],
    ['confirmed (user_confirmed)', 'user_confirmed'],
    ['AI (cee_inference)', 'cee_inference'],
  ] as const)('⭐ %s: "Range: 20%%–30%% of monthly team capacity", the same words, no attribution', (_n, source) => {
    for (const viewMode of ['standard', 'detailed'] as const) {
      const container = card(withRangeSource(source), viewMode)
      expect(screen.getByTestId(`factor-stored-range-${ID}`).textContent).toBe(NEUTRAL)
      expect(container.textContent).not.toContain('your range')
      expect(screen.getByTestId(`factor-stored-range-${ID}`).textContent).not.toMatch(/olumi|estimate|yours?\b/i)
      // The 25% stays the card's value; the range sits beside it.
      expect(container.textContent).toContain('25')
      cleanup()
    }
  })

  it('CONTRAST: no range, a malformed range, or one missing an end draws no line', () => {
    for (const range of [undefined, { low: 20, source: 'user_override' }, { low: '20', high: 30, source: 'user_override' },
      { low: 20, high: Number.NaN, source: 'user_override' }]) {
      card(withRange(range))
      expect(screen.queryByTestId(`factor-stored-range-${ID}`)).toBeNull()
      cleanup()
    }
  })
})

describe('one card never states two ranges: where the prior-range line is drawn, the stored line is not', () => {
  it('a prior with the SAME bounds: only the prior-range line', () => {
    for (const viewMode of ['standard', 'detailed'] as const) {
      card(withPrior(0.2, 0.3), viewMode)
      expect(screen.getByTestId(`factor-prior-range-${ID}`).textContent)
        .toBe('Your value replaces the range 20 % of monthly team capacity to 30 % of monthly team capacity')
      expect(screen.queryByTestId(`factor-stored-range-${ID}`)).toBeNull()
      cleanup()
    }
  })

  // ⚠ KNOWN RESIDUAL (DL ruling): where both are present with DIFFERENT numbers, the card states only the prior-range line,
  // so the stored 20–30 bounds are HIDDEN, not absent. This row records exactly what renders: the prior line, in its own
  // existing words (the value's `user_override` stamp makes it "Your value replaces the range …"; unchanged here).
  it('KNOWN RESIDUAL — a prior with DIFFERENT bounds (10–50 vs stored 20–30): only the prior line renders', () => {
    for (const viewMode of ['standard', 'detailed'] as const) {
      const container = card(withPrior(0.1, 0.5), viewMode)
      expect(screen.getByTestId(`factor-prior-range-${ID}`).textContent)
        .toBe('Your value replaces the range 10 % of monthly team capacity to 50 % of monthly team capacity')
      expect(screen.queryByTestId(`factor-stored-range-${ID}`)).toBeNull()
      expect(container.textContent).not.toContain('20%–30%')
      cleanup()
    }
  })
})
