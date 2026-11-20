/** S4 density lane (L1, 20 Nov): the real Views' reason links are all drawn at rest now; the fold (`linkDrawn`, `routeRailAtRest`) is deleted. */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { View } from '../../../client'
import * as layout from '../../../layout'
import { cardLinks, drawnModelOf } from '../../../layout'
import { unlinkedIds, bandLabelOf } from '../../bands/bands'

const load = (n: string): View => JSON.parse(readFileSync(path.resolve(`src/olumiView/fixtures/real/${n}.view3.json`), 'utf8'))
describe('connector density on the real Views', () => {
  it('the at-rest fold of reason links and route rails is gone from the layout (the old path is deleted with the new)', () => {
    expect((layout as Record<string, unknown>).linkDrawn).toBeUndefined()
    expect((layout as Record<string, unknown>).routeRailAtRest).toBeUndefined()
  })
  for (const n of ['hiring', 'hosting', 'european-22cards', 'together', 'capacity', 'bakery-r5']) {
    it(`${n}: every link of the View is a drawn edge at rest, reason links included; the unlinked marks and the inputs label still read every link`, () => {
      const model = load(n).model!, drawn = drawnModelOf(model), all = cardLinks(drawn)
      console.log(`DENSITY ${n} drawn=${all.length} reason=${all.filter(({ link }) => link.kind === 'reason').length}`)
      // cardLinks is the canvas's edge list (canvas.ts), one edge per link, none held back at rest.
      expect(all.length).toBe(drawn.links.length)
      expect(Array.isArray(unlinkedIds(model))).toBe(true)
      expect(typeof bandLabelOf('inputs', model)).toBe('string')
    })
  }
  it('hiring has reason links to draw (positive control: the all-links count is the whole View, not an empty list)', () => {
    const all = cardLinks(drawnModelOf(load('hiring').model!))
    expect(all.some(({ link }) => link.kind === 'reason')).toBe(true)
  })
})
