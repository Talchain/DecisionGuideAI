/**
 * R5 (the design lead's R3 look check, item 4): v10's driver badge (20 px, `right-1 top-1` on an option card with core's `driver`) covered
 * the last letters of O3's title: the card's padding is 12 px, so the badge reaches 12 px into the title row, which reserved nothing.
 * The title row of an option card core gives a driver now keeps that room (`pr-4`, 16 px); a card without one keeps its full width.
 * Fixture: core's european golden (each option has a driver).
 */
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render } from '@testing-library/react'
import type { View } from '../client'
import { ViewCard } from '../../canvas/nodes/ViewCardNode'

afterEach(cleanup)
const european: View = JSON.parse(readFileSync(path.resolve('src/olumiView/golden', 'european.view.json'), 'utf8'))
const titleRow = (c: HTMLElement, id: string) => c.querySelector<HTMLElement>(`[data-view="${id}.heading"]`)!.parentElement!

describe('an option card\'s title keeps room for v10\'s driver badge', () => {
  it('each option with a driver: its title row reserves the badge\'s reach; without a driver, or not an option, it does not', () => {
    const options = european.model!.cards.filter((c) => c.family === 'option')
    expect(options.length).toBeGreaterThan(0)
    for (const card of options) {
      expect(card.driver, card.id).not.toBeNull()
      expect(titleRow(render(<ViewCard card={card} />).container, card.id).classList.contains('pr-4'), card.id).toBe(true)
      cleanup()
      expect(titleRow(render(<ViewCard card={{ ...card, driver: null }} />).container, card.id).classList.contains('pr-4'), `${card.id} no driver`).toBe(false)
      cleanup()
    }
    const figure = european.model!.cards.find((c) => c.family === 'quantity')!
    expect(titleRow(render(<ViewCard card={figure} />).container, figure.id).classList.contains('pr-4')).toBe(false)
  })
})
