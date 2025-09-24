// src/lib/sseClient.ts

export type Handlers = {
  onHello?: () => void
  onToken?: (t: string) => void
  onCost?: (usd: number) => void
  onDone?: () => void
  onCancelled?: () => void
  onLimit?: () => void
  onError?: (err?: unknown) => void
  onAborted?: () => void
}

export type JobsStreamOptions = {
  jobId: string
  org?: string
  autoReconnect?: boolean
  maxRetries?: number
  onProgress?: (n: number) => void
  onDone?: () => void
  onCancelled?: () => void
  onError?: (err?: unknown) => void
}

// Subscribe to jobs progress stream: GET /jobs/stream?jobId=&org=
export function openJobsStream(opts: JobsStreamOptions): StreamHandle {
  const base = getBaseUrl()
  const jobId = opts.jobId
  const org = opts.org || 'demo'
  const autoReconnect = opts.autoReconnect !== false
  const maxRetries = typeof opts.maxRetries === 'number' ? opts.maxRetries : 1

  let es: EventSource | null = null
  let closed = false
  let retries = 0
  let lastProcessedId: string | undefined

  const makeUrl = (resumeId?: string): string => {
    const u = new URL('/jobs/stream', base)
    u.searchParams.set('jobId', jobId)
    u.searchParams.set('org', org)
    if (resumeId) u.searchParams.set('lastEventId', resumeId)
    return u.toString()
  }

  const cleanup = () => {
    if (es) {
      try { es.close() } catch {}
    }
    es = null
  }

  const start = () => {
    if (closed) return
    es = new EventSource(makeUrl(lastProcessedId))

    const handleMessage = (ev: MessageEvent, type: string) => {
      const id = (ev as any)?.lastEventId as string | undefined
      if (id && id === lastProcessedId) return
      if (id) lastProcessedId = id

      if (type === 'progress') {
        const n = parseFloat(String(ev.data ?? ''))
        if (!Number.isNaN(n)) opts.onProgress?.(n)
        return
      }
      if (type === 'done') {
        opts.onDone?.()
        cleanup()
        return
      }
      if (type === 'cancelled') {
        opts.onCancelled?.()
        cleanup()
        return
      }
    }

    const add = (type: string) => es?.addEventListener(type, (ev: any) => handleMessage(ev, type))
    add('progress')
    add('done')
    add('cancelled')
    es!.onmessage = (ev: MessageEvent) => handleMessage(ev, 'progress')

    es!.onerror = (err: any) => {
      if (closed) return
      const willRetry = autoReconnect && retries < maxRetries
      try { (err as any).willRetry = willRetry } catch {}
      opts.onError?.(err)
      if (!willRetry) { cleanup(); return }
      retries += 1
      cleanup()
      setTimeout(() => start(), 50)
    }
  }

  start()

  return {
    cancel: async () => {
      closed = true
      cleanup()
      try {
        const u = new URL('/jobs/cancel', base)
        u.searchParams.set('jobId', jobId)
        u.searchParams.set('org', org)
        await fetch(u.toString(), { method: 'POST' })
      } catch {}
    },
    close: () => { closed = true; cleanup() },
  }
}

export type StreamOptions = Handlers & {
  route: string
  sessionId?: string
  org?: string
  autoReconnect?: boolean
  maxRetries?: number // maximum reconnect attempts (default: 1)
  // Optional scenario params
  seed?: string | number
  budget?: number
  model?: string
}

export type StreamHandle = { cancel: () => Promise<void>; close: () => void }

function getBaseUrl(): string {
  try {
    const env = (import.meta as any)?.env?.VITE_EDGE_GATEWAY_URL
    if (typeof env === 'string' && env.length > 0) return env
  } catch (_e) {}
  // Fallback for local dev
  return 'http://localhost:3001'
}

// Normalise token text to avoid CRLF surprises
function normaliseCRLF(s: string): string {
  return s.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

export function openStream(opts: StreamOptions): StreamHandle {
  const base = getBaseUrl()
  const route = opts.route || 'critique'
  const sessionId = opts.sessionId || 'demo'
  const org = opts.org || 'demo'
  const autoReconnect = opts.autoReconnect !== false
  const maxRetries = typeof opts.maxRetries === 'number' ? opts.maxRetries : 1

  let es: EventSource | null = null
  let closed = false
  let retries = 0
  let cancelRequested = false
  let lastProcessedId: string | undefined

  const makeUrl = (resumeId?: string): string => {
    const u = new URL('/stream', base)
    u.searchParams.set('route', route)
    u.searchParams.set('sessionId', sessionId)
    u.searchParams.set('org', org)
    if (opts.seed != null && String(opts.seed).length > 0) {
      u.searchParams.set('seed', String(opts.seed))
    }
    if (typeof opts.budget === 'number') {
      u.searchParams.set('budget', String(opts.budget))
    }
    if (typeof opts.model === 'string' && opts.model.length > 0) {
      u.searchParams.set('model', opts.model)
    }
    if (resumeId) u.searchParams.set('lastEventId', resumeId)
    return u.toString()
  }

  const cleanup = () => {
    if (es) {
      try {
        es.close()
      } catch {}
    }
    es = null
  }

  const start = () => {
    if (closed) return
    // Supply lastEventId via query to support resume semantics on manual reconnects.
    es = new EventSource(makeUrl(lastProcessedId))

    // Fire hello on connection open
    if (es) {
      es.onopen = () => {
        opts.onHello?.()
      }
    }

    const handleMessage = (ev: MessageEvent, type: string) => {
      // De-duplicate by SSE id, if present
      const id = (ev as any)?.lastEventId as string | undefined
      if (id && id === lastProcessedId) return
      if (id) lastProcessedId = id

      if (type === 'token') {
        const token = normaliseCRLF(String(ev.data ?? ''))
        if (token) opts.onToken?.(token)
        return
      }
      if (type === 'cost') {
        const n = parseFloat(String(ev.data ?? ''))
        if (!Number.isNaN(n)) opts.onCost?.(n)
        return
      }
      if (type === 'done') {
        opts.onDone?.()
        cleanup()
        return
      }
      if (type === 'cancelled') {
        opts.onCancelled?.()
        cleanup()
        return
      }
      if (type === 'limited') {
        opts.onLimit?.()
        cleanup()
        return
      }
      if (type === 'aborted') {
        opts.onAborted?.()
        cleanup()
        return
      }
      if (type === 'hello') {
        // Some backends also emit a logical hello event
        opts.onHello?.()
        return
      }
    }

    const add = (type: string) => {
      es?.addEventListener(type, (ev: any) => handleMessage(ev as MessageEvent, type))
    }

    add('hello')
    add('token')
    add('cost')
    add('done')
    add('cancelled')
    add('limited')
    add('aborted')
    // Fallback if server uses default event type
    es!.onmessage = (ev: MessageEvent) => handleMessage(ev, 'token')

    es!.onerror = (err: any) => {
      if (closed) return
      const willRetry = autoReconnect && !cancelRequested && retries < maxRetries
      // Notify UI; callers may show a subtle reconnect hint while willRetry
      try { (err as any).willRetry = willRetry } catch {}
      opts.onError?.(err)
      if (!willRetry) {
        // Terminal error: stop trying
        cleanup()
        return
      }
      retries += 1
      // Actively recreate the connection once; native EventSource would also retry,
      // but we take control to keep determinism and single retry semantics.
      cleanup()
      // Small micro-delay to avoid tight loop; do not use real timers in tests
      setTimeout(() => start(), 50)
    }
  }

  start()

  const handle: StreamHandle = {
    cancel: async () => {
      cancelRequested = true
      try {
        const u = new URL('/cancel', base)
        u.searchParams.set('route', route)
        u.searchParams.set('sessionId', sessionId)
        u.searchParams.set('org', org)
        // Accept idempotent 202/409
        await fetch(u.toString(), { method: 'POST' })
      } catch {
        // swallow; UI state remains consistent
      }
    },
    close: () => {
      closed = true
      cleanup()
    },
  }

  return handle
}
