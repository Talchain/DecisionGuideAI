import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { startFakeCore } from './fakeCore.mjs'
import { createServer } from '../../../scripts/olumi-core/server.mjs'
import { setTeamFetch, teamApi } from '../team/api.ts'

// Every write the Team tab makes goes through /api, so it is held to the tier R rules: the page says who it was opened for
// (x-olumi-person), only the Olumi page itself may write (no header, same-origin or none), and an identity that cannot be checked
// fails closed. Nothing of this is new server code; this proves the six team writes meet it.
const here = path.dirname(fileURLToPath(import.meta.url))
const TAB = vm.runInNewContext(fs.readFileSync(path.join(here, '../../../scripts/olumi-core/lib/tab.js'), 'utf8'))
const SID = 's_abc000000001'
const WRITES = [
  ['views', `/api/scenarios/${SID}/views`, { text: 'a view' }],
  ['views (skip)', `/api/scenarios/${SID}/views`, { skip: true }],
  ['reveal', `/api/scenarios/${SID}/reveal`, {}],
  ['evidence', `/api/scenarios/${SID}/evidence`, { text: 'e', concerns: [], stance: 'unclear' }],
  ['commitments', `/api/scenarios/${SID}/commitments`, { action: 'a', owner: '1', expect: 'e', reconsider: 'r' }],
  ['outcomes', `/api/scenarios/${SID}/commitments/1/outcomes`, { happened: 'h', versus: 'better', reconsider_triggered: false }],
]
let fake, server, base, dist
const H = (cookie, extra = {}) => ({ 'content-type': 'application/json', cookie, ...extra })
const upstream = (since) => fake.calls.slice(since).filter((c) => c.method === 'POST')

beforeAll(async () => {
  fake = await startFakeCore(); fake.addPerson('tok-ada', '1', 'Ada'); fake.addPerson('tok-bea', '2', 'Bea')
  dist = fs.mkdtempSync(path.join(os.tmpdir(), 'dgai-dist-'))
  fs.writeFileSync(path.join(dist, 'index.html'), '<!doctype html><html><head></head><body></body></html>')
  server = createServer({ coreUrl: fake.url, distDir: dist, log: 'off' })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  base = `http://127.0.0.1:${server.address().port}`
})
afterAll(async () => { setTeamFetch(null); await new Promise((r) => server.close(r)); await fake.close(); fs.rmSync(dist, { recursive: true, force: true }) })

describe('the Team tab\'s writes meet the /api rules', () => {
  for (const [name, p, body] of WRITES) {
    it(`${name}: refused before core when not from the Olumi page itself (cross-site, same-site), and when the page cannot say who it is for`, async () => {
      for (const site of ['cross-site', 'same-site']) {
        const before = fake.calls.length
        const r = await fetch(base + p, { method: 'POST', headers: H('olumi=tok-ada', { 'x-olumi-person': '1', 'sec-fetch-site': site }), body: JSON.stringify(body) })
        expect(r.status, site).toBe(403)
        expect(upstream(before)).toHaveLength(0)
      }
      const before = fake.calls.length
      expect((await fetch(base + p, { method: 'POST', headers: H('olumi=tok-ada'), body: JSON.stringify(body) })).status).toBe(409)
      expect(upstream(before)).toHaveLength(0)
    })
    it(`${name}: a page opened for Ada never writes as Bea`, async () => {
      const before = fake.calls.length
      const r = await fetch(base + p, { method: 'POST', headers: H('olumi=tok-bea', { 'x-olumi-person': '1' }), body: JSON.stringify(body) })
      expect(r.status).toBe(409)
      expect(upstream(before)).toHaveLength(0)
    })
    it(`${name}: from the page itself it goes through to core`, async () => {
      const before = fake.calls.length
      await fetch(base + p, { method: 'POST', headers: H('olumi=tok-ada', { 'x-olumi-person': '1', 'sec-fetch-site': 'same-origin' }), body: JSON.stringify(body) })
      expect(upstream(before).map((c) => c.path)).toEqual([p])
    })
  }
  it('an identity core cannot confirm fails closed for a team write too', async () => {
    const before = fake.calls.length
    const r = await fetch(base + WRITES[0][1], { method: 'POST', headers: H('olumi=tok-gone', { 'x-olumi-person': '1' }), body: JSON.stringify({ text: 'x' }) })
    expect([401, 503]).toContain(r.status)
    expect(upstream(before)).toHaveLength(0)
  })
})

describe('the page\'s own side stamps every team call with who the page was opened for', () => {
  it('every teamApi call carries x-olumi-person, as a same-origin JSON request', async () => {
    const sent = []
    const win = {
      Storage: class {}, localStorage: null, sessionStorage: null, URL, Headers, Request,
      location: { hash: '#/canvas', pathname: '/', search: '', origin: 'http://app.test', href: 'http://app.test/', replace() {} },
      document: { body: null, createElement: () => ({ setAttribute() {}, style: {} }), addEventListener() {} },
      addEventListener() {},
      fetch: async (input, init) => { sent.push({ url: String(input), headers: new Headers(init?.headers), init }); return new Response('{}', { status: 200 }) },
    }
    TAB(win, { id: '1', name: 'Ada' })
    setTeamFetch(win.fetch)
    await teamApi.giveView(SID, 'x'); await teamApi.skipView(SID); await teamApi.reveal(SID)
    await teamApi.addEvidence(SID, { text: 'e', source: null, concerns: [], stance: 'unclear' }, 'op-12345678')
    await teamApi.addCommitment(SID, { action: 'a', owner: '1', expect: 'e', reconsider: 'r', keeps: [] })
    await teamApi.addOutcome(SID, 1, { happened: 'h', versus: 'better', reconsider_triggered: false, note: null }, 'op-12345678')
    await teamApi.read(SID)
    expect(sent).toHaveLength(7)
    expect(sent.map((s) => s.headers.get('x-olumi-person'))).toEqual(Array(7).fill('1'))
    expect(sent.every((s) => s.init.mode === 'same-origin' && s.init.credentials === 'same-origin' && s.url.startsWith('/api/'))).toBe(true)
  })
})
