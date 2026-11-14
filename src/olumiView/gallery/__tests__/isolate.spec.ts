/**
 * The view gallery's isolation (../isolate.ts): a saved View answers its own reads; every write is refused and listed; any other read is
 * listed, never passed on. Bound by path, method and the list each request lands in.
 */
import { describe, expect, it } from 'vitest'
import { GALLERY_MARK, NOT_SAVED_HERE, READ_ONLY, answerOf, decide, isolate } from '../isolate'
import { frameHashOf, isSavedView } from '../manifest'

const VIEW = { schema: 'olumi.view/3', id: 's_0123456789ab', you: 'Ada', you_id: 'p_ada' }
const ORIGIN = 'http://gallery.test'
const at = (path: string) => new URL(path, ORIGIN)

describe('the view gallery isolation', () => {
  it('G1: the saved View answers who the page is for and its own scenario, whatever the query', () => {
    const a = answerOf(VIEW)
    expect(decide('GET', at('/api/me'), ORIGIN, a)).toEqual({ kind: 'answer', status: 200, body: { me: { id: 'p_ada', name: 'Ada' } } })
    expect(decide('GET', at('/api/scenarios/s_0123456789ab/view?schema=3&open=x'), ORIGIN, a)).toEqual({ kind: 'answer', status: 200, body: VIEW })
  })
  it('G2: a read the saved View does not hold is a 404 listed as unanswered, another scenario included', () => {
    const a = answerOf(VIEW)
    for (const path of ['/api/scenarios/s_0123456789ab/versions', '/api/scenarios/s_ffffffffffff/view?schema=3']) {
      expect(decide('GET', at(path), ORIGIN, a)).toEqual({ kind: 'answer', status: 404, body: { error: NOT_SAVED_HERE }, list: 'unanswered', why: 'not in this saved View' })
    }
  })
  it('G3: every write is refused in words and listed, on the View\'s own scenario too', () => {
    const a = answerOf(VIEW)
    for (const [method, path] of [['POST', '/api/proposals/18/approve'], ['POST', '/api/scenarios/s_0123456789ab/messages'], ['PUT', '/api/me'], ['DELETE', '/api/scenarios/s_0123456789ab']] as const) {
      expect(decide(method, at(path), ORIGIN, a)).toEqual({ kind: 'answer', status: 409, body: { error: 'The gallery is read-only: nothing is sent or saved.' }, list: 'refused', why: 'write' })
    }
  })
  it('G4: another origin fails like a dead network, and a same-origin path outside /api is listed as unexpected', () => {
    const a = answerOf(VIEW)
    expect(decide('GET', new URL('https://elsewhere.test/api/me'), ORIGIN, a)).toEqual({ kind: 'fail', why: 'outside' })
    expect(decide('GET', at('/engine/health'), ORIGIN, a)).toMatchObject({ status: 404, list: 'refused', why: 'unexpected' })
    // The build's own version file is expected at boot: answered 404, listed nowhere.
    expect(decide('GET', at('/version.json'), ORIGIN, a)).toEqual({ kind: 'answer', status: 404, body: { error: NOT_SAVED_HERE } })
  })
  it('G5: installed on a page, fetch never reaches the network and the lists say what was asked', async () => {
    let reached = 0
    const win = { location: { origin: ORIGIN, href: `${ORIGIN}/view-gallery.html` }, fetch: () => { reached++; return Promise.resolve(new Response('{}')) },
      XMLHttpRequest: { prototype: {} }, navigator: {} } as unknown as Parameters<typeof isolate>[0]
    const state = isolate(win, 'fixtures/x.view3.json', answerOf(VIEW))
    expect(state.mark).toBe(GALLERY_MARK)
    const me = await win.fetch('/api/me')
    expect(me.status).toBe(200)
    expect(await me.json()).toEqual({ me: { id: 'p_ada', name: 'Ada' } })
    const saved = await win.fetch('/api/proposals/18/approve', { method: 'POST', body: '{}' })
    expect(saved.status).toBe(409)
    expect(await saved.json()).toEqual({ error: READ_ONLY })
    expect((await win.fetch('/api/scenarios/s_0123456789ab/summary')).status).toBe(404)
    await expect(win.fetch('https://elsewhere.test/x')).rejects.toThrow('Refused by the view gallery.')
    expect(() => new (win as unknown as { WebSocket: new (u: string) => unknown }).WebSocket('wss://elsewhere.test')).toThrow()
    expect(reached).toBe(0)
    expect(state.refused.map((x) => `${x.method} ${x.url} ${x.why}`)).toEqual(['POST /api/proposals/18/approve write', 'GET https://elsewhere.test outside', 'WebSocket wss://elsewhere.test unexpected'])
    expect(state.unanswered.map((x) => `${x.method} ${x.url}`)).toEqual(['GET /api/scenarios/s_0123456789ab/summary'])
  })
  it('G7: a Request, a URL object, a lower-case method and HEAD are read as what they are', async () => {
    const win = { location: { origin: ORIGIN, href: `${ORIGIN}/view-gallery.html` }, fetch: () => Promise.reject(new Error('network')), XMLHttpRequest: { prototype: {} }, navigator: {} } as unknown as Parameters<typeof isolate>[0]
    const state = isolate(win, 'fixtures/x.view3.json', answerOf(VIEW))
    // A write carried by a Request object, to a path the View can answer as a read: refused, never answered.
    expect((await win.fetch(new Request(`${ORIGIN}/api/me`, { method: 'POST', body: '{}' }))).status).toBe(409)
    expect((await win.fetch('/api/me', { method: 'post' })).status).toBe(409)
    expect((await win.fetch(new URL('/api/me', ORIGIN))).status).toBe(200)
    const head = await win.fetch('/api/me', { method: 'head' })
    expect([head.status, await head.text()]).toEqual([200, ''])
    expect(state.refused.map((x) => `${x.method} ${x.url}`)).toEqual(['POST /api/me', 'POST /api/me'])
  })
  it('G8: every other way out is refused and listed: an event stream, an XHR and a beacon', () => {
    const win = { location: { origin: ORIGIN, href: `${ORIGIN}/view-gallery.html` }, fetch: () => Promise.reject(new Error('network')), XMLHttpRequest: { prototype: {} }, navigator: {} } as unknown as Parameters<typeof isolate>[0]
    const state = isolate(win, 'fixtures/x.view3.json', answerOf(VIEW))
    const w = win as unknown as { EventSource: new (u: string) => unknown; XMLHttpRequest: { prototype: { open: (m: string, u: string) => void } }; navigator: { sendBeacon: (u: string) => boolean } }
    expect(() => new w.EventSource('/api/stream')).toThrow('Refused by the view gallery.')
    expect(() => w.XMLHttpRequest.prototype.open('GET', '/api/me')).toThrow('Refused by the view gallery.')
    expect(w.navigator.sendBeacon('https://elsewhere.test/b')).toBe(false)
    expect(state.refused.map((x) => `${x.method} ${x.url} ${x.why}`)).toEqual(['EventSource /api/stream unexpected', 'XHR GET /api/me unexpected', 'beacon https://elsewhere.test/b unexpected'])
  })
  it('G9: a saved View that does not say who it is for answers that nobody is, and never invents a person', () => {
    for (const view of [{ id: 's_0123456789ab' }, { id: 's_0123456789ab', you: 'Ada' }, { id: 's_0123456789ab', you: 'Ada', you_id: 7 }]) {
      expect(decide('GET', at('/api/me'), ORIGIN, answerOf(view))).toEqual({ kind: 'answer', status: 200, body: { me: null } })
    }
    expect([READ_ONLY, NOT_SAVED_HERE]).toEqual(['The gallery is read-only: nothing is sent or saved.', 'Not in this saved View.'])
  })
  it('G6: only a whole View document for one core scenario is a frame, and its address is that scenario\'s own page', () => {
    expect(isSavedView(VIEW)).toBe(true)
    for (const doc of [null, [], { schema: 'olumi.view/2', id: 's_0123456789ab' }, { schema: 'olumi.view/3', id: 'demo' }, { schema: 'olumi.view/3' }]) expect(isSavedView(doc)).toBe(false)
    expect(frameHashOf(VIEW, 'fixtures/a b.json')).toBe('#/scenario/00000000-0000-4000-8000-0123456789ab?gf=fixtures%2Fa%20b.json')
  })
})
