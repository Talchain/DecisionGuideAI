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
})
