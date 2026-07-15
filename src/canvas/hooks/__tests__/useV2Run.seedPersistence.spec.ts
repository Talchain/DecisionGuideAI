/**
 * Seed persistence honesty (T2b) — the PERSISTED half of the #326 doctrine.
 *
 * PR #326 removed the `parseInt(...) || 0` fabrication from the READ path
 * (hydrateAnalysis.ts) and shipped as "receipts fail closed — no fabricated
 * Seed/Stable-edges values". But the WRITE path kept the exact same pattern:
 *
 *   const seedUsed = successResult.meta?.seed_used
 *     ? (parseInt(successResult.meta.seed_used, 10) || 0)
 *     : (seed ?? 0)
 *
 * That value has TWO sinks — the Supabase provenance record and the graph
 * hash. Because hydrateAnalysis PREFERS provenance (`provenance?.seed_used ??
 * ...`), a fabricated 0 written here comes back as a real-looking "Seed 0"
 * receipt after a reload, defeating #326 on its own target surface.
 *
 * `resolveSeedUsed` is the receipt: what seed did the ENGINE say it used?
 * Absence and malformed echoes are UNKNOWN (null), never 0. It mirrors
 * hydrateAnalysis.ts:111-115 (Number.parseInt + Number.isFinite) so the write
 * path and the read path agree about the same fact.
 *
 * Sibling pins:
 * - src/hooks/__tests__/hydrateAnalysis.spec.ts (the read path, #326)
 * - src/components/results/__tests__/receipts-fail-closed.spec.tsx (#326)
 * - src/components/results/__tests__/receipts-persistence-roundtrip.spec.tsx
 *   (the end-to-end reload pin this lane adds)
 */
import { describe, it, expect } from 'vitest'
import { resolveSeedUsed } from '../useV2Run'

describe('resolveSeedUsed — the engine seed receipt (T2b)', () => {
  it('a well-formed echo is the receipt', () => {
    expect(resolveSeedUsed('42')).toBe(42)
    expect(resolveSeedUsed('1337')).toBe(1337)
  })

  it('a REAL engine seed of 0 is an honest value — preserved, not confused with unknown', () => {
    // The whole point of failing closed: 0 must stay distinguishable from
    // "unknown". A string '0' is the conforming wire shape (V2Meta.seed_used
    // is declared `string`).
    expect(resolveSeedUsed('0')).toBe(0)
  })

  it('a real engine seed of 0 sent as a NUMBER is still preserved', () => {
    // The old code gated on truthiness, so a numeric 0 was FALSY and silently
    // fell through to the requested seed — reporting a seed the engine never
    // confirmed.
    expect(resolveSeedUsed(0)).toBe(0)
  })

  it('a MALFORMED echo is unknown → null, never a fabricated 0', () => {
    // This is the exact `parseInt('abc', 10) || 0` → 0 bug #326 removed from
    // the read path. NaN must become null, not 0.
    expect(resolveSeedUsed('abc')).toBeNull()
    expect(resolveSeedUsed('')).toBeNull()
    expect(resolveSeedUsed('   ')).toBeNull()
    expect(resolveSeedUsed({})).toBeNull()
  })

  it('NO echo is unknown → null, never a fabricated 0', () => {
    expect(resolveSeedUsed(undefined)).toBeNull()
    expect(resolveSeedUsed(null)).toBeNull()
  })

  it('never returns NaN — NaN would survive a `!= null` guard and render as "Seed NaN"', () => {
    for (const bad of ['abc', '', null, undefined, {}, []]) {
      const out = resolveSeedUsed(bad)
      expect(Number.isNaN(out as number)).toBe(false)
    }
  })

  it('does NOT fall back to the requested seed — an unconfirmed seed is not a receipt', () => {
    // useV2Run always has a requested seed in hand (it derives one at
    // useV2Run.ts:424-441, ending in a timestamp fallback), so the old
    // `: (seed ?? 0)` branch quietly recorded "the engine used X" whenever the
    // engine said nothing at all. The receipt must only ever report what the
    // engine actually echoed; the requested seed is a separate fact.
    expect(resolveSeedUsed(undefined)).toBeNull()
  })
})
