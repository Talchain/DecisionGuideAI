/**
 * UI-BRIEF-20261115 (Paul, 15 Nov: "visualising it as much as it can"): the option card's range band (ResultBand ChanceBand) is said once in
 * "How to read this", in core's own run.sensitivity line: what the band's two ends are. Only where some option carries a driver.
 */
import { laneTipOf } from './tipHelpers'
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
vi.mock('../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
import path from 'node:path'
import { cleanup, render } from '@testing-library/react'
import type { View } from '../client'
import { useViewStore } from '../store'

const EURO = JSON.parse(readFileSync(path.resolve('src/olumiView/golden/european.view.json'), 'utf8')) as View
afterEach(() => { cleanup(); useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none' } as never) })

describe('the key says what the band is, once, in core\'s words', () => {
  it('R5 "How to read this" carries core\'s run.sensitivity line when an option draws a band, and not otherwise', async () => {
    const { ViewLegend } = await import('../ViewLegend')
    useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: EURO.id, view: EURO, status: 'ready', error: null, stale: false, at: null } as never)
    const el = render(<ViewLegend open onOpenChange={() => {}} />).container
    const line = el.querySelector('[data-view-key-rail]')
    expect([line?.textContent, laneTipOf(line as HTMLElement)]).toEqual([EURO.model!.run!.sensitivity!.text, EURO.model!.run!.sensitivity!.title])
    cleanup()
    const bare = { ...EURO, model: { ...EURO.model!, cards: EURO.model!.cards.map((c) => ({ ...c, rows: c.rows.map((r) => (r.kind === 'chance' ? { ...r, driver: null } : r)) })) } } as View
    useViewStore.setState({ view: bare } as never)
    const el2 = render(<ViewLegend open onOpenChange={() => {}} />).container
    expect(el2.querySelector('[data-view-key-rail]')).toBeNull()
  })
})
