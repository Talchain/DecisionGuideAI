// tests/ci-guards/bundle-env-allowlist.spec.ts
// =============================================================================
// Anti-vacuity spec for scripts/ci/assert-bundle-env-allowlist.mjs
// =============================================================================
//
// The guard asserts an ABSENCE ("no VITE_* key outside the allow-list is baked
// into the bundle"). CLAUDE.md trap 13: an absence assertion is worthless until
// it has proved it can see a PRESENCE. Three ways this guard could quietly
// report green, each pinned by a test a mutant fails:
//
//   MUTANT A — `extractBakedKeys` returns an empty set.
//              Nothing to compare, so every bundle passes forever.
//              Pinned by the THROWS tests.
//
//   MUTANT B — `deriveExplainedKeys` returns everything (e.g. comments count as
//              reads). Then a wholesale inline is "explained" and sails through.
//              Pinned by the stripComments tests.
//
//   MUTANT C — `computeVerdict` never reports a violation.
//              Pinned by the POSITIVE CONTROL: a synthetic chunk carrying a real
//              Vite full-env object MUST be caught.
//
// No build and no network is required — the controls are synthetic fixtures.
// =============================================================================

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  extractBakedKeys,
  deriveExplainedKeys,
  computeVerdict,
  stripComments,
  VacuousScanError,
  ALLOWLIST_PATH,
  ROOT,
} from '../../scripts/ci/assert-bundle-env-allowlist.mjs'

/**
 * What Vite actually emits for a wholesale inline, minified: an env object with
 * the BASE_URL/MODE/PROD markers and every VITE_* the deploy defined, `!0`/`!1`
 * for booleans. This is the shape the guard exists to catch.
 */
const WHOLESALE_INLINE_CHUNK =
  'const P={BASE_URL:"/",DEV:!1,MODE:"production",PROD:!0,SSR:!1,' +
  'VITE_APP_ENV:"staging",VITE_FEATURE_SSE:"1",VITE_PLOT_BEARER:"a-token-value",' +
  'VITE_SUPABASE_ANON_KEY:"anon",VITE_NOBODY_READS_THIS:"leaked"};' +
  'const q=P?.VITE_FEATURE_COMPARE_DEBUG;'

/** A correctly-narrowed chunk: one named value, no env object. */
const NARROWED_CHUNK = 'function r(){const t="1";return{enabled:t==="1"}}'

describe('extractBakedKeys — MUTANT A: never returns an empty set quietly', () => {
  it('extracts the VITE_* keys from a wholesale-inline chunk', () => {
    const { all } = extractBakedKeys([{ file: 'x.js', text: WHOLESALE_INLINE_CHUNK }])
    expect(all.has('VITE_PLOT_BEARER')).toBe(true)
    expect(all.has('VITE_NOBODY_READS_THIS')).toBe(true)
    expect(all.has('VITE_APP_ENV')).toBe(true)
  })

  it('does NOT treat a VITE_ name in VALUE position as a baked key', () => {
    // `{envKey:"VITE_FEATURE_SSE"}` is a flag CONFIG, not a baked env entry.
    const { all } = extractBakedKeys([
      { file: 'x.js', text: 'const c={envKey:"VITE_FEATURE_SSE",storageKey:"s"};const e={VITE_REAL:"1"};' },
    ])
    expect(all.has('VITE_FEATURE_SSE')).toBe(false)
    expect(all.has('VITE_REAL')).toBe(true)
  })

  it('THROWS when there are no chunks at all', () => {
    expect(() => extractBakedKeys([])).toThrow(VacuousScanError)
    expect(() => extractBakedKeys([])).toThrow(/ZERO \.js chunks/)
  })

  it('THROWS when chunks exist but carry ZERO baked VITE_* values', () => {
    expect(() => extractBakedKeys([{ file: 'a.js', text: 'console.log(1)' }])).toThrow(VacuousScanError)
    expect(() => extractBakedKeys([{ file: 'a.js', text: 'console.log(1)' }])).toThrow(/ZERO baked VITE_\*/)
  })

  it('never returns an empty set — the only empty outcome is a throw', () => {
    for (const text of ['', 'var x=1', '{}', 'const e={BASE_URL:"/"};']) {
      let result: unknown = null
      try {
        result = extractBakedKeys([{ file: 'a.js', text }]).all
      } catch {
        result = 'threw'
      }
      expect(result === 'threw' || (result as Set<string>).size > 0).toBe(true)
    }
  })
})

describe('stripComments — MUTANT B: a comment must not count as a read', () => {
  it('removes a line comment that merely NAMES a variable', () => {
    const src = '// we deliberately never read import.meta.env.VITE_SECRET here\nconst a=1'
    expect(stripComments(src)).not.toContain('VITE_SECRET')
  })

  it('removes a block/JSDoc comment that names a variable', () => {
    const src = '/**\n * ⚠ do not read import.meta.env.VITE_SECRET\n */\nconst a=1'
    expect(stripComments(src)).not.toContain('VITE_SECRET')
  })

  it('KEEPS a real read — stripping must not remove live code', () => {
    const src = 'const t = import.meta.env?.VITE_REAL_READ\n// import.meta.env.VITE_COMMENTED'
    const out = stripComments(src)
    expect(out).toContain('VITE_REAL_READ')
    expect(out).not.toContain('VITE_COMMENTED')
  })

  it('does not mangle a URL containing //', () => {
    expect(stripComments('const u="https://example.test/x"')).toContain('https://example.test/x')
  })
})

describe('computeVerdict — MUTANT C: the POSITIVE CONTROL', () => {
  it('CATCHES a wholesale inline: keys baked but read nowhere', () => {
    const { all } = extractBakedKeys([{ file: 'x.js', text: WHOLESALE_INLINE_CHUNK }])
    // Source reads only ONE of them — the classic wholesale-inline signature.
    const explained = new Set(['VITE_FEATURE_SSE'])
    const { unexplained } = computeVerdict({ baked: all, explained, allowed: new Set(all) })
    expect(unexplained).toContain('VITE_NOBODY_READS_THIS')
    expect(unexplained).toContain('VITE_PLOT_BEARER')
    expect(unexplained.length).toBeGreaterThan(0)
  })

  it('PASSES a correctly-narrowed bundle where every baked key is read', () => {
    const baked = new Set(['VITE_FEATURE_SSE', 'VITE_APP_ENV'])
    const explained = new Set(['VITE_FEATURE_SSE', 'VITE_APP_ENV', 'VITE_UNUSED_BUT_READ'])
    const { unexplained, undeclared } = computeVerdict({ baked, explained, allowed: explained })
    expect(unexplained).toEqual([])
    expect(undeclared).toEqual([])
  })

  it('CATCHES an undeclared key even when it IS read (the classify-me gate)', () => {
    const baked = new Set(['VITE_BRAND_NEW_TOKEN'])
    const explained = new Set(['VITE_BRAND_NEW_TOKEN']) // someone added a read
    const allowed = new Set(['VITE_APP_ENV']) // but never classified it
    const { unexplained, undeclared } = computeVerdict({ baked, explained, allowed })
    expect(unexplained).toEqual([])
    expect(undeclared).toEqual(['VITE_BRAND_NEW_TOKEN'])
  })

  it('a narrowed chunk carries no env object at all', () => {
    expect(() => extractBakedKeys([{ file: 'n.js', text: NARROWED_CHUNK }])).toThrow(VacuousScanError)
  })
})

describe('derivation against the REAL repo — floors, not exact counts', () => {
  const derived = deriveExplainedKeys({
    srcDir: path.join(ROOT, 'src'),
    flagEnvPath: path.join(ROOT, 'src/lib/flagEnv.ts'),
  })

  it('derives a NON-EMPTY flag-env key set from the real generated file', () => {
    // Floor: adding or removing a flag must not red this.
    expect(derived.flagEnvKeys.size).toBeGreaterThanOrEqual(50)
  })

  it('derives real literal reads from src/ — including the bearer, which IS read', () => {
    expect(derived.readInSource.has('VITE_PLOT_BEARER')).toBe(true)
    expect(derived.readInSource.size).toBeGreaterThanOrEqual(30)
  })

  it('THROWS rather than returning empty when flagEnv cannot be read', () => {
    expect(() =>
      deriveExplainedKeys({
        srcDir: path.join(ROOT, 'src'),
        flagEnvPath: path.join(ROOT, 'src/lib/does-not-exist.ts'),
      }),
    ).toThrow(VacuousScanError)
  })
})

describe('the declared allow-list file', () => {
  const declared = JSON.parse(readFileSync(ALLOWLIST_PATH, 'utf8'))

  it('parses and declares a non-empty allowed list', () => {
    expect(Array.isArray(declared.allowed)).toBe(true)
    expect(declared.allowed.length).toBeGreaterThan(0)
  })

  it('every allowed entry is a VITE_ name, never a value', () => {
    for (const k of declared.allowed) expect(k).toMatch(/^VITE_[A-Z0-9_]+$/)
  })

  it('never contains a credential VALUE — only names', () => {
    const blob = JSON.stringify(declared)
    // A 64-char hex/base64-ish run would be a token. There must be none.
    expect(blob).not.toMatch(/[A-Za-z0-9_-]{48,}/)
  })

  it('records VITE_PLOT_BEARER as knownExposed, so the residual risk stays visible', () => {
    expect(Object.keys(declared.knownExposed ?? {})).toContain('VITE_PLOT_BEARER')
  })

  it('does NOT put VITE_PLOT_BEARER in `allowed` — it is tracked, not blessed', () => {
    expect(declared.allowed).not.toContain('VITE_PLOT_BEARER')
  })
})
