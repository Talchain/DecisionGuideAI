/** The saved model's aims that the analysis does not include yet: listed by id, never hidden, never on the engine graph. */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { otherAimLinkWords, otherAimsOf, otherAimSourceWords } from '../otherAims'
import { OtherAimCard } from '../../OtherAimsLayer'

/** A SYNTHETIC core graph: one analysed goal on the canvas, three more aims only in the living model. */
const graph = () => ({
  nodes: [
    { id: 'decision_1', kind: 'decision', label: 'Courier choice' },
    { id: 'on_time', kind: 'goal', label: 'Deliveries on time' },
    { id: 'switch_courier', kind: 'option', label: 'Switch courier' },
    { id: 'add_tracking', kind: 'option', label: 'Add live tracking' },
  ],
  edges: [],
  living_model: {
    aims: [
      { id: 'on_time', text: 'Deliveries on time', source: 'user', status: 'current' },
      { id: 'goodwill', text: 'Keep customer goodwill', source: 'user', status: 'current' },
      { id: 'refund_volume', text: 'Fewer refunds', source: 'olumi', status: 'later' },
      { id: 'cost_cap', text: 'Stay under the cost cap', source: 'party', party: 'Sam', status: 'current' },
      { id: 'dropped_aim', text: 'Open a second depot', source: 'user', status: 'withdrawn' },
    ],
    options: [{ id: 'switch_courier', label: 'Switch courier' }, { id: 'add_tracking', label: 'Add live tracking' }],
    factors: [],
    links: [
      { id: 'l1', from: 'switch_courier', to: 'goodwill' },
      { id: 'l2', from: 'add_tracking', to: 'goodwill' },
      { id: 'l3', from: 'switch_courier', to: 'on_time' },
    ],
  },
})

describe('otherAimsOf', () => {
  it('lists every aim that is not a node, by id, in the model\'s order (only the analysed goal excluded; a withdrawn aim is kept)', () => {
    expect(otherAimsOf(graph()).map((a) => [a.id, a.status])).toEqual([['goodwill', 'current'], ['refund_volume', 'later'], ['cost_cap', 'current'], ['dropped_aim', 'withdrawn']])
  })

  it('keeps each aim\'s own words, source and the labels the model links into it', () => {
    const [goodwill, refunds, cap] = otherAimsOf(graph())
    expect(goodwill).toEqual({ id: 'goodwill', text: 'Keep customer goodwill', source: 'user', party: null, linkedFrom: ['Switch courier', 'Add live tracking'], allOptionsCount: 2, status: 'current' })
    expect(refunds).toMatchObject({ id: 'refund_volume', source: 'olumi', linkedFrom: [] })
    expect(cap).toMatchObject({ id: 'cost_cap', source: 'party', party: 'Sam' })
  })

  it('CONTRAST: a graph with no living model (legacy) has no other aims; neither does a model whose every aim is on the canvas', () => {
    const { living_model: _lm, ...legacy } = graph()
    expect(otherAimsOf(legacy)).toEqual([])
    const g = graph()
    g.living_model.aims = [g.living_model.aims[0]]
    expect(otherAimsOf(g)).toEqual([])
  })

  it('says "both options" only when exactly the options link in and the canvas shows those same options; otherwise the names', () => {
    expect(otherAimLinkWords(otherAimsOf(graph())[0])).toBe('Linked from both options')
    expect(otherAimLinkWords({ linkedFrom: ['A', 'B', 'C'], allOptionsCount: 3 })).toBe('Linked from all 3 options')
    expect(otherAimLinkWords({ linkedFrom: [], allOptionsCount: null })).toBeNull()
  })

  it('Codex R4: a factor sharing an option\'s label, or an option card the living model lacks, falls back to the names', () => {
    const withFactor = graph()
    withFactor.living_model.factors = [{ id: 'f_switch', label: 'Switch courier' }] as never
    withFactor.living_model.links.push({ id: 'l4', from: 'f_switch', to: 'goodwill' })
    expect(otherAimsOf(withFactor)[0].allOptionsCount).toBeNull()
    const extraCanvasOption = graph()
    extraCanvasOption.nodes.push({ id: 'third_way', kind: 'option', label: 'Hire drivers' })
    expect(otherAimsOf(extraCanvasOption)[0].allOptionsCount).toBeNull()
    expect(otherAimLinkWords(otherAimsOf(extraCanvasOption)[0])).toBe('Linked from Switch courier, Add live tracking')
  })

  it('names who each aim came from in the canvas\'s provenance words', () => {
    expect(['user', 'olumi', 'unverified'].map((source) => otherAimSourceWords({ source: source as never, party: null }))).toEqual(['Yours', 'Olumi’s', 'Source not confirmed'])
    expect(otherAimSourceWords({ source: 'party', party: 'Sam' })).toBe('From Sam')
  })
})

describe('OtherAimCard', () => {
  it('shows the aim, "Not in this analysis yet", its source and what links into it, bound to the aim id', () => {
    const [goodwill] = otherAimsOf(graph())
    render(<OtherAimCard aim={goodwill} />)
    const card = screen.getByTestId('other-aim-goodwill')
    expect(card.getAttribute('data-aim-id')).toBe('goodwill')
    expect(card.textContent).toContain('Keep customer goodwill')
    expect(screen.getByTestId('other-aim-goodwill-status').textContent).toBe('Not in this analysis yet')
    expect(screen.getByTestId('other-aim-goodwill-source').textContent).toBe('Yours')
    expect(screen.getByTestId('other-aim-goodwill-links').textContent).toBe('Linked from both options')
  })

  it('a withdrawn aim is shown and says so, never "not in this analysis yet"', () => {
    const dropped = otherAimsOf(graph()).find((a) => a.id === 'dropped_aim')!
    render(<OtherAimCard aim={dropped} />)
    expect(screen.getByTestId('other-aim-dropped_aim-status').textContent).toBe('Withdrawn')
  })

  it('an Olumi aim says so, and an aim nothing links into shows no links line', () => {
    const [, refunds] = otherAimsOf(graph())
    render(<OtherAimCard aim={refunds} />)
    expect(screen.getByTestId('other-aim-refund_volume-source').textContent).toBe('Olumi’s')
    expect(screen.queryByTestId('other-aim-refund_volume-links')).toBeNull()
  })
})
