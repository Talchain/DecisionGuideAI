#!/usr/bin/env node
// J1 whole-PoC journey: the LLM boundary, frozen.
//
// On the CI runner, /etc/hosts points api.openai.com and api.anthropic.com at
// 127.0.0.1, and this server answers them over TLS, using a CA the job generates
// and trusts (NODE_EXTRA_CA_CERTS / SSL_CERT_FILE). Every client in every service
// (CEE's agent route with its hard-coded Responses URL, the SDK adapters, and ISL's
// Python clients) therefore reaches this server. Nothing else can reach the real
// provider.
//
// Modes (JOURNEY_LLM_MODE):
//   replay - answer from the frozen recordings in JOURNEY_LLM_FIXTURES. A request
//            with no recording is a MISS: a 400 (not retried by the SDKs), plus a
//            ledger row. The spec reads the ledger and turns any MISS into a red
//            "could not measure". A miss never falls through to a live call.
//   record - forward to the real provider (resolved through public DNS, since
//            /etc/hosts points at us) and save every exchange. The first 429
//            aborts: every later call is refused and the ledger says why.
//
// Matching. A call's SIGNATURE is its coarse shape: host, path, model, stream,
// sorted tool names, and the structured-output format name. Its DETAIL hash covers
// the normalised instructions and input (uuids, long hex, timestamps and long
// numbers replaced). The replay takes the first unused recording with the same
// signature, preferring one whose detail hash also matches. A detail mismatch
// still serves, but it is ledgered as `hit_drift`, so a prompt change since the
// recording shows up in the summary rather than as a silent pass.

import crypto from 'node:crypto'
import dns from 'node:dns'
import fs from 'node:fs'
import http from 'node:http'
import https from 'node:https'
import path from 'node:path'

const MODE = process.env.JOURNEY_LLM_MODE
const FIXTURES = process.env.JOURNEY_LLM_FIXTURES
const LEDGER = process.env.JOURNEY_LLM_LEDGER
const PORT = Number(process.env.JOURNEY_LLM_PORT ?? 443)
const CERT = process.env.JOURNEY_LLM_CERT
const KEY = process.env.JOURNEY_LLM_KEY
// Local record (macOS, no sudo): a plain-HTTP listener for CEE's fetch preload
// (llm-redirect-preload.mjs), which carries the real host in `x-journey-host`.
const HTTP_PORT = process.env.JOURNEY_LLM_HTTP_PORT ? Number(process.env.JOURNEY_LLM_HTTP_PORT) : null
const PROVIDER_HOSTS = new Set(['api.openai.com', 'api.anthropic.com'])

for (const [k, v] of Object.entries({ JOURNEY_LLM_MODE: MODE, JOURNEY_LLM_FIXTURES: FIXTURES, JOURNEY_LLM_LEDGER: LEDGER })) {
  if (!v) { console.error(`[llm-replay] ${k} is required`); process.exit(2) }
}
if (MODE !== 'replay' && MODE !== 'record') { console.error(`[llm-replay] unknown mode ${MODE}`); process.exit(2) }
if (!(CERT && KEY) && HTTP_PORT === null) { console.error('[llm-replay] need JOURNEY_LLM_CERT+KEY (TLS) or JOURNEY_LLM_HTTP_PORT'); process.exit(2) }

fs.mkdirSync(FIXTURES, { recursive: true })
fs.mkdirSync(path.dirname(LEDGER), { recursive: true })

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16)
const ledger = (row) => fs.appendFileSync(LEDGER, JSON.stringify({ t: new Date().toISOString(), mode: MODE, ...row }) + '\n')

const normalise = (s) => String(s)
  .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<uuid>')
  .replace(/\b[0-9a-f]{16,}\b/gi, '<hex>')
  .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?/g, '<ts>')
  .replace(/\b\d{6,}\b/g, '<n>')

function shapeOf(host, urlPath, body) {
  const b = body && typeof body === 'object' ? body : {}
  const tools = Array.isArray(b.tools)
    ? b.tools.map((t) => t?.name ?? t?.function?.name ?? t?.type ?? '?').sort().join(',')
    : ''
  const format =
    b.text?.format?.name ?? b.response_format?.json_schema?.name ?? b.response_format?.type ??
    (typeof b.tool_choice === 'object' ? (b.tool_choice?.name ?? b.tool_choice?.function?.name ?? '') : (b.tool_choice ?? '')) ?? ''
  const signature = [host, urlPath, `model=${b.model ?? ''}`, `stream=${b.stream === true}`, `tools=${sha(tools)}`, `format=${format}`].join('|')
  const detail = sha(normalise(JSON.stringify([b.instructions ?? b.system ?? '', b.input ?? b.messages ?? ''])))
  return { signature, detail }
}

// ── replay index ────────────────────────────────────────────────────────────
const recordings = MODE === 'replay'
  ? fs.readdirSync(FIXTURES).filter((f) => /^\d+-.*\.json$/.test(f)).sort()
      .map((f) => ({ file: f, ...JSON.parse(fs.readFileSync(path.join(FIXTURES, f), 'utf8')) }))
  : []
const used = new Set()
if (MODE === 'replay') {
  console.log(`[llm-replay] replay mode: ${recordings.length} recordings in ${FIXTURES}`)
  ledger({ outcome: 'index', recordings: recordings.length })
}

let seq = 0
let abortedBy429 = false
const resolver = new dns.promises.Resolver()
resolver.setServers(['1.1.1.1', '8.8.8.8'])

// The real provider address, for record mode. On the CI runner /etc/hosts points the
// provider hosts at this server, so the system lookup returns loopback and public DNS
// is used instead. On a Mac (fetch redirected by the preload) the system lookup is
// right. One address per host is cached, and a lookup is retried: the first local
// record lost the draft's last call to a single DNS timeout at load 130 (5 Oct 12:04Z).
const addressCache = new Map()
async function providerAddress(host) {
  const hit = addressCache.get(host)
  if (hit && hit.until > Date.now()) return hit.ip
  let lastErr
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const sys = await dns.promises.lookup(host, { family: 4 })
      const ip = /^127\./.test(sys.address) ? (await resolver.resolve4(host))[0] : sys.address
      addressCache.set(host, { ip, until: Date.now() + 10 * 60_000 })
      return ip
    } catch (e) { lastErr = e; await new Promise((r) => setTimeout(r, 1_000 * attempt)) }
  }
  throw lastErr
}

function refuse(res, status, type, message) {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify({ error: { type, message } }))
}

async function forward(req, host, bodyBuf) {
  // A transport failure (no HTTP status) is retried here, invisibly to CEE; an HTTP
  // answer from the provider, error or not, is the product's and is recorded as is.
  let lastErr
  for (let attempt = 1; attempt <= 3; attempt++) {
    try { return await forwardOnce(req, host, bodyBuf) }
    catch (e) { lastErr = e; await new Promise((r) => setTimeout(r, 1_500 * attempt)) }
  }
  throw lastErr
}

async function forwardOnce(req, host, bodyBuf) {
  const ip = await providerAddress(host)
  const headers = { ...req.headers, host }
  delete headers['x-journey-host']
  delete headers['accept-encoding'] // identity bodies, so recordings are plain text
  delete headers['content-length']
  headers['content-length'] = String(bodyBuf.length)
  return new Promise((resolve, reject) => {
    const up = https.request({ host: ip, servername: host, port: 443, method: req.method, path: req.url, headers }, (r) => {
      const chunks = []
      r.on('data', (c) => chunks.push(c))
      r.on('end', () => resolve({ status: r.statusCode ?? 0, headers: r.headers, body: Buffer.concat(chunks) }))
      r.on('error', reject)
    })
    up.on('error', reject)
    up.end(bodyBuf)
  })
}

function handle(req, res) {
  const chunks = []
  req.on('data', (c) => chunks.push(c))
  req.on('end', async () => {
    const host = String(req.headers['x-journey-host'] ?? req.headers.host ?? '').replace(/:\d+$/, '')
    const urlPath = String(req.url ?? '').split('?')[0]
    const bodyBuf = Buffer.concat(chunks)
    let body = null
    try { body = JSON.parse(bodyBuf.toString('utf8')) } catch { /* non-JSON request */ }
    const { signature, detail } = shapeOf(host, urlPath, body)

    // The workflow's boot check: proves the redirect, the TLS trust and the mode,
    // without touching the ledger.
    if (urlPath === '/__journey_selftest') {
      res.writeHead(200, { 'content-type': 'application/json' })
      return res.end(JSON.stringify({ ok: true, mode: MODE, host, recordings: recordings.length }))
    }

    const n = ++seq
    if (!PROVIDER_HOSTS.has(host)) {
      ledger({ seq: n, outcome: 'unknown_host', host, path: urlPath })
      return refuse(res, 400, 'journey_unknown_host', `journey LLM boundary does not serve ${host}`)
    }

    if (MODE === 'replay') {
      const free = recordings.filter((r) => !used.has(r.file) && r.signature === signature)
      const pick = free.find((r) => r.detail === detail) ?? free[0]
      if (!pick) {
        ledger({ seq: n, outcome: 'miss', signature, detail })
        return refuse(res, 400, 'journey_replay_miss', `no frozen recording for call ${n} (${signature})`)
      }
      used.add(pick.file)
      ledger({ seq: n, outcome: pick.detail === detail ? 'hit' : 'hit_drift', signature, detail, recorded_detail: pick.detail, file: pick.file })
      res.writeHead(pick.status, { 'content-type': pick.content_type ?? 'application/json' })
      return res.end(pick.body)
    }

    // record
    if (abortedBy429) {
      ledger({ seq: n, outcome: 'refused_after_429', signature })
      return refuse(res, 400, 'journey_aborted_after_429', 'record run aborted at the first 429')
    }
    try {
      const up = await forward(req, host, bodyBuf)
      const contentType = String(up.headers['content-type'] ?? 'application/json')
      if (up.status === 429) {
        abortedBy429 = true
        ledger({ seq: n, outcome: 'rate_limited', signature, status: 429 })
      } else {
        const file = `${String(n).padStart(4, '0')}-${host.split('.')[1]}.json`
        fs.writeFileSync(path.join(FIXTURES, file), JSON.stringify({
          seq: n, signature, detail, host, path: urlPath, model: body?.model ?? null,
          status: up.status, content_type: contentType, recorded_at: new Date().toISOString(),
          // the request is kept for diagnosis only; credentials never reach the file
          request: body, body: up.body.toString('utf8'),
        }, null, 1))
        ledger({ seq: n, outcome: 'recorded', signature, detail, status: up.status, file })
      }
      res.writeHead(up.status, { 'content-type': contentType })
      res.end(up.body)
    } catch (e) {
      ledger({ seq: n, outcome: 'upstream_error', signature, error: String(e).slice(0, 200) })
      refuse(res, 502, 'journey_upstream_error', String(e).slice(0, 200))
    }
  })
}

if (CERT && KEY) {
  https.createServer({ cert: fs.readFileSync(CERT), key: fs.readFileSync(KEY) }, handle)
    .listen(PORT, '127.0.0.1', () => console.log(`[llm-replay] ${MODE} on https://127.0.0.1:${PORT}`))
}
if (HTTP_PORT !== null) {
  http.createServer(handle).listen(HTTP_PORT, '127.0.0.1', () => console.log(`[llm-replay] ${MODE} on http://127.0.0.1:${HTTP_PORT}`))
}
