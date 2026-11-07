/**
 * A reason every option shares, said once in the Analysis panel too (the strategy audit, 7 Nov: "it belongs once, in the panel"): the
 * panel's head says core's shared reason once (`run.shared_blockers`, ViewChances `SharedBlockers`), so an option row it covers names
 * its option and draws no repeat of core's short row under the aim's heading; its hover keeps core's row title. A reason that is the
 * option's own stays its row's finding. Fixtures are core's own Views (hosting, app-launch); bound by card id, row index and aim id.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import type { View } from '../../client'
import { optionCards } from '../../layout'
import { AnalysisHeroPanel } from '../AnalysisHeroPanel'
import { viewOf } from './viewAt'
afterEach(cleanup)
const hosting = viewOf('real/hosting'), launch = viewOf('golden/app-launch')
const draw = (v: View) => render(<AnalysisHeroPanel model={v.model!} chat={v.chat} />).container
const rowEl = (c: HTMLElement, id: string, i: number) => c.querySelector<HTMLElement>(`[data-testid="port-option-row"][data-view-row="${id}.rows.${i}"]`)

describe('the Analysis panel says a shared reason once', () => {
  it("catch: the head says each shared reason once; a covered option's row draws no repeat, its own reason stays its finding", () => {
    const c = draw(hosting), [shared] = hosting.model!.run!.shared_blockers!, own = 'protect_delivery_quality'
    expect(c.querySelectorAll('[data-view="run.shared_blockers.0.text"]')).toHaveLength(1)
    expect(c.querySelector('[data-view="run.shared_blockers.0.text"]')!.textContent).toBe(shared!.text)
    for (const card of optionCards(hosting.model!)) {
      const s = card.rows.findIndex((r) => r.kind === 'none' && r.aim_id === shared!.aim_id)
      const o = card.rows.findIndex((r) => r.kind === 'none' && r.aim_id === own)
      const sr = rowEl(c, card.id, s)!, or = rowEl(c, card.id, o)!
      expect(sr, `${card.id} shared row`).not.toBeNull()
      expect(sr.querySelector(`[data-view="${card.id}.heading"]`)!.textContent).toBe(card.heading)
      expect(sr.querySelector(`[data-view="${card.id}.rows.${s}.text"]`), `${card.id}: no repeat`).toBeNull()
      expect(sr.querySelector('[data-testid="port-row-readout"]'), `${card.id}: no empty finding line`).toBeNull()
      expect(sr.getAttribute('title')).toBe(card.rows[s]!.title)
      expect(or.querySelector(`[data-view="${card.id}.rows.${o}.text"]`)!.textContent, `${card.id}: its own`).toBe((card.rows[o] as { text: string }).text)
    }
  })

  it('catch: where every option waits on shared reasons, no option row repeats one; each is said once at the head', () => {
    const c = draw(launch), blockers = launch.model!.run!.shared_blockers!
    blockers.forEach((b, i) => {
      const at = c.querySelectorAll(`[data-view="run.shared_blockers.${i}.text"]`)
      expect(at).toHaveLength(1)
      expect(at[0]!.textContent).toBe(b.text)
    })
    let rows = 0
    for (const card of optionCards(launch.model!)) card.rows.forEach((r, i) => {
      if (r.kind !== 'none') return
      rows++
      expect(rowEl(c, card.id, i), `${card.id} row ${i}`).not.toBeNull()
      expect(c.querySelector(`[data-view="${card.id}.rows.${i}.text"]`), `${card.id} row ${i}`).toBeNull()
    })
    expect(rows).toBeGreaterThan(blockers.length)
  })

  it('must not change: a covered row with something to open keeps its line and its open control, with no repeat in it', () => {
    const v = hosting, [shared] = v.model!.run!.shared_blockers!
    const c = render(<AnalysisHeroPanel model={v.model!} chat={v.chat} rowAction={(e) => <span data-testid="row-act" data-for={e.card.id}>act</span>} />).container
    for (const card of optionCards(v.model!)) {
      const s = card.rows.findIndex((r) => r.kind === 'none' && r.aim_id === shared!.aim_id), sr = rowEl(c, card.id, s)!
      expect(sr.querySelector('[data-testid="port-row-readout"]')!.textContent, card.id).toBe('')
      expect(sr.querySelector('button[aria-expanded]'), card.id).not.toBeNull()
    }
  })
})
