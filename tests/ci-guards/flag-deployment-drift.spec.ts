// tests/ci-guards/flag-deployment-drift.spec.ts
// =============================================================================
// Anti-vacuity spec for tools/ci-guards/flag-deployment-drift.mjs
// =============================================================================
//
// This guard's whole value is that it CANNOT quietly report green. Two failure
// modes would destroy it, and both are pinned here by tests that a mutant fails:
//
//   MUTANT A — `deriveDeclaredFlags` returns `[]`.
//              An empty declared set can diverge from nothing, so every run
//              would report "no divergences" forever. Pinned by the FLOOR
//              assertions below.
//
//   MUTANT B — `extractDeployedEnv` returns `{}`.
//              A bundle whose env could not be read would look identical to a
//              bundle with no overrides — the exact "unreachable check reports
//              green" defect this guard exists to close. Pinned by the THROWS
//              assertions below.
//
// No network is used. The unreachable-deploy path is exercised against a closed
// local port, so it is deterministic and offline.
// =============================================================================

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  deriveDeclaredFlags,
  parseNetlifyEnv,
  extractDeployedEnv,
  computeDivergences,
  coerceFlagValue,
  renderTable,
  run,
  VERDICT,
  DeployUnreachableError,
} from '../../tools/ci-guards/flag-deployment-drift.mjs'

const ROOT = process.cwd()
const flagsSource = readFileSync(path.join(ROOT, 'src/flags.ts'), 'utf8')
const netlifySource = readFileSync(path.join(ROOT, 'netlify.toml'), 'utf8')

// A realistic slice of what Vite bakes into the served flags chunk: the
// `{ ...import.meta.env }` replacement, minified, with `!0`/`!1` booleans.
const BAKED_ENV_FIXTURE =
  'const e={BASE_URL:"/",DEV:!1,MODE:"production",PROD:!0,SSR:!1,' +
  'VITE_APP_ENV:"staging",VITE_FEATURE_COMPARE_TAB:"1",VITE_V5_CANONICAL_ANALYSIS:"true",' +
  'VITE_FEATURE_ORCHESTRATOR_STREAMING:"false",VITE_SOMETHING_ODD:"maybe",VITE_BOOLY:!0};' +
  'const c={envKey:"VITE_V5_CANONICAL_ANALYSIS",storageKey:"feature.v5CanonicalAnalysis"};'

describe('deriveDeclaredFlags — derived, never a hand-listed array', () => {
  const { flags, unparseable } = deriveDeclaredFlags(flagsSource, 'src/flags.ts')

  // ── MUTANT A FLOOR ────────────────────────────────────────────────────────
  // Make the derivation return [] and these fail. Without them an empty
  // declared set would sail through as "no divergences".
  it('derives a NON-EMPTY declared set from the real src/flags.ts', () => {
    expect(flags.length).toBeGreaterThan(0)
  })

  it('derives at least 50 flags — a collapsed walker cannot pass as a clean run', () => {
    // Floor, not an exact count: adding a flag must never red this.
    expect(flags.length).toBeGreaterThanOrEqual(50)
  })

  it('finds the three flags proven dashboard-set on staging (2026-07-28)', () => {
    const keys = flags.map((f) => f.envKey)
    expect(keys).toContain('VITE_V5_CANONICAL_ANALYSIS')
    expect(keys).toContain('VITE_FEATURE_COMPARE_TAB')
    expect(keys).toContain('VITE_FEATURE_PRE_ANALYSIS_V3')
  })

  it('reads defaultValue as a real boolean, defaulting to false', () => {
    const v5 = flags.find((f) => f.envKey === 'VITE_V5_CANONICAL_ANALYSIS')!
    expect(v5.defaultValue).toBe(false)
    // At least one flag declares an explicit `defaultValue: true`, so the
    // reader is proven to distinguish the two rather than always answering false.
    expect(flags.some((f) => f.defaultValue === true)).toBe(true)
  })

  it('every derived flag carries a non-empty envKey', () => {
    for (const f of flags) expect(f.envKey, `flag ${f.name}`).toMatch(/^VITE_[A-Z0-9_]+$/)
  })

  it('parses the real src/flags.ts with ZERO unparseable declarations', () => {
    expect(unparseable).toEqual([])
  })
})

describe('deriveDeclaredFlags — FAILS LOUD rather than silently omitting', () => {
  it('throws when FLAGS_CONFIG is absent entirely', () => {
    expect(() => deriveDeclaredFlags('export const nope = 1', 'x.ts')).toThrow(/FLAGS_CONFIG/)
  })

  it('throws when FLAGS_CONFIG is not an object literal', () => {
    expect(() => deriveDeclaredFlags('const FLAGS_CONFIG = buildFlags()', 'x.ts')).toThrow(/not an object literal/)
  })

  it('reports a spread declaration as UNPARSEABLE instead of dropping it', () => {
    const { flags, unparseable } = deriveDeclaredFlags(
      `const FLAGS_CONFIG = { ...OTHER, a: { envKey: 'VITE_A', storageKey: 's' } } as const`, 'x.ts')
    expect(flags.map((f) => f.envKey)).toEqual(['VITE_A'])
    expect(unparseable).toHaveLength(1)
    expect(unparseable[0].reason).toMatch(/unsupported property kind/)
  })

  it('reports a computed envKey as UNPARSEABLE instead of dropping it', () => {
    const { flags, unparseable } = deriveDeclaredFlags(
      `const FLAGS_CONFIG = { a: { envKey: PREFIX + 'A', storageKey: 's' } } as const`, 'x.ts')
    expect(flags).toEqual([])
    expect(unparseable).toHaveLength(1)
    expect(unparseable[0].reason).toMatch(/envKey is .*expected a string literal/)
  })

  it('reports a non-literal defaultValue as UNPARSEABLE instead of guessing false', () => {
    const { unparseable } = deriveDeclaredFlags(
      `const FLAGS_CONFIG = { a: { envKey: 'VITE_A', storageKey: 's', defaultValue: isProd() } } as const`, 'x.ts')
    expect(unparseable).toHaveLength(1)
    expect(unparseable[0].reason).toMatch(/defaultValue is .*expected a boolean literal/)
  })

  it('unwraps `as const` so the real declaration form is readable', () => {
    const { flags } = deriveDeclaredFlags(
      `const FLAGS_CONFIG = { a: { envKey: 'VITE_A', storageKey: 's' } } as const`, 'x.ts')
    expect(flags).toEqual([{ name: 'a', envKey: 'VITE_A', storageKey: 's', defaultValue: false }])
  })
})

describe('extractDeployedEnv — MUTANT B: never returns an empty map quietly', () => {
  it('extracts the baked VITE_* values from a Vite env object', () => {
    const env = extractDeployedEnv(BAKED_ENV_FIXTURE)
    expect(env.VITE_FEATURE_COMPARE_TAB).toBe('1')
    expect(env.VITE_V5_CANONICAL_ANALYSIS).toBe('true')
    expect(env.VITE_FEATURE_ORCHESTRATOR_STREAMING).toBe('false')
    expect(env.VITE_BOOLY).toBe('true') // `!0` is Vite's minified `true`
  })

  it('does NOT mistake a flag CONFIG literal for a baked env value', () => {
    // `{envKey:"VITE_V5_CANONICAL_ANALYSIS"}` must not become an env entry.
    const env = extractDeployedEnv(BAKED_ENV_FIXTURE)
    expect(env.envKey).toBeUndefined()
    expect(Object.keys(env).every((k) => k.startsWith('VITE_'))).toBe(true)
  })

  // ── MUTANT B PIN ──────────────────────────────────────────────────────────
  // Make extraction return {} and these fail. The failure mode they forbid is
  // "read nothing, report no divergences".
  it('THROWS when the chunk contains no Vite env object at all', () => {
    expect(() => extractDeployedEnv('console.log("hello")', { sourceLabel: 'stub.js' }))
      .toThrow(DeployUnreachableError)
    expect(() => extractDeployedEnv('console.log("hello")', { sourceLabel: 'stub.js' }))
      .toThrow(/No Vite import\.meta\.env object found/)
  })

  it('THROWS when an env object is found but carries ZERO VITE_* keys', () => {
    expect(() => extractDeployedEnv('const e={BASE_URL:"/",MODE:"production",PROD:!0};'))
      .toThrow(/ZERO VITE_\* keys/)
  })

  it('never returns an empty object — the only empty outcome is a throw', () => {
    for (const input of ['', 'var x=1', '{}', 'const e={BASE_URL:"/"};']) {
      let result: unknown = null
      try { result = extractDeployedEnv(input) } catch { result = 'threw' }
      expect(result === 'threw' || Object.keys(result as object).length > 0).toBe(true)
    }
  })
})

describe('parseNetlifyEnv — reads the real netlify.toml', () => {
  const parsed = parseNetlifyEnv(netlifySource)

  it('separates the build context from the staging context', () => {
    expect(Object.keys(parsed.build).length).toBeGreaterThan(0)
    expect(Object.keys(parsed.staging).length).toBeGreaterThan(0)
    expect(parsed.staging.VITE_APP_ENV).toBe('staging')
  })

  it('ignores comments and unrelated sections', () => {
    const t = `# lead\n[build.environment]\n  A = "1" # trailing\n[[headers]]\n  B = "2"\n[context.staging.environment]\n  C = "3"\n`
    const p = parseNetlifyEnv(t)
    expect(p.build).toEqual({ A: '1' })
    expect(p.staging).toEqual({ C: '3' })
  })

  it('records the three dashboard-set flags verified on staging 2026-07-28', () => {
    // These were set ONLY in the Netlify dashboard until this change. Pinning
    // them here means deleting the netlify.toml record reds this spec rather
    // than silently restoring the "repo says OFF, deploy says ON" trap.
    expect(parsed.staging.VITE_V5_CANONICAL_ANALYSIS).toBe('true')
    expect(parsed.staging.VITE_FEATURE_COMPARE_TAB).toBe('1')
    expect(parsed.staging.VITE_FEATURE_PRE_ANALYSIS_V3).toBe('1')
  })
})

describe('coerceFlagValue — mirrors flagFactory.makeFlag exactly', () => {
  it('accepts the truthy and falsy forms flagFactory accepts', () => {
    for (const v of ['1', 1, true, 'true']) expect(coerceFlagValue(v)).toBe(true)
    for (const v of ['0', 0, false, 'false']) expect(coerceFlagValue(v)).toBe(false)
  })
  it('returns null for anything flagFactory would ignore', () => {
    for (const v of ['yes', '', 'TRUE', 2, null, undefined]) expect(coerceFlagValue(v)).toBeNull()
  })
})

describe('computeDivergences', () => {
  const declared = [
    { name: 'v5CanonicalAnalysis', envKey: 'VITE_V5_CANONICAL_ANALYSIS', storageKey: 's1', defaultValue: false },
    { name: 'recorded', envKey: 'VITE_RECORDED', storageKey: 's2', defaultValue: false },
    { name: 'untouched', envKey: 'VITE_UNTOUCHED', storageKey: 's3', defaultValue: false },
    { name: 'defaultOn', envKey: 'VITE_DEFAULT_ON', storageKey: 's4', defaultValue: true },
  ]

  it('flags a dashboard-set ON flag whose repo default is OFF (the real 28 Jul defect)', () => {
    const { divergences } = computeDivergences({
      declared,
      netlify: { build: {}, staging: {} },
      deployed: { VITE_V5_CANONICAL_ANALYSIS: 'true' },
    })
    const d = divergences.find((r) => r.envKey === 'VITE_V5_CANONICAL_ANALYSIS')!
    expect(d.verdict).toBe(VERDICT.DASHBOARD)
    expect(d.repoExpected).toBe(false)
    expect(d.deployEffective).toBe(true)
    expect(d.dashboardOnly).toBe(true)
  })

  it('reports OK once the same value is recorded in netlify.toml', () => {
    const { divergences } = computeDivergences({
      declared,
      netlify: { build: {}, staging: { VITE_V5_CANONICAL_ANALYSIS: 'true' } },
      deployed: { VITE_V5_CANONICAL_ANALYSIS: 'true' },
    })
    expect(divergences.find((r) => r.envKey === 'VITE_V5_CANONICAL_ANALYSIS')).toBeUndefined()
  })

  it('catches the INVERSE too: a default-ON flag turned OFF by the dashboard', () => {
    const { divergences } = computeDivergences({
      declared, netlify: { build: {}, staging: {} }, deployed: { VITE_DEFAULT_ON: 'false' },
    })
    const d = divergences.find((r) => r.envKey === 'VITE_DEFAULT_ON')!
    expect(d.verdict).toBe(VERDICT.DASHBOARD)
    expect(d.repoExpected).toBe(true)
    expect(d.deployEffective).toBe(false)
  })

  it('lets the staging context override [build.environment], as Netlify does', () => {
    const { rows } = computeDivergences({
      declared,
      netlify: { build: { VITE_RECORDED: '0' }, staging: { VITE_RECORDED: '1' } },
      deployed: { VITE_RECORDED: '1' },
    })
    const r = rows.find((x) => x.envKey === 'VITE_RECORDED')!
    expect(r.repoSource).toBe('netlify.toml[staging]')
    expect(r.verdict).toBe(VERDICT.OK)
  })

  it('treats a flag absent from the deploy as resolving to its compiled default', () => {
    const { rows } = computeDivergences({ declared, netlify: { build: {}, staging: {} }, deployed: { VITE_OTHER: '1' } })
    const r = rows.find((x) => x.envKey === 'VITE_UNTOUCHED')!
    expect(r.deployedPresent).toBe(false)
    expect(r.deployEffective).toBe(false)
    expect(r.verdict).toBe(VERDICT.OK)
  })

  it('marks a non-boolean deployed value NON-BOOLEAN and redacts it', () => {
    const { rows } = computeDivergences({
      declared, netlify: { build: {}, staging: {} }, deployed: { VITE_UNTOUCHED: 'sometimes' },
    })
    const r = rows.find((x) => x.envKey === 'VITE_UNTOUCHED')!
    expect(r.verdict).toBe(VERDICT.NONBOOL)
    expect(r.deployedRaw).toBe('<non-boolean:redacted>')
  })

  it('lists undeclared deployed keys by NAME ONLY — they may be credentials', () => {
    const { undeclaredInDeploy, rows } = computeDivergences({
      declared, netlify: { build: {}, staging: {} },
      deployed: { VITE_PLOT_BEARER: 'super-secret-token', VITE_UNTOUCHED: '0' },
    })
    expect(undeclaredInDeploy).toContain('VITE_PLOT_BEARER')
    // The secret's VALUE must appear nowhere in the structured output.
    expect(JSON.stringify({ undeclaredInDeploy, rows })).not.toContain('super-secret-token')
  })

  it('renderTable never prints an undeclared key\'s value', () => {
    const { rows } = computeDivergences({
      declared, netlify: { build: {}, staging: {} },
      deployed: { VITE_PLOT_BEARER: 'super-secret-token', VITE_V5_CANONICAL_ANALYSIS: 'true' },
    })
    const table = renderTable(rows)
    expect(table).not.toContain('super-secret-token')
    expect(table).toContain('VITE_V5_CANONICAL_ANALYSIS')
  })
})

describe('posture — reports, and refuses to fake a green', () => {
  it('an UNREACHABLE deploy exits 0 but reports UNVERIFIED, never "no divergences"', async () => {
    const out: string[] = []
    const errOut: string[] = []
    // Closed local port: deterministic connection refusal, no external network.
    const code = await run(['--url=http://127.0.0.1:1'], {
      cwd: ROOT, log: (m: string) => out.push(String(m)), err: (m: string) => errOut.push(String(m)),
    })
    const all = [...out, ...errOut].join('\n')

    expect(code).toBe(0)                       // non-blocking posture
    expect(all).toContain('UNVERIFIED')
    expect(all).toMatch(/could not be read|Could not fetch/i)
    expect(all).not.toContain('No divergences')  // the defect this closes
    expect(all).not.toContain('✅')
  }, 30000)

  it('an unreachable deploy names every flag it could NOT verify', async () => {
    const lines: string[] = []
    await run(['--url=http://127.0.0.1:1', '--json'], {
      cwd: ROOT, log: (m: string) => lines.push(String(m)), err: () => {},
    })
    const payload = JSON.parse(lines.join('\n'))
    expect(payload.status).toBe('UNVERIFIED')
    expect(payload.verifiedFlags).toEqual([])
    expect(payload.unverifiedFlags.length).toBe(payload.declaredCount)
    expect(payload.unverifiedFlags).toContain('VITE_V5_CANONICAL_ANALYSIS')
  }, 30000)
})
