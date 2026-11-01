#!/usr/bin/env node
/**
 * ONE origin for DecisionGuideAI on olumi-core: this server serves DGAI's production build (`dist/`) and answers its backend
 * calls from olumi-core (the shim, lib/turn.mjs), and proxies the person's private link, the API and the health check to core.
 *
 *   GET  /                      DGAI (the app), for a browser that holds a valid private link; else the "open your link" page
 *   GET  /k/<token>[?to=/s/<id>]  proxied to core; its Set-Cookie passes through, its redirect lands in DGAI (the canvas, or that scenario)
 *   GET  /s/<id>                that scenario, in DGAI
 *   POST /bff/orchestrate/v2/turn          DGAI's chat turn, card press and canvas edit  -> core (the shim)
 *   GET  /bff/cee/scenarios/<uuid>/graph   DGAI's saved-model read                       -> core (the shim)
 *   ANY  /api/*, GET /healthz   proxied to core (the admin routes are NOT reachable from here); a write needs the page's x-olumi-person, as a /bff write does, and a read from a page that names a person other than the browser's link is refused (409),
 *                               and a write that is not from the Olumi page itself (Sec-Fetch-Site other than same-origin or none) is refused (403) here and by core;
 *                               a write whose identity cannot be checked is refused too
 *
 * Identity is the browser's own `olumi` cookie, forwarded to core on every call: this server holds none. Nothing a person
 * has is kept here either: the shim derives ids from what it reads (lib/ids.mjs), and the one pairing it cannot derive
 * (the UUID DGAI minted before core knew the scenario) is kept by the PAGE (lib/tab.js) in its own storage, sent back on the calls
 * that name that scenario (`x-olumi-scenario`) and handed out when a scenario is made (`x-olumi-alias`). The page also says who it
 * was opened for (`x-olumi-person`); a write from a page whose person is not the one the browser's link names now is refused.
 *
 * Env: OLUMI_CORE_URL (core's base URL, required), PORT (default 3952), DIST_DIR (default ../../dist), OLUMI_LOG (off to silence).
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { makeCore, CoreError, errorTurn, identityChangedTurn, IDENTITY_CHANGED_WORDS } from './lib/core.mjs'
import { makeShim } from './lib/turn.mjs'
import { aliasesOfHeader, aliasHeader, parseCookies, uuidOfSid, isUuid } from './lib/ids.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.map': 'application/json', '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json' }

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

/** The page for a browser with no valid private link: plain words, nothing of DGAI loads. */
export const LINK_PAGE = (note) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Open your private link</title></head><body style="font:16px/1.5 system-ui,sans-serif;max-width:520px;margin:72px auto;padding:0 16px;color:#1f2937"><h1 style="font-size:22px;margin:0 0 12px">Open your private link</h1><p>Olumi opens from a private link that was sent to you. Open that link in this browser to continue.</p><p style="color:#6b7280">${esc(note)}</p></body></html>`

/**
 * The page's side (lib/tab.js), inlined and run before DGAI starts with the person this page is opened for. Its source is read
 * once here, as text, so it reaches the browser exactly as it is tested.
 */
const TAB = fs.readFileSync(path.join(here, 'lib/tab.js'), 'utf8').trim()
/** JSON that is safe inside an inline <script>: nothing in a person's name can close the tag or break the line. */
const scriptJson = (v) => JSON.stringify(v).replace(/[<>&\u2028\u2029]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`)
const bootstrap = (person) => `<script>(${TAB})(window,${scriptJson(person)})</script>`

export function createServer(opts = {}) {
  const coreUrl = (opts.coreUrl ?? process.env.OLUMI_CORE_URL ?? '').replace(/\/$/, '')
  if (!coreUrl) throw new Error('OLUMI_CORE_URL is required')
  const dist = path.resolve(opts.distDir ?? process.env.DIST_DIR ?? path.join(here, '../../dist'))
  const logOn = (opts.log ?? process.env.OLUMI_LOG) !== 'off'
  const log = (...a) => { if (logOn) console.log(JSON.stringify({ t: new Date().toISOString(), ...Object.fromEntries(a.map((x, i) => [i === 0 ? 'm' : `d${i}`, x])) })) }
  const core = makeCore({ base: coreUrl, fetchImpl: opts.fetchImpl, paidTimeoutMs: opts.paidTimeoutMs })
  const shim = makeShim({ core, log })
  const indexHtml = () => fs.readFileSync(path.join(dist, 'index.html'), 'utf8')

  /** Who is calling: the browser's private link, the one scenario pairing this call brings, and who the page says it was opened for. */
  const ctxOf = (req) => {
    const c = parseCookies(req.headers.cookie)
    const person = req.headers['x-olumi-person']
    return { token: c.olumi || null, aliases: aliasesOfHeader(req.headers['x-olumi-scenario']), person: typeof person === 'string' && person !== '' ? person : null }
  }
  const readBody = async (req, limit = 1_000_000) => {
    const chunks = []; let n = 0
    for await (const c of req) { n += c.length; if (n > limit) throw Object.assign(new Error('too large'), { status: 413 }); chunks.push(c) }
    return Buffer.concat(chunks)
  }
  const json = (res, status, obj, headers = {}) => { res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers }); res.end(JSON.stringify(obj)) }
  const html = (res, status, body) => { res.writeHead(status, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }); res.end(body) }

  /** Forward one request to core as itself: the method, body and the browser's cookie; the answer comes back as core wrote it. */
  async function proxy(req, res, pathAndQuery, { rewriteLocation } = {}) {
    const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await readBody(req)
    let r
    try {
      r = await (opts.fetchImpl ?? fetch)(coreUrl + pathAndQuery, {
        method: req.method, redirect: 'manual',
        // `Sec-Fetch-Site` goes on unchanged: core refuses a cross-site write itself (403), so the proxy must not hide where it came from.
        // The ONE olumi cookie this server read (the one the identity check was made on), not the browser's raw header: a header with two
        // `olumi=` values must not be judged on one and acted on as the other.
        headers: { ...(parseCookies(req.headers.cookie).olumi ? { cookie: `olumi=${encodeURIComponent(parseCookies(req.headers.cookie).olumi)}` } : {}), ...(req.headers['content-type'] ? { 'content-type': req.headers['content-type'] } : {}), ...(req.headers['sec-fetch-site'] ? { 'sec-fetch-site': req.headers['sec-fetch-site'] } : {}) },
        body, signal: AbortSignal.timeout(11 * 60_000),
      })
    } catch (e) { return json(res, 502, { error: 'Olumi cannot be reached right now. Try again in a moment.' }) }
    const headers = {}
    for (const h of ['content-type', 'retry-after', 'cache-control']) if (r.headers.get(h)) headers[h] = r.headers.get(h)
    const setCookie = r.headers.getSetCookie?.() ?? []
    if (setCookie.length) headers['set-cookie'] = setCookie
    const loc = r.headers.get('location')
    if (loc) headers.location = rewriteLocation ? await rewriteLocation(loc, setCookie) : loc
    const buf = Buffer.from(await r.arrayBuffer())
    res.writeHead(r.status, headers)
    res.end(req.method === 'HEAD' ? undefined : buf)
  }

  /** Is this browser's cookie a person core knows? Returns { me } or null. */
  async function whoIs(ctx) {
    if (!ctx.token) return null
    try { const r = await core('GET', '/api/me', { token: ctx.token }); return r.me ?? null } catch { return null }
  }

  /**
   * May a call from this page go on? Null when it may; else why not. A write or read for a browser that holds a link is checked
   * against core's own answer to "who is this?": a page that was opened for someone else (or, for a write, cannot say who it was
   * opened for) is `changed`; an answer that cannot be had (core down, an error, no person in it) is `error`. Both FAIL CLOSED: a
   * check that could not be made never lets a write through. No link at all is core's own 401, not this.
   */
  async function identityRefusal(ctx, { required }) {
    if (!ctx.token) return null
    let me
    try { me = (await core('GET', '/api/me', { token: ctx.token })).me ?? null } catch (e) { return { error: e instanceof CoreError ? e : new CoreError(0, 'olumi-core is not reachable') } }
    if (!me || me.id == null) return { error: new CoreError(401, 'the private link this browser holds is no longer valid') }
    return (ctx.person === null ? required : ctx.person !== String(me.id)) ? { changed: true } : null
  }
  /** The HTTP answer for a refusal (the API and the saved-model read): 409 when the person changed, else 401 for a link core does not accept, else 503. */
  const refusalHttp = (no) => {
    if (no.changed) return { status: 409, body: { error: IDENTITY_CHANGED_WORDS } }
    const status = no.error.status === 401 || no.error.status === 403 ? 401 : 503
    return { status, body: { error: status === 401 ? 'open your private link first' : 'Olumi cannot check who this page is for right now. Nothing was saved. Try again in a moment.' } }
  }

  async function serveStatic(req, res, pathname) {
    let rel
    try { rel = decodeURIComponent(pathname).replace(/^\/+/, '') } catch { return false }
    const file = path.resolve(dist, rel)
    if (!file.startsWith(dist + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return false
    const ext = path.extname(file)
    const hashed = /\/assets\//.test(pathname)
    res.writeHead(200, { 'content-type': TYPES[ext] ?? 'application/octet-stream', 'cache-control': hashed ? 'public, max-age=31536000, immutable' : 'no-cache' })
    res.end(req.method === 'HEAD' ? undefined : fs.readFileSync(file))
    return true
  }

  async function app(req, res) {
    // The request target is the one thing a stranger fully controls, so it is checked before anything else runs and a bad one is
    // a 400 for that stranger alone: `new URL('//', ...)` throws, and out here that would end the process for every person.
    let url
    try {
      const target = req.url ?? '/'
      if (!target.startsWith('/') || target.startsWith('//')) throw new Error('not a path on this server')
      url = new URL(target, 'http://x')
    } catch { return json(res, 400, { error: 'bad request' }) }
    // vite's dev proxy rewrites /bff/cee/* to /assist/v1/* and /bff/orchestrate/* to /orchestrate/*: accept both spellings.
    const p = url.pathname.replace(/^\/assist\/v1\//, '/bff/cee/').replace(/^\/orchestrate\//, '/bff/orchestrate/')
    const method = req.method ?? 'GET'
    try {
      // A write is allowed only from the Olumi page itself, as core allows it (src/server/app.ts): no header (a script), `same-origin` or `none`.
      // Anything else (`cross-site`, `same-site`) is refused here, before anything is read or sent on (core refuses it too: the header goes on).
      const site = req.headers['sec-fetch-site']
      if (method !== 'GET' && method !== 'HEAD' && site !== undefined && site !== 'same-origin' && site !== 'none') return json(res, 403, { error: 'changes can only be made from the Olumi page' })
      // Every write path takes JSON only, as core does (src/server/app.ts): a body sent as anything else (text/plain, a form) is refused
      // here with 415, BEFORE anything is read, checked or sent upstream. This shim re-issues a body to core as application/json, so
      // without this a cross-site form post could ride in as a JSON write. The saved-model read (POST .../graph) writes nothing, so it is
      // not a write path; the private link (/k/) and the API are, for every method but a read (the admin routes are a 404 here and never go on).
      const isRead = method === 'GET' || method === 'HEAD'
      const adminPath = /^\/api\/+admin(\/|$)/i.test(p)
      const writePath = (p.startsWith('/api/') && !adminPath) || p.startsWith('/k/') || p.startsWith('/bff/orchestrate/')
      if (!isRead && writePath && !/^application\/json\b/i.test(req.headers['content-type'] ?? '')) return json(res, 415, { error: 'send the request as JSON' })
      if (p === '/healthz') {
        try { const h = await core('GET', '/healthz'); return json(res, 200, { ok: true, server: 'dgai-on-olumi-core', core: h }) }
        catch (e) { return json(res, 503, { ok: false, server: 'dgai-on-olumi-core', core: 'unreachable' }) }
      }
      if (p.startsWith('/k/')) {
        const ctx = ctxOf(req)
        return await proxy(req, res, p + url.search, {
          // Core redirects to /s/<id> (the link names a scenario) or to / (it does not). Both land in DGAI: the named scenario, or the
          // person's most recent one (a link opened on a new device must open their work, not a blank canvas), else the canvas.
          rewriteLocation: async (loc, setCookie) => {
            const newToken = /(?:^|;\s*)olumi=([^;]*)/.exec(setCookie.find((c) => c.startsWith('olumi=')) ?? '')?.[1]
            const token = newToken ? decodeURIComponent(newToken) : ctx.token
            const named = /^\/s\/(s_[0-9a-f]+)$/.exec(loc)?.[1]
            let sid = named
            if (!sid && token) { try { sid = (await core('GET', '/api/me', { token })).scenarios?.at(-1)?.id } catch { /* the canvas, then */ } }
            return sid ? `/#/scenario/${uuidOfSid(sid)}` : '/#/canvas'
          },
        }).then(() => undefined)
      }
      if (adminPath) return json(res, 404, { error: 'not found' })   // however it is spelled (`/api/admin`, `/api//admin/...`): never reaches core from here
      if (p.startsWith('/api/')) {
        // A write through the API is held to the same identity check as a /bff write: the page must say who it was opened for, and it must still be the person this browser's link names.
        if (method !== 'GET' && method !== 'HEAD') {
          const no = await identityRefusal(ctxOf(req), { required: true })
          if (no) { log('api write refused', no.changed ? 'page opened for another person' : `identity not verified (${no.error.status})`); const h = refusalHttp(no); return json(res, h.status, h.body) }
        } else {
          // A READ is held to the same check when the page says who it was opened for (as the saved-model read is): a tab opened for Ada, while the
          // browser's private link has since become Bea's, must not be handed Bea's private views. A read from no page (no `x-olumi-person`) is core's own.
          const readCtx = ctxOf(req)
          const no = readCtx.person === null ? null : await identityRefusal(readCtx, { required: false })
          if (no) { log('api read refused', no.changed ? 'page opened for another person' : `identity not verified (${no.error.status})`); const h = refusalHttp(no); return json(res, h.status, h.body) }
        }
        return await proxy(req, res, p + url.search)
      }

      if (p === '/bff/orchestrate/v2/turn' && method === 'POST') {
        let body
        try { body = JSON.parse((await readBody(req)).toString('utf8') || '{}') } catch { return json(res, 400, { error: 'malformed JSON' }) }
        // A turn is a JSON object: `null`, a list or a bare value would fail below as a server error, not as the refusal it is.
        if (body === null || typeof body !== 'object' || Array.isArray(body)) return json(res, 400, { error: 'a turn is a JSON object' })
        const ctx = ctxOf(req)
        const no = await identityRefusal(ctx, { required: true })
        if (no) { log('turn refused', no.changed ? 'page opened for another person' : `identity not verified (${no.error.status})`); return json(res, 200, no.changed ? identityChangedTurn(body.turn_id) : errorTurn(body.turn_id, no.error)) }
        let r
        try { r = await shim.turn(ctx, body) } catch (e) { log('turn failed', String(e?.stack ?? e)); r = { out: errorTurn(body.turn_id, e) } }
        return json(res, 200, r.out, r.alias ? { 'x-olumi-alias': aliasHeader(r.alias) } : {})
      }
      if (p.startsWith('/bff/orchestrate/')) return json(res, 404, { error: 'not available on Olumi' })   // incl. the draft stream: DGAI falls back to the buffered turn
      const g = /^\/bff\/cee\/scenarios\/([^/]+)\/graph$/.exec(p)
      if (g && (method === 'GET' || method === 'POST')) {
        const uuid = decodeURIComponent(g[1])
        if (!isUuid(uuid)) return json(res, 404, { error: 'not found' })
        const ctx = ctxOf(req)
        const no = await identityRefusal(ctx, { required: false })
        if (no) { const h = refusalHttp(no); return json(res, h.status, h.body) }
        let r
        try { r = await shim.graphRead(ctx, uuid) } catch (e) { log('graph failed', String(e?.stack ?? e)); r = { status: 502, body: { error: 'Olumi cannot be reached right now.' } } }
        return json(res, r.status, r.body)
      }
      if (p.startsWith('/bff/')) { log('bff not served', method, p); return json(res, 404, { error: 'not available on Olumi' }) }

      if (method !== 'GET' && method !== 'HEAD') return json(res, 405, { error: 'method not allowed' })
      const sPath = /^\/s\/(s_[0-9a-f]+)\/?$/.exec(p)
      const isDoc = p === '/' || p === '/index.html' || sPath
      if (!isDoc && (await serveStatic(req, res, p))) return
      if (!isDoc && path.extname(p)) return json(res, 404, { error: 'not found' })
      // A document: DGAI, for a browser core knows; else the "open your link" page (a silent empty canvas would be a hidden failure).
      const ctx = ctxOf(req)
      const me = await whoIs(ctx)
      if (!me) return html(res, 401, LINK_PAGE(ctx.token ? 'The link this browser holds is no longer valid.' : 'This browser has not opened one yet.'))
      if (sPath) { res.writeHead(302, { location: `/#/scenario/${uuidOfSid(sPath[1])}`, 'cache-control': 'no-store' }); return res.end() }
      let doc
      try { doc = indexHtml() } catch { return json(res, 503, { error: 'The app has not been built (no dist/index.html).' }) }
      return html(res, 200, doc.replace(/<head>/i, `<head>${bootstrap(me)}`))
    } catch (e) {
      log('unhandled', String(e?.stack ?? e))
      if (!res.headersSent) json(res, e?.status === 413 ? 413 : 500, { error: e?.status === 413 ? 'too large' : 'something went wrong' })
      else res.end()
    }
  }
  // `app` answers its own failures; this is the last net, so one request that slips past it cannot end the process.
  return http.createServer((req, res) => {
    app(req, res).catch((e) => {
      log('request failed outside the handler', String(e?.stack ?? e))
      if (!res.headersSent) { try { json(res, 500, { error: 'something went wrong' }) } catch { res.destroy() } } else res.destroy()
    })
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT ?? 3952)
  const server = createServer()
  server.listen(port, process.env.HOST ?? '0.0.0.0', () => console.log(JSON.stringify({ m: 'listening', port, core: process.env.OLUMI_CORE_URL })))
}
