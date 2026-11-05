/**
 * THE TRADE-OFFS LENS ON THE CORE LANE (DL ruling 3 via github-3c, 5 Nov): options × aims, each cell that option card's own row for that
 * aim (`rows[].aim_id`: chance, limit or none), drawn in core's words with core's title as hover and core's mark. Order and headings are
 * core's (the options' cards, the aims' cards, in the rows' order). No word, number, sort or rank of DGAI's own. Fixtures: every golden.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, render, screen } from '@testing-library/react'
import type { View, ViewModel } from '../client'
import { optionCards } from '../layout'
import { useViewLens } from '../lens'
import { useViewStore } from '../store'
import { TradeOffsGrid, ViewTradeOffsKey, tradeOffAims } from '../ViewTradeOffsKey'

afterEach(() => { cleanup(); useViewLens.setState({ lens: 'full' }); useViewStore.setState({ view: null }) })
const DIR = path.resolve('src/olumiView/golden')
const goldens = readdirSync(DIR).filter((f) => f.endsWith('.view.json')).map((f) => [f, (JSON.parse(readFileSync(path.join(DIR, f), 'utf8')) as View).model] as const)
  .filter((g): g is readonly [string, ViewModel] => g[1] != null && optionCards(g[1]).length > 0)

/** Core's own words for a row as the cell draws them: a chance its approx and value, a limit its value, then core's Olumi mark after a
 *  no-break space (as the Analysis rows draw it); a none row its text. */
const NBSP = '\u00a0'
const mark = (m: { glyph: string } | null) => (m === null ? '' : `${NBSP}${m.glyph}`)
const wordsOf = (r: ViewModel['cards'][number]['rows'][number]) =>
  r.kind === 'none' ? r.text : r.kind === 'chance' ? `${r.approx}${r.value}${mark(r.olumi)}` : r.kind === 'limit' ? `${r.value}${mark(r.olumi)}` : ''

describe('the Trade-offs grid: each option against each aim, in core\'s rows', () => {
  it('the goldens give grids to test, a none row among them', () => {
    expect(goldens.length).toBeGreaterThanOrEqual(8)
    expect(goldens.some(([, m]) => optionCards(m).some((c) => c.rows.some((r) => r.kind === 'none')))).toBe(true)
  })

  for (const [name, model] of goldens) {
    it(`${name}: headings are core's options and aims in core's order; each cell is that option's row for that aim, its words and hover`, () => {
      const c = render(<TradeOffsGrid model={model} />).container
      const options = optionCards(model), aims = tradeOffAims(model)
      expect([...c.querySelectorAll('[data-tradeoff-option]')].map((e) => [e.getAttribute('data-tradeoff-option'), e.textContent]))
        .toEqual(options.map((o) => [o.id, o.heading]))
      expect([...c.querySelectorAll('[data-tradeoff-aim]')].map((e) => [e.getAttribute('data-tradeoff-aim'), e.textContent]))
        .toEqual(aims.map((a) => [a.id, a.heading]))
      for (const o of options) for (const a of aims) {
        const i = o.rows.findIndex((r) => r.aim_id === a.id), row = o.rows[i]!
        const cell = c.querySelector(`[data-tradeoff-cell="${o.id}.${a.id}"]`)
        expect(cell?.getAttribute('data-view-row'), `${o.id} × ${a.id}`).toBe(`${o.id}.rows.${i}`)
        expect(cell?.textContent, `${o.id} × ${a.id}: words`).toBe(wordsOf(row))
        expect(cell?.getAttribute('title'), `${o.id} × ${a.id}: hover`).toBe(row.title)
      }
    })
  }

  it('a row core cannot work out is drawn in core\'s none words, never blank', () => {
    const [, model] = goldens.find(([, m]) => optionCards(m).some((c) => c.rows.some((r) => r.kind === 'none')))!
    const c = render(<TradeOffsGrid model={model} />).container
    for (const o of optionCards(model)) o.rows.forEach((r) => {
      if (r.kind !== 'none') return
      const cell = c.querySelector(`[data-tradeoff-cell="${o.id}.${r.aim_id}"]`)
      expect(cell?.textContent, o.id).toBe(r.text)
      expect(r.text.trim()).not.toBe('')
    })
  })

  it('no word of DGAI\'s own: every cell is core\'s words, and nothing ranks, totals or names a winner', () => {
    for (const [name, model] of goldens) {
      const c = render(<TradeOffsGrid model={model} />).container
      expect(c.textContent ?? '', name).not.toMatch(/\b(best|winner|recommend|total|score|rank)\b/i)
      cleanup()
    }
  })

  it('the key card shows on the Trade-offs lens only', () => {
    const [, model] = goldens.find(([n]) => n === 'european.view.json')!
    useViewStore.setState({ view: { model } as unknown as View })
    render(<ViewTradeOffsKey />)
    expect(screen.queryByTestId('view-tradeoffs-key')).toBeNull()
    act(() => useViewLens.setState({ lens: 'tradeoffs' }))
    expect(screen.getByTestId('view-tradeoffs-key')).toBeTruthy()
  })
})
