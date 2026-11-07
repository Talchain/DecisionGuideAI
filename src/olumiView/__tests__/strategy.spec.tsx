/**
 * Strategy lane, slice 1 (7 Nov 2026): core's `strategy` key drawn on the canvas and in the dock. Bound by identity to a REAL View
 * (fixtures/strategy/growth-reveal.view3.json, olumi-core wip/strategy on the seeded growth-strategy case): view ids, card ids, member
 * names and core's exact words. A View without the key (the V11 consulting fixture) draws nothing of it.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { View } from '../client'
import { useViewStore } from '../store'
import { useReveal } from '../reveal'
import { strategyMarkOn, strategyOf, viewLinesOf } from '../strategy/strategy'
import { StrategyChips } from '../strategy/StrategyChips'
import { StrategyViewLines } from '../strategy/StrategyViewLines'
import { StrategyOverviewSection } from '../strategy/StrategyOverview'
import { CardViewChips } from '../RevealMarks'

const real: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/strategy', 'growth-reveal.view3.json'), 'utf8'))
const none: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/v11', 'consulting-reveal.view3.json'), 'utf8'))
const byName = (n: string) => real.collab.shared.find((v) => v.by === n)!
const PRIYA = byName('Priya'), TOM = byName('Tom'), MAYA = byName('Maya')
const S = strategyOf(real)!

beforeEach(() => { useViewStore.setState({ uuid: '00000000-0000-4000-8000-bfb575be381c', sid: real.id, view: real, status: 'ready', error: null, stale: false, at: null }); useReveal.setState({ selected: null }) })
afterEach(() => cleanup())

describe('core’s strategy marks on the canvas (real View)', () => {
  it('one mark per card the revealed views speak to, in core’s words and kinds (held positions differ; the same stance is said as what it is, never as agreement); none on a card nobody spoke to; none without the key', () => {
    expect(S.marks.map((m) => [m.card, m.kind, m.text])).toEqual([
      ['cross_team_adoption', 'disagreement', 'Priya and Tom differ'],
      ['speed_to_value', 'shared', 'Priya, Tom and Maya observed it'],
      ['implementation_effort', 'unique', 'Only Priya knew'],
    ])
    expect(strategyMarkOn(real, 'pilot_conversion')).toBeNull()
    expect(strategyOf(none)).toBeNull()
    expect(strategyMarkOn(none, 'time_to_contract')).toBeNull()
  })
  it('the chip shows the people’s initials and core’s sentence; selecting it opens the first person’s view; nothing renders without the key', () => {
    render(<StrategyChips card="cross_team_adoption" />)
    const chip = screen.getByTestId('strategy-chips-cross_team_adoption').querySelector('button') as HTMLElement
    // Maya is unsure, which is not a position: she is neither a party to the disagreement nor an initial on its chip.
    expect(chip.querySelector('[data-strategy-chip-text]')).toHaveTextContent('Priya and Tom differ')
    expect(chip.getAttribute('data-strategy-kind')).toBe('disagreement')
    expect(chip.textContent!.startsWith('PT')).toBe(true)
    expect(chip.textContent!.startsWith('PTM')).toBe(false)
    fireEvent.click(chip)
    expect(useReveal.getState().selected).toBe(PRIYA.id)
    cleanup()
    useViewStore.setState({ view: none })
    const { container } = render(<StrategyChips card="time_to_contract" />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('core’s own reveal marks the views (served View, olumi-core wip/strategy-n1 297e0c15)', () => {
  // On the debate lane's base, core's collab.marks carries the words-only marks itself: V11's chip draws them, in its order, with the dock and
  // camera that follow; the strategy shim draws nothing, so no card has two chips for one mark.
  const n1: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/strategy', 'growth-reveal-n1.view3.json'), 'utf8'))
  it('the contested card’s chips are V11’s, disagreement first, in core’s words; the shim yields', () => {
    useViewStore.setState({ view: n1 })
    expect(strategyMarkOn(n1, 'cross_team_adoption')).toBeNull()
    expect(strategyMarkOn(n1, 'speed_to_value')).toBeNull()
    const { container } = render(<StrategyChips card="cross_team_adoption" />)
    expect(container).toBeEmptyDOMElement()
    cleanup()
    render(<CardViewChips card="cross_team_adoption" />)
    const chips = [...screen.getByTestId('reveal-chips-cross_team_adoption').querySelectorAll('[data-reveal-card-chip]')]
    expect(chips.map((c) => [c.getAttribute('data-reveal-kind'), c.querySelector('[data-reveal-chip-text]')?.textContent])).toEqual([['disagreement', 'Priya and Tom differ'], ['evidence', 'Maya added evidence']])
    cleanup()
    render(<CardViewChips card="speed_to_value" />)
    expect(screen.getByTestId('reveal-chips-speed_to_value').querySelector('[data-reveal-chip-text]')).toHaveTextContent('Priya, Tom and Maya observed it')
  })
})

describe('a person’s qualitative views in the dock (real View)', () => {
  it('Priya’s block carries core’s pill and the card’s name per view, in core’s order; Tom’s pill without a source is the stance word alone', () => {
    expect(viewLinesOf(real, PRIYA.id).map((l) => [l.about.id, l.pill])).toEqual([['cross_team_adoption', 'Observed, two rollouts'], ['speed_to_value', 'Observed, two rollouts'], ['implementation_effort', 'Observed, two rollouts']])
    render(<StrategyViewLines view={real} v={PRIYA} />)
    const lines = screen.getByTestId(`strategy-view-lines-${PRIYA.id}`)
    expect(within(lines).getByTestId(`strategy-pill-${PRIYA.id}-cross_team_adoption`)).toHaveTextContent('Observed, two rollouts')
    expect(lines).toHaveTextContent('Cross-team adoption')
    // Her words for the card she led with are the view's words already shown above her block: not repeated; her other card's words are.
    expect(lines).not.toHaveTextContent('It took two quarters.')
    expect(lines).toHaveTextContent('Integration took a quarter each time.')
    cleanup()
    render(<StrategyViewLines view={real} v={TOM} />)
    expect(screen.getByTestId(`strategy-pill-${TOM.id}-cross_team_adoption`)).toHaveTextContent(/^Expects$/)
    cleanup()
    render(<StrategyViewLines view={real} v={MAYA} />)
    expect(screen.getByTestId(`strategy-pill-${MAYA.id}-cross_team_adoption`)).toHaveTextContent(/^Unsure$/)
  })
})

describe('the strategy overview (real View)', () => {
  it('folded until opened; then core’s sections in order, each line a stored word with its holder; an empty section says so in core’s words; the gate under the aim', () => {
    render(<StrategyOverviewSection view={real} />)
    expect(screen.getByTestId('strategy-overview-toggle')).toHaveTextContent(S.overview.heading)
    expect(screen.queryByTestId('strategy-overview-body')).toBeNull()
    fireEvent.click(screen.getByTestId('strategy-overview-toggle'))
    const body = screen.getByTestId('strategy-overview-body')
    expect([...body.querySelectorAll('section')].map((s) => s.getAttribute('aria-label'))).toEqual(S.overview.sections.map((s) => s.heading))
    expect(S.overview.sections.map((s) => s.heading)).toEqual(['Question', 'Aim', 'Routes', 'Assumptions', 'Factors', 'Risks', 'Open questions', 'Commitments'])
    const assumption = S.items.find((i) => i.kind === 'assumption')!
    expect(assumption.by).toBe('Tom')
    const assumptions = within(body).getByTestId('strategy-overview-assumptions')
    expect(within(assumptions).getByText(assumption.text)).toBeInTheDocument()
    expect(assumptions.querySelector(`[data-strategy-line="${assumption.id}"] [data-strategy-pill]`)).toHaveTextContent('Untested')
    expect(assumptions.querySelector(`[data-strategy-line="${assumption.id}"] [title="Tom"]`)).toHaveTextContent('T')
    // A factor's pill is the reveal's mark sentence and its holders the mark's people, as core sends them.
    const factors = within(body).getByTestId('strategy-overview-factors')
    for (const m of S.marks) expect(factors.querySelector(`[data-strategy-line="${m.card}"] [data-strategy-pill]`)).toHaveTextContent(m.text)
    const commitments = within(body).getByTestId('strategy-overview-commitments')
    expect(S.overview.sections.find((s) => s.id === 'commitments')!.lines).toEqual([])
    expect(commitments).toHaveTextContent(S.overview.sections.find((s) => s.id === 'commitments')!.empty)
    expect(within(body).getByTestId('strategy-gate')).toHaveTextContent(S.gate.text)
    expect(S.gate.quantified).toBe(false)
    cleanup()
    const { container } = render(<StrategyOverviewSection view={none} />)
    expect(container).toBeEmptyDOMElement()
  })
})
