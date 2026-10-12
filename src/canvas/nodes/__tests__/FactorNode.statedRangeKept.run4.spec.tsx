/**
 * Run-4 judge B3 (DL 12 Oct, §7.3 witness row "a stated range kept, with any derived value identified"): hiring's user
 * said "between 20% and 30%" for non-development time. The stored model keeps that range (`observed_state.range`
 * {low 20, high 30, source 'user_override', meaning 'min_max'}) and the value 25 it derived, but the canvas card printed
 * only "25% of monthly team capacity". The card now also says the range is theirs: "20%–30% of monthly team capacity
 * (your range)", through the same formatter as the value line. The 25% stays, as the model's figure inside it.
 *
 * Node data: run-4 hiring reopen, `fac_capacity_used_for_non_development_tasks` (live/runs/2026-10-12T172858Z/hiring/
 * reopen.json, after.state.node_data; UI 616bbf21, CEE a770ce49), verbatim except the long source quote is shortened.
 * Capacity's missing range is CEE's (its stored model holds none) and is not tested here.
 * F UI check round 1 (DL 12 Oct, blocking): only a range the user AUTHORED (typed, or from their brief) is "your range";
 * a confirmed one (`user_confirmed`) is not. The negatives below keep the served 20–30 bounds so only the source differs.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { FactorNode } from '../FactorNode'
import { useCanvasStore } from '../../store'
import { resolveFactorStatedRangeOnCard, STATED_RANGE_YOURS } from '../shared/factorStatedRange'

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
const withRange = (range: Record<string, unknown> | undefined) =>
  ({ ...SERVED, observedState: { ...SERVED.observedState, range } })

function card(data: Record<string, unknown>, viewMode: 'standard' | 'detailed' = 'standard') {
  useCanvasStore.setState({ nodes: [{ id: ID, type: 'factor', position: { x: 0, y: 0 }, data }], edges: [], viewMode } as never)
  render(<ReactFlowProvider><FactorNode id={ID} type="factor" data={data as never} selected={false} isConnectable
    positionAbsoluteX={0} positionAbsoluteY={0} dragging={false} zIndex={0} deletable selectable draggable /></ReactFlowProvider>)
  return screen.getByTestId(`factor-stated-range-${ID}`)
}

describe('run 4 B3: the user\'s stated range is kept on the canvas card', () => {
  it('⭐ the served hiring factor says "20%–30% of monthly team capacity (your range)" beside its 25%', () => {
    const line = card(SERVED)
    expect(line).toHaveTextContent('20%–30% of monthly team capacity (your range)')
    expect(document.body.textContent).toContain('25')
  })

  it('in the Detailed view too', () => {
    expect(card(SERVED, 'detailed')).toHaveTextContent('20%–30% of monthly team capacity (your range)')
  })

  it('the words come from the owner: the same formatter as the value line, both ends', () => {
    expect(resolveFactorStatedRangeOnCard(SERVED)).toBe('20%–30% of monthly team capacity (your range)')
    const tickets = { label: 'Support capacity per additional specialist', category: 'external',
      observedState: { cap: 100, unit: 'tickets per week per specialist', value: 0.2, raw_value: 20, source: 'brief_extraction',
        range: { low: 10, high: 30, source: 'brief_extraction', meaning: 'min_max' } } }
    expect(resolveFactorStatedRangeOnCard(tickets)).toBe('10–30 tickets per week per specialist (your range)')
  })

  it('CONTRAST: a range Olumi chose is not "your range" (no line), with the served 20–30 bounds unchanged', () => {
    for (const source of ['cee_inference', 'inferred', 'cee_repair']) {
      expect(resolveFactorStatedRangeOnCard(withRange({ low: 20, high: 30, source, meaning: 'min_max' }))).toBeNull()
    }
  })

  // F UI check round 1 (DL 12 Oct, blocking): confirming a range does not make the user its author. Only a range they
  // typed, or one from their brief, is "your range".
  it('⭐ NEGATIVE: a CONFIRMED range (user_confirmed 20–30) is not "your range": no line, on the card either', () => {
    const confirmed = withRange({ low: 20, high: 30, source: 'user_confirmed', meaning: 'min_max' })
    expect(resolveFactorStatedRangeOnCard(confirmed)).toBeNull()
    useCanvasStore.setState({ nodes: [{ id: ID, type: 'factor', position: { x: 0, y: 0 }, data: confirmed }], edges: [] } as never)
    render(<ReactFlowProvider><FactorNode id={ID} type="factor" data={confirmed as never} selected={false} isConnectable
      positionAbsoluteX={0} positionAbsoluteY={0} dragging={false} zIndex={0} deletable selectable draggable /></ReactFlowProvider>)
    expect(screen.queryByTestId(`factor-stated-range-${ID}`)).toBeNull()
    expect(document.body.textContent).not.toContain(STATED_RANGE_YOURS)
  })

  it('NEGATIVE: other user-owned or adopted stamps that do not say the user wrote it get no line', () => {
    for (const range of [
      { low: 20, high: 30, source: 'user_assumption', meaning: 'min_max' },
      { low: 20, high: 30, source: 'user_assumption', meaning: 'min_max', reviewed_by_user: { intent: 'confirm' } },
      { low: 20, high: 30, source: 'panel_elicited', meaning: 'min_max' },
    ]) {
      expect(resolveFactorStatedRangeOnCard(withRange(range))).toBeNull()
    }
  })

  it('POSITIVE CONTROL: every authored stamp (typed, or from the brief) says the line, same words', () => {
    for (const source of ['user_override', 'user', 'user_edited', 'user_calibration', 'brief_extraction', 'explicit']) {
      expect(resolveFactorStatedRangeOnCard(withRange({ low: 20, high: 30, source, meaning: 'min_max' })), source)
        .toBe('20%–30% of monthly team capacity (your range)')
    }
  })

  it('CONTRAST: no range, a malformed range, or an unknown source says nothing', () => {
    for (const range of [undefined, { low: 20, source: 'user_override' }, { low: '20', high: 30, source: 'user_override' },
      { low: 20, high: Number.NaN, source: 'user_override' }, { low: 20, high: 30 }]) {
      expect(resolveFactorStatedRangeOnCard(withRange(range as never))).toBeNull()
    }
    useCanvasStore.setState({ nodes: [{ id: ID, type: 'factor', position: { x: 0, y: 0 }, data: withRange(undefined) }], edges: [] } as never)
    render(<ReactFlowProvider><FactorNode id={ID} type="factor" data={withRange(undefined) as never} selected={false} isConnectable
      positionAbsoluteX={0} positionAbsoluteY={0} dragging={false} zIndex={0} deletable selectable draggable /></ReactFlowProvider>)
    expect(screen.queryByTestId(`factor-stated-range-${ID}`)).toBeNull()
  })
})
