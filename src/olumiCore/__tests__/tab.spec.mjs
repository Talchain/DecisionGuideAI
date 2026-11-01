import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

// The page's side of the one-origin server (lib/tab.js), run exactly as the browser gets it: its source text, in a fresh context,
// against a window made of the real URL / Headers / Request classes and a Map for storage.
const here = path.dirname(fileURLToPath(import.meta.url))
const SOURCE = fs.readFileSync(path.join(here, '../../../scripts/olumi-core/lib/tab.js'), 'utf8')
const install = vm.runInNewContext(SOURCE)
const U = '11111111-2222-4333-8444-555555555555'
const uuidN = (i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`

function pageFor(person, { storage = new Map(), session = new Map(), hash = '#/canvas', answer = () => new Response('{}', { status: 200 }), storageRefuses = false } = {}) {
  const sent = []
  // Its own Storage class per page, because the script patches the class's prototype (as it must in a browser, where assigning
  // a property on a Storage instance would store an ITEM).
  class FakeStorage {
    constructor(map) { this.map = map }
    getItem(k) { if (storageRefuses) throw new Error('denied'); return this.map.has(k) ? this.map.get(k) : null }
    setItem(k, v) { if (storageRefuses) throw new Error('denied'); this.map.set(k, String(v)) }
    removeItem(k) { this.map.delete(k) }
    clear() { if (storageRefuses) throw new Error('denied'); this.map.clear() }
  }
  const shown = []
  const listeners = {}
  const win = {
    Storage: FakeStorage, localStorage: new FakeStorage(storage), sessionStorage: new FakeStorage(session), URL, Headers, Request,
    location: { hash, pathname: '/', search: '', origin: 'http://app.test', href: 'http://app.test/', replace(u) { win.location.replaced = u } },
    document: { body: { appendChild: (el) => shown.push(el) }, createElement: () => ({ setAttribute(k, v) { this[k] = v }, style: {} }), addEventListener() {} },
    addEventListener: (name, fn) => { (listeners[name] ??= []).push(fn) },
    fetch: async (input, init) => { const req = input instanceof Request ? input : null; sent.push({ url: req ? req.url : String(input), headers: new Headers(req ? req.headers : init?.headers), init }); return answer(sent.at(-1)) },
  }
  install(win, person)
  const fire = (name, ev = {}) => (listeners[name] ?? []).forEach((fn) => fn(ev))
  return { win, sent, storage, session, shown, fire }
}
const ADA = { id: '1', name: 'Ada' }
const BEA = { id: '2', name: 'Bea' }
const turnTo = (uuid) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'message', scenario_id: uuid, message: 'hi' }) })

describe('the page says who it was opened for (finding: an open tab must not write as somebody else)', () => {
  it('every call to the server\'s /bff/ and /api/ routes carries the person this tab was opened for; other addresses are left alone', async () => {
    const { win, sent } = pageFor(ADA)
    await win.fetch('/bff/orchestrate/v2/turn', turnTo(U))
    await win.fetch('/bff/cee/scenarios/' + U + '/graph', { method: 'POST', body: '{}' })
    await win.fetch('/api/me')
    await win.fetch('https://elsewhere.test/bff/x')
    expect(sent.map((s) => s.headers.get('x-olumi-person'))).toEqual(['1', '1', '1', null])
    expect(sent[0].headers.get('content-type')).toBe('application/json')
    expect(sent[0].init.body).toContain('"message":"hi"')
  })
  it('a Request object is carried the same way, its body untouched', async () => {
    const { win, sent } = pageFor(ADA)
    await win.fetch(new Request('http://app.test/bff/orchestrate/v2/turn', turnTo(U)))
    expect(sent[0].headers.get('x-olumi-person')).toBe('1')
    expect(sent[0].headers.get('content-type')).toBe('application/json')
  })
  it('exposes the person to DGAI, and sends a bare address to the canvas', () => {
    const { win } = pageFor(ADA, { hash: '' })
    expect(win.__OLUMI_CORE__).toEqual({ person: ADA })
    expect(win.location.replaced).toBe('/#/canvas')
    expect(pageFor(ADA, { hash: '#/scenario/' + U }).win.location.replaced).toBeUndefined()
  })
})

describe('a scenario pairing lives in the browser, uncapped, and rides only on the calls that name that scenario (findings 5 and 6)', () => {
  const aliasAnswer = (uuid, sid) => () => new Response('{}', { status: 200, headers: { 'x-olumi-alias': `${uuid}=${sid}` } })
  it('is learned from the answer and sent back for that scenario, in a turn\'s body and in a read\'s path, and for no other', async () => {
    let answer = aliasAnswer(U, 's_abc123')
    const { win, sent, storage } = pageFor(ADA, { answer: () => answer() })
    await win.fetch('/bff/orchestrate/v2/turn', turnTo(U))
    answer = () => new Response('{}', { status: 200 })
    await win.fetch('/bff/orchestrate/v2/turn', turnTo(U))
    await win.fetch('/bff/cee/scenarios/' + U + '/graph', { method: 'POST', body: '{}' })
    await win.fetch('/bff/orchestrate/v2/turn', turnTo(uuidN(7)))
    expect(sent.map((s) => s.headers.get('x-olumi-scenario'))).toEqual([null, `${U}=s_abc123`, `${U}=s_abc123`, null])
    expect(storage.get('olumi-core-sc:' + U)).toBe('s_abc123')
  })
  it('does not forget the first scenario when more are started: 40 scenarios in one browser are all still paired', async () => {
    let i = 0
    const { win, sent } = pageFor(ADA, { answer: () => new Response('{}', { status: 200, headers: { 'x-olumi-alias': `${uuidN(i)}=s_${String(i).padStart(12, '0')}` } }) })
    for (i = 0; i < 40; i++) await win.fetch('/bff/orchestrate/v2/turn', turnTo(uuidN(i)))
    sent.length = 0
    await win.fetch('/bff/cee/scenarios/' + uuidN(0) + '/graph', { method: 'POST', body: '{}' })
    expect(sent[0].headers.get('x-olumi-scenario')).toBe(`${uuidN(0)}=s_000000000000`)
  })
  it('a pairing is the same person\'s only: a different person\'s link clears it with the rest of the saved state', async () => {
    const storage = new Map()
    const a = pageFor(ADA, { storage, answer: () => new Response('{}', { headers: { 'x-olumi-alias': `${U}=s_abc123` } }) })
    await a.win.fetch('/bff/orchestrate/v2/turn', turnTo(U))
    expect(storage.get('olumi-core-sc:' + U)).toBe('s_abc123')
    storage.set('olumi-canvas-autosave', '{"their":"model"}')
    // the same person's next visit keeps all of it
    pageFor(ADA, { storage })
    expect(storage.get('olumi-core-sc:' + U)).toBe('s_abc123')
    expect(storage.get('olumi-canvas-autosave')).toBeDefined()
    // another person's link in the same browser starts clean
    pageFor(BEA, { storage })
    expect(storage.get('olumi-core-sc:' + U)).toBeUndefined()
    expect(storage.get('olumi-canvas-autosave')).toBeUndefined()
    expect(storage.get('olumi-core-person')).toBe('2')
  })
  it('a pairing in the answer that is not a UUID and a core scenario id is ignored', async () => {
    const { win, storage } = pageFor(ADA, { answer: () => new Response('{}', { headers: { 'x-olumi-alias': 'nonsense=<script>' } }) })
    await win.fetch('/bff/orchestrate/v2/turn', turnTo(U))
    expect([...storage.keys()].filter((k) => k.startsWith('olumi-core-sc:'))).toEqual([])
  })
  it('storage that refuses (a private window) breaks nothing: calls still go, without a pairing', async () => {
    const { win, sent } = pageFor(ADA, { storageRefuses: true, answer: () => new Response('{}', { headers: { 'x-olumi-alias': `${U}=s_abc123` } }) })
    await win.fetch('/bff/orchestrate/v2/turn', turnTo(U))
    expect(sent[0].headers.get('x-olumi-person')).toBe('1')
  })
})

describe('an address that names a scenario this person cannot open says so', () => {
  it('a 404 or a 401 on the saved-model read puts a notice on the page', async () => {
    for (const status of [404, 401]) {
      const { shown } = pageFor(ADA, { hash: '#/scenario/' + U, answer: () => new Response('{}', { status }) })
      await new Promise((r) => setTimeout(r, 5))
      expect(shown, String(status)).toHaveLength(1)
    }
  })
  it('a scenario that reads fine puts nothing on the page', async () => {
    const { shown } = pageFor(ADA, { hash: '#/scenario/' + U })
    await new Promise((r) => setTimeout(r, 5))
    expect(shown).toHaveLength(0)
  })
})

describe('a tab that was one person\'s leaves nothing of theirs for the next, and never takes the current person\'s (the cross-person leak a reload revealed, and the wipe its first fix caused)', () => {
  it('learns from another tab that the browser changed person: says so, and writes nothing more to the shared storage', () => {
    const storage = new Map()
    const ada = pageFor(ADA, { storage })
    ada.win.localStorage.setItem('olumi-canvas-autosave', 'ada-before')
    expect(ada.shown).toHaveLength(0)
    // another tab (Bea's) clears the storage and names Bea in it
    storage.clear(); storage.set('olumi-core-person', '2')
    ada.fire('storage', { key: null }); ada.fire('storage', { key: 'olumi-core-person' })
    expect(ada.shown).toHaveLength(1)
    expect(ada.shown[0]['data-testid']).toBe('olumi-core-page-for-someone-else')
    // Ada's page, being closed or reloaded, tries to save her model: it goes nowhere
    ada.win.localStorage.setItem('olumi-canvas-autosave', 'ADA-MODEL')
    ada.win.localStorage.removeItem('olumi-core-person')
    ada.win.localStorage.clear()
    expect(storage.get('olumi-canvas-autosave')).toBeUndefined()
    expect(storage.get('olumi-core-person')).toBe('2')
  })
  it('does not mistake a clear by another tab of the SAME person for a change of person', () => {
    const storage = new Map()
    const ada = pageFor(ADA, { storage })
    storage.clear()
    ada.fire('storage', { key: null })
    expect(ada.shown).toHaveLength(0)
    ada.win.localStorage.setItem('x', '1')
    expect(storage.get('x')).toBe('1')
  })
  it('a change of person is also noticed when the tab is next looked at (focus), not only by an event', () => {
    const storage = new Map()
    const ada = pageFor(ADA, { storage })
    storage.set('olumi-core-person', '2')
    ada.fire('focus')
    expect(ada.shown).toHaveLength(1)
  })
  it('a tab that was Ada\'s and is reloaded as Bea (Bea\'s page already holds the shared storage) leaves Bea\'s saved state alone: her scenario pairing and autosave survive (finding: a stale tab\'s reload wiped the current person\'s pairing)', () => {
    const storage = new Map(), session = new Map()
    pageFor(ADA, { storage, session })
    // Bea took the link in another tab: storage now names Bea and holds HER scenario pairing and autosave
    storage.set('olumi-core-person', '2'); storage.set('olumi-core-sc:' + U, 's_bea0000000001'); storage.set('olumi-canvas-autosave', 'BEA-MODEL')
    // Ada's old tab reloads, now opened for Bea
    pageFor(BEA, { storage, session })
    expect(storage.get('olumi-core-sc:' + U)).toBe('s_bea0000000001')
    expect(storage.get('olumi-canvas-autosave')).toBe('BEA-MODEL')
    expect(storage.get('olumi-core-person')).toBe('2')
    // the tab's own memory of who it was is Bea's now
    expect(session.get('olumi-core-tab-person')).toBe('2')
  })
  it('a tab that was Ada\'s and is restored under Bea\'s link when storage still names ADA starts clean (the shared storage was never Bea\'s)', () => {
    const storage = new Map(), session = new Map()
    pageFor(ADA, { storage, session })
    storage.set('olumi-core-sc:' + U, 's_ada0000000001'); storage.set('olumi-canvas-autosave', 'ADA-MODEL')
    pageFor(BEA, { storage, session })
    expect(storage.get('olumi-core-sc:' + U)).toBeUndefined()
    expect(storage.get('olumi-canvas-autosave')).toBeUndefined()
    expect(storage.get('olumi-core-person')).toBe('2')
  })
  it('Ada\'s old document cannot save her model into Bea\'s storage even if no event or focus told it: each write first checks whose storage this is', () => {
    const storage = new Map()
    const ada = pageFor(ADA, { storage })
    // Bea took the link in another tab; this tab was in the background and heard nothing
    storage.clear(); storage.set('olumi-core-person', '2')
    ada.win.localStorage.setItem('olumi-canvas-autosave', 'ADA-MODEL')   // its unload save
    expect(storage.get('olumi-canvas-autosave')).toBeUndefined()
    expect(ada.shown).toHaveLength(1)
    expect(storage.get('olumi-core-person')).toBe('2')
  })
  it('a write by the person the storage names still goes through', () => {
    const storage = new Map()
    const ada = pageFor(ADA, { storage })
    ada.win.localStorage.setItem('olumi-canvas-autosave', 'ADA-MODEL')
    expect(storage.get('olumi-canvas-autosave')).toBe('ADA-MODEL')
    expect(ada.shown).toHaveLength(0)
  })
})

describe('the page says which model it last read, so a stale tab cannot overwrite a newer figure', () => {
  it('the revision the server put on an answer for a scenario is sent back on the calls that name that scenario, and only those', async () => {
    const answer = (s) => new Response('{}', { status: 200, headers: s.url.includes('/graph') ? { 'x-olumi-revision': '0123456789abcdef' } : {} })
    const { win, sent } = pageFor(ADA, { answer })
    await win.fetch('/bff/cee/scenarios/' + U + '/graph', { method: 'POST', body: '{}' })
    await win.fetch('/bff/orchestrate/v2/turn', turnTo(U))
    await win.fetch('/bff/orchestrate/v2/turn', turnTo('99999999-2222-4333-8444-555555555555'))
    expect(sent.map((s) => s.headers.get('x-olumi-revision'))).toEqual([null, '0123456789abcdef', null])
  })
})
