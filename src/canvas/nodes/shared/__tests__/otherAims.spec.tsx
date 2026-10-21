/** The saved model's aims that the analysis does not include yet: listed by id, never hidden, never on the engine graph. */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { otherAimLinkWords, otherAimsOf, otherAimSourceWords } from '../otherAims'
import { OtherAimRow, OtherAimsList } from '../GoalOtherAims'

vi.mock('../../../../lib/supabase', () => ({ getSessionIdentity: vi.fn(async () => ({ userId: null, accessToken: null })) }))

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
    expect(otherAimLinkWords(otherAimsOf(graph())[0])).toBe('linked from both options')
    expect(otherAimLinkWords({ linkedFrom: ['A', 'B', 'C'], allOptionsCount: 3 })).toBe('linked from all 3 options')
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
    expect(otherAimLinkWords(otherAimsOf(extraCanvasOption)[0])).toBe('linked from Switch courier, Add live tracking')
  })

  it('names who each aim came from in the canvas\'s provenance words', () => {
    expect(['user', 'olumi', 'unverified'].map((source) => otherAimSourceWords({ source: source as never, party: null }))).toEqual(['Yours', 'Olumi’s', 'Source not confirmed'])
    expect(otherAimSourceWords({ source: 'party', party: 'Sam' })).toBe('From Sam')
  })
})

describe('OtherAimsList (on the goal card)', () => {
  it('heads the rows "Also in your model · not in this analysis yet" and shows each aim, its source and what links in, bound to the aim id', () => {
    render(<OtherAimsList aims={otherAimsOf(graph())} />)
    expect(screen.getByTestId('goal-other-aims').textContent).toContain('Also in your model · not in this analysis yet')
    const row = screen.getByTestId('other-aim-goodwill')
    expect(row.getAttribute('data-aim-id')).toBe('goodwill')
    expect(row.textContent).toBe('Keep customer goodwill ·  Yours · linked from both options')
    expect(screen.getByTestId('other-aim-goodwill-source').textContent).toBe(' ·  Yours')
    expect(screen.getAllByRole('listitem').map((li) => li.getAttribute('data-aim-id'))).toEqual(['goodwill', 'refund_volume', 'cost_cap', 'dropped_aim'])
  })

  it('a withdrawn aim is shown and says so; an Olumi aim says so; an aim nothing links into shows no links words', () => {
    const aims = otherAimsOf(graph())
    render(<ul>{aims.map((a) => <OtherAimRow key={a.id} aim={a} />)}</ul>)
    expect(screen.getByTestId('other-aim-dropped_aim-status').textContent).toBe(' · Withdrawn')
    expect(screen.queryByTestId('other-aim-goodwill-status')).toBeNull()
    expect(screen.getByTestId('other-aim-refund_volume-source').textContent).toBe(' ·  Olumi’s')
    expect(screen.queryByTestId('other-aim-refund_volume-links')).toBeNull()
  })

  it('CONTRAST: no other aims, no section', () => {
    const { container } = render(<OtherAimsList aims={[]} />)
    expect(container.innerHTML).toBe('')
  })
})

/**
 * ⭐ A RISK THE ANALYSIS LEAVES OUT IS LISTED, NEVER LOST (DL, Paul's brief 21 Oct). Core's mapper leaves a risk with no
 * chance out of the engine graph (mapper.ts:412), so it vanished from the canvas. It is now a row in the same section.
 */
describe('risks the analysis leaves out', () => {
  const withRisks = () => {
    const g = graph() as ReturnType<typeof graph> & { living_model: Record<string, unknown> }
    g.living_model.risks = [
      { id: 'vendor_delay', label: 'Vendor delays the launch', occurrence: { low: null, high: null }, source: 'user', party: null, quote: 'the vendor might slip' },
      { id: 'strike', label: 'Courier strike', occurrence: { low: 0.1, high: 0.2 }, source: 'party', party: 'Ops lead', quote: 'maybe 10-20%' },
      { id: 'on_canvas_risk', label: 'Already drawn', occurrence: { low: 0.1, high: 0.1 }, source: 'olumi', party: null, quote: null },
    ]
    ;(g.living_model.links as unknown[]).push({ id: 'l_r', from: 'vendor_delay', to: 'on_time' })
    g.nodes.push({ id: 'on_canvas_risk', kind: 'risk', label: 'Already drawn' })
    return g
  }
  it('⭐ each risk not on the canvas is a row, by id: whose it is, what it affects, and "chance needed" when nobody gave one', () => {
    const risks = otherAimsOf(withRisks()).filter((a) => a.risk)
    expect(risks.map((r) => [r.id, r.source, r.risk?.chanceNeeded, otherAimLinkWords(r)])).toEqual([
      ['vendor_delay', 'user', true, 'affects Deliveries on time'],
      ['strike', 'party', false, null],
    ])
    render(<ul>{risks.map((a) => <OtherAimRow key={a.id} aim={a} />)}</ul>)
    expect(screen.getByTestId('other-aim-vendor_delay-risk').textContent).toBe(' · Risk · chance needed')
    expect(screen.getByTestId('other-aim-strike-risk').textContent).toBe(' · Risk')
  })
  it('⛔ an aim is never labelled a risk; a risk already on the canvas is not listed again', () => {
    const all = otherAimsOf(withRisks())
    expect(all.filter((a) => !a.risk).every((a) => a.risk === undefined)).toBe(true)
    expect(all.map((a) => a.id)).not.toContain('on_canvas_risk')
  })
})
