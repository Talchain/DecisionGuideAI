import success from '../../fixtures/plot/report.success.json'
import badInput from '../../fixtures/plot/report.bad_input.json'
import rateLimited from '../../fixtures/plot/report.rate_limited.json'
import limitNodes from '../../fixtures/plot/report.limit_exceeded.nodes.json'
import limitsFx from '../../fixtures/plot/limits.json'
import listFx from '../../fixtures/plot/templates.list.json'

import type {
  RunRequest,
  ReportV1,
  ErrorV1,
  LimitsV1,
  TemplateDetail,
  TemplateListV1,
  StreamEvent
} from './types'

const TTL_MS = 60_000

interface CacheEntry<T> {
  etag: string
  data: T
  expiresAt: number
}

const cache = new Map<string, CacheEntry<unknown>>()

const stableStringify = (obj: unknown): string =>
  JSON.stringify(
    obj,
    (_key, value) =>
      value && typeof value === 'object' && !Array.isArray(value)
        ? Object.keys(value as Record<string, unknown>)
            .sort()
            .reduce<Record<string, unknown>>((acc, k) => {
              acc[k] = (value as Record<string, unknown>)[k]
              return acc
            }, {})
        : value
  )

const hash = (value: string): string => {
  let h = 5381
  for (let i = 0; i < value.length; i += 1) {
    h = ((h << 5) + h) + value.charCodeAt(i)
  }
  return (h >>> 0).toString(16)
}

const weakETag = (payload: unknown): string => `W/"${hash(stableStringify(payload))}"`

const clampRetryAfter = (seconds: number, min = 1, max = 60): number =>
  Math.max(min, Math.min(max, Math.floor(seconds)))

const mulberry32 = (seed: number) => {
  let s = seed >>> 0
  return () => {
    s += 0x6D2B79F5
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

let DELAY_OVERRIDE_MS: number | null = null

const seededDelay = async (seed: number, lo = 120, hi = 220) => {
  if (DELAY_OVERRIDE_MS !== null) {
    await new Promise(resolve => setTimeout(resolve, DELAY_OVERRIDE_MS as number))
    return
  }
  const prng = mulberry32(seed)
  const duration = Math.floor(lo + (hi - lo) * prng())
  await new Promise(resolve => setTimeout(resolve, duration))
}

const getCached = <T>(key: string): CacheEntry<T> | undefined => {
  const entry = cache.get(key)
  if (!entry) return undefined
  if (entry.expiresAt < Date.now()) {
    cache.delete(key)
    return undefined
  }
  return entry as CacheEntry<T>
}

const setCached = <T>(key: string, data: T): CacheEntry<T> => {
  const entry: CacheEntry<T> = {
    etag: weakETag(data),
    data,
    expiresAt: Date.now() + TTL_MS
  }
  cache.set(key, entry)
  return entry
}

const loadTemplateById = async (id: string): Promise<TemplateDetail> => {
  const detail = await import(`../../fixtures/plot/templates.byId/${id}.json`)
  return detail.default as TemplateDetail
}

const chooseErrorForSeed = (seed: number): ErrorV1 | null => {
  if (seed % 31 === 0) {
    const err = limitNodes as ErrorV1
    return {
      schema: 'error.v1',
      code: 'LIMIT_EXCEEDED',
      error: err.error,
      hint: err.hint,
      fields: err.fields
    }
  }

  if (seed % 29 === 0) {
    const err = rateLimited as ErrorV1
    const retryAfter = clampRetryAfter(err.retry_after ?? 10, 5, 15)
    return {
      schema: 'error.v1',
      code: 'RATE_LIMITED',
      error: err.error,
      hint: err.hint,
      retry_after: retryAfter
    }
  }

  if (seed % 23 === 0) {
    const err = badInput as ErrorV1
    return {
      schema: 'error.v1',
      code: 'BAD_INPUT',
      error: err.error,
      hint: err.hint
    }
  }

  return null
}

const baseSuccessReport = success as ReportV1

const materialiseSuccessReport = (seed: number, detail: TemplateDetail): ReportV1 => {
  const clone = JSON.parse(JSON.stringify(baseSuccessReport)) as ReportV1
  clone.meta = {
    ...clone.meta,
    seed,
    response_id: `mock-${detail.id}-${seed}`
  }
  clone.model_card = {
    ...clone.model_card
  }
  return clone
}

export const plot = {
  __test: {
    getETag(key: string) {
      return cache.get(key)?.etag
    },
    peekCache() {
      return Array.from(cache.keys())
    },
    clearCache() {
      cache.clear()
    },
    setDelay(ms: number | null) {
      DELAY_OVERRIDE_MS = ms
    }
  },

  async run(input: RunRequest): Promise<ReportV1> {
    const baseDetail = await loadTemplateById(input.template_id)
    const seed = input.seed ?? baseDetail.default_seed ?? 1337

    await seededDelay(seed)

    const error = chooseErrorForSeed(seed)
    if (error) {
      throw error
    }

    return materialiseSuccessReport(seed, baseDetail)
  },

  async limits(): Promise<LimitsV1> {
    const key = 'limits'
    const hit = getCached<LimitsV1>(key)
    if (hit) {
      return hit.data
    }
    const data = limitsFx as LimitsV1
    return setCached(key, data).data
  },

  async templates(): Promise<TemplateListV1> {
    const key = 'templates'
    const hit = getCached<TemplateListV1>(key)
    if (hit) {
      return hit.data
    }
    const data = listFx as TemplateListV1
    return setCached(key, data).data
  },

  async template(id: string): Promise<TemplateDetail> {
    const key = `template:${id}`
    const hit = getCached<TemplateDetail>(key)
    if (hit) {
      return hit.data
    }
    const detail = await loadTemplateById(id)
    return setCached(key, detail).data
  },

  stream: {
    // Callback-based streaming API (matches httpV1Adapter contract)
    run(
      input: RunRequest,
      handlers: {
        onHello?: (data: { response_id: string }) => void
        onTick?: (data: { index: number }) => void
        onDone?: (data: { response_id: string; report: ReportV1 }) => void
        onError?: (error: ErrorV1) => void
      }
    ): () => void {
      let isCancelled = false

      // Start async streaming
      ;(async () => {
        const detail = await loadTemplateById(input.template_id)
        const seed = input.seed ?? detail.default_seed ?? 1337
        const responseId = `mock-${detail.id}-${seed}`

        if (isCancelled) return

        // Call onHello
        handlers.onHello?.({ response_id: responseId })

        const error = chooseErrorForSeed(seed)
        if (error) {
          handlers.onError?.(error)
          return
        }

        const prng = mulberry32(seed)
        const tickCount = 5 + Math.floor(prng() * 3)

        for (let i = 0; i < tickCount; i += 1) {
          if (isCancelled) return
          await new Promise(resolve => setTimeout(resolve, 250))
          if (isCancelled) return
          handlers.onTick?.({ index: i })
        }

        if (isCancelled) return

        const report = materialiseSuccessReport(seed, detail)

        const mode = seed % 3

        let ceeReview: import('./types').CEEReview | null = null
        let ceeError: import('./types').CEEError | null = null

        if (mode === 0) {
          // Ready state: full Decision Review payload
          ceeReview = {
            story: {
              headline: 'Mock Decision Review',
              key_drivers: [
                { label: 'Mock driver 1', why: 'Represents a key upside in the mock engine.' },
                { label: 'Mock driver 2', why: 'Represents a key downside in the mock engine.' },
              ],
              next_actions: [
                { label: 'Review this decision with your team', why: 'Align on risks and trade-offs before acting.' },
              ],
            },
            journey: {
              is_complete: true,
              missing_envelopes: [],
            },
          }
        } else if (mode === 2) {
          // Error state: no review, CEE error view model
          ceeError = {
            code: 'CEE_TEMPORARY',
            retryable: true,
            traceId: `mock-trace-${seed}`,
            suggestedAction: 'retry',
          }
        }

        const ceeTrace: import('./types').CEETrace = {
          requestId: responseId,
          degraded: false,
          timestamp: new Date().toISOString(),
        }

        handlers.onDone?.({ response_id: responseId, report, ceeReview, ceeTrace, ceeError } as any)
      })().catch((err) => {
        if (!isCancelled) {
          handlers.onError?.(err as ErrorV1)
        }
      })

      // Return cancel function
      return () => {
        isCancelled = true
      }
    }
  }
}
