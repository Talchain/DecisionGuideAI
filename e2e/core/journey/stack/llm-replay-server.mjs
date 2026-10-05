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
// Matching (scheme 2, after the Codex buddy review of #2513, 5 Oct). A call's
// SIGNATURE is host, HTTP method, the full request target (path + query), model, stream,
// and hashes of the FULL tool definitions and
// the FULL structured-output format (schemas included). Its DETAIL hash covers the
// whole request body, canonical (sorted keys), with only these values normalised,
// each a measured per-run volatility:
//   - uuids (scenario, turn, user and run ids are minted per run);
//   - ISO timestamps;
//   - float noise: a decimal with a fraction is compared at 6 significant digits
//     (Mac arm64 record vs Linux x86_64 replay). Integers are never touched, so
//     business quantities (120000, 187500) and counts stay exact;
//   - run ids, by KEY only (`run_id`): two CI replays of one frozen journey gave R2
//     f349e115… and d4e74b76… (runs 37312998590, 37315190922);
//   - the Run-explanation chip key `agent-explain-run:<16 hex>`: a digest of scenario_id +
//     computed_at (CEE run-explanation.ts:47 @b43bb79e), drift #5 of run 37318530007.
// Graph and analysis hashes are NOT normalised: they are content-derived (H1 2771ec91…,
// H2 9ad1f20a… identical on the Mac record and on both CI replays).
// Replay serves ONLY an exact (signature, detail) match. Anything else is red:
//   `drift` - a recording with the same signature exists but the request differs
//             (a diagnosis file names the first differing position);
//   `miss`  - no recording of that shape at all;
//   `exhausted` - an exact match whose every recording was already served, reuse off.
// `hit_reuse` (a used recording served again) is OFF until a client posts
// /__journey_allow_reuse, which the workflow does only before the advisory isolation
// rows. J1 runs first, so J1 sees exact hits or red.
// Recordings made under scheme 1 are re-keyed at load from their stored `request`.

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

const canonical = (v) => {
  if (Array.isArray(v)) return v.map(canonical)
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, canonical(v[k])]))
  return v
}
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi
const ISO_TS = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?/g
// A decimal WITH a fraction (and optional exponent). Integers never match.
const DECIMAL = /-?\b\d+\.\d+(?:[eE][-+]?\d+)?/g
// Escaped or not: the run id is often inside a JSON string the request carries.
const RUN_ID_VALUE = /(run_id\\*"\s*:\s*\\*")[0-9a-f]{16,64}/g
const RUN_KEY = /agent-explain-run:[0-9a-f]{16}/g
const normalise = (s) => String(s)
  .replace(UUID, '<uuid>')
  .replace(ISO_TS, '<ts>')
  .replace(RUN_ID_VALUE, '$1<run_id>')
  .replace(RUN_KEY, 'agent-explain-run:<run_key>')
  .replace(DECIMAL, (m) => String(Number(Number(m).toPrecision(6))))

function shapeOf(host, method, target, body) {
  const b = body && typeof body === 'object' ? body : {}
  const tools = sha(JSON.stringify(canonical(b.tools ?? null)))
  const format = sha(JSON.stringify(canonical([b.text?.format ?? null, b.response_format ?? null, b.tool_choice ?? null])))
  // method + the FULL request target (path and query): a PUT, or a query, is a different call.
  const signature = [host, method, target, `model=${b.model ?? ''}`, `stream=${b.stream === true}`, `tools=${tools}`, `format=${format}`].join('|')
  const norm = normalise(JSON.stringify(canonical(b)))
  return { signature, detail: sha(norm), norm }
}

/** The first position where two normalised requests differ, with context, for a drift row. */
function firstDifference(a, b) {
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  return { at: i, recorded: b.slice(Math.max(0, i - 160), i + 160), served: a.slice(Math.max(0, i - 160), i + 160) }
}

// ── replay index ────────────────────────────────────────────────────────────
const recordings = MODE === 'replay'
  ? fs.readdirSync(FIXTURES).filter((f) => /^\d+-.*\.json$/.test(f)).sort()
      .map((f) => {
        const r = JSON.parse(fs.readFileSync(path.join(FIXTURES, f), 'utf8'))
        // Re-key from the stored request, so every recording is matched under this scheme.
        // Scheme-1 recordings stored neither method nor query: every one was POST /v1/responses
        // with no query (the Responses API); a replayed call with a query therefore misses.
        const k = shapeOf(r.host, r.method ?? 'POST', r.target ?? r.path, r.request)
        return { file: f, ...r, signature: k.signature, detail: k.detail, norm: k.norm }
      })
  : []
const used = new Set()
// Reuse: off until /__journey_allow_reuse (advisory isolation rows only).
let reuseAllowed = false
const reuse = new Map()
if (MODE === 'replay') {
  console.log(`[llm-replay] replay mode: ${recordings.length} recordings in ${FIXTURES}`)
  ledger({ outcome: 'index', recordings: recordings.length, scheme: 2 })
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
    const target = String(req.url ?? '')
    const urlPath = target.split('?')[0]
    const method = String(req.method ?? '')
    const bodyBuf = Buffer.concat(chunks)
    let body = null
    try { body = JSON.parse(bodyBuf.toString('utf8')) } catch { /* non-JSON request */ }
    const { signature, detail, norm } = shapeOf(host, method, target, body)

    // The workflow's boot check: proves the redirect, the TLS trust and the mode,
    // without touching the ledger.
    if (urlPath === '/__journey_selftest') {
      res.writeHead(200, { 'content-type': 'application/json' })
      return res.end(JSON.stringify({ ok: true, mode: MODE, host, recordings: recordings.length, reuse: reuseAllowed }))
    }
    if (urlPath === '/__journey_allow_reuse' && req.method === 'POST') {
      reuseAllowed = true
      ledger({ outcome: 'reuse_enabled' })
      res.writeHead(200, { 'content-type': 'application/json' })
      return res.end(JSON.stringify({ ok: true, reuse: true }))
    }

    const n = ++seq
    if (!PROVIDER_HOSTS.has(host)) {
      ledger({ seq: n, outcome: 'unknown_host', host, path: urlPath })
      return refuse(res, 400, 'journey_unknown_host', `journey LLM boundary does not serve ${host}`)
    }

    if (MODE === 'replay') {
      const exact = recordings.filter((r) => r.signature === signature && r.detail === detail)
      let pick = exact.find((r) => !used.has(r.file))
      let outcome = pick ? 'hit' : null
      if (!pick && reuseAllowed && exact.length) {
        const k = reuse.get(signature + detail) ?? 0
        pick = exact[k % exact.length]; reuse.set(signature + detail, k + 1); outcome = 'hit_reuse'
      }
      if (!pick) {
        const near = recordings.find((r) => r.signature === signature && !used.has(r.file)) ??
          recordings.find((r) => r.signature === signature)
        if (near && near.detail === detail) {
          // Same request, every recording of it already served, reuse off: one call too many.
          ledger({ seq: n, outcome: 'exhausted', signature, detail, nearest: near.file })
          return refuse(res, 400, 'journey_replay_exhausted', `call ${n} repeats frozen ${near.file}, already served (reuse is off)`)
        }
        if (near) {
          const diff = firstDifference(norm, near.norm)
          const file = path.join(path.dirname(LEDGER), `drift-${String(n).padStart(4, '0')}.json`)
          // The WHOLE normalised request, so every difference (not only the first) can be diffed
          // against the recording normalised the same way. Bodies only: no header is ever kept.
          fs.writeFileSync(file, JSON.stringify({ seq: n, signature, detail, nearest: near.file, ...diff, served_norm: norm }, null, 1))
          ledger({ seq: n, outcome: 'drift', signature, detail, nearest: near.file, recorded_detail: near.detail, diff_at: diff.at, diagnosis: path.basename(file) })
          return refuse(res, 400, 'journey_replay_drift', `call ${n} differs from frozen ${near.file} at char ${diff.at}`)
        }
        ledger({ seq: n, outcome: 'miss', signature, detail })
        return refuse(res, 400, 'journey_replay_miss', `no frozen recording for call ${n} (${signature})`)
      }
      used.add(pick.file)
      ledger({ seq: n, outcome, signature, detail, file: pick.file })
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
          seq: n, signature, detail, host, method, target, path: urlPath, model: body?.model ?? null,
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
