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
 *   ANY  /api/*, GET /healthz   proxied to core (the admin routes are NOT reachable from here)
 *
 * Identity is the browser's own `olumi` cookie, forwarded to core on every call: this server holds none. Nothing a person
 * has is kept here either: the shim derives ids from what it reads (lib/ids.mjs), and the one pairing it cannot derive
 * (the UUID DGAI minted before core knew the scenario) rides in the browser's own `olumi_sc` cookie.
 *
 * Env: OLUMI_CORE_URL (core's base URL, required), PORT (default 3952), DIST_DIR (default ../../dist), OLUMI_LOG (off to silence).
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { makeCore, CoreError, errorTurn } from './lib/core.mjs'
import { makeShim } from './lib/turn.mjs'
import { decodeAliases, encodeAliases, isSid, parseCookies, uuidOfSid, isUuid } from './lib/ids.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.map': 'application/json', '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json' }

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

/** The page for a browser with no valid private link: plain words, nothing of DGAI loads. */
export const LINK_PAGE = (note) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Open your private link</title></head><body style="font:16px/1.5 system-ui,sans-serif;max-width:520px;margin:72px auto;padding:0 16px;color:#1f2937"><h1 style="font-size:22px;margin:0 0 12px">Open your private link</h1><p>Olumi opens from a private link that was sent to you. Open that link in this browser to continue.</p><p style="color:#6b7280">${esc(note)}</p></body></html>`

/**
 * Runs before DGAI starts. (1) When this browser last held someone else's link, DGAI's saved state (their scenario, thread and
 * autosave) is cleared. (2) When the address names a scenario this person cannot open (someone else's, or none), DGAI would
 * show a blank canvas and say nothing: this says so, with the way out.
 */
const bootstrap = (person) => `<script>(function(){try{var p=${JSON.stringify(person.id)};var k='olumi-core-person';var had=localStorage.getItem(k);if(had!==p){localStorage.clear();sessionStorage.clear();localStorage.setItem(k,p)}window.__OLUMI_CORE__={person:${JSON.stringify(person)}};if(!location.hash||location.hash==='#'||location.hash==='#/'){location.replace(location.pathname+location.search+'#/canvas')}var m=/^#\\/scenario\\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i.exec(location.hash);if(m){fetch('/bff/cee/scenarios/'+m[1]+'/graph',{method:'POST',headers:{'content-type':'application/json'},body:'{}'}).then(function(r){if(r.status!==404&&r.status!==401)return;var d=document.createElement('div');d.setAttribute('role','alert');d.setAttribute('data-testid','olumi-core-scenario-unavailable');d.style.cssText='position:fixed;top:0;left:0;right:0;z-index:2147483647;background:#fff7ed;border-bottom:1px solid #fdba74;color:#7c2d12;font:15px/1.4 system-ui,sans-serif;padding:12px 16px;text-align:center';d.innerHTML='That scenario is not available to you: it may belong to someone else. Open it from your own private link, or <a href="#/canvas" style="color:inherit">start a new one</a>.';document.body.appendChild(d)}).catch(function(){})}}catch(e){}})()</script>`

export function createServer(opts = {}) {
  const coreUrl = (opts.coreUrl ?? process.env.OLUMI_CORE_URL ?? '').replace(/\/$/, '')
  if (!coreUrl) throw new Error('OLUMI_CORE_URL is required')
  const dist = path.resolve(opts.distDir ?? process.env.DIST_DIR ?? path.join(here, '../../dist'))
  const logOn = (opts.log ?? process.env.OLUMI_LOG) !== 'off'
  const log = (...a) => { if (logOn) console.log(JSON.stringify({ t: new Date().toISOString(), ...Object.fromEntries(a.map((x, i) => [i === 0 ? 'm' : `d${i}`, x])) })) }
  const core = makeCore({ base: coreUrl, fetchImpl: opts.fetchImpl, paidTimeoutMs: opts.paidTimeoutMs })
  const shim = makeShim({ core, log })
  const indexHtml = () => fs.readFileSync(path.join(dist, 'index.html'), 'utf8')

  const secure = (req) => req.headers['x-forwarded-proto'] === 'https'
  const ctxOf = (req) => {
    const c = parseCookies(req.headers.cookie)
    return { token: c.olumi || null, aliases: decodeAliases(c.olumi_sc) }
  }
  const aliasCookie = (req, aliases) => `olumi_sc=${encodeAliases(aliases)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${secure(req) ? '; Secure' : ''}`
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
        headers: { ...(req.headers.cookie ? { cookie: req.headers.cookie } : {}), ...(req.headers['content-type'] ? { 'content-type': req.headers['content-type'] } : {}) },
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

  async function serveStatic(req, res, pathname) {
    const rel = decodeURIComponent(pathname).replace(/^\/+/, '')
    const file = path.resolve(dist, rel)
    if (!file.startsWith(dist + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return false
    const ext = path.extname(file)
    const hashed = /\/assets\//.test(pathname)
    res.writeHead(200, { 'content-type': TYPES[ext] ?? 'application/octet-stream', 'cache-control': hashed ? 'public, max-age=31536000, immutable' : 'no-cache' })
    res.end(req.method === 'HEAD' ? undefined : fs.readFileSync(file))
    return true
  }

  async function app(req, res) {
    const url = new URL(req.url ?? '/', 'http://x')
    // vite's dev proxy rewrites /bff/cee/* to /assist/v1/* and /bff/orchestrate/* to /orchestrate/*: accept both spellings.
    const p = url.pathname.replace(/^\/assist\/v1\//, '/bff/cee/').replace(/^\/orchestrate\//, '/bff/orchestrate/')
    const method = req.method ?? 'GET'
    try {
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
            const aliases = !token || token === ctx.token ? ctx.aliases : []
            const named = /^\/s\/(s_[0-9a-f]+)$/.exec(loc)?.[1]
            let sid = named
            if (!sid && token) { try { sid = (await core('GET', '/api/me', { token })).scenarios?.at(-1)?.id } catch { /* the canvas, then */ } }
            return sid ? `/#/scenario/${uuidOfSid(sid, aliases)}` : '/#/canvas'
          },
        }).then(() => undefined)
      }
      if (p.startsWith('/api/admin/')) return json(res, 404, { error: 'not found' })
      if (p.startsWith('/api/')) return await proxy(req, res, p + url.search)

      if (p === '/bff/orchestrate/v2/turn' && method === 'POST') {
        let body
        try { body = JSON.parse((await readBody(req)).toString('utf8') || '{}') } catch { return json(res, 400, { error: 'malformed JSON' }) }
        const ctx = ctxOf(req)
        let r
        try { r = await shim.turn(ctx, body) } catch (e) { log('turn failed', String(e?.stack ?? e)); r = { out: errorTurn(body.turn_id, e) } }
        const extra = r.aliases ? { 'set-cookie': aliasCookie(req, r.aliases) } : {}
        return json(res, 200, r.out, extra)
      }
      if (p.startsWith('/bff/orchestrate/')) return json(res, 404, { error: 'not available on Olumi' })   // incl. the draft stream: DGAI falls back to the buffered turn
      const g = /^\/bff\/cee\/scenarios\/([^/]+)\/graph$/.exec(p)
      if (g && (method === 'GET' || method === 'POST')) {
        const uuid = decodeURIComponent(g[1])
        if (!isUuid(uuid)) return json(res, 404, { error: 'not found' })
        let r
        try { r = await shim.graphRead(ctxOf(req), uuid) } catch (e) { log('graph failed', String(e?.stack ?? e)); r = { status: 502, body: { error: 'Olumi cannot be reached right now.' } } }
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
      if (sPath) { res.writeHead(302, { location: `/#/scenario/${uuidOfSid(sPath[1], ctx.aliases)}`, 'cache-control': 'no-store' }); return res.end() }
      let doc
      try { doc = indexHtml() } catch { return json(res, 503, { error: 'The app has not been built (no dist/index.html).' }) }
      return html(res, 200, doc.replace(/<head>/i, `<head>${bootstrap(me)}`))
    } catch (e) {
      log('unhandled', String(e?.stack ?? e))
      if (!res.headersSent) json(res, e?.status === 413 ? 413 : 500, { error: e?.status === 413 ? 'too large' : 'something went wrong' })
      else res.end()
    }
  }
  return http.createServer((req, res) => { void app(req, res) })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT ?? 3952)
  const server = createServer()
  server.listen(port, process.env.HOST ?? '0.0.0.0', () => console.log(JSON.stringify({ m: 'listening', port, core: process.env.OLUMI_CORE_URL })))
}
