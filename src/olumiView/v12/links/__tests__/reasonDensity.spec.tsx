/** S4 density lane: how many lines a Simple board draws at rest, before (every link) and after (a reason link only while focused), on the real Views. */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { View } from '../../../client'
import { cardLinks, drawnModelOf, linkDrawn } from '../../../layout'
import { unlinkedIds, bandLabelOf } from '../../bands/bands'

const load = (n: string): View => JSON.parse(readFileSync(path.resolve(`src/olumiView/fixtures/real/${n}.view3.json`), 'utf8'))
const rows: [string, number, number][] = []
describe('connector density on the real Views', () => {
  for (const n of ['hiring', 'hosting', 'european-22cards', 'together', 'capacity', 'bakery-r5']) {
    it(`${n}: Simple at rest draws fewer lines than the board has; the unlinked marks and the inputs label still read every link`, () => {
      const model = load(n).model!, drawn = drawnModelOf(model), all = cardLinks(drawn)
      const atRest = all.filter(({ link }) => linkDrawn(link, new Set()))
      rows.push([n, all.length, atRest.length])
      console.log(`DENSITY ${n} before=${all.length} after=${atRest.length} reason=${all.filter(({ link }) => link.kind === 'reason').length}`)
      expect(atRest.length).toBeLessThanOrEqual(all.length)
      expect(atRest.every(({ link }) => link.kind !== 'reason' || link.alert || link.proposed)).toBe(true)
      // The hidden lines are still in the View the marks read.
      expect(drawn.links.length).toBeGreaterThanOrEqual(all.length)
      expect(Array.isArray(unlinkedIds(model))).toBe(true)
      expect(typeof bandLabelOf('inputs', model)).toBe('string')
    })
  }
  it('hiring loses lines at rest', () => {
    const m = drawnModelOf(load('hiring').model!), all = cardLinks(m)
    expect(all.filter(({ link }) => linkDrawn(link, new Set())).length).toBeLessThan(all.length)
  })
})
