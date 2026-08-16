/**
 * Version persistence — behaviour pinned.
 *
 * The guest assertion is the one that matters: nothing in this module consults
 * an identity, so a signed-out session gets a fully working feature. That is
 * the defect at `compare-tab/useCompareHistoryHydration.ts:79` NOT repeated.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  MAX_VERSIONS,
  VERSIONS_STORAGE_KEY,
  appendVersion,
  clearVersions,
  deleteVersion,
  loadVersions,
  saveVersions,
} from '../versionStorage'
import type { ModelVersion } from '../types'

function version(id: string, createdAt: number, name = `v-${id}`): ModelVersion {
  return {
    id,
    name,
    createdAt,
    origin: 'manual',
    nodes: [{ id: 'n1', kind: 'factor', label: 'Price', fields: { value: 1 } }],
    edges: [],
  }
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('versionStorage', () => {
  it('returns an empty list when nothing is stored', () => {
    expect(loadVersions()).toEqual([])
  })

  it('round-trips a saved version', () => {
    const saved = saveVersions([version('a', 100)])

    expect(saved.success).toBe(true)
    expect(loadVersions().map((v) => v.id)).toEqual(['a'])
  })

  it('works with NO user identity present — guests get a working feature', () => {
    // There is no auth stub anywhere in this file. If this module ever grew a
    // userId guard, this test would be the one that reds.
    appendVersion(version('guest-save', 1))

    expect(loadVersions().map((v) => v.id)).toEqual(['guest-save'])
  })

  it('returns versions newest first regardless of insertion order', () => {
    saveVersions([version('old', 100), version('new', 300), version('mid', 200)])

    expect(loadVersions().map((v) => v.id)).toEqual(['new', 'mid', 'old'])
  })

  it('appends to the front and keeps existing versions', () => {
    appendVersion(version('first', 100))
    appendVersion(version('second', 200))

    expect(loadVersions().map((v) => v.id)).toEqual(['second', 'first'])
  })

  it('prunes to MAX_VERSIONS, dropping the oldest', () => {
    const many = Array.from({ length: MAX_VERSIONS + 5 }, (_, i) => version(`v${i}`, i))

    const result = saveVersions(many)

    expect(result.success).toBe(true)
    const stored = loadVersions()
    expect(stored).toHaveLength(MAX_VERSIONS)
    // Newest kept, oldest dropped.
    expect(stored[0]!.id).toBe(`v${MAX_VERSIONS + 4}`)
    expect(stored.map((v) => v.id)).not.toContain('v0')
  })

  it('deletes one version by id and leaves the rest', () => {
    saveVersions([version('a', 100), version('b', 200), version('c', 300)])

    deleteVersion('b')

    expect(loadVersions().map((v) => v.id)).toEqual(['c', 'a'])
  })

  it('deletes the LAST remaining version', () => {
    // Regression: the shedding loop stops at 1, so an empty write once fell
    // through to a false QUOTA_EXCEEDED and the delete silently did nothing.
    saveVersions([version('only', 100)])

    const result = deleteVersion('only')

    expect(result.success).toBe(true)
    expect(loadVersions()).toEqual([])
  })

  it('saving an empty list succeeds and clears the store', () => {
    saveVersions([version('a', 100)])

    const result = saveVersions([])

    expect(result.success).toBe(true)
    expect(result.success && result.data).toEqual([])
    expect(loadVersions()).toEqual([])
  })

  it('deleting an unknown id is a no-op, not an error', () => {
    saveVersions([version('a', 100)])

    const result = deleteVersion('does-not-exist')

    expect(result.success).toBe(true)
    expect(loadVersions().map((v) => v.id)).toEqual(['a'])
  })

  it('clears every version', () => {
    saveVersions([version('a', 100), version('b', 200)])

    clearVersions()

    expect(loadVersions()).toEqual([])
  })

  it('preserves the captured graph contents through a round trip', () => {
    const original = version('a', 100)
    original.nodes[0]!.fields = { value: 0, unit: '', flagged: false }

    saveVersions([original])

    expect(loadVersions()[0]!.nodes[0]!.fields).toEqual({ value: 0, unit: '', flagged: false })
  })

  describe('corrupt or hostile stored data', () => {
    it('treats unparseable JSON as empty and warns', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      localStorage.setItem(VERSIONS_STORAGE_KEY, '{not json')

      expect(loadVersions()).toEqual([])
      expect(warn).toHaveBeenCalled()
    })

    it('treats a payload whose data is not an array as empty', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      localStorage.setItem(
        VERSIONS_STORAGE_KEY,
        JSON.stringify({ schema: 'x', version: '1', timestamp: 1, data: { nope: true } }),
      )

      expect(loadVersions()).toEqual([])
    })

    it('drops individually malformed entries but keeps the valid ones', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      localStorage.setItem(
        VERSIONS_STORAGE_KEY,
        JSON.stringify({
          schema: 'x',
          version: '1',
          timestamp: 1,
          data: [version('good', 100), { id: 'bad' }, null],
        }),
      )

      expect(loadVersions().map((v) => v.id)).toEqual(['good'])
      expect(warn).toHaveBeenCalled()
    })
  })

  describe('quota exhaustion', () => {
    it('sheds the oldest versions and reports success with what it kept', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      let calls = 0
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        calls += 1
        // Reject the first two attempts (3 versions, then 2); accept the third.
        if (calls < 3) {
          const error = new Error('quota')
          error.name = 'QuotaExceededError'
          throw error
        }
      })

      const result = saveVersions([version('a', 300), version('b', 200), version('c', 100)])

      expect(result.success).toBe(true)
      // Newest survives, oldest two shed.
      expect(result.success && result.data.map((v) => v.id)).toEqual(['a'])
      expect(calls).toBe(3)
    })

    it('reports a real failure when even one version will not fit', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        const error = new Error('quota')
        error.name = 'QuotaExceededError'
        throw error
      })

      const result = saveVersions([version('a', 100)])

      expect(result.success).toBe(false)
      expect(result.success === false && result.error.type).toBe('QUOTA_EXCEEDED')
    })

    it('reports a non-quota write failure rather than swallowing it', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('security error')
      })

      const result = saveVersions([version('a', 100)])

      expect(result.success).toBe(false)
      expect(result.success === false && result.error.type).toBe('UNKNOWN')
    })
  })
})
