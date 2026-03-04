/**
 * Tests for the legacyDirectRun feature flag (VITE_ENABLE_LEGACY_DIRECT_RUN).
 *
 * Verifies:
 * - Flag is exported correctly from flags.ts
 * - Default is true (backward compatible)
 * - Can be overridden via localStorage
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { makeFlag } from '../lib/flagFactory'

const globalAny: any = globalThis as any

beforeEach(() => {
  const store: Record<string, string> = {}
  globalAny.localStorage = {
    getItem(key: string) { return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null },
    setItem(key: string, value: string) { store[key] = String(value) },
    removeItem(key: string) { delete store[key] },
    clear() { for (const k of Object.keys(store)) delete store[k] },
    key(i: number) { return Object.keys(store)[i] ?? null },
    get length() { return Object.keys(store).length },
  }
})

describe('legacyDirectRun flag', () => {
  it('defaults to true (backward compatible — both paths run by default)', () => {
    const flag = makeFlag({
      envKey: 'VITE_ENABLE_LEGACY_DIRECT_RUN',
      storageKey: 'feature.legacyDirectRun',
      defaultValue: true,
    })
    // With no env var set and no localStorage override, should default to true
    expect(flag()).toBe(true)
  })

  it('can be disabled via localStorage override', () => {
    const flag = makeFlag({
      envKey: 'VITE_ENABLE_LEGACY_DIRECT_RUN',
      storageKey: 'feature.legacyDirectRun',
      defaultValue: true,
    })
    globalAny.localStorage.setItem('feature.legacyDirectRun', '0')
    expect(flag()).toBe(false)
  })

  it('can be explicitly enabled via localStorage override', () => {
    const flag = makeFlag({
      envKey: 'VITE_ENABLE_LEGACY_DIRECT_RUN',
      storageKey: 'feature.legacyDirectRun',
      defaultValue: true,
    })
    globalAny.localStorage.setItem('feature.legacyDirectRun', '1')
    expect(flag()).toBe(true)
  })
})

describe('legacyDirectRun export from flags.ts', () => {
  it('isLegacyDirectRunEnabled is exported as a function', async () => {
    const { isLegacyDirectRunEnabled } = await import('../flags')
    expect(typeof isLegacyDirectRunEnabled).toBe('function')
  })
})
