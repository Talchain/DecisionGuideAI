import { describe, expect, it } from 'vitest'
import type { View } from '../../client'
import studio from '../../fixtures/core-38eebca9/studio.view3.json'
import cafe from '../../fixtures/core-78c3afc4/cafe-waits.view3.json'
import { checkNeedsOf } from '../items'

const modelOf = (v: unknown) => (v as View).model!

// PL 1514: a no-result row hidden by a shared blocker's coverage must not consume an editable wait it names.
describe('Check keeps an editable wait that only a hidden blocker row names', () => {
  it.each([
    ['Studio', studio, 'member_mood'],
    ['Café', cafe, 'tip_gain'],
  ])('%s lists the %s wait with its edit', (_name, view, id) => {
    const items = checkNeedsOf(modelOf(view))
    const wait = items.find((item) => item.kind === 'waits' && item.cards.includes(id))
    expect(wait).toBeDefined()
    expect(wait!.action.kind).toBe('edit')
  })

  it('CONTRAST: each wait id is still listed once', () => {
    for (const [view, id] of [[studio, 'member_mood'], [cafe, 'tip_gain']] as const) {
      const listed = checkNeedsOf(modelOf(view)).filter((item) => (item.kind === 'waits' || item.kind === 'size') && item.cards.includes(id))
      expect(listed).toHaveLength(1)
    }
  })
})
