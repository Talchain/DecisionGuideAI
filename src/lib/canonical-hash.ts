/**
 * Canonical Payload Hashing Utility
 *
 * Provides deterministic JSON serialization and SHA-256 hashing for request payloads.
 * Used for cross-service tracing — enables matching requests across UI, BFF, and backend
 * via the `x-olumi-payload-hash` header.
 *
 * Key properties:
 * - Keys sorted alphabetically at every nesting level
 * - `undefined` values are omitted (JSON standard)
 * - `null` values are preserved
 * - Arrays preserve element order
 * - Deterministic output for identical logical payloads
 *
 * @example
 * ```typescript
 * import { computePayloadHash, canonicalJson } from '@/lib/canonical-hash'
 *
 * const payload = { z: 1, a: 2, nested: { b: 3, a: 4 } }
 * const hash = await computePayloadHash(payload) // "a1b2c3d4e5f6"
 * const json = canonicalJson(payload) // '{"a":2,"nested":{"a":4,"b":3},"z":1}'
 * ```
 */

/**
 * Recursively canonicalise a value for deterministic JSON serialization.
 * - Objects: keys sorted alphabetically, undefined values omitted
 * - Arrays: elements canonicalised, order preserved
 * - Primitives: returned as-is (null, string, number, boolean)
 * - Special types: Date → ISO string, Map → sorted entries, Set → sorted array
 *
 * @param value - Any JSON-serializable value
 * @returns Canonicalised value ready for JSON.stringify
 */
export function canonicalise(value: unknown): unknown {
  // Handle null explicitly (typeof null === 'object')
  if (value === null) {
    return null
  }

  // Handle arrays — preserve order, canonicalise elements
  if (Array.isArray(value)) {
    return value.map(canonicalise)
  }

  // Handle objects — check for special types first
  if (typeof value === 'object') {
    // Date — use toJSON() for ISO string representation
    if (value instanceof Date) {
      return value.toJSON()
    }

    // Map — convert to sorted array of [key, value] entries
    if (value instanceof Map) {
      const entries = Array.from(value.entries())
        .map(([k, v]) => [canonicalise(k), canonicalise(v)])
        .sort((a, b) => {
          const aKey = JSON.stringify(a[0])
          const bKey = JSON.stringify(b[0])
          return aKey.localeCompare(bKey)
        })
      return { __type: 'Map', entries }
    }

    // Set — convert to sorted array
    if (value instanceof Set) {
      const items = Array.from(value.values())
        .map(canonicalise)
        .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
      return { __type: 'Set', items }
    }

    // RegExp — convert to string representation
    if (value instanceof RegExp) {
      return { __type: 'RegExp', source: value.source, flags: value.flags }
    }

    // Error — extract message and name
    if (value instanceof Error) {
      return { __type: 'Error', name: value.name, message: value.message }
    }

    // Plain object — sort keys, omit undefined, canonicalise values.
    //
    // The accumulator is a null-prototype object (`Object.create(null)`), NOT
    // a plain `{}` — mirroring CEE's hardened canonicalizeJson/stableStringify.
    // `JSON.parse` of wire JSON yields an OWN enumerable `__proto__` key when
    // the payload contains one, and `Object.keys` enumerates it; on a plain
    // object `acc['__proto__'] = …` hits the inherited accessor's setter and
    // the key silently vanishes, so two payloads differing only in `__proto__`
    // would hash identically (a hash collision). A null-prototype accumulator
    // has no such setter, so `__proto__` round-trips as a normal own property.
    // Output is byte-identical to the previous behaviour for every payload
    // without an own `__proto__` key.
    const obj = value as Record<string, unknown>
    const sortedKeys = Object.keys(obj).sort()

    return sortedKeys.reduce<Record<string, unknown>>((acc, key) => {
      const v = obj[key]
      // Omit undefined values (JSON.stringify does this anyway, but explicit is clearer)
      if (v !== undefined) {
        acc[key] = canonicalise(v)
      }
      return acc
    }, Object.create(null) as Record<string, unknown>)
  }

  // Primitives (string, number, boolean) — return as-is
  return value
}

/**
 * Convert a value to canonical JSON string.
 * Deterministic output regardless of original key order.
 *
 * @param payload - Any JSON-serializable value
 * @returns Canonical JSON string
 *
 * @example
 * ```typescript
 * canonicalJson({ z: 1, a: 2 }) // '{"a":2,"z":1}'
 * canonicalJson({ outer: { z: 1, a: 2 } }) // '{"outer":{"a":2,"z":1}}'
 * ```
 */
export function canonicalJson(payload: unknown): string {
  return JSON.stringify(canonicalise(payload))
}

/**
 * Compute a 12-character SHA-256 hash of a payload's canonical JSON.
 * Uses Web Crypto API (browser-native, no dependencies).
 *
 * @param payload - Any JSON-serializable value
 * @returns Promise resolving to 12-character hex hash (first 48 bits of SHA-256)
 *
 * @example
 * ```typescript
 * const hash = await computePayloadHash({ z: 1, a: 2, m: 3 })
 * // Returns: "8f14e45fceea" (deterministic for this payload)
 * ```
 */
export async function computePayloadHash(payload: unknown): Promise<string> {
  const canonical = canonicalJson(payload)
  const encoder = new TextEncoder()
  const data = encoder.encode(canonical)

  // Use Web Crypto API for SHA-256
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))

  // Convert to hex and take first 12 characters (48 bits)
  const fullHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
  return fullHex.slice(0, 12)
}

/**
 * Synchronous hash computation using a simple hash function.
 * Use this when async is not practical (e.g., in synchronous code paths).
 * Less cryptographically secure than SHA-256 but deterministic.
 *
 * @param payload - Any JSON-serializable value
 * @returns 12-character hex hash
 */
export function computePayloadHashSync(payload: unknown): string {
  const canonical = canonicalJson(payload)

  // Simple FNV-1a hash (32-bit, then extend to 48-bit with second pass)
  let h1 = 2166136261
  let h2 = 2166136261

  for (let i = 0; i < canonical.length; i++) {
    const char = canonical.charCodeAt(i)
    h1 ^= char
    h1 = Math.imul(h1, 16777619)
    // Second hash with different seed for more bits
    h2 ^= char
    h2 = Math.imul(h2, 16777259)
  }

  // Convert to unsigned 32-bit and then to hex
  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0')
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0')

  // Take first 12 chars from combined hashes
  return (hex1 + hex2).slice(0, 12)
}
