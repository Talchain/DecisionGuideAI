/**
 * Tests for canonical-hash.ts
 *
 * Verifies:
 * - Deterministic key ordering at all nesting levels
 * - Correct handling of undefined vs null
 * - Array order preservation
 * - Hash consistency across identical logical payloads
 */

import { describe, it, expect } from 'vitest'
import {
  canonicalise,
  canonicalJson,
  computePayloadHash,
  computePayloadHashSync,
} from '../canonical-hash'

describe('canonicalise', () => {
  it('sorts object keys alphabetically', () => {
    const input = { z: 1, a: 2, m: 3 }
    const result = canonicalise(input)
    expect(Object.keys(result as object)).toEqual(['a', 'm', 'z'])
  })

  it('sorts keys at every nesting level', () => {
    const input = { outer: { z: 1, a: 2 }, name: 'test' }
    const result = canonicalise(input) as Record<string, unknown>
    expect(Object.keys(result)).toEqual(['name', 'outer'])
    expect(Object.keys(result.outer as object)).toEqual(['a', 'z'])
  })

  it('preserves null values', () => {
    const input = { a: 1, c: null }
    const result = canonicalise(input) as Record<string, unknown>
    expect(result.c).toBeNull()
    expect('c' in result).toBe(true)
  })

  it('omits undefined values', () => {
    const input = { a: 1, b: undefined, c: null }
    const result = canonicalise(input) as Record<string, unknown>
    expect('b' in result).toBe(false)
    expect('a' in result).toBe(true)
    expect('c' in result).toBe(true)
  })

  it('preserves array order', () => {
    const input = { arr: [3, 1, 2] }
    const result = canonicalise(input) as Record<string, unknown>
    expect(result.arr).toEqual([3, 1, 2])
  })

  it('canonicalises objects within arrays', () => {
    const input = { arr: [{ z: 1, a: 2 }, { b: 3, a: 4 }] }
    const result = canonicalise(input) as Record<string, unknown>
    const arr = result.arr as Array<Record<string, unknown>>
    expect(Object.keys(arr[0])).toEqual(['a', 'z'])
    expect(Object.keys(arr[1])).toEqual(['a', 'b'])
  })

  it('handles empty objects', () => {
    expect(canonicalise({})).toEqual({})
  })

  it('handles empty arrays', () => {
    expect(canonicalise([])).toEqual([])
  })

  it('handles primitives', () => {
    expect(canonicalise('string')).toBe('string')
    expect(canonicalise(42)).toBe(42)
    expect(canonicalise(true)).toBe(true)
    expect(canonicalise(false)).toBe(false)
    expect(canonicalise(null)).toBeNull()
  })

  it('handles deeply nested structures', () => {
    const input = {
      level1: {
        z: {
          b: { d: 1, c: 2 },
          a: { f: 3, e: 4 },
        },
        a: 'first',
      },
    }
    const result = canonicalise(input) as any
    expect(Object.keys(result.level1)).toEqual(['a', 'z'])
    expect(Object.keys(result.level1.z)).toEqual(['a', 'b'])
    expect(Object.keys(result.level1.z.a)).toEqual(['e', 'f'])
    expect(Object.keys(result.level1.z.b)).toEqual(['c', 'd'])
  })
})

describe('canonicalJson', () => {
  it('produces sorted JSON for simple object', () => {
    const input = { z: 1, a: 2, m: 3 }
    expect(canonicalJson(input)).toBe('{"a":2,"m":3,"z":1}')
  })

  it('produces sorted JSON for nested object', () => {
    const input = { outer: { z: 1, a: 2 }, name: 'test' }
    expect(canonicalJson(input)).toBe('{"name":"test","outer":{"a":2,"z":1}}')
  })

  it('omits undefined but keeps null', () => {
    const input = { a: 1, b: undefined, c: null }
    expect(canonicalJson(input)).toBe('{"a":1,"c":null}')
  })

  it('handles arrays with objects', () => {
    const input = { items: [{ b: 2, a: 1 }] }
    expect(canonicalJson(input)).toBe('{"items":[{"a":1,"b":2}]}')
  })

  it('produces identical output regardless of input key order', () => {
    const input1 = { z: 1, a: 2, m: 3 }
    const input2 = { a: 2, z: 1, m: 3 }
    const input3 = { m: 3, z: 1, a: 2 }

    const json1 = canonicalJson(input1)
    const json2 = canonicalJson(input2)
    const json3 = canonicalJson(input3)

    expect(json1).toBe(json2)
    expect(json2).toBe(json3)
  })
})

describe('computePayloadHash', () => {
  it('produces 12-character hex string', async () => {
    const hash = await computePayloadHash({ test: 1 })
    expect(hash).toHaveLength(12)
    expect(hash).toMatch(/^[0-9a-f]{12}$/)
  })

  it('produces same hash for identical logical payloads', async () => {
    const hash1 = await computePayloadHash({ z: 1, a: 2 })
    const hash2 = await computePayloadHash({ a: 2, z: 1 })
    expect(hash1).toBe(hash2)
  })

  it('produces different hashes for different payloads', async () => {
    const hash1 = await computePayloadHash({ a: 1 })
    const hash2 = await computePayloadHash({ a: 2 })
    expect(hash1).not.toBe(hash2)
  })

  it('handles empty object', async () => {
    const hash = await computePayloadHash({})
    expect(hash).toHaveLength(12)
  })

  it('handles complex nested payload', async () => {
    const payload = {
      nodes: [
        { id: '1', type: 'option', data: { label: 'Test' } },
        { id: '2', type: 'factor', data: { label: 'Factor' } },
      ],
      edges: [{ source: '1', target: '2', weight: 0.8 }],
      options: { seed: 42, mode: 'standard' },
    }
    const hash = await computePayloadHash(payload)
    expect(hash).toHaveLength(12)

    // Same payload with different key order should produce same hash
    const payload2 = {
      edges: [{ weight: 0.8, source: '1', target: '2' }],
      options: { mode: 'standard', seed: 42 },
      nodes: [
        { data: { label: 'Test' }, id: '1', type: 'option' },
        { data: { label: 'Factor' }, type: 'factor', id: '2' },
      ],
    }
    const hash2 = await computePayloadHash(payload2)
    expect(hash).toBe(hash2)
  })

  // Test vectors from the brief
  it('test vector 1: { z: 1, a: 2, m: 3 }', async () => {
    const input = { z: 1, a: 2, m: 3 }
    const canonical = canonicalJson(input)
    expect(canonical).toBe('{"a":2,"m":3,"z":1}')
    // Note: Hash will be computed, we verify it's deterministic
    const hash = await computePayloadHash(input)
    expect(hash).toHaveLength(12)
    // Re-compute should give same result
    const hash2 = await computePayloadHash({ a: 2, z: 1, m: 3 })
    expect(hash).toBe(hash2)
  })

  it('test vector 2: nested object', async () => {
    const input = { outer: { z: 1, a: 2 }, name: 'test' }
    const canonical = canonicalJson(input)
    expect(canonical).toBe('{"name":"test","outer":{"a":2,"z":1}}')
    const hash = await computePayloadHash(input)
    expect(hash).toHaveLength(12)
  })

  it('test vector 3: undefined removed, null kept', async () => {
    const input = { a: 1, b: undefined, c: null }
    const canonical = canonicalJson(input)
    expect(canonical).toBe('{"a":1,"c":null}')
    expect(canonical).not.toContain('undefined')
    expect(canonical).toContain('null')
  })
})

describe('computePayloadHashSync', () => {
  it('produces 12-character hex string', () => {
    const hash = computePayloadHashSync({ test: 1 })
    expect(hash).toHaveLength(12)
    expect(hash).toMatch(/^[0-9a-f]{12}$/)
  })

  it('produces same hash for identical logical payloads', () => {
    const hash1 = computePayloadHashSync({ z: 1, a: 2 })
    const hash2 = computePayloadHashSync({ a: 2, z: 1 })
    expect(hash1).toBe(hash2)
  })

  it('produces different hashes for different payloads', () => {
    const hash1 = computePayloadHashSync({ a: 1 })
    const hash2 = computePayloadHashSync({ a: 2 })
    expect(hash1).not.toBe(hash2)
  })

  it('is deterministic across calls', () => {
    const payload = { complex: { nested: { data: [1, 2, 3] } } }
    const hashes = Array.from({ length: 10 }, () => computePayloadHashSync(payload))
    expect(new Set(hashes).size).toBe(1) // All hashes should be identical
  })
})

describe('edge cases', () => {
  it('handles unicode content', async () => {
    const input = { emoji: '🚀', chinese: '中文', arabic: 'العربية' }
    const hash = await computePayloadHash(input)
    expect(hash).toHaveLength(12)
  })

  it('handles very large payloads', async () => {
    const largeArray = Array.from({ length: 1000 }, (_, i) => ({
      id: i,
      name: `item-${i}`,
      nested: { value: i * 2 },
    }))
    const input = { items: largeArray }
    const hash = await computePayloadHash(input)
    expect(hash).toHaveLength(12)
  })

  it('handles mixed types in arrays', () => {
    const input = { mixed: [1, 'two', null, { three: 3 }, [4, 5]] }
    const json = canonicalJson(input)
    expect(json).toBe('{"mixed":[1,"two",null,{"three":3},[4,5]]}')
  })

  it('handles number edge cases', () => {
    const input = { zero: 0, negative: -1, float: 3.14159, scientific: 1e10 }
    const json = canonicalJson(input)
    expect(json).toContain('"zero":0')
    expect(json).toContain('"negative":-1')
  })

  it('handles boolean values', () => {
    const input = { yes: true, no: false }
    const json = canonicalJson(input)
    expect(json).toBe('{"no":false,"yes":true}')
  })
})
