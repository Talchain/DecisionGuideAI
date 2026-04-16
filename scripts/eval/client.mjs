// HTTP client for the CEE orchestrator. Default transport is SSE (mirrors the
// real UI path); --sync falls back to the synchronous endpoint for debugging.

import { performance } from 'node:perf_hooks'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(v) {
  return typeof v === 'string' && UUID_RE.test(v)
}

export class TransportError extends Error {
  constructor(message, { status, body, requestId, kind } = {}) {
    super(message)
    this.name = 'TransportError'
    this.status = status ?? 0
    this.body = body
    this.requestId = requestId
    this.kind = kind ?? 'unknown'
  }
}

function requireEnv(name) {
  const v = process.env[name]
  if (!v || !v.trim()) throw new Error(`Missing env var: ${name}`)
  return v.trim()
}

function baseUrl() {
  return (process.env.CEE_BASE_URL || 'https://cee-staging.onrender.com').replace(/\/+$/, '')
}

// Parse SSE chunks into events. Port of parseSSELines logic in turnService.ts.
export function parseSse(lines, flush = false) {
  const events = []
  let currentType = ''
  let dataLines = []
  for (const raw of lines) {
    const line = raw.replace(/\r$/, '')
    if (line === '') {
      if (dataLines.length > 0) {
        events.push({ eventType: currentType, data: dataLines.join('\n') })
        dataLines = []
        currentType = ''
      }
      continue
    }
    if (line.startsWith(':')) continue
    if (line.startsWith('event: ')) currentType = line.slice(7).trim()
    else if (line.startsWith('event:')) currentType = line.slice(6).trim()
    else if (line.startsWith('data: ')) dataLines.push(line.slice(6))
    else if (line.startsWith('data:')) dataLines.push(line.slice(5))
  }
  if (flush && dataLines.length > 0) {
    events.push({ eventType: currentType, data: dataLines.join('\n') })
  }
  return events
}

// One retry on 5xx / network. Does not retry on 4xx.
async function fetchWithRetry(url, init, { retries = 1, timeoutMs = 120_000 } = {}) {
  let lastErr
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const signal = init.signal ? anySignal(init.signal, controller.signal) : controller.signal
    try {
      const res = await fetch(url, { ...init, signal })
      clearTimeout(timer)
      if (res.status >= 500 && attempt < retries) {
        lastErr = new TransportError(`HTTP ${res.status}`, { status: res.status, kind: 'server_5xx' })
        await sleep(1500)
        continue
      }
      return res
    } catch (err) {
      clearTimeout(timer)
      const isAbort = err?.name === 'AbortError'
      lastErr = new TransportError(isAbort ? 'timeout' : (err?.message ?? 'network'), {
        kind: isAbort ? 'timeout' : 'network',
      })
      if (attempt < retries) { await sleep(1500); continue }
      throw lastErr
    }
  }
  throw lastErr ?? new TransportError('exhausted retries')
}

function anySignal(a, b) {
  const c = new AbortController()
  const abort = () => c.abort()
  if (a.aborted || b.aborted) { c.abort(); return c.signal }
  a.addEventListener('abort', abort, { once: true })
  b.addEventListener('abort', abort, { once: true })
  return c.signal
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)) }

const COMMON_HEADERS = () => ({
  'Content-Type': 'application/json',
  'X-Olumi-Assist-Key': requireEnv('ASSIST_API_KEY'),
})

// Synchronous POST /orchestrate/v1/turn — used by --sync flag or when SSE
// content-type is JSON (server cache hit).
export async function callSync(requestBody) {
  const url = `${baseUrl()}/orchestrate/v1/turn`
  const start = performance.now()
  const res = await fetchWithRetry(url, {
    method: 'POST',
    headers: { ...COMMON_HEADERS(), Accept: 'application/json' },
    body: JSON.stringify(requestBody),
  })
  const elapsed = Math.max(1, Math.round(performance.now() - start))
  const text = await res.text()
  let body
  try { body = text ? JSON.parse(text) : null } catch { body = { raw: text } }
  if (!res.ok) {
    throw new TransportError(`HTTP ${res.status}`, {
      status: res.status,
      body,
      requestId: res.headers.get('x-request-id') ?? undefined,
      kind: 'http_error',
    })
  }
  return {
    envelope: body,
    latency_ms: elapsed,
    cache_hit: null,
    transport: 'sync',
    stream_events: null,
    request_id: res.headers.get('x-request-id') ?? undefined,
  }
}

// SSE POST /orchestrate/v1/turn/stream — default transport.
// Returns the final envelope extracted from turn_complete, a timeline of
// events observed, and detected cache-hit state.
export async function callStream(requestBody, { timeoutMs = 120_000 } = {}) {
  const url = `${baseUrl()}/orchestrate/v1/turn/stream`
  const start = performance.now()
  const res = await fetchWithRetry(
    url,
    {
      method: 'POST',
      headers: { ...COMMON_HEADERS(), Accept: 'text/event-stream' },
      body: JSON.stringify(requestBody),
    },
    { retries: 1, timeoutMs },
  )

  // Fallback: endpoint returned JSON (CEE cache hit) or error.
  const ct = res.headers.get('content-type') ?? ''
  if (!res.ok) {
    const text = await res.text()
    let body
    try { body = text ? JSON.parse(text) : null } catch { body = { raw: text } }
    throw new TransportError(`HTTP ${res.status}`, {
      status: res.status,
      body,
      requestId: res.headers.get('x-request-id') ?? undefined,
      kind: 'http_error',
    })
  }
  if (ct.includes('application/json')) {
    const text = await res.text()
    let body
    try { body = JSON.parse(text) } catch { body = { raw: text } }
    const elapsed = Math.max(1, Math.round(performance.now() - start))
    return {
      envelope: body,
      latency_ms: elapsed,
      cache_hit: true,
      transport: 'stream-json-cache',
      stream_events: null,
      request_id: res.headers.get('x-request-id') ?? undefined,
    }
  }
  if (!ct.includes('text/event-stream')) {
    throw new TransportError(`Unexpected content-type on stream: ${ct}`, { kind: 'bad_content_type' })
  }
  if (!res.body) throw new TransportError('No stream body', { kind: 'no_body' })

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let envelope = null
  const timeline = []
  let seqCount = 0

  const handle = (events) => {
    for (const { eventType, data } of events) {
      let payload
      try { payload = JSON.parse(data) } catch { continue }
      const type = eventType || payload.type
      const t_ms = Math.max(1, Math.round(performance.now() - start))
      const entry = { seq: payload.seq ?? seqCount++, type, t_ms }
      // Capture tool names so executed_tools can be derived from stream
      if (type === 'tool_start' || type === 'tool_result') {
        entry.tool_name = payload.tool_name
        if (type === 'tool_result') entry.success = payload.success
      }
      if (type === 'block') entry.block_type = payload.block?.type
      if (type === 'error') entry.error = payload.error
      timeline.push(entry)
      if (type === 'turn_complete' && payload.envelope) envelope = payload.envelope
    }
  }

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const parts = buffer.split('\n')
      buffer = parts.pop() ?? ''
      handle(parseSse(parts))
    }
    const tail = decoder.decode()
    if (tail) buffer += tail
    if (buffer.length > 0) handle(parseSse(buffer.split('\n'), true))
  } finally {
    try { reader.releaseLock() } catch { /* noop */ }
  }

  const elapsed = Math.max(1, Math.round(performance.now() - start))
  if (!envelope) {
    throw new TransportError('Stream ended without turn_complete event', {
      kind: 'no_turn_complete',
      body: { events: timeline.slice(-10) },
    })
  }
  return {
    envelope,
    latency_ms: elapsed,
    cache_hit: false,
    transport: 'stream',
    stream_events: timeline,
    request_id: res.headers.get('x-request-id') ?? undefined,
  }
}

// Unified caller. `mode` = 'stream' | 'sync'.
export async function call(requestBody, { mode = 'stream' } = {}) {
  if (!isUuid(requestBody.scenario_id)) throw new Error('scenario_id must be UUID')
  if (!isUuid(requestBody.client_turn_id)) throw new Error('client_turn_id must be UUID')
  return mode === 'sync' ? callSync(requestBody) : callStream(requestBody)
}
