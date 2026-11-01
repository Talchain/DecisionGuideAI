import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import net from 'node:net'
import { startFakeCore } from './fakeCore.mjs'
import { createServer, LINK_PAGE } from '../../../scripts/olumi-core/server.mjs'

let fake, server, base, dist
const BRIEF = 'a brief'
// The page says who it was opened for on every /bff/ call (lib/tab.js): by default the person whose cookie the browser sends.
const PERSON_OF = { 'olumi=tok-ada': '1', 'olumi=tok-bea': '2' }
const H = (cookie, extra = {}) => ({ headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}), ...(PERSON_OF[cookie] ? { 'x-olumi-person': PERSON_OF[cookie] } : {}), ...extra }, redirect: 'manual' })
const post = (p, body, cookie, extra) => fetch(base + p, { method: 'POST', ...H(cookie, extra), body: JSON.stringify(body) })
const U = '11111111-2222-4333-8444-555555555555'
const turn = (message, cookie, extra = {}, headers) => post('/bff/orchestrate/v2/turn', { kind: 'message', turn_id: crypto.randomUUID(), scenario_id: U, stage: 'frame', message, source: 'composer', ...extra }, cookie, headers)

beforeAll(async () => {
  fake = await startFakeCore(); fake.addPerson('tok-ada', '1', 'Ada'); fake.addPerson('tok-bea', '2', 'Bea')
  dist = fs.mkdtempSync(path.join(os.tmpdir(), 'dgai-dist-'))
  fs.mkdirSync(path.join(dist, 'assets'))
  fs.writeFileSync(path.join(dist, 'index.html'), '<!doctype html><html><head><title>DGAI</title></head><body>the app</body></html>')
  fs.writeFileSync(path.join(dist, 'assets', 'app-abc123.js'), 'console.log(1)')
  server = createServer({ coreUrl: fake.url, distDir: dist, log: 'off' })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  base = `http://127.0.0.1:${server.address().port}`
})
afterAll(async () => { await new Promise((r) => server.close(r)); await fake.close(); fs.rmSync(dist, { recursive: true, force: true }) })

describe('one origin: the app, the private link, the API and the health check', () => {
  it('a browser with no private link gets the plain "open your link" page, never the app or an empty canvas', async () => {
    const r = await fetch(base + '/', { redirect: 'manual' })
    expect(r.status).toBe(401)
    const html = await r.text()
    expect(html).toContain('Open your private link')
    expect(html).not.toContain('the app')
    expect(LINK_PAGE('x')).toContain('Open your private link')
  })
  it('a private link is proxied: core\'s cookie passes through and the redirect lands in DGAI (the canvas, or that scenario)', async () => {
    const r = await fetch(base + '/k/tok-ada', { redirect: 'manual' })
    expect(r.status).toBe(302)
    expect(r.headers.get('set-cookie')).toMatch(/^olumi=tok-ada; Path=\/; HttpOnly/)
    expect(r.headers.get('location')).toBe('/#/canvas')
    const to = await fetch(base + '/k/tok-ada?to=/s/s_abc000000001', { redirect: 'manual' })
    expect(to.headers.get('location')).toBe('/#/scenario/00000000-0000-4000-8000-abc000000001')
  })
  it('an invalid link is core\'s own 404 text, passed through', async () => {
    const r = await fetch(base + '/k/not-a-token', { redirect: 'manual' })
    expect(r.status).toBe(404); expect(await r.text()).toBe('This link is not valid.')
  })
  it('with a valid cookie the app is served, with the person injected before it starts (it clears a previous person\'s saved state)', async () => {
    const r = await fetch(base + '/', { headers: { cookie: 'olumi=tok-ada' } })
    expect(r.status).toBe(200)
    const html = await r.text()
    expect(html).toContain('the app')
    expect(html).toContain('{"id":"1","name":"Ada"})</script>')
    expect(html).toContain('olumi-core-person')
    expect(html.indexOf('olumi-core-person')).toBeLessThan(html.indexOf('<title>'))
  })
  it('an expired or revoked cookie is the same page as none', async () => {
    expect((await fetch(base + '/', { headers: { cookie: 'olumi=tok-gone' } })).status).toBe(401)
  })
  it('/s/<id> opens that scenario in the app for a person core knows, and is the link page for anyone else', async () => {
    const r = await fetch(base + '/s/s_abc000000001', { headers: { cookie: 'olumi=tok-ada' }, redirect: 'manual' })
    expect(r.status).toBe(302); expect(r.headers.get('location')).toBe('/#/scenario/00000000-0000-4000-8000-abc000000001')
    expect((await fetch(base + '/s/s_abc000000001', { redirect: 'manual' })).status).toBe(401)
  })
  it('serves the built files, immutable when hashed; an unknown file is a 404, not the app', async () => {
    const r = await fetch(base + '/assets/app-abc123.js')
    expect(r.status).toBe(200); expect(r.headers.get('cache-control')).toMatch(/immutable/); expect(r.headers.get('content-type')).toMatch(/javascript/)
    expect((await fetch(base + '/assets/missing.js')).status).toBe(404)
    expect((await fetch(base + '/..%2f..%2fetc/passwd')).status).not.toBe(200)
  })
  it('the API is proxied with the browser\'s own cookie, and core\'s 401 reaches the browser', async () => {
    const me = await (await fetch(base + '/api/me', { headers: { cookie: 'olumi=tok-bea' } })).json()
    expect(me.me).toEqual({ id: '2', name: 'Bea' })
    expect((await fetch(base + '/api/scenarios/s_abc000000001')).status).toBe(401)
  })
  it('the admin routes are not reachable from this origin and never reach core', async () => {
    const before = fake.calls.length
    const r = await fetch(base + '/api/admin/people', { method: 'POST', headers: { 'x-olumi-admin': 'k'.repeat(30) } })
    expect(r.status).toBe(404)
    expect(fake.calls.slice(before).some((c) => c.path.startsWith('/api/admin'))).toBe(false)
  })
  it('the admin routes are not reachable however they are spelled', async () => {
    const before = fake.calls.length
    for (const p of ['/api/admin', '/api/admin/', '/api//admin/people', '/api/ADMIN/people']) {
      for (const method of ['GET', 'POST']) {
        const r = await fetch(base + p, { method, headers: { 'content-type': 'application/json', cookie: 'olumi=tok-ada', 'x-olumi-person': '1' }, ...(method === 'POST' ? { body: '{}' } : {}) })
        expect(r.status, `${method} ${p}`).toBe(404)
      }
    }
    expect(fake.calls.slice(before).some((c) => /admin/i.test(c.path))).toBe(false)
  })
  it('core is sent the ONE olumi cookie the identity was checked on, never the browser\'s raw header', async () => {
    const seen = []
    const spy = createServer({ coreUrl: fake.url, distDir: dist, log: 'off', fetchImpl: (url, init) => { seen.push({ url: String(url), cookie: init?.headers?.cookie }); return fetch(url, init) } })
    await new Promise((r) => spy.listen(0, '127.0.0.1', r))
    const r = await fetch(`http://127.0.0.1:${spy.address().port}/api/scenarios`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-olumi-person': '1', cookie: 'olumi=tok-ada; olumi=tok-bea; other=1' }, body: JSON.stringify({ brief: BRIEF }) })
    expect(r.status).toBe(201)
    const sent = seen.find((x) => x.url.endsWith('/api/scenarios') && x.cookie !== undefined)
    expect(sent.cookie).toBe('olumi=tok-ada')
    await new Promise((r2) => spy.close(r2))
  })
  it('the health check reports this server and core, and is 503 when core is down', async () => {
    expect(await (await fetch(base + '/healthz')).json()).toMatchObject({ ok: true, core: { ok: true } })
    const down = createServer({ coreUrl: 'http://127.0.0.1:1', distDir: dist, log: 'off' })
    await new Promise((r) => down.listen(0, '127.0.0.1', r))
    const r = await fetch(`http://127.0.0.1:${down.address().port}/healthz`)
    expect(r.status).toBe(503)
    await new Promise((r2) => down.close(r2))
  })
  it('what only CEE had is a plain 404, so the draft stream falls back to the buffered turn', async () => {
    expect((await post('/bff/orchestrate/v2/turn/stream', {}, 'olumi=tok-ada')).status).toBe(404)
    expect((await fetch(base + '/bff/cee/prompts/warm', { method: 'POST' })).status).toBe(404)
  })
})

/** One raw request line, sent as written (fetch would normalise a hostile target before it left the client). */
const raw = (line) => new Promise((resolve, reject) => {
  const sock = net.connect(Number(new URL(base).port), '127.0.0.1')
  let data = ''
  sock.on('data', (d) => { data += d }); sock.on('error', reject); sock.on('close', () => resolve(data))
  sock.write(`${line} HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n`)
})

describe('a hostile request line cannot take the single origin down for everyone', () => {
  for (const target of ['//', '//evil.example/x', 'http://evil.example/', '*', '/%E0%A4%A', '/assets/%E0%A4%A']) {
    const must400 = !target.startsWith('/%') && !target.startsWith('/assets')
    it(`GET ${target} is answered with a 4xx, and the server still answers the next person`, async () => {
      const answer = await raw(`GET ${target}`)
      expect(answer).toMatch(/^HTTP\/1\.1 4\d\d /)
      if (must400) expect(answer).toMatch(/^HTTP\/1\.1 400 /)
      expect((await fetch(base + '/healthz')).status).toBe(200)
    })
  }
})

describe('identity: each browser is its own person (gap 3)', () => {
  it('two browsers with two cookies are two people: each turn reaches core with that browser\'s own token, never one held by the server', async () => {
    const before = fake.calls.length
    const a = await (await turn(BRIEF, 'olumi=tok-ada')).json()
    const b = await (await turn(BRIEF, 'olumi=tok-bea')).json()
    expect(a.error).toBeNull(); expect(b.error).toBeNull()
    const posts = fake.calls.slice(before).filter((c) => c.method === 'POST' && c.path === '/api/scenarios')
    expect(posts.map((c) => c.token)).toEqual(['tok-ada', 'tok-bea'])
    const owners = [...fake.scenarios.values()].map((s) => s.owner)
    expect(owners.slice(-2)).toEqual(['1', '2'])
  })
  it('a turn with no cookie is the "open your private link" failure, in the turn, not a hang', async () => {
    const out = await (await turn(BRIEF, null)).json()
    expect(out.error).toMatchObject({ code: 'unauthorised' })
  })
  it('a scenario started in a browser is paired with its UUID by the page, not the server: the answer names the pairing, and a call that brings it back finds the scenario (another person cannot)', async () => {
    const r = await turn(BRIEF, 'olumi=tok-ada')
    const alias = r.headers.get('x-olumi-alias')
    expect(alias).toMatch(new RegExp(`^${U}=s_[0-9a-f]+$`))
    expect(r.headers.get('set-cookie')).toBeNull()   // no cookie, so nothing capped and nothing one tab overwrites for another
    const read = (cookie, extra) => fetch(`${base}/bff/cee/scenarios/${U}/graph`, { method: 'POST', ...H(cookie, extra), body: '{}' })
    const own = await (await read('olumi=tok-ada', { 'x-olumi-scenario': alias })).json()
    expect(own.graph_present).toBe(true)
    const nobody = await (await read('olumi=tok-ada')).json()
    expect(nobody.graph_present).toBe(false)
    expect((await read('olumi=tok-bea', { 'x-olumi-scenario': alias })).status).toBe(404)
  })
  it('a pairing header that is not a UUID and a core scenario id names nothing', async () => {
    const r = await fetch(`${base}/bff/cee/scenarios/${U}/graph`, { method: 'POST', ...H('olumi=tok-ada', { 'x-olumi-scenario': `${U}=../../etc` }), body: '{}' })
    expect((await r.json()).graph_present).toBe(false)
  })
  it('a second person landing through a link that adds them to a scenario opens it by its derived UUID, with their own cookie', async () => {
    const sid = [...fake.scenarios.keys()].at(-1)
    const derived = `00000000-0000-4000-8000-${sid.slice(2)}`
    // the fake treats ownership as one person's, so Bea cannot read it; what the link must do is hand her the right route
    const land = await fetch(`${base}/k/tok-bea?to=/s/${sid}`, { redirect: 'manual' })
    expect(land.headers.get('location')).toBe(`/#/scenario/${derived}`)
    expect(land.headers.get('set-cookie')).toMatch(/olumi=tok-bea/)
  })
  it('a link that names no scenario lands on the person\'s most recent one (a new device opens their work, not a blank canvas); with none it lands on the canvas', async () => {
    const mine = [...fake.scenarios].filter(([, s]) => s.owner === '1').map(([id]) => id)
    expect(mine.length).toBeGreaterThan(1)
    const land = await fetch(base + '/k/tok-ada', { redirect: 'manual' })
    expect(land.headers.get('location')).toBe(`/#/scenario/00000000-0000-4000-8000-${mine.at(-1).slice(2)}`)
    fake.addPerson('tok-new', '9', 'Nia')
    expect((await fetch(base + '/k/tok-new', { redirect: 'manual' })).headers.get('location')).toBe('/#/canvas')
  })
  it('a scenario address this person cannot open is said, not shown as a blank canvas: the page carries the notice and the check', async () => {
    const html = await (await fetch(base + '/', { headers: { cookie: 'olumi=tok-ada' } })).text()
    expect(html).toContain('olumi-core-scenario-unavailable')
    expect(html).toContain("'/bff/cee/scenarios/' + named[1] + '/graph'")
    expect(html).toMatch(/That scenario is not available to you/)
  })
  it('a malformed turn body is a 400, not a crash', async () => {
    const r = await fetch(base + '/bff/orchestrate/v2/turn', { method: 'POST', headers: { 'content-type': 'application/json', cookie: 'olumi=tok-ada' }, body: '{nope' })
    expect(r.status).toBe(400)
    for (const body of ['null', '[]', '"a turn"', '7']) {
      const bad = await fetch(base + '/bff/orchestrate/v2/turn', { method: 'POST', headers: { 'content-type': 'application/json', cookie: 'olumi=tok-ada', 'x-olumi-person': '1' }, body })
      expect(bad.status, body).toBe(400)
    }
  })
})

describe('an open tab cannot write as somebody else (the browser\'s private link changed since the tab was opened)', () => {
  const writes = (since) => fake.calls.slice(since).filter((c) => c.method === 'POST')
  it('a turn from a tab opened for Ada, while the browser now holds Bea\'s link, saves nothing and says to reload', async () => {
    const before = fake.calls.length
    const out = await (await turn(BRIEF, 'olumi=tok-bea', {}, { 'x-olumi-person': '1' })).json()
    expect(out.error).toMatchObject({ code: 'identity_changed', retry_safe: false, nothing_saved: true })
    expect(out.error.message).toMatch(/different private link/)
    expect(out.error.message).toMatch(/Reload/)
    expect(writes(before)).toHaveLength(0)
  })
  it('the same turn from a tab opened for Bea goes through, as Bea', async () => {
    const before = fake.calls.length
    const out = await (await turn(BRIEF, 'olumi=tok-bea')).json()
    expect(out.error).toBeNull()
    expect(writes(before).map((c) => c.token)).toEqual(['tok-bea'])
  })
  it('a page that does not say who it was opened for (an old tab, a script) cannot write either: it fails closed', async () => {
    const before = fake.calls.length
    const out = await (await post('/bff/orchestrate/v2/turn', { kind: 'message', turn_id: crypto.randomUUID(), scenario_id: U, stage: 'frame', message: BRIEF, source: 'composer' }, 'olumi=tok-ada', { 'x-olumi-person': '' })).json()
    const bare = await fetch(base + '/bff/orchestrate/v2/turn', { method: 'POST', headers: { 'content-type': 'application/json', cookie: 'olumi=tok-ada' }, body: JSON.stringify({ kind: 'message', scenario_id: U, message: BRIEF }) })
    expect((await bare.json()).error).toMatchObject({ code: 'identity_changed', nothing_saved: true })
    expect(out.error).toMatchObject({ code: 'identity_changed' })
    expect(writes(before)).toHaveLength(0)
  })
  it('a read from a tab opened for someone else is refused in words, not answered with the new person\'s scenarios', async () => {
    const r = await fetch(`${base}/bff/cee/scenarios/${U}/graph`, { method: 'POST', ...H('olumi=tok-bea', { 'x-olumi-person': '1' }), body: '{}' })
    expect(r.status).toBe(409)
    expect((await r.json()).error).toMatch(/different private link/)
  })
  it('a browser with no valid link still gets "open your private link", not the identity message', async () => {
    const out = await (await turn(BRIEF, 'olumi=tok-gone', {}, { 'x-olumi-person': '1' })).json()
    expect(out.error).toMatchObject({ code: 'unauthorised' })
  })
})

describe('every write path takes JSON only, as core does: anything else is a 415 here, and NOTHING reaches core (security)', () => {
  const asType = (p, type, body, extra = {}) => fetch(base + p, { method: 'POST', headers: { ...(type ? { 'content-type': type } : {}), cookie: 'olumi=tok-ada', 'x-olumi-person': '1', ...extra }, body })
  const TURN = JSON.stringify({ kind: 'message', turn_id: crypto.randomUUID(), scenario_id: U, stage: 'frame', message: BRIEF, source: 'composer' })
  it('the chat turn sent as text/plain with valid JSON and the right identity is refused with 415 and nothing goes upstream', async () => {
    const before = fake.calls.length
    const r = await asType('/bff/orchestrate/v2/turn', 'text/plain', TURN)
    expect(r.status).toBe(415)
    expect((await r.json()).error).toMatch(/JSON/)
    expect(fake.calls.length).toBe(before)   // not even the identity check was made
  })
  it('so is every other type that is not JSON, or no type at all, on the turn, the API and the private link', async () => {
    const before = fake.calls.length
    for (const type of ['text/plain', 'application/x-www-form-urlencoded', 'multipart/form-data; boundary=x', 'application/jsonp', 'application/xml', '']) {
      for (const p of ['/bff/orchestrate/v2/turn', '/api/scenarios', '/api/scenarios/s_abc123/messages', '/api/proposals/5/approve', '/k/tok-ada']) {
        expect((await asType(p, type, TURN)).status, `${type || '(none)'} ${p}`).toBe(415)
      }
    }
    expect(fake.calls.length).toBe(before)
  })
  it('a write by another method (PUT, PATCH, DELETE) is held to it too', async () => {
    const before = fake.calls.length
    for (const method of ['PUT', 'PATCH', 'DELETE']) {
      const r = await fetch(base + '/api/scenarios/s_abc123', { method, headers: { 'content-type': 'text/plain', cookie: 'olumi=tok-ada', 'x-olumi-person': '1' }, body: '{}' })
      expect(r.status, method).toBe(415)
    }
    expect(fake.calls.length).toBe(before)
  })
  it('JSON still goes through, with or without a charset', async () => {
    for (const type of ['application/json', 'application/json; charset=utf-8', 'Application/JSON']) {
      const before = fake.calls.length
      const r = await asType('/api/scenarios', type, JSON.stringify({ brief: BRIEF }))
      expect(r.status, type).toBe(201)
      expect(fake.calls.slice(before).filter((c) => c.method === 'POST')).toHaveLength(1)
    }
    const out = await (await asType('/bff/orchestrate/v2/turn', 'application/json; charset=utf-8', TURN)).json()
    expect(out.error).toBeNull()
  })
  it('a read is not a write: the saved-model read and GETs need no body type', async () => {
    expect((await fetch(`${base}/bff/cee/scenarios/${U}/graph`, { method: 'POST', headers: { cookie: 'olumi=tok-ada', 'x-olumi-person': '1' } })).status).not.toBe(415)
    expect((await fetch(base + '/api/me', { headers: { cookie: 'olumi=tok-ada' } })).status).toBe(200)
  })
})

describe('the API is held to the same rules as the /bff writes (security: a cross-site or other person\'s write never reaches core)', () => {
  const upstream = (since) => fake.calls.slice(since).filter((c) => c.method === 'POST')
  const apiPost = (cookie, headers = {}) => fetch(base + '/api/scenarios', { method: 'POST', ...H(cookie, headers), body: JSON.stringify({ brief: BRIEF }) })
  it('a cross-site POST to /api is refused with a 403 before it reaches core', async () => {
    const before = fake.calls.length
    const r = await apiPost('olumi=tok-ada', { 'sec-fetch-site': 'cross-site' })
    expect(r.status).toBe(403)
    expect(upstream(before)).toHaveLength(0)
  })
  it('a cross-site POST to the chat turn is refused the same way', async () => {
    const before = fake.calls.length
    const r = await turn(BRIEF, 'olumi=tok-ada', {}, { 'sec-fetch-site': 'cross-site' })
    expect(r.status).toBe(403)
    expect(upstream(before)).toHaveLength(0)
  })
  it('a write from the Olumi page itself passes (same-origin, a browser address bar `none`, or no header at all), and core is told where it came from', async () => {
    for (const site of ['same-origin', 'none', null]) {
      const before = fake.calls.length
      const r = await apiPost('olumi=tok-ada', site ? { 'sec-fetch-site': site } : {})
      expect(r.status).toBe(201)
      const sent = upstream(before)
      expect(sent).toHaveLength(1)
      expect(sent[0]).toMatchObject({ path: '/api/scenarios', token: 'tok-ada', site })
    }
  })
  it('a SAME-SITE write is refused as core refuses it (only the Olumi page itself may change things), here and on the chat turn, and nothing reaches core', async () => {
    const before = fake.calls.length
    const r = await apiPost('olumi=tok-ada', { 'sec-fetch-site': 'same-site' })
    expect(r.status).toBe(403)
    expect((await turn(BRIEF, 'olumi=tok-ada', {}, { 'sec-fetch-site': 'same-site' })).status).toBe(403)
    expect(upstream(before)).toHaveLength(0)
    // and the fake is core's real rule: asked directly, it says the same
    const direct = await fetch(fake.url + '/api/scenarios', { method: 'POST', headers: { 'content-type': 'application/json', cookie: 'olumi=tok-ada', 'sec-fetch-site': 'same-site' }, body: '{}' })
    expect(direct.status).toBe(403)
  })
  it('a write from a page opened for someone else, or one that cannot say who it was opened for, is refused in words and never reaches core', async () => {
    const before = fake.calls.length
    const other = await apiPost('olumi=tok-bea', { 'x-olumi-person': '1' })
    expect(other.status).toBe(409)
    expect((await other.json()).error).toMatch(/different private link/)
    const unsaid = await apiPost('olumi=tok-ada', { 'x-olumi-person': '' })
    expect(unsaid.status).toBe(409)
    expect(upstream(before)).toHaveLength(0)
  })
  it('Codex 1: a READ from a page opened for Ada, while the browser holds Bea\'s link, is refused and never reaches core (Bea\'s private view must not reach Ada\'s tab)', async () => {
    const before = fake.calls.length
    const r = await fetch(`${base}/api/scenarios/s_abc123`, { method: 'GET', headers: { cookie: 'olumi=tok-bea', 'x-olumi-person': '1' } })
    expect(r.status).toBe(409)
    expect((await r.json()).error).toMatch(/different private link/)
    expect(upstream(before)).toHaveLength(0)
    // the right person's tab, and a read from no page at all, go through to core as before
    const mine = await fetch(`${base}/api/scenarios/s_abc123`, { method: 'GET', headers: { cookie: 'olumi=tok-ada', 'x-olumi-person': '1' } })
    expect(mine.status).not.toBe(409)
    const noPage = await fetch(`${base}/api/me`, { method: 'GET', headers: { cookie: 'olumi=tok-bea' } })
    expect(noPage.status).toBe(200)
  })
  describe('a write whose identity cannot be checked FAILS CLOSED (security: Ada\'s tab with Bea\'s cookie must not write as Bea because /api/me hiccuped)', () => {
    afterEach(() => fake.meDown(null))
    it('an API write is refused (503) and nothing reaches core but the identity question itself', async () => {
      const before = fake.calls.length
      fake.meDown(500)
      // Ada's tab (x-olumi-person 1) while the browser holds Bea's cookie: the case the lookup exists to stop
      const r = await apiPost('olumi=tok-bea', { 'x-olumi-person': '1' })
      expect(r.status).toBe(503)
      expect((await r.json()).error).toMatch(/Nothing was saved/)
      expect(upstream(before)).toHaveLength(0)
      expect(fake.calls.slice(before).every((c) => c.path === '/api/me')).toBe(true)
    })
    it('the same when core cannot be reached at all for the lookup, even for the right person', async () => {
      const before = fake.calls.length
      fake.meDown(503)
      const r = await apiPost('olumi=tok-ada', {})
      expect(r.status).toBe(503)
      expect(upstream(before)).toHaveLength(0)
    })
    it('the chat turn is refused in words, saving nothing', async () => {
      const before = fake.calls.length
      fake.meDown(500)
      const out = await (await turn(BRIEF, 'olumi=tok-bea', {}, { 'x-olumi-person': '1' })).json()
      expect(out.error).toMatchObject({ nothing_saved: true })
      expect(out.cards).toEqual([])
      expect(upstream(before)).toHaveLength(0)
    })
    it('a saved-model read is not answered either, rather than shown to a page opened for someone else', async () => {
      fake.meDown(500)
      const r = await fetch(`${base}/bff/cee/scenarios/${U}/graph`, { method: 'POST', ...H('olumi=tok-bea', { 'x-olumi-person': '1' }), body: '{}' })
      expect(r.status).toBe(503)
    })
    it('a link core does not recognise answers 401 and writes nothing; once the lookup works again the right person writes as before', async () => {
      const before = fake.calls.length
      const gone = await apiPost('olumi=tok-gone', { 'x-olumi-person': '1' })
      expect(gone.status).toBe(401)
      expect(upstream(before)).toHaveLength(0)
      fake.meDown(500)
      expect((await apiPost('olumi=tok-ada', {})).status).toBe(503)
      fake.meDown(null)
      expect((await apiPost('olumi=tok-ada', {})).status).toBe(201)
    })
  })
  it('a read through /api needs no page identity (it is core\'s own cookie check), and the page script says who it is on /api calls too', async () => {
    expect((await fetch(base + '/api/me', { headers: { cookie: 'olumi=tok-ada' } })).status).toBe(200)
    const html = await (await fetch(base + '/', { headers: { cookie: 'olumi=tok-ada' } })).text()
    expect(html).toContain("url.pathname.indexOf('/api/') === 0")
  })
})

describe('the identity check fails closed when core cannot answer who the browser is (findings: /api/me blip let a stale page write as the cookie holder)', () => {
  /** A second origin over the same fake core whose /api/me throws (a dropped connection) or answers 502 on the calls it is told to. */
  async function withMeFault(fault) {
    let armed = 0
    const fetchImpl = async (url, init) => {
      if (armed > 0 && String(url).endsWith('/api/me')) { armed--; if (fault === 'throw') throw new Error('blip'); return new Response('{"error":"bad gateway"}', { status: 502, headers: { 'content-type': 'application/json' } }) }
      return fetch(url, init)
    }
    const s = createServer({ coreUrl: fake.url, distDir: dist, log: 'off', fetchImpl })
    await new Promise((r) => s.listen(0, '127.0.0.1', r))
    const b = `http://127.0.0.1:${s.address().port}`
    return { b, arm: (n = 1) => { armed = n }, close: () => new Promise((r) => s.close(r)) }
  }
  const writesSince = (since) => fake.calls.slice(since).filter((c) => c.method === 'POST')
  const turnAt = (b, cookie, person) => fetch(b + '/bff/orchestrate/v2/turn', { method: 'POST', headers: { 'content-type': 'application/json', cookie, ...(person ? { 'x-olumi-person': person } : {}) }, body: JSON.stringify({ kind: 'message', turn_id: crypto.randomUUID(), scenario_id: crypto.randomUUID(), stage: 'frame', message: BRIEF, source: 'composer' }) }).then((r) => r.json())

  for (const fault of ['throw', '502']) {
    it(`a write from a page opened for Ada, with the browser now on Bea's link and the identity lookup failing (${fault}), is refused and saves nothing`, async () => {
      const s = await withMeFault(fault)
      const before = fake.calls.length
      s.arm()
      const out = await turnAt(s.b, 'olumi=tok-bea', '1')
      await s.close()
      expect(out.model).toBeNull()
      expect(out.error).toMatchObject({ code: 'identity_unconfirmed', retry_safe: true, nothing_saved: true })
      expect(out.error.message).toMatch(/nothing was saved/i)
      expect(writesSince(before)).toHaveLength(0)
    })
  }
  it('the same turn without the blip is still refused as identity_changed, and with the right page it goes through once the lookup answers', async () => {
    const s = await withMeFault('throw')
    expect((await turnAt(s.b, 'olumi=tok-bea', '1')).error).toMatchObject({ code: 'identity_changed' })
    s.arm()
    expect((await turnAt(s.b, 'olumi=tok-bea', '2')).error).toMatchObject({ code: 'identity_unconfirmed' })
    expect((await turnAt(s.b, 'olumi=tok-bea', '2')).error).toBeNull()
    await s.close()
  })
  it('a read does not write, so a failing lookup does not turn it away; a document request says core could not be reached, not that the link is invalid', async () => {
    const s = await withMeFault('throw')
    s.arm()
    const doc = await fetch(s.b + '/', { headers: { cookie: 'olumi=tok-ada' } })
    expect(doc.status).toBe(503)
    expect(await doc.text()).not.toMatch(/no longer valid/)
    await s.close()
  })
})
