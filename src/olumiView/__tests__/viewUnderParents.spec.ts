/**
 * Cards under what they hang from (DL 4 Nov, R3: "the edges are spaghetti": the options were packed under the question and their
 * subtrees stayed where the layout spread them). Every golden View, placed as the canvas places it: a card that hangs from exactly one
 * option sits, left to right, in its option's order among the other options' cards, so its links drop row to row.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { View } from '../client'
import { causalPlaces, cardLinks, CARD_WIDTH } from '../layout'

const GOLDEN = ['app-launch', 'bakery', 'european', 'pricing', 'proposal', 's_ce285b3617bb', 'studio'] as const
// UI restore stage 1 (DL ruling 10 Nov): capacity/hiring parent-order rows retired; restoreLayout.spec.ts pins their replacement.
const fileOf = (g: string) => path.resolve('src/olumiView/golden', `${g}.view.json`)

describe('each card under the option it hangs from', () => {
  for (const g of GOLDEN) {
    it(`${g}: a card of one option is, left to right, in its option's order`, async () => {
      const m = (JSON.parse(readFileSync(fileOf(g), 'utf8')) as View).model!
      const p = await causalPlaces(m, new Map())
      const options = new Set(m.cards.flatMap((c) => (c.family === 'option' ? [c.id] : [])))
      // A card whose only neighbour above (a link either way to a card placed higher) is one option hangs from that option alone.
      const above = new Map<string, Set<string>>()
      for (const { link } of cardLinks(m)) for (const [a, b] of [[link.from, link.to], [link.to, link.from]] as const) if (!options.has(a) && p.get(b)!.y < p.get(a)!.y) above.set(a, new Set([...(above.get(a) ?? []), b]))
      const kids = [...above].flatMap(([id, up]) => (up.size === 1 && options.has([...up][0]!) ? [{ id, o: [...up][0]! }] : []))
      const cx = (id: string) => p.get(id)!.x + CARD_WIDTH / 2
      const wrong: string[] = []
      for (const a of kids) for (const b of kids) if (a.o !== b.o && cx(a.o) < cx(b.o) && !(cx(a.id) < cx(b.id))) wrong.push(`${a.id}(${a.o}) right of ${b.id}(${b.o})`)
      expect(wrong).toEqual([])
    })
  }
})
