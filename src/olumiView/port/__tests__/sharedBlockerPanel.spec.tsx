/**
 * A reason every option shares, said once in the Analysis panel (the strategy audit, 7 Nov: "it belongs once, in the panel"), and every
 * option still shows a chance or one plain reason (DL 9 Nov: a blank row for a withheld option is a defect). Core (design call 8 Nov (c),
 * e653edb1) says the shared reason once (`run.shared_blockers`) and gives each covered row its short mark, "No chance yet", with the reason
 * as its hover; the panel draws both as core sends them. Fixtures are core e653edb1's own Views (the app-launch golden and its
 * pricing-unmoved-first case); bound by card id, row index and aim id.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import type { View } from '../../client'
import { optionCards } from '../../layout'
import { AnalysisHeroPanel } from '../AnalysisHeroPanel'
import { viewOf } from './viewAt'
afterEach(cleanup)
const launch = viewOf('golden/app-launch'), unmoved = viewOf('golden/pricing-unmoved-first')
const draw = (v: View) => render(<AnalysisHeroPanel model={v.model!} chat={v.chat} />).container
const rowEl = (c: HTMLElement, id: string, i: number) => c.querySelector<HTMLElement>(`[data-testid="port-option-row"][data-view-row="${id}.rows.${i}"]`)

describe('the Analysis panel says a shared reason once, and every covered option still shows core\'s mark', () => {
  it('app-launch: each shared reason once at the head; every covered row draws core\'s short mark, never the shared sentence, its hover core\'s title', () => {
    const c = draw(launch), blockers = launch.model!.run!.shared_blockers!
    blockers.forEach((b, i) => {
      const at = c.querySelectorAll(`[data-view="run.shared_blockers.${i}.text"]`)
      expect(at).toHaveLength(1)
      expect(at[0]!.textContent).toBe(b.text)
      expect(c.textContent!.split(b.text).length - 1, 'said once').toBe(1)
    })
    let rows = 0
    for (const card of optionCards(launch.model!)) card.rows.forEach((r, i) => {
      if (r.kind !== 'none') return
      rows++
      const el = rowEl(c, card.id, i)!
      expect(el, `${card.id} row ${i}`).not.toBeNull()
      expect(el.querySelector(`[data-view="${card.id}.rows.${i}.text"]`)?.textContent, `${card.id} row ${i}: core's mark`).toBe(r.text)
      expect(el.querySelector('[data-testid="port-row-readout"]')!.textContent, `${card.id} row ${i}: never blank`).not.toBe('')
    })
    expect(rows).toBeGreaterThan(blockers.length)
  })

  it('pricing-unmoved-first: the covered row says "No chance yet"; the option\'s own chance for its other aim is drawn as before', () => {
    const c = draw(unmoved), [shared] = unmoved.model!.run!.shared_blockers!
    for (const card of optionCards(unmoved.model!)) {
      const s = card.rows.findIndex((r) => r.kind === 'none' && r.aim_id === shared!.aim_id)
      const o = card.rows.findIndex((r) => r.kind === 'chance')
      expect(rowEl(c, card.id, s)!.querySelector(`[data-view="${card.id}.rows.${s}.text"]`)?.textContent).toBe((card.rows[s] as { text: string }).text)
      expect(rowEl(c, card.id, o)!.querySelector(`[data-view="${card.id}.rows.${o}.value"]`)?.textContent).toBe((card.rows[o] as { value: string }).value)
    }
  })

  it('must not change: a covered row with something to open keeps its line and its open control', () => {
    const c = render(<AnalysisHeroPanel model={launch.model!} chat={launch.chat} rowAction={(e) => <span data-testid="row-act" data-for={e.card.id}>act</span>} />).container
    for (const card of optionCards(launch.model!)) {
      const s = card.rows.findIndex((r) => r.kind === 'none'), sr = rowEl(c, card.id, s)!
      expect(sr.querySelector('[data-testid="port-row-readout"]')!.textContent, card.id).toBe((card.rows[s] as { text: string }).text)
      expect(sr.querySelector('button[aria-expanded]'), card.id).not.toBeNull()
    }
  })
})
