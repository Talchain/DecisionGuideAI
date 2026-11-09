/**
 * DL ruling 9 Nov (ii), rehearsal fbd2 step 5: folds start closed, at every version, on the page where the person approved the draft as on a
 * reopened one; the route is one click away on the badge's count. 77cdc6f6's first-look fold opening is retired for this serve: it drew 35
 * cards on a 21-card board and a reopened page could not draw them back. Real path: useViewCanvas against the store, with setOpened observed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { renderHook, act } from '@testing-library/react'

vi.mock('../../lib/supabase', () => ({ supabase: {}, getUserId: async () => null, getSessionIdentity: async () => ({ userId: null, accessToken: null }) }))
vi.mock('../../lib/posthog', () => ({ trackEvent: () => undefined }))

import { useCanvasStore } from '../../canvas/store'
import type { View } from '../client'
import { useViewStore } from '../store'
import { useViewCanvas } from '../canvas'

const load = (f: string): View => JSON.parse(readFileSync(path.resolve(f), 'utf8'))
const european = load('src/olumiView/golden/european.view.json')
const bookshop = load('src/olumiView/fixtures/j1/bookshop-v1.core-5d8a009b.view3.json')
const closed = (v: View) => v.model!.cards.filter((c) => c.badge !== null && !c.badge.open && c.badge.records.length > 0).map((c) => c.id)
let calls = 0
const keep = useViewStore.getState().setOpened

beforeEach(() => {
  calls = 0
  useCanvasStore.setState({ nodes: [], edges: [], highlightedNodes: new Set() } as never)
})
afterEach(() => { useViewStore.setState({ setOpened: keep } as never) })
const start = (sid: string) => {
  useViewStore.setState({ uuid: 'u', sid, view: null, status: 'none', error: null, stale: false, opened: { open: new Map(), all: false },
    setOpened: async () => { calls += 1; return true } } as never)
  renderHook(() => useViewCanvas(true))
}
const drawn = () => useCanvasStore.getState().nodes.map((n) => n.id)

describe('folds start closed: the board opens none of core\'s folds by itself', () => {
  for (const [name, v] of [['europe', european], ['bkshop', bookshop]] as const) for (const after of [false, true]) {
    it(`${name}, version 1, ${after ? 'after a held proposal (the page that approved it)' : 'on a fresh page (reopened)'}: no fold is opened, and no folded record is drawn`, async () => {
      expect(v.version?.n).toBe(1)
      expect(closed(v).length, 'contrast: core sends closed folds with records the board could open').toBeGreaterThan(0)
      start(`s_${name}${after ? 'pr' : 'fr'}0001`)
      if (after) act(() => { useViewStore.setState({ view: { ...v, version: null }, status: 'ready' }) })
      act(() => { useViewStore.setState({ view: v, status: 'ready' }) })
      await vi.waitFor(() => expect(drawn()).toContain(v.model!.cards[0]!.id))
      expect(calls).toBe(0)
      const folded = v.model!.cards.flatMap((c) => (c.badge !== null && !c.badge.open ? c.badge.records : []))
      expect(drawn().filter((id) => folded.includes(id))).toEqual([])
    })
  }
})
