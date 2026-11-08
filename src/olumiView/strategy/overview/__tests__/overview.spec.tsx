/**
 * Strategy Overview page (7 Nov 2026): core's `strategy.overview.sections` drawn as the approved board's two columns, read from a REAL View
 * (fixtures/strategy/growth-reveal.view3.json). Bound by identity: section ids and headings, line ids, the fixture's own pills and holders,
 * read from the fixture and never retyped. The page makes no word of its own beyond "Close"; its heading is core's.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { View } from '../../../client'
import { StrategyOverviewPage } from '../StrategyOverviewPage'
import { overviewOf } from '../overview'
import { useOverview } from '../useOverview'

const view: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/strategy', 'growth-reveal.view3.json'), 'utf8'))
const S = view.strategy!
const section = (id: string) => S.overview.sections.find((s) => s.id === id)!

afterEach(() => cleanup())

const group = (name: string) => within(screen.getByRole('region', { name }))
const rowIds = (name: string) => group(name).queryAllByRole('listitem').map((r) => r.getAttribute('data-row'))
const row = (id: string) => document.querySelector(`[data-row="${id}"]`) as HTMLElement
const pillOf = (id: string) => within(row(id)).queryByTestId('pill')?.textContent ?? ''
const holdersOf = (id: string) => within(row(id)).queryAllByTestId('holder').map((h) => h.getAttribute('aria-label'))

describe('Strategy Overview page (real View, core’s sections)', () => {
  it('draws core’s eight groups in the board’s order, each line by id, with core’s pill and holders; counts where the board counts', () => {
    render(<StrategyOverviewPage view={view} onClose={() => {}} />)
    expect(S.overview.sections.map((s) => s.heading)).toEqual(['Question', 'Aim', 'Routes', 'Assumptions', 'Factors', 'Risks', 'Open questions', 'Commitments'])
    for (const s of S.overview.sections) {
      expect(rowIds(s.heading)).toEqual(s.lines.map((l) => l.id))
      for (const l of s.lines) { expect(pillOf(l.id)).toBe(l.pill ?? ''); expect(holdersOf(l.id)).toEqual(l.people.map((p) => p.name)); expect(row(l.id)).toHaveTextContent(l.text) }
    }
    for (const id of ['routes', 'factors']) expect(group(section(id).heading).getByTestId('count')).toHaveTextContent(String(section(id).lines.length))
    // The fixture's own facts, so a wrong producer cannot pass: the three marks are the factors' pills; Olumi holds what it inferred.
    expect(S.marks.length).toBe(3)
    for (const m of S.marks) { expect(pillOf(m.card)).toBe(m.text); expect(holdersOf(m.card)).toEqual(m.people.map((p) => p.name)) }
    expect(pillOf('pilot_conversion')).toBe('Olumi inferred'); expect(holdersOf('pilot_conversion')).toEqual(['Olumi'])
    const assumption = S.items.find((i) => i.kind === 'assumption')!
    expect(pillOf(assumption.id)).toBe('Untested'); expect(holdersOf(assumption.id)).toEqual([assumption.by])
  })

  it('an Olumi-asked question is core’s pill with Olumi as holder; without the key the page has no rows', () => {
    const q = section('questions')
    const olumi = { ...view, strategy: { ...S, overview: { ...S.overview, sections: S.overview.sections.map((s) => (s.id !== 'questions' ? s : { ...s, lines: [...s.lines, { ...q.lines[0]!, id: 'olumi-question:1', text: 'Fixture: what did the two pilot teams actually do?', pill: 'Olumi asks', people: [{ id: 'olumi', name: 'Olumi' }], by: 'Olumi', by_id: 'olumi' }] })) } } } as View
    render(<StrategyOverviewPage view={olumi} onClose={() => {}} />)
    expect(pillOf('olumi-question:1')).toBe('Olumi asks')
    expect(holdersOf('olumi-question:1')).toEqual(['Olumi'])
    cleanup()
    expect(overviewOf({ ...view, strategy: undefined } as View)).toEqual([])
    render(<StrategyOverviewPage view={{ ...view, strategy: undefined } as View} onClose={() => {}} />)
    expect(document.querySelectorAll('[data-row]')).toHaveLength(0)
  })

  it('Commitments shows core’s empty sentence; Close calls onClose; the store opens and closes', () => {
    const onClose = vi.fn()
    render(<StrategyOverviewPage view={view} onClose={onClose} />)
    expect(section('commitments').lines).toEqual([])
    expect(group('Commitments').getByText(section('commitments').empty)).toBeInTheDocument()
    expect(section('commitments').empty).toBe('No commitments recorded yet.')
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(useOverview.getState().open).toBe(false)
    useOverview.getState().show(); expect(useOverview.getState().open).toBe(true)
    useOverview.getState().hide(); expect(useOverview.getState().open).toBe(false)
  })

  it('says no best, winner, recommendation, confidence or percentage, with a contrast that finds a served pill', () => {
    const { container } = render(<StrategyOverviewPage view={view} onClose={() => {}} />)
    const text = container.textContent ?? ''
    expect(text).toContain(view.strategy!.overview.heading) // core's heading, not the page's own word
    expect(text).toContain('From the brief')
    expect(text).not.toMatch(/best|winner|recommend|confidence|%/i)
  })
})
