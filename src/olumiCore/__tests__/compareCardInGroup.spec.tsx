/**
 * S4 press, task 1: a press on a changed figure in the Compare tab, where that figure sits inside a ROW group card (v12/bands/groups.ts: Olumi's
 * approved unsized driver is folded into "N more from Olumi"), opens that group so the board draws the card. Before: only the inputs' fold was
 * opened (`setInputsOpen`), the card stayed in its group and `focusWhenDrawn` waited 5 s and gave up. Real path: `showCard` against the stores,
 * on the in-repo bakery fixture (oven_price: Olumi's driver with no value yet).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { View, ViewCard } from '../../olumiView/client'
import { useViewStore } from '../../olumiView/store'
import { useCanvasStore } from '../../canvas/store'
import { groupOpen, useInputsOpen } from '../../olumiView/v12/bands/foldStore'
import { cardGroupsOf, groupIdOf } from '../../olumiView/v12/bands/groups'
import { showCard } from '../compare'

const base = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/core-38eebca9/bakery-asked.view3.json'), 'utf8')) as View
const olumis = (id: string): ViewCard => ({ ...base.model!.cards.find((c) => c.id === id)!, kind: 'driver', author: { by: 'olumi', text: 'olumi', title: '' }, change: null }) as unknown as ViewCard
const install = (): View => {
  const view = { ...base, model: { ...base.model!, cards: base.model!.cards.map((c) => (c.id === 'oven_price' ? olumis('oven_price') : c)) } } as unknown as View
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-0123456789ab', sid: view.id, view, status: 'ready', error: null, stale: false, at: null } as never)
  useCanvasStore.setState({ nodes: [], edges: [] })
  return view
}
afterEach(() => { useInputsOpen.setState({ open: {} }); useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none', at: null } as never); useCanvasStore.setState({ nodes: [], edges: [] }) })

describe('S4 press 1: a changed figure inside a row group card', () => {
  it('P1 the figure is in the Olumi inputs group (precondition), and the press opens that group', () => {
    const view = install(), gid = groupIdOf('olumi', 'inputs')
    expect(cardGroupsOf(view.model!, view).find((g) => g.id === gid)?.cards).toContain('oven_price')
    expect(groupOpen(view.id, gid)).toBe(false)
    showCard(view.id, 'oven_price')
    expect(groupOpen(view.id, gid), 'the group holding the figure is open, so the board draws its card').toBe(true)
  })
  it('P1b CONTRAST: a figure in no group opens no group (only the inputs fold, as before)', () => {
    const view = install()
    showCard(view.id, 'budget')
    expect(Object.keys(useInputsOpen.getState().open).filter((k) => k.includes('#'))).toEqual([])
  })
})
