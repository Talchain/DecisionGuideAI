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
    async *run(input: RunRequest): AsyncIterable<StreamEvent> {
      const detail = await loadTemplateById(input.template_id)
      const seed = input.seed ?? detail.default_seed ?? 1337

      yield { type: 'hello', data: { response_id: `mock-${detail.id}-${seed}` } }

      const error = chooseErrorForSeed(seed)
      if (error) {
        yield { type: 'error', data: error }
        return
      }

      const prng = mulberry32(seed)
      const tickCount = 5 + Math.floor(prng() * 3)
      let reconnectedSent = false

      for (let i = 0; i < tickCount; i += 1) {
        await new Promise(resolve => setTimeout(resolve, 250))
        yield { type: 'tick', data: { index: i } }
        if (!reconnectedSent && i >= 1) {
          reconnectedSent = true
          yield { type: 'reconnected', data: { attempt: 1 } }
        }
      }

      yield { type: 'done', data: { response_id: `mock-${detail.id}-${seed}` } }
    }
  }
}
