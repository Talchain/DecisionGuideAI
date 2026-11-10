/**
 * Core 91fdf8a9 (DL 10 Nov): a figure with no value (asked, unsized, unsupported) sends `figure.text: ''`, its words opening `figure.title`
 * and `detail`. The card then draws no figure row unless the row holds something to use: the ✎ where core offers an edit, or Olumi's pill
 * on an Olumi figure. An empty row would still cost its 6px gap on a canvas that lays out at drawn heights. Core's own bakery and app-launch
 * cards, bound by id.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { View, ViewCard as Card } from '../client'
import { ViewCard } from '../../canvas/nodes/ViewCardNode'

afterEach(cleanup)
const card = (g: string, id: string) => (JSON.parse(readFileSync(path.resolve(`src/olumiView/golden/${g}.view.json`), 'utf8')) as View).model!.cards.find((c) => c.id === id)!
const row = (c: Card) => render(<ViewCard card={c} />).container.querySelector(`[data-view="${c.id}.figure.text"]`)

describe('a figure with no value takes no row when the row would hold nothing', () => {
  const oven = card('bakery', 'oven_price')
  it('bakery\'s oven price, given no edit and no Olumi pill: no figure row; its words stay the card\'s hover', () => {
    expect([oven.figure!.text, oven.author?.by]).toEqual(['', 'person'])
    expect(row({ ...oven, figure: { ...oven.figure!, edit: null } })).toBeNull()
  })
  it('CONTRAST: with core\'s edit the row holds the ✎; an Olumi figure with no value keeps its row for Olumi\'s pill', () => {
    expect(oven.figure!.edit).not.toBeNull()
    expect(row(oven)).not.toBeNull()
    const margin = card('app-launch', 'readiness_margin')
    expect([margin.figure!.text, margin.figure!.edit, margin.author?.by]).toEqual(['', null, 'olumi'])
    expect(row(margin)).not.toBeNull()
  })
})
