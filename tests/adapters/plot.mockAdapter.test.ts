import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest'

import { plot } from '../../src/adapters/plot'

const PRICING = 'pricing-v1'

const runWithSeed = async (seed: number) => {
  return plot.run({ template_id: PRICING, seed })
}

describe('plot mock adapter', () => {
  beforeEach(() => {
    plot.__test.clearCache()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns success report with hash metadata', async () => {
    const report = await runWithSeed(1337)
    expect(report.schema).toBe('report.v1')
    expect(report.model_card.response_hash).toContain('sha256:')
    expect(report.model_card.response_hash_algo).toBe('sha256')
    expect(report.model_card.normalized).toBe(true)
    expect(report.results.likely).toBe(150)
  })

  it('throws BAD_INPUT when seed divisible by 23', async () => {
    await expect(runWithSeed(23)).rejects.toMatchObject({
      code: 'BAD_INPUT'
    })
  })

  it('throws RATE_LIMITED when seed divisible by 29', async () => {
    await expect(runWithSeed(29)).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      retry_after: expect.any(Number)
    })
  })

  it('throws LIMIT_EXCEEDED when seed divisible by 31', async () => {
    await expect(runWithSeed(31)).rejects.toMatchObject({
      code: 'LIMIT_EXCEEDED',
      fields: expect.objectContaining({ max: 12 })
    })
  })

  it('returns cached limits with stable ETag', async () => {
    const first = await plot.limits()
    const firstEtag = plot.__test.getETag('limits')
    expect(firstEtag).toBeDefined()

    const second = await plot.limits()
    const secondEtag = plot.__test.getETag('limits')
    expect(second).toEqual(first)
    expect(secondEtag).toBe(firstEtag)
  })

  it('templates list caches and exposes keys', async () => {
    const list = await plot.templates()
    expect(list.items).toHaveLength(6)

    const keys = plot.__test.peekCache()
    expect(keys).toContain('templates')
  })

  it('template detail caches per id', async () => {
    const detail = await plot.template(PRICING)
    expect(detail.id).toBe(PRICING)

    const keys = plot.__test.peekCache()
    expect(keys).toContain(`template:${PRICING}`)
  })

  it('ensures deterministic success payload for identical seeds', async () => {
    const first = await runWithSeed(42)
    const second = await runWithSeed(42)
    expect(first).toEqual(second)
  })

  it('stream emits hello, ticks, reconnected and done', async () => {
    vi.useFakeTimers()
    
    const events: string[] = []
    const stream = plot.stream.run({ template_id: PRICING, seed: 42 })

    const iterator = stream[Symbol.asyncIterator]()

    const advanceTicks = async () => {
      let keepRunning = true
      while (keepRunning) {
        const nextPromise = iterator.next()
        await vi.advanceTimersByTimeAsync(250)
        const { value, done } = await nextPromise
        if (!done && value) {
          events.push(value.type)
        }
        keepRunning = !done
      }
    }

    await advanceTicks()

    expect(events[0]).toBe('hello')
    expect(events).toContain('reconnected')
    expect(events.at(-1)).toBe('done')
    expect(events.filter(e => e === 'tick').length).toBeGreaterThanOrEqual(5)
  })

  it('stream emits error and stops when run would fail', async () => {
    const events: string[] = []
    const stream = plot.stream.run({ template_id: PRICING, seed: 29 })

    const iterator = stream[Symbol.asyncIterator]()
    const first = await iterator.next()
    if (!first.done && first.value) {
      events.push(first.value.type)
    }
    const second = await iterator.next()
    if (!second.done && second.value) {
      events.push(second.value.type)
    }

    expect(events).toEqual(['hello', 'error'])
  })
})
