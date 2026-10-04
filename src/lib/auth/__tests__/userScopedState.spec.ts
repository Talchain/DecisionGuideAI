import { afterEach, describe, expect, it } from 'vitest'
import { clearUserScopedState, USER_SCOPED_STORAGE_KEYS, USER_SCOPED_STORAGE_PREFIXES } from '../userScopedState'

describe('user-scoped state identity boundary', () => {
  afterEach(() => { localStorage.clear(); sessionStorage.clear() })

  it('clears every registered persisted key and prefix while leaving device flags alone', () => {
    for (const key of USER_SCOPED_STORAGE_KEYS) localStorage.setItem(key, 'user-a')
    for (const prefix of USER_SCOPED_STORAGE_PREFIXES) localStorage.setItem(`${prefix}scenario-a`, 'user-a')
    localStorage.setItem('feature.aiPanelV2', '1')
    clearUserScopedState()
    for (const key of USER_SCOPED_STORAGE_KEYS) expect(localStorage.getItem(key)).toBeNull()
    for (const prefix of USER_SCOPED_STORAGE_PREFIXES) expect(localStorage.getItem(`${prefix}scenario-a`)).toBeNull()
    expect(localStorage.getItem('feature.aiPanelV2')).toBe('1')
  })

  it('keeps the registry explicit so a new user-scoped persisted surface cannot hide in cleanup', () => {
    expect(new Set(USER_SCOPED_STORAGE_KEYS).size).toBe(USER_SCOPED_STORAGE_KEYS.length)
    expect(USER_SCOPED_STORAGE_PREFIXES.length).toBeGreaterThan(0)
  })
})
