// tests/ci-guards/no-bundle-credentials.spec.ts
// =============================================================================
// Controls for scripts/ci/assert-no-bundle-credentials.mjs
// =============================================================================
//
// THE DEFECT PINNED. `src/lib/plotAuthHeaders.ts` read `VITE_PLOT_BEARER`. Vite
// replaces `import.meta.env.VITE_X` with the LITERAL at build time, so the emitted
// chunk was:
//
//     function c(){const c="<64-char secret>";return{Authorization:`Bearer ${c}`}}
//
// A live shared server-to-server credential, in a public asset, fetchable by any
// visitor. Measured at the deployed bytes on 2026-08-13.
//
// WHY EVERY EXISTING CHECK MISSED IT. The variable NAME is compiled away, so
// `grep VITE_PLOT_BEARER dist/` returns ZERO whether or not the secret is baked in —
// a confident false all-clear. `assert-bundle-env-allowlist.mjs` matches
// `VITE_NAME:"value"` pairs and so is structurally blind to the narrowed form; it
// even printed a 🚨 line about this exact credential on every run and then exited 0.
// A loud log that returns zero is not a gate.
//
// ⚠ THE CONTROL THAT MATTERS MOST IS THE CONTRAST ONE. A sentinel that matches
// EVERYTHING catches this credential too, and looks identical in CI until the day it
// blocks an innocent build and gets loosened into uselessness. The positive control
// proves it can see a presence; the contrast controls prove it is discriminating.
// Both are required — neither alone says anything about the other.
//
// The false positives below are not hypothetical. Each was MEASURED against a real
// 90-chunk production build and then fixed by DISCRIMINATION rather than by widening
// the excuse list.
// =============================================================================

import { describe, it, expect } from 'vitest'
import {
  scanChunk,
  scanChunks,
  isCredentialShaped,
  classifyJwt,
  precedingKey,
  shannonEntropy,
  redact,
  VacuousScanError,
} from '../../scripts/ci/assert-no-bundle-credentials.mjs'

/**
 * A synthetic 64-character hex string — shape-identical to the credential that
 * shipped, and to a SHA-256 digest. That ambiguity is deliberate: two tests below
 * depend on the same value being a violation under one key name and an allowed
 * content digest under another.
 */
const SYNTHETIC_SECRET = 'a7c31e9f04b8d62a5e1c7093fb4d8e26a9013c7f5b2e8d4a6c093f1b7e5a2d84'

/** Exactly the chunk Vite emitted for the real defect, with a synthetic value. */
const LEAKY_CHUNK = `function a(){const a="${SYNTHETIC_SECRET}";return{Authorization:\`Bearer \${a}\`}}export{a as p};`

/** base64url encode, no padding — how a JWT segment is written. */
const b64u = (obj: unknown) =>
  Buffer.from(JSON.stringify(obj)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

const jwt = (payload: unknown) =>
  `${b64u({ alg: 'HS256', typ: 'JWT' })}.${b64u(payload)}.c2lnbmF0dXJlLXN5bnRoZXRpYy1ub3QtcmVhbC1hYmNkZWY`

const ANON_JWT = jwt({ iss: 'supabase', ref: 'syntheticproj', role: 'anon', iat: 1700000000 })
const SERVICE_ROLE_JWT = jwt({ iss: 'supabase', ref: 'syntheticproj', role: 'service_role', iat: 1700000000 })

const violationsOf = (text: string, file = 'x.js') =>
  scanChunk({ file, text }).filter((f) => f.kind === 'violation')
const allowedOf = (text: string, file = 'x.js') =>
  scanChunk({ file, text }).filter((f) => f.kind === 'allowed')

// ═══════════════════════════════════════════════════════════════════════════════
describe('POSITIVE CONTROL — the sentinel catches the shape that actually shipped', () => {
  it('FAILS on a bare high-entropy literal beside a Bearer template', () => {
    const found = violationsOf(LEAKY_CHUNK)
    expect(found).toHaveLength(1)
    expect(found[0].id).toBe('high-entropy-literal-in-auth-context')
    expect(found[0].value).toBe(SYNTHETIC_SECRET)
  })

  it('catches it even though the VARIABLE NAME is absent — the whole point', () => {
    // This is what defeated every prior check. Assert the name really is gone, so
    // the test cannot pass for the wrong reason.
    expect(LEAKY_CHUNK).not.toContain('VITE_PLOT_BEARER')
    expect(violationsOf(LEAKY_CHUNK)).toHaveLength(1)
  })

  it('catches a secret next to `Authorization` without the word Bearer', () => {
    const chunk = `const h={Authorization:"${SYNTHETIC_SECRET}"};export{h};`
    expect(violationsOf(chunk)).toHaveLength(1)
  })

  it('catches a Supabase SERVICE_ROLE JWT anywhere, with no auth context needed', () => {
    const found = violationsOf(`const k="${SERVICE_ROLE_JWT}";export{k};`)
    expect(found).toHaveLength(1)
    expect(found[0].id).toBe('jwt')
    expect(found[0].reason).toMatch(/SERVICE_ROLE/i)
  })

  it.each([
    ['supabase secret key', 'sb_secret_9f3a1c7e5b2d8046af13c9e7'],
    ['openai key', 'sk-proj-A9f3K1c7E5b2D8046aF13c9E7x2Q8w'],
    ['github token', 'ghp_A9f3K1c7E5b2D8046aF13c9E7x2Q8w1Z4t'],
    ['aws access key id', 'AKIA9F3K1C7E5B2D8046'],
    // Exactly 39 characters — `AIza` + 35. The signature is length-exact on purpose;
    // my first fixture here was 40 and the test correctly failed.
    ['google api key', 'AIzaA9f3K1c7E5b2D8046aF13c9E7x2Q8w1Z4t7'],
    ['private key block', '-----BEGIN RSA PRIVATE KEY-----'],
  ])('catches a %s with no auth context', (_label, secret) => {
    expect(violationsOf(`const x="${secret}";`).length).toBeGreaterThan(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
describe('CONTRAST CONTROL — it is not simply matching everything', () => {
  it('passes a clean minified chunk', () => {
    expect(violationsOf('const a=1;function b(c){return c*2}export{b};')).toHaveLength(0)
  })

  it('passes an `Authorization` header NAME with no credential near it', () => {
    // The header name alone must not be a violation, or every fetch wrapper reds.
    const chunk = 'function f(t){return fetch(u,{headers:{Authorization:t,"Content-Type":"application/json"}})}'
    expect(violationsOf(chunk)).toHaveLength(0)
  })

  it('passes a long base64 data: URI that is NOWHERE near an auth marker', () => {
    const chunk = `const img="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk";export{img};`
    expect(violationsOf(chunk)).toHaveLength(0)
  })

  it('passes a long CSS/SVG path string', () => {
    const chunk = 'const d="M 10.5 20.25 L 30.75 40.5 C 50.25 60.75 70.5 80.25 90.75 100.5 Z";'
    expect(violationsOf(chunk)).toHaveLength(0)
  })

  it('MEASURED FALSE POSITIVE 1 — a snake_case identifier beside a REDACTION pattern', () => {
    // Real: clipboard-*.js holds a telemetry key list adjacent to the redaction
    // patterns /\bbearer\s+\S+/i and token|secret|password|authorization. The auth
    // context is satisfied by code whose entire job is to STRIP credentials.
    const chunk =
      'const keys=["has_results","scientific_validation_unavailable_count","bundle_size_bytes"],' +
      'pats=[/\\bbearer\\s+\\S+/i,/\\b(api[_-]?key|token|secret|password|authorization)\\s*[:=]/i];'
    expect(violationsOf(chunk)).toHaveLength(0)
  })

  it('MEASURED FALSE POSITIVE 2 — a SHA-256 content digest assigned to a digest-named key', () => {
    // Real: ReactFlowGraph-*.js carries `captureSha256:"<64 hex>"` for evidence
    // captures. A digest and a hex secret are BYTE-IDENTICAL; only the key name can
    // separate them, so the exemption is reported, never silent.
    const chunk = `const m={captureFile:"docs/evidence/x.json",captureSha256:"${SYNTHETIC_SECRET}",token:"t"};`
    expect(violationsOf(chunk)).toHaveLength(0)
    const allowed = allowedOf(chunk)
    expect(allowed).toHaveLength(1)
    expect(allowed[0].id).toBe('content-digest')
  })

  it('but the digest exemption is NARROW — the same value under a non-digest key still FAILS', () => {
    // The discriminating twin of the test above. Without this, "allow anything with
    // a key name" would pass the test above and gut the sentinel.
    const chunk = `const m={authToken:"${SYNTHETIC_SECRET}",Authorization:"x"};`
    expect(violationsOf(chunk)).toHaveLength(1)
  })

  it('passes a long camelCase identifier in the base64 alphabet', () => {
    const chunk = 'const AccessControlAllowOriginHeaderNameConstant="Authorization";'
    expect(violationsOf(chunk)).toHaveLength(0)
  })

  it('passes low-entropy padding beside an auth marker', () => {
    expect(violationsOf('const t="00000000000000000000000000000000000000";const h={Bearer:t};')).toHaveLength(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
describe('PUBLIC BY DESIGN — decided by the value, not by a list', () => {
  it('ALLOWS a Supabase anon JWT, and says why', () => {
    const chunk = `const k="${ANON_JWT}";export{k};`
    expect(violationsOf(chunk)).toHaveLength(0)
    const allowed = allowedOf(chunk)
    expect(allowed).toHaveLength(1)
    expect(allowed[0].reason).toMatch(/public by design/i)
  })

  it('THE DISCRIMINATING PAIR: same shape, opposite verdicts, from the role claim alone', () => {
    // The two tokens are byte-indistinguishable by shape, length and charset. Only
    // decoding separates them. This is why the anon key is NOT on an allow-list: a
    // list keyed on shape would have to admit both.
    expect(classifyJwt(ANON_JWT)).toBeNull()
    expect(classifyJwt(SERVICE_ROLE_JWT)).not.toBeNull()
  })

  it('an UNDECODABLE JWT fails — unknown is not safe', () => {
    expect(classifyJwt('eyJhbGciOiJIUzI1NiJ9.bm90LWpzb24tYXQtYWxs.c2ln')).toMatch(/could not be decoded|no `role`/)
  })

  it('a JWT with some OTHER role fails', () => {
    expect(classifyJwt(jwt({ role: 'admin' }))).toMatch(/role "admin"/)
  })

  it('ALLOWS sb_publishable_ but FAILS sb_secret_', () => {
    expect(violationsOf('const k="sb_publishable_9f3a1c7e5b2d8046af13c9e7";')).toHaveLength(0)
    expect(violationsOf('const k="sb_secret_9f3a1c7e5b2d8046af13c9e7";')).toHaveLength(1)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
describe('ANTI-VACUITY — an empty scan can never be reported as clean', () => {
  it('THROWS on zero files', () => {
    expect(() => scanChunks([])).toThrow(VacuousScanError)
    expect(() => scanChunks([])).toThrow(/ZERO files/)
  })

  it('THROWS on files totalling zero bytes', () => {
    expect(() => scanChunks([{ file: 'a.js', text: '' }])).toThrow(VacuousScanError)
    expect(() => scanChunks([{ file: 'a.js', text: '' }])).toThrow(/ZERO bytes/)
  })

  it('a non-empty clean scan returns cleanly (the throw is not unconditional)', () => {
    const r = scanChunks([{ file: 'a.js', text: 'const a=1;' }])
    expect(r.violations).toHaveLength(0)
    expect(r.bytes).toBeGreaterThan(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
describe('the discriminators, unit-level', () => {
  it('isCredentialShaped: accepts hex and base64 secrets', () => {
    expect(isCredentialShaped(SYNTHETIC_SECRET)).toBe(true)
    expect(isCredentialShaped('A9f3K1c7E5b2D8046aF13c9E7x2Q8w1Z4t7Yb')).toBe(true)
  })

  it('isCredentialShaped: rejects the measured false-positive shapes', () => {
    expect(isCredentialShaped('scientific_validation_unavailable_count')).toBe(false)
    expect(isCredentialShaped('AccessControlAllowOriginHeaderName')).toBe(false)
    expect(isCredentialShaped('0000000000000000000000000000000000')).toBe(false)
    expect(isCredentialShaped('short')).toBe(false)
    expect(isCredentialShaped('a value with spaces in it that is quite long')).toBe(false)
  })

  it('precedingKey: reads the property name a literal is assigned to', () => {
    // The index is that of the OPENING QUOTE, matching how scanChunk calls it.
    const t = 'const m={captureSha256:"abc"};'
    expect(precedingKey(t, t.indexOf('"abc"'))).toBe('captureSha256')
    const q = 'const m={"x-digest":"abc"};'
    expect(precedingKey(q, q.indexOf('"abc"'))).toBe('x-digest')
    // Not a property assignment — a bare `const a = "..."` has no key.
    const bare = 'const a="abc"'
    expect(precedingKey(bare, bare.indexOf('"abc"'))).toBeNull()
  })

  it('shannonEntropy: random hex scores high, repetition scores ~0', () => {
    expect(shannonEntropy(SYNTHETIC_SECRET)).toBeGreaterThan(3.2)
    expect(shannonEntropy('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')).toBe(0)
  })

  it('redact: NEVER returns the value — a guard must not publish what it found', () => {
    const out = redact(SYNTHETIC_SECRET)
    expect(out).not.toContain(SYNTHETIC_SECRET)
    expect(out).toMatch(/^<64 chars, sha256:[0-9a-f]{8}>$/)
  })
})
