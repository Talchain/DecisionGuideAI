/**
 * A4 (DL brief 10 Nov): the previous Reasoning tab's "Options side by side" matrix, fed by core's View through `coreViewToLegacy`.
 *
 * Fixtures are core 8d27d6758442e45a4eef47ef57b158a3cee9d3c6's goldens (`src/view/__tests__/golden/<name>.view3.json`), copied unedited:
 *  - studio: two aims, the lead aim's chance and fixed rows, the other aim's refusals; two options share one value string, so every cell is
 *    bound by its View path, never by its words;
 *  - app-launch: no chance anywhere, three shared reasons said once under the table;
 *  - bakery-asked: a refusal with its own words;
 *  - european: one goal and two limits per option, each its own value, so a cell drawn from another field (the headline) goes red.
 */
import '@testing-library/jest-dom/vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { View } from '../../client'
import { optionCards } from '../../layout'
import { DecisionMatrixTable } from '../../../components/results/analysisNew/sections/DecisionMatrix'
import { coreViewToLegacy } from '../coreViewToLegacy'

const viewOf = (n: string) => JSON.parse(readFileSync(path.resolve(`src/olumiView/legacy/__tests__/fixtures/a4-${n}.view3.json`), 'utf8')) as View
/** The string a View path names (`<card id>.rows.<i>.value`, `run.shared_blockers.<i>.text`). */
function at(view: View, p: string): unknown {
  const [head, ...rest] = p.split('.')
  let v: unknown = head === 'run' ? view.model!.run : view.model!.cards.find((c) => c.id === head)
  for (const k of rest) v = (v as Record<string, unknown>)[k]
  return v
}
const open = (view: View) => {
  render(<DecisionMatrixTable {...coreViewToLegacy(view).matrix!} />)
  fireEvent.click(screen.getByRole('button', { name: /Options side by side/ }))
}
afterEach(cleanup)

describe('coreViewToLegacy → DecisionMatrixTable (A4 proof)', () => {
  it.each([
    ['studio', ['takings_goal', 'keep_members']],
    ['european', ['reach_customer_target', 'investment_limit', 'proposed_churn_guardrail']],
  ])('%s: one row per compared option in core card order, one column per aim with the lead aim first, every cell core’s own string at its path', (name, expected) => {
    const view = viewOf(name)
    open(view)
    const rows = [...document.querySelectorAll('[data-testid^="decision-matrix-row-"]')].map((r) => r.getAttribute('data-testid')!.slice('decision-matrix-row-'.length))
    expect(rows).toEqual(optionCards(view.model!).map((c) => c.id))
    const aims = [...document.querySelectorAll('[data-testid^="decision-matrix-aim-"]')].map((h) => h.getAttribute('data-testid')!.slice('decision-matrix-aim-'.length))
    expect(aims).toEqual(expected)
    for (const card of optionCards(view.model!)) {
      card.rows.forEach((row, i) => {
        const cell = screen.getByTestId(`decision-matrix-chance-${card.id}-${row.aim_id}`)
        const p = `${card.id}.rows.${i}.${row.kind === 'none' ? 'text' : 'value'}`
        expect(cell.getAttribute('data-view')).toBe(p)
        expect(cell.querySelector('span')!.textContent).toBe(at(view, p))
      })
    }
    // Each heading is the option's own words, at its path.
    for (const card of optionCards(view.model!)) expect(screen.getByTestId(`decision-matrix-row-${card.id}`).querySelector(`[data-view="${card.id}.heading"]`)!.textContent).toBe(card.heading)
  })

  it('studio: a cell’s Why is that row’s own sentence; the outcome line is the lead aim row’s range sentence', () => {
    const view = viewOf('studio')
    open(view)
    const card = optionCards(view.model!).find((c) => c.id === 'weekend_workshops')!
    const i = card.rows.findIndex((r) => r.aim_id === 'takings_goal')
    const row = card.rows[i]!
    if (row.kind !== 'chance' || row.outcome == null) throw new Error('fixture: weekend_workshops has a chance row with an outcome for takings_goal')
    const cell = screen.getByTestId('decision-matrix-chance-weekend_workshops-takings_goal')
    fireEvent.click(cell.querySelector('button')!)
    expect(cell).toHaveTextContent(row.title)
    fireEvent.click(screen.getByRole('button', { name: /Modelled outcomes/ }))
    const line = screen.getByTestId('decision-matrix-outcome-weekend_workshops')
    expect(line.textContent).toBe(`${card.heading}: ${row.outcome.text}`)
    expect(line.getAttribute('title')).toBe(row.outcome.title)
  })

  it('app-launch: every option refused for every aim; each shared reason said once under the table, at its path', () => {
    const view = viewOf('app-launch')
    open(view)
    const shared = view.model!.run!.shared_blockers!
    const lines = screen.getAllByTestId('decision-matrix-withheld')
    expect(lines.map((l) => l.getAttribute('data-view'))).toEqual(shared.map((_, i) => `run.shared_blockers.${i}.text`))
    lines.forEach((l, i) => expect(l.textContent).toBe(shared[i]!.text))
  })

  it('bakery-asked: a refused cell draws its own words with its own explanation as the Why', () => {
    const view = viewOf('bakery-asked')
    open(view)
    for (const card of optionCards(view.model!)) card.rows.forEach((row, i) => {
      if (row.kind !== 'none') return
      const cell = document.querySelector<HTMLElement>(`[data-view="${card.id}.rows.${i}.text"]`)!
      expect(cell.querySelector('span')!.textContent).toBe(row.text)
      fireEvent.click(cell.querySelector('button')!)
      expect(cell).toHaveTextContent(row.title)
    })
  })

  it('a View with no model draws no matrix (never an invented one)', () => {
    expect(coreViewToLegacy({ ...viewOf('studio'), model: null } as View).matrix).toBeNull()
  })
})
