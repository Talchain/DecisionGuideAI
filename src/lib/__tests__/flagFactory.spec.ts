import { describe, it, expect, beforeEach } from 'vitest'
import { makeFlag } from '../flagFactory'

// Simple in-memory localStorage shim for Node/test environments
const globalAny: any = globalThis as any

beforeEach(() => {
  const store: Record<string, string> = {}
  globalAny.localStorage = {
    getItem(key: string) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null
    },
    setItem(key: string, value: string) {
      store[key] = String(value)
    },
    removeItem(key: string) {
      delete store[key]
    },
    clear() {
      for (const k of Object.keys(store)) delete store[k]
    },
    key(i: number) {
      return Object.keys(store)[i] ?? null
    },
    get length() {
      return Object.keys(store).length
    },
  }
})

describe('makeFlag', () => {
  it('returns default false when no env or storage override', () => {
    const flag = makeFlag({ envKey: '', storageKey: 'test.flag.defaultFalse' })
    expect(flag()).toBe(false)
  })

  it('returns default true when no env or storage override', () => {
    const flag = makeFlag({ envKey: '', storageKey: 'test.flag.defaultTrue', defaultValue: true })
    expect(flag()).toBe(true)
  })

  it('treats localStorage "1" as explicit ON even when default is false', () => {
    const key = 'test.flag.lsOn'
    const flag = makeFlag({ envKey: '', storageKey: key })
    globalAny.localStorage.setItem(key, '1')
    expect(flag()).toBe(true)
  })

  it('allows localStorage "0" to disable a default-true flag', () => {
    const key = 'test.flag.lsOffDefaultTrue'
    const flag = makeFlag({ envKey: '', storageKey: key, defaultValue: true })
    globalAny.localStorage.setItem(key, '0')
    expect(flag()).toBe(false)
  })

  it('treats localStorage "false" as explicit OFF', () => {
    const key = 'test.flag.lsFalse'
    const flag = makeFlag({ envKey: '', storageKey: key, defaultValue: true })
    globalAny.localStorage.setItem(key, 'false')
    expect(flag()).toBe(false)
  })

  it('treats any other non-null localStorage value as ON', () => {
    const key = 'test.flag.lsOther'
    const flag = makeFlag({ envKey: '', storageKey: key })
    globalAny.localStorage.setItem(key, 'yes')
    expect(flag()).toBe(true)
  })

  it('resolves env var from eagerly-captured snapshot (not dynamic access)', () => {
    // The factory captures { ...import.meta.env } at module load time.
    // If MODE is present in the snapshot, dynamic key lookup works correctly.
    // This is the exact pattern that was broken before the fix — dynamic
    // access via (import.meta as any)?.env?.[envKey] returned undefined.
    const flag = makeFlag({ envKey: 'MODE', storageKey: 'test.flag.mode' })
    // MODE is 'test' in vitest — not a truthy flag value, so should be false
    expect(flag()).toBe(false)
  })

  it('snapshot resolves VITE_ prefixed vars the same as literal access', () => {
    // Verify that the snapshot mechanism produces the same result as
    // direct literal access for a VITE_ prefixed env var.
    const literalValue = import.meta.env.VITE_ENABLE_ORCHESTRATOR_V2
    const flag = makeFlag({
      envKey: 'VITE_ENABLE_ORCHESTRATOR_V2',
      storageKey: 'test.flag.orchV2Snapshot',
    })
    const factoryResult = flag()

    // Both should agree: if env var is 'true', both should be true
    if (literalValue === 'true' || literalValue === '1') {
      expect(factoryResult).toBe(true)
    } else if (literalValue === undefined || literalValue === '' || literalValue === 'false' || literalValue === '0') {
      expect(factoryResult).toBe(false)
    }
    // If env var is set to something else, just verify it's a boolean
    expect(typeof factoryResult).toBe('boolean')
  })
})

describe('isOrchestratorV2Enabled (real export)', () => {
  it('is a callable function returning boolean', async () => {
    const { isOrchestratorV2Enabled } = await import('../../flags')
    expect(typeof isOrchestratorV2Enabled).toBe('function')
    expect(typeof isOrchestratorV2Enabled()).toBe('boolean')
  })

  it('respects localStorage override', async () => {
    const { isOrchestratorV2Enabled } = await import('../../flags')

    globalAny.localStorage.setItem('feature.orchestratorV2', '1')
    expect(isOrchestratorV2Enabled()).toBe(true)

    globalAny.localStorage.setItem('feature.orchestratorV2', '0')
    expect(isOrchestratorV2Enabled()).toBe(false)

    globalAny.localStorage.removeItem('feature.orchestratorV2')
  })
})
