// A stand-in for olumi-core's REST API (v1.4) that answers from captured real views (./fixtures), for the shim's specs.
// It checks the cookie (a token maps to one person), keeps one scenario per person, and can be told to fail the next call.
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const fx = (n) => JSON.parse(fs.readFileSync(path.join(here, 'fixtures', n), 'utf8'))

export async function startFakeCore() {
  const people = new Map() // token -> { id, name }
  const scenarios = new Map() // sid -> { owner, view }
  const calls = []
  let fail = null
  let problemNext = null
  let next = 1
  const server = http.createServer(async (req, res) => { try { await handle(req, res) } catch (e) { res.writeHead(500, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: String(e) })) } })
  const handle = async (req, res) => {
    const url = new URL(req.url, 'http://x')
    const chunks = []; for await (const c of req) chunks.push(c)
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}
    const token = /(?:^|;\s*)olumi=([^;]*)/.exec(req.headers.cookie ?? '')?.[1]
    const me = token ? people.get(decodeURIComponent(token)) : undefined
    calls.push({ method: req.method, path: url.pathname, token: token ? decodeURIComponent(token) : null, body })
    const send = (s, o, h = {}) => { res.writeHead(s, { 'content-type': 'application/json', ...h }); res.end(JSON.stringify(o)) }
    if (url.pathname === '/healthz') return send(200, { ok: true, commit: 'fake', store: 'readable' })
    if (url.pathname.startsWith('/k/')) {
      const t = decodeURIComponent(url.pathname.slice(3))
      if (!people.has(t)) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('This link is not valid.') }
      const to = url.searchParams.get('to')
      res.writeHead(302, { location: to ?? '/', 'set-cookie': `olumi=${encodeURIComponent(t)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000` }); return res.end()
    }
    if (url.pathname === '/api/me') return send(200, { me: me ?? null, commit: 'fake', scenarios: [...scenarios].filter(([, s]) => s.owner === me?.id).map(([id]) => ({ id, title: 'Support capacity' })) })
    if (url.pathname.startsWith('/api/admin/')) return send(200, { admin: 'reachable' })
    if (!me) return send(401, { error: 'open your private link first' })
    if (fail) { const f = fail; fail = null; return send(f.status, { error: f.message }, f.headers) }
    let m
    if (req.method === 'POST' && url.pathname === '/api/scenarios') {
      const sid = `s_${(0xabc000000000 + next++).toString(16)}`
      const view = fx('view-first-pending.json'); view.id = sid; view.you = me.name
      const pid = 1000 + next; view.pending.id = pid; view.chat[0].id = pid; view.chat[0].proposal = pid
      view.chat[0].problem = problemNext; problemNext = null
      scenarios.set(sid, { owner: me.id, view })
      return send(201, { scenario: sid, proposal: view.pending.id })
    }
    if ((m = url.pathname.match(/^\/api\/scenarios\/(s_[0-9a-f]+)$/)) && req.method === 'GET') {
      const s = scenarios.get(m[1]); return s && s.owner === me.id ? send(200, s.view) : send(404, { error: 'not found' })
    }
    if ((m = url.pathname.match(/^\/api\/proposals\/(\d+)\/approve$/))) {
      const entry = [...scenarios.values()].find((s) => s.owner === me.id && s.view.pending?.id === Number(m[1]))
      if (!entry) return send(409, { error: 'this change is not pending and cannot be approved' })
      const approved = fx('view-approved.json'); approved.id = entry.view.id; approved.you = me.name; approved.version.id = entry.view.pending.id + 1; approved.chat[0].id = entry.view.pending.id; entry.view = approved
      return send(200, { version: approved.version.id, n: approved.version.n, receipt: `approve:${m[1]}` })
    }
    if ((m = url.pathname.match(/^\/api\/proposals\/(\d+)\/discard$/))) {
      const entry = [...scenarios.values()].find((s) => s.owner === me.id && s.view.pending?.id === Number(m[1]))
      if (entry) entry.view.pending = null
      return send(200, { receipt: `discard:${m[1]}` })
    }
    if ((m = url.pathname.match(/^\/api\/scenarios\/(s_[0-9a-f]+)\/(messages|challenge)$/))) {
      const entry = scenarios.get(m[1]); if (!entry || entry.owner !== me.id) return send(404, { error: 'not found' })
      const asked = m[2] === 'challenge' || /\?/.test(body.text ?? '')
      if (asked) {
        const answer = { ...(entry.view.version?.coach ?? fx('view-approved.json').version.coach), answer: 'A reply that changes nothing.' }
        entry.view.chat = [...entry.view.chat, { id: 90 + next++, at: new Date().toISOString(), by: me.name, said: body.text ?? body.kind, first: false, kind: 'message', proposal: null, version: null, current: false, answer: problemNext ? null : answer, status: 'discussion', problem: problemNext, cited: {} }]
        problemNext = null
        return send(201, { proposal: entry.view.chat.at(-1).id, discussion: true })
      }
      const withChange = fx('view-approved-with-change.json'); withChange.id = entry.view.id; withChange.you = me.name; withChange.pending.id = 2000 + next++; withChange.version.id = entry.view.version?.id ?? withChange.version.id
      withChange.chat = [...withChange.chat.slice(0, -1), { ...withChange.chat.at(-1), id: withChange.pending.id, proposal: withChange.pending.id, problem: problemNext }]
      problemNext = null
      entry.view = withChange
      return send(201, { proposal: withChange.pending.id, discussion: false })
    }
    if ((m = url.pathname.match(/^\/api\/scenarios\/(s_[0-9a-f]+)\/edit$/))) {
      const entry = scenarios.get(m[1]); if (!entry || entry.owner !== me.id) return send(404, { error: 'not found' })
      if (entry.view.pending) return send(409, { error: 'approve or set aside the pending change first' })
      if (body.base !== entry.view.version.id) return send(409, { error: 'this figure was edited on a different version' })
      const rec = entry.view.version.form.records.find((r) => r.id === body.quantity)
      if (!rec) return send(404, { error: 'no such figure' })
      rec.assertion = { kind: 'point', value: body.value.value, approximate: false }
      entry.view.version = { ...entry.view.version, id: entry.view.version.id + 100, n: entry.view.version.n + 1 }
      return send(201, { version: entry.view.version.id, n: entry.view.version.n, receipt: 'edit' })
    }
    return send(404, { error: 'not found' })
  }
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const url = `http://127.0.0.1:${server.address().port}`
  return {
    url, calls, scenarios,
    addPerson: (token, id, name) => people.set(token, { id, name }),
    failNext: (status, message, headers = {}) => { fail = { status, message, headers } },
    problemNext: (text) => { problemNext = text },
    close: () => new Promise((r) => server.close(r)),
  }
}
