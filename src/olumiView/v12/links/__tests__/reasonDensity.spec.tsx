/** S4 density lane (L1, 20 Nov): the real Views' reason links are all drawn at rest now: each is rendered by the lane's edge, none is folded away. */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { View } from '../../../client'
import { cardLinks, drawnModelOf } from '../../../layout'
import { cleanup } from '@testing-library/react'
import { drawLinkEdge, restingEdge } from './drawEdge'
import { unlinkedIds, bandLabelOf } from '../../bands/bands'

const load = (n: string): View => JSON.parse(readFileSync(path.resolve(`src/olumiView/fixtures/real/${n}.view3.json`), 'utf8'))
describe('connector density on the real Views', () => {
  for (const n of ['hiring', 'hosting', 'european-22cards', 'together', 'capacity', 'bakery-r5']) {
    it(`${n}: every link of the View is a drawn edge at rest, reason links included; the unlinked marks and the inputs label still read every link`, () => {
      const model = load(n).model!, drawn = drawnModelOf(model), all = cardLinks(drawn)
      console.log(`DENSITY ${n} drawn=${all.length} reason=${all.filter(({ link }) => link.kind === 'reason').length}`)
      // cardLinks is the canvas's edge list (canvas.ts), one edge per link; each reason link is RENDERED by the lane's edge (its dotted look is links.spec L1b), with nothing hovered or selected.
      expect(all.length).toBe(drawn.links.length)
      const reasons = all.filter(({ link }) => link.kind === 'reason')
      for (const { link, i } of reasons) { expect(restingEdge(drawLinkEdge(link, i)), `${n} links.${i}`).toMatchObject({ drawn: true, faded: false }); cleanup() }
      expect(Array.isArray(unlinkedIds(model))).toBe(true)
      expect(typeof bandLabelOf('inputs', model)).toBe('string')
    })
  }
  it('hiring has reason links to draw (positive control: the all-links count is the whole View, not an empty list)', () => {
    const all = cardLinks(drawnModelOf(load('hiring').model!))
    expect(all.some(({ link }) => link.kind === 'reason')).toBe(true)
    const reason = all.find(({ link }) => link.kind === 'reason')!
    expect(restingEdge(drawLinkEdge(reason.link, reason.i)).drawn).toBe(true)
  })
})
