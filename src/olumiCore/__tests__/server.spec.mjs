import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { startFakeCore } from './fakeCore.mjs'
import { createServer, LINK_PAGE } from '../../../scripts/olumi-core/server.mjs'

let fake, server, base, dist
const BRIEF = 'a brief'
const H = (cookie, extra = {}) => ({ headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}), ...extra }, redirect: 'manual' })
const post = (p, body, cookie) => fetch(base + p, { method: 'POST', ...H(cookie), body: JSON.stringify(body) })
const U = '11111111-2222-4333-8444-555555555555'
const turn = (message, cookie, extra = {}) => post('/bff/orchestrate/v2/turn', { kind: 'message', turn_id: crypto.randomUUID(), scenario_id: U, stage: 'frame', message, source: 'composer', ...extra }, cookie)

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
    expect(html).toContain('window.__OLUMI_CORE__={person:{"id":"1","name":"Ada"}}')
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
  it('a scenario started in a browser is found again by that browser alone (its own alias cookie), and not by another person', async () => {
    const r = await turn(BRIEF, 'olumi=tok-ada')
    const alias = (r.headers.getSetCookie().find((c) => c.startsWith('olumi_sc=')) ?? '').split(';')[0]
    expect(alias).toMatch(/^olumi_sc=/)
    const own = await (await fetch(`${base}/bff/cee/scenarios/${U}/graph`, { method: 'POST', ...H(`olumi=tok-ada; ${alias}`), body: '{}' })).json()
    expect(own.graph_present).toBe(true)
    const nobody = await (await fetch(`${base}/bff/cee/scenarios/${U}/graph`, { method: 'POST', ...H('olumi=tok-ada'), body: '{}' })).json()
    expect(nobody.graph_present).toBe(false)
    const other = await fetch(`${base}/bff/cee/scenarios/${U}/graph`, { method: 'POST', ...H(`olumi=tok-bea; ${alias}`), body: '{}' })
    expect(other.status).toBe(404)
  })
  it('a second person landing through a link that adds them to a scenario opens it by its derived UUID, with their own cookie', async () => {
    const sid = [...fake.scenarios.keys()].at(-1)
    const derived = `00000000-0000-4000-8000-${sid.slice(2)}`
    // the fake treats ownership as one person's, so Bea cannot read it; what the link must do is hand her the right route
    const land = await fetch(`${base}/k/tok-bea?to=/s/${sid}`, { redirect: 'manual' })
    expect(land.headers.get('location')).toBe(`/#/scenario/${derived}`)
    expect(land.headers.get('set-cookie')).toMatch(/olumi=tok-bea/)
  })
  it('a malformed turn body is a 400, not a crash', async () => {
    const r = await fetch(base + '/bff/orchestrate/v2/turn', { method: 'POST', headers: { cookie: 'olumi=tok-ada' }, body: '{nope' })
    expect(r.status).toBe(400)
  })
})
