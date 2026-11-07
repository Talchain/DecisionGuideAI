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

const real: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/strategy', 'growth-reveal.view3.json'), 'utf8'))
const none: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/v11', 'consulting-reveal.view3.json'), 'utf8'))
const byName = (n: string) => real.collab.shared.find((v) => v.by === n)!
const PRIYA = byName('Priya'), TOM = byName('Tom'), MAYA = byName('Maya')
const S = strategyOf(real)!

beforeEach(() => { useViewStore.setState({ uuid: '00000000-0000-4000-8000-bfb575be381c', sid: real.id, view: real, status: 'ready', error: null, stale: false, at: null }); useReveal.setState({ selected: null }) })
afterEach(() => cleanup())

describe('core’s strategy marks on the canvas (real View)', () => {
  it('one mark per card the revealed views speak to, in core’s words and kinds; none on a card nobody spoke to; none at all without the key', () => {
    expect(S.marks.map((m) => [m.card, m.kind, m.text])).toEqual([
      ['cross_team_adoption', 'disagreement', 'Priya, Tom and Maya differ'],
      ['speed_to_value', 'shared', 'Priya, Tom and Maya share a view'],
      ['implementation_effort', 'unique', 'Only Priya knew'],
    ])
    expect(strategyMarkOn(real, 'pilot_conversion')).toBeNull()
    expect(strategyOf(none)).toBeNull()
    expect(strategyMarkOn(none, 'time_to_contract')).toBeNull()
  })
  it('the chip shows the people’s initials and core’s sentence; selecting it opens the first person’s view; nothing renders without the key', () => {
    render(<StrategyChips card="cross_team_adoption" />)
    const chip = screen.getByTestId('strategy-chips-cross_team_adoption').querySelector('button') as HTMLElement
    expect(chip.querySelector('[data-strategy-chip-text]')).toHaveTextContent('Priya, Tom and Maya differ')
    expect(chip.getAttribute('data-strategy-kind')).toBe('disagreement')
    expect(chip.textContent!.startsWith('PTM')).toBe(true)
    fireEvent.click(chip)
    expect(useReveal.getState().selected).toBe(PRIYA.id)
    cleanup()
    useViewStore.setState({ view: none })
    const { container } = render(<StrategyChips card="time_to_contract" />)
    expect(container).toBeEmptyDOMElement()
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
    const claim = S.items.find((i) => i.kind === 'claim')!
    expect(claim.by).toBe('Priya')
    const claims = within(body).getByTestId('strategy-overview-claims')
    expect(within(claims).getByText(claim.text)).toBeInTheDocument()
    expect(claims.querySelector(`[data-strategy-line="${claim.id}"] [title="Priya"]`)).toHaveTextContent('P')
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
