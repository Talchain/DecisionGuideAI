/**
 * LAPSE-FC: the key lists and the storage sweep live in a leaf the main bundle can carry, so the lapse boundary sweeps
 * even when its chunk never arrives. Pinned here: the leaf imports nothing (the main-bundle claim), the lapse module's
 * static imports stay light, both paths read the SAME lists, and the epoch key is the scenarios' key.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import * as leaf from '../userScopedKeys'
import * as boundary from '../userScopedState'
import { SIGNED_IN_HERE_KEY } from '../lapseBoundary'
import { IDENTITY_EPOCH_KEY } from '../../../canvas/store/scenarios'

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')
/**
 * Static import / re-export specifiers (never `import(...)`), with `import type` left out: types are erased. Clauses are
 * bindings only (names, braces, commas, `* as`), so a `from` inside a comment or string never counts.
 */
const staticImports = (src: string) =>
  Array.from(src.matchAll(
    /^\s*(?:import\s+(?!type\s)(?:[\w$*{}\s,]+?\s+from\s+)?|export\s+(?!type\s)(?:\*(?:\s+as\s+[\w$]+)?|\{[^}]*\})\s+from\s+)['"]([^'"]+)['"]/gm,
  ), (m) => m[1])

describe('LAPSE-FC — a leaf the main bundle can carry', () => {
  it('userScopedKeys.ts imports nothing, statically or dynamically', () => {
    const src = source('src/lib/auth/userScopedKeys.ts')
    expect(staticImports(src)).toEqual([])
    expect(src).not.toMatch(/\bimport\s*\(/)
    // POSITIVE CONTROL: the same scan finds the full boundary's heavy imports.
    expect(staticImports(source('src/lib/auth/userScopedState.ts'))).toContain('../../canvas/store')
  })

  it('lapseBoundary.ts (in main.tsx\'s static graph) imports only the stored-session check and the leaf', () => {
    expect(staticImports(source('src/lib/auth/lapseBoundary.ts')).sort()).toEqual(['../storedSupabaseSession', './userScopedKeys'])
  })

  it('the full boundary reads the SAME lists as the leaf (one object each, so they cannot drift)', () => {
    expect(boundary.USER_SCOPED_STORAGE_KEYS).toBe(leaf.USER_SCOPED_STORAGE_KEYS)
    expect(boundary.USER_SCOPED_STORAGE_PREFIXES).toBe(leaf.USER_SCOPED_STORAGE_PREFIXES)
    expect(boundary.USER_SCOPED_SESSION_KEYS).toBe(leaf.USER_SCOPED_SESSION_KEYS)
    expect(SIGNED_IN_HERE_KEY).toBe(leaf.SIGNED_IN_HERE_KEY)
    expect(leaf.USER_SCOPED_STORAGE_KEYS).toContain(SIGNED_IN_HERE_KEY)
  })

  it('the epoch the fallback writes is scenarios.IDENTITY_EPOCH_KEY, and the sweep never removes it', () => {
    expect(leaf.IDENTITY_EPOCH_STORAGE_KEY).toBe(IDENTITY_EPOCH_KEY)
    localStorage.setItem(IDENTITY_EPOCH_KEY, 'epoch')
    leaf.sweepUserScopedStorage()
    expect(localStorage.getItem(IDENTITY_EPOCH_KEY)).toBe('epoch')
    localStorage.clear()
  })

  it('the session sweep also removes registered user-scoped prefixes while preserving device preferences', () => {
    for (const key of leaf.USER_SCOPED_SESSION_KEYS) sessionStorage.setItem(key, 'A private state')
    for (const prefix of leaf.USER_SCOPED_STORAGE_PREFIXES) sessionStorage.setItem(`${prefix}scenario-a`, 'A private state')
    sessionStorage.setItem('canvas.viewMode', 'device-preference')
    leaf.sweepUserScopedStorage()
    for (const key of leaf.USER_SCOPED_SESSION_KEYS) expect(sessionStorage.getItem(key)).toBeNull()
    for (const prefix of leaf.USER_SCOPED_STORAGE_PREFIXES) expect.soft(sessionStorage.getItem(`${prefix}scenario-a`), prefix).toBeNull()
    expect(sessionStorage.getItem('canvas.viewMode')).toBe('device-preference')
    sessionStorage.clear()
  })
})
