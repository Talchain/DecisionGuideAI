/**
 * ED-12 (core wip/ed12-notes f9527c1f): a premise core marks as Olumi's (`premises[].olumi`, with its `id`) shows core's Olumi glyph beside
 * its words, core's title on hover; a premise with `olumi: null` shows none. Bound to core's own output: its app-launch golden at f9527c1f
 * (fixtures/ed12), every premise of every card, by its own path.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render } from '@testing-library/react'
import type { View } from '../client'
import { ViewCard } from '../../canvas/nodes/ViewCardNode'

const raw = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/ed12/app-launch.view3.json'), 'utf8'))
const view: View = raw.view ?? raw

describe("ED-12: Olumi's premises carry core's Olumi mark (core f9527c1f app-launch)", () => {
  it("every premise core marks as Olumi's draws core's glyph and title at its own path; every other premise draws none", () => {
    let marked = 0, plain = 0
    for (const card of view.model!.cards) {
      if (card.premises.length === 0) continue
      const c = render(<ViewCard card={card} selected />).container
      card.premises.forEach((p, j) => {
        const mark = c.querySelector<HTMLElement>(`[data-view="${card.id}.premises.${j}.olumi.glyph"]`)
        if (p.olumi === null) { plain += 1; expect(mark, `${card.id}.${j}`).toBeNull(); return }
        marked += 1
        expect([mark?.textContent, mark?.getAttribute('title')], `${card.id}.${j}`).toEqual([p.olumi.glyph, p.olumi.title])
        expect(mark?.closest(`[data-premise-row="${card.id}.${j}"]`), `${card.id}.${j}`).not.toBeNull()
      })
      cleanup()
    }
    expect(marked).toBeGreaterThan(0) // the probe sees core's marked premises (7 in this golden)
  })
})
