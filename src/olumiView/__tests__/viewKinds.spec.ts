/**
 * R1 P1 (Codex on d169a9dc1): a card's canvas kind is the producer's role, never whether it can be edited right now. Core withdraws every
 * `figure.edit` while a proposal is held (and on a past version), so "no edit → outcome" drew inputs as outcomes and renumbered them
 * between versions. The stable role: a figure core works out from others is one a `through` link arrives at. Wire goldens only.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { View } from '../client'
import { cardNumbersOf, drawKindOf } from '../layout'

const read = (n: string): View => JSON.parse(readFileSync(path.resolve('src/olumiView/golden', n), 'utf8'))

describe('a card is drawn by its role, the same on every version', () => {
  it('proposal held (no edit anywhere): the inputs draw as factors, the worked-out total as an outcome', () => {
    const m = read('proposal.view.json').model!
    const kind = (id: string) => drawKindOf(m.cards.find((c) => c.id === id)!, m)
    expect(['existing_capacity', 'per_specialist', 'capacity_target', 'deadline', 'start_delay'].map(kind)).toEqual(['factor', 'factor', 'factor', 'factor', 'factor'])
    expect(kind('total_capacity')).toBe('outcome')
  })
  it('the same cards on the version with edits (whatif) and with a proposal held (proposal) keep their kind and number', () => {
    const a = read('whatif.view.json').model!, b = read('proposal.view.json').model!
    const na = cardNumbersOf(a), nb = cardNumbersOf(b)
    for (const id of ['existing_capacity', 'per_specialist', 'total_capacity', 'capacity_target']) {
      expect(drawKindOf(b.cards.find((c) => c.id === id)!, b), id).toBe(drawKindOf(a.cards.find((c) => c.id === id)!, a))
      expect(nb.get(id), id).toBe(na.get(id))
    }
  })
  it('CONTRAST: on every golden, a figure is an outcome exactly when core works it out through others', () => {
    for (const n of ['bakery', 'european', 'pricing', 'studio', 's_ce285b3617bb', 'app-launch']) {
      const m = read(`${n}.view.json`).model!
      const outcomes = m.cards.filter((c) => c.family === 'quantity' && drawKindOf(c, m) === 'outcome').map((c) => c.id)
      expect(outcomes.length, n).toBeGreaterThan(0)
      for (const id of outcomes) expect(m.cards.find((c) => c.id === id)!.figure?.edit ?? null, `${n} ${id}`).toBeNull()
    }
  })
})
