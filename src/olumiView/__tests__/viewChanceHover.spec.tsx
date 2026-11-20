/**
 * Look defect 2 (Paul's look check, R5, via github-3c 5 Nov): each option's chance definition ("If Olumi's estimates hold, the chance
 * that …", core's chance-row `text`) was drawn as body text under every option, on the Analysis tab. It belongs in the
 * row's hover: core's row `title`, which opens with that sentence verbatim and carries the full basis. Fixtures: every core golden.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render } from '@testing-library/react'
import { tipOf } from './tipHelpers'
import type { View } from '../client'
import { ViewChances } from '../ViewChances'

afterEach(cleanup)
const DIR = path.resolve('src/olumiView/golden')
const goldens = readdirSync(DIR).filter((f) => f.endsWith('.view.json')).map((f) => [f, JSON.parse(readFileSync(path.join(DIR, f), 'utf8')) as View] as const)
const chanceRows = (v: View) => (v.model?.cards ?? []).filter((c) => c.family === 'option' && c.status === null)
  .flatMap((card) => card.rows.flatMap((row, i) => (row.kind === 'chance' && row.text ? [{ card, row, i }] : [])))

describe('an option\'s chance definition is in its row\'s hover, never body text', () => {
  it('the goldens carry definitions to test (a positive control: 13 rows across them)', () => {
    expect(goldens.flatMap(([, v]) => chanceRows(v)).length).toBeGreaterThanOrEqual(13)
  })

  for (const [name, view] of goldens) {
    const rows = chanceRows(view)
    if (rows.length === 0) continue
    it(`${name}: the Analysis tab draws no definition on screen; each row's hover (the one Tip) is core's title, which opens with it`, async () => {
      const c = render(<ViewChances model={view.model!} />).container
      // The option rows' own text (core cc1b522e may also send the line as one of the Run's notes, for an aim the Run is not about: that note
      // is core's, drawn verbatim, and is not the row).
      const onRows = [...c.querySelectorAll('[data-view-row]')].map((e) => e.textContent ?? '').join('\n')
      for (const { card, row, i } of rows) {
        expect(onRows.includes(row.text!), `${card.id} row ${i} on screen`).toBe(false)
        const at = `${card.id}.rows.${i}`
        const hover = await tipOf(c.querySelector<HTMLElement>(`[data-view-row="${at}"] [data-view="${at}.aim"], [data-view-row="${at}"] > [data-view="${at}.text"]`)!)
        expect([hover === row.title, hover.startsWith(row.text!)], `${card.id} row ${i} hover`).toEqual([true, true])
      }
    }, 30000)
  }
})
