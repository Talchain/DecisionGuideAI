/**
 * Strategy Overview page (7 Nov 2026): the rows read from a REAL View (fixtures/strategy/growth-reveal.view3.json). Bound by identity:
 * card ids, item ids, people's names and the fixture's own mark sentences, read from the fixture and never retyped.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { View } from '../../../client'
import { StrategyOverviewPage } from '../StrategyOverviewPage'
import { useOverview } from '../useOverview'

const view: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/strategy', 'growth-reveal.view3.json'), 'utf8'))
const S = view.strategy!
const cards = view.model!.cards
const ids = (family: string) => cards.filter((c) => c.family === family).map((c) => c.id)
const evidenceMark = view.collab.marks!.find((m) => m.kind === 'evidence')!
const AIM_FIGURES = ['arr_target', 'arr_2027']
const FACTORS = ids('quantity').filter((id) => !AIM_FIGURES.includes(id))

afterEach(() => cleanup())

const group = (name: string) => within(screen.getByRole('region', { name }))
const rowIds = (name: string) => group(name).queryAllByRole('listitem').map((r) => r.getAttribute('data-row'))
const row = (id: string) => document.querySelector(`[data-row="${id}"]`) as HTMLElement
const pillOf = (id: string) => within(row(id)).getByTestId('pill').textContent
const holdersOf = (id: string) => within(row(id)).getAllByTestId('holder').map((h) => h.getAttribute('aria-label'))

describe('Strategy Overview page (real View)', () => {
  it('each group lists the right ids in order', () => {
    render(<StrategyOverviewPage view={view} onClose={() => {}} />)
    expect(rowIds('Question')).toEqual(['question'])
    expect(rowIds('Aim')).toEqual(ids('goal'))
    expect(rowIds('Routes')).toEqual(ids('option'))
    expect(rowIds('Assumptions')).toEqual(S.items.filter((i) => i.kind === 'assumption').map((i) => i.id))
    expect(rowIds('Factors')).toEqual(FACTORS)
    expect(FACTORS).not.toContain('arr_target')
    expect(rowIds('Risks')).toEqual(ids('risk'))
    expect(rowIds('Open questions')).toEqual(S.items.filter((i) => i.kind === 'question').map((i) => i.id))
    expect(group('Routes').getByTestId('count')).toHaveTextContent(String(ids('option').length))
    expect(group('Factors').getByTestId('count')).toHaveTextContent(String(FACTORS.length))
  })

  it('the question and the aim read the model; the pills are the fixture’s own sentences, in the order mark, evidence, brief', () => {
    render(<StrategyOverviewPage view={view} onClose={() => {}} />)
    expect(row('question')).toHaveTextContent(view.model!.question.text)
    expect(row(ids('goal')[0])).toHaveTextContent(cards.find((c) => c.family === 'goal')!.heading)
    for (const m of S.marks) expect(pillOf(m.card)).toBe(m.text)
    expect(pillOf('cross_team_adoption')).not.toBe(evidenceMark.text)
    expect(evidenceMark.card).toBe('cross_team_adoption')
    expect(pillOf('pilot_conversion')).toBe('From the brief')
    for (const id of [...ids('option'), ...ids('risk')]) expect(pillOf(id)).toBe('From the brief')
    expect(pillOf(S.items.find((i) => i.kind === 'assumption')!.id)).toBe('Untested')
    expect(pillOf(S.items.find((i) => i.kind === 'question')!.id)).toBe(S.items.find((i) => i.kind === 'question')!.kind_text)
  })

  it('holders are the mark’s people, else the brief’s author; an item’s holder is its by', () => {
    render(<StrategyOverviewPage view={view} onClose={() => {}} />)
    for (const m of S.marks) expect(holdersOf(m.card)).toEqual(m.people.map((p) => p.name))
    expect(holdersOf('pilot_conversion')).toEqual([view.members[0].name])
    for (const i of S.items.filter((x) => x.kind === 'assumption' || x.kind === 'question')) expect(holdersOf(i.id)).toEqual([i.by])
  })

  it('Olumi’s own question says so; a missing strategy key draws no rows but the page stays honest', () => {
    const olumi = { ...view, strategy: { ...S, items: [{ ...S.items.find((i) => i.kind === 'question')!, id: 'iq', by: 'Olumi' }] } } as View
    render(<StrategyOverviewPage view={olumi} onClose={() => {}} />)
    expect(pillOf('iq')).toBe('Olumi asks')
    expect(holdersOf('iq')).toEqual(['Olumi'])
    cleanup()
    const none = { ...view, strategy: undefined } as View
    render(<StrategyOverviewPage view={none} onClose={() => {}} />)
    expect(rowIds('Assumptions')).toEqual([])
    expect(rowIds('Routes')).toEqual(ids('option'))
  })

  it('Commitments shows the empty sentence; Close calls onClose; the store opens and closes', () => {
    const onClose = vi.fn()
    render(<StrategyOverviewPage view={view} onClose={onClose} />)
    expect(view.collab.commitments).toEqual([])
    expect(group('Commitments').getByText('No commitments recorded yet.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(useOverview.getState().open).toBe(false)
    useOverview.getState().show(); expect(useOverview.getState().open).toBe(true)
    useOverview.getState().hide(); expect(useOverview.getState().open).toBe(false)
  })

  it('says no best, winner, recommendation, confidence or percentage', () => {
    const { container } = render(<StrategyOverviewPage view={view} onClose={() => {}} />)
    const text = container.textContent ?? ''
    expect(text).toContain('Overview')
    expect(text).not.toMatch(/best|winner|recommend|confidence|%/i)
  })
})
